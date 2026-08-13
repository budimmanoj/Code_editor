package dev.manoj.demo.controllers;

import dev.manoj.demo.dto.CodeVersionDto;
import dev.manoj.demo.dto.UpdateCodeDto;
import dev.manoj.demo.enums.CodeReviewStatus;
import dev.manoj.demo.service.WorkSpaceService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/code")
public class CodeController {

    private final WorkSpaceService workSpaceService;

    public CodeController(WorkSpaceService workSpaceService) {
        this.workSpaceService = workSpaceService;
    }

    /** Save / submit code — ADMIN saves are approved immediately, USER saves create PENDING */
    @PostMapping("/update")
    public String updateCode(@RequestBody UpdateCodeDto dto, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        dto.setUserId(userId);
        return workSpaceService.updateCode(dto);
    }

    /** List all versions for a specific file */
    @GetMapping("/versions/{roomId}/{fileNodeId}")
    public List<CodeVersionDto> getFileVersions(@PathVariable UUID roomId,
                                                @PathVariable UUID fileNodeId,
                                                Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return workSpaceService.getFileVersions(roomId, fileNodeId, userId);
    }

    @GetMapping("/versions/room/{roomId}")
    public List<CodeVersionDto> getRoomVersions(@PathVariable UUID roomId, Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return workSpaceService.getRoomVersions(roomId, userId);
    }

    @GetMapping("/history/{roomId}")
    public List<CodeVersionDto> getHistory(@PathVariable UUID roomId,
                                           @org.springframework.web.bind.annotation.RequestParam String scopeType,
                                           @org.springframework.web.bind.annotation.RequestParam UUID scopeId,
                                           Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        return workSpaceService.getHistory(roomId, scopeType, scopeId, userId);
    }

    /**
     * Admin: list all PENDING versions across every file in the room.
     * Used to power the admin review dashboard.
     */
    @GetMapping("/pending/{roomId}")
    public List<CodeVersionDto> getPendingVersions(@PathVariable UUID roomId,
                                                   Authentication auth) {
        UUID adminId = (UUID) auth.getPrincipal();
        return workSpaceService.getPendingVersions(roomId, adminId);
    }

    /**
     * Admin: approve a version.
     * Marks it REVIEWED, updates fileNode.content, broadcasts REVISION_APPROVED via WS.
     */
    @PutMapping("/versions/{roomId}/{versionId}/approve")
    public String approveVersion(@PathVariable UUID roomId,
                                 @PathVariable UUID versionId,
                                 Authentication auth) {
        UUID adminId = (UUID) auth.getPrincipal();
        return workSpaceService.updateVersionStatus(roomId, versionId, CodeReviewStatus.APPROVED, adminId);
    }

    /**
     * Admin: reject a version with an optional comment.
     * Marks it REJECTED, fileNode.content stays unchanged, broadcasts REVISION_REJECTED via WS.
     */
    @PostMapping("/versions/{roomId}/{versionId}/reject")
    public String rejectVersion(@PathVariable UUID roomId,
                                @PathVariable UUID versionId,
                                @RequestBody(required = false) Map<String, String> body,
                                Authentication auth) {
        UUID adminId = (UUID) auth.getPrincipal();
        String comment = body != null ? body.get("comment") : null;
        return workSpaceService.updateVersionStatus(roomId, versionId, CodeReviewStatus.REJECTED, adminId, comment);
    }

    /**
     * Legacy generic status update (still supports NO_CHANGE for revert).
     * Kept for backward compatibility.
     */
    @PutMapping("/versions/{roomId}/{versionId}/status")
    public String updateVersionStatus(@PathVariable UUID roomId,
                                      @PathVariable UUID versionId,
                                      @RequestParam CodeReviewStatus status,
                                      Authentication auth) {
        UUID adminId = (UUID) auth.getPrincipal();
        return workSpaceService.updateVersionStatus(roomId, versionId, status, adminId);
    }

    @PostMapping("/versions/{roomId}/{fileNodeId}/revert/{versionId}")
    public String revertToVersion(@PathVariable UUID roomId,
                                  @PathVariable UUID fileNodeId,
                                  @PathVariable UUID versionId,
                                  Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return workSpaceService.revertToVersion(roomId, fileNodeId, versionId, userId);
    }
}
