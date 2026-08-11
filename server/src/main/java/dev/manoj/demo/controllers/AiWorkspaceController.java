package dev.manoj.demo.controllers;

import dev.manoj.demo.dto.AiActionDto;
import dev.manoj.demo.dto.CreateFileNodeDto;
import dev.manoj.demo.dto.UpdateCodeDto;
import dev.manoj.demo.enums.FileType;
import dev.manoj.demo.model.FileNode;
import dev.manoj.demo.service.WorkSpaceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Executes confirmed AI workspace actions.
 *
 * This endpoint is only called AFTER the user has reviewed and approved
 * an ACTION response from /api/ai/chat. The frontend sends the action
 * payload here to actually execute it.
 *
 * Security: All IDs are re-validated server-side regardless of what the AI returned.
 */
import dev.manoj.demo.websocket.RoomWebSocketHandler;


@RestController
@RequestMapping("/api/ai/workspace-action")
public class AiWorkspaceController {

    private final WorkSpaceService workSpaceService;
    private final RoomWebSocketHandler wsHandler;

    public AiWorkspaceController(WorkSpaceService workSpaceService, RoomWebSocketHandler wsHandler) {
        this.workSpaceService = workSpaceService;
        this.wsHandler = wsHandler;
    }

    /**
     * Execute a confirmed AI action.
     *
     * Expected body: { "action": {...}, "roomId": "..." }
     * Returns: { "fileId": "...", "fileName": "..." } for CREATE_FILE
     *          { "fileId": "...", "message": "updated" } for UPDATE_FILE
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> execute(
            @RequestBody ExecuteActionRequest request,
            Authentication auth) {

        UUID userId = (UUID) auth.getPrincipal();
        UUID roomId;
        try {
            roomId = UUID.fromString(request.getRoomId());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid roomId"));
        }

        AiActionDto action = request.getAction();
        if (action == null || action.getType() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Action type is required"));
        }

        try {
            return switch (action.getType()) {
                case "CREATE_FILE" -> handleCreateFile(action, roomId, userId);
                case "UPDATE_FILE" -> handleUpdateFile(action, roomId, userId);
                default -> ResponseEntity.badRequest().body(Map.of("error", "Unknown action type: " + action.getType()));
            };
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    private ResponseEntity<Map<String, Object>> handleCreateFile(AiActionDto action, UUID roomId, UUID userId) {
        if (action.getFileName() == null || action.getFileName().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "fileName is required for CREATE_FILE"));
        }

        CreateFileNodeDto dto = new CreateFileNodeDto();
        dto.setRoomId(roomId);
        dto.setName(action.getFileName());
        dto.setType(FileType.FILE);
        dto.setLanguage(action.getLanguage());

        // Resolve parentFolderId if provided (validate it belongs to the room via service)
        if (action.getParentFolderId() != null && !action.getParentFolderId().isBlank()) {
            try {
                dto.setParentId(UUID.fromString(action.getParentFolderId()));
            } catch (Exception e) {
                // Invalid UUID — ignore, create at root
            }
        }

        FileNode created = workSpaceService.createFileNode(dto, userId);

        // Set the initial content via updateCode (creates a version in history)
        String content = action.getContent() != null ? action.getContent() : "";
        if (!content.isBlank()) {
            UpdateCodeDto updateDto = new UpdateCodeDto();
            updateDto.setRoomId(roomId);
            updateDto.setFileNodeId(created.getId());
            updateDto.setUserId(userId);
            updateDto.setContent(content);
            workSpaceService.updateCode(updateDto);
        }

        // Broadcast creation to the room
        wsHandler.broadcastToRoom(roomId.toString(), null, Map.of(
            "type", "FILE_CREATED",
            "fileId", created.getId().toString(),
            "fileName", created.getName(),
            "parentFolderId", action.getParentFolderId() != null ? action.getParentFolderId() : "",
            "language", action.getLanguage() != null ? action.getLanguage() : "",
            "fileType", "FILE"
        ));

        return ResponseEntity.ok(Map.of(
            "fileId", created.getId().toString(),
            "fileName", created.getName(),
            "message", "File created successfully"
        ));
    }

    private ResponseEntity<Map<String, Object>> handleUpdateFile(AiActionDto action, UUID roomId, UUID userId) {
        if (action.getFileId() == null || action.getFileId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "fileId is required for UPDATE_FILE"));
        }
        if (action.getNewContent() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "newContent is required for UPDATE_FILE"));
        }

        UUID fileNodeId;
        try {
            fileNodeId = UUID.fromString(action.getFileId());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid fileId"));
        }

        // This validates room membership and file-belongs-to-room internally
        UpdateCodeDto updateDto = new UpdateCodeDto();
        updateDto.setRoomId(roomId);
        updateDto.setFileNodeId(fileNodeId);
        updateDto.setUserId(userId);
        updateDto.setContent(action.getNewContent());

        updateDto.setExpectedVersion(action.getExpectedVersion());

        String result = workSpaceService.updateCode(updateDto);

        // Only broadcast if the AI update was applied immediately to the canonical file (admin)
        // Non-admins just create a PENDING version for review, so we shouldn't force-sync the room.
        if (!result.contains("review")) {
            // Clear any stale Yjs buffers so they don't overwrite the AI's canonical change
            wsHandler.clearYjsBuffer(fileNodeId.toString());

            // Broadcast to the room so all editors apply the new content
            wsHandler.broadcastToRoom(roomId.toString(), null, Map.of(
                "type", "CODE_UPDATE",
                "fileId", fileNodeId.toString(),
                "content", action.getNewContent(),
                "source", "AI"
            ));
        }

        return ResponseEntity.ok(Map.of(
            "fileId", fileNodeId.toString(),
            "message", result
        ));
    }

    // ── Request body ─────────────────────────────────────────────────────────

    public static class ExecuteActionRequest {
        private AiActionDto action;
        private String roomId;

        public AiActionDto getAction() { return action; }
        public void setAction(AiActionDto action) { this.action = action; }
        public String getRoomId() { return roomId; }
        public void setRoomId(String roomId) { this.roomId = roomId; }
    }
}
