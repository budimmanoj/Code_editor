package dev.manoj.demo.service;
import java.time.LocalDateTime;
import dev.manoj.demo.dto.*;
import dev.manoj.demo.enums.RoomRole;
import dev.manoj.demo.model.FileNode;
import dev.manoj.demo.dto.FileNodeInfo;
import dev.manoj.demo.model.Room;
import dev.manoj.demo.model.RoomParticipant;
import dev.manoj.demo.repository.FileNodeRepository;
import dev.manoj.demo.repository.RoomParticipantRepository;
import dev.manoj.demo.repository.RoomRepository;
import dev.manoj.demo.websocket.RoomWebSocketHandler;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

import dev.manoj.demo.repository.CodeVersionRepository;
import dev.manoj.demo.repository.UserRepository;
import dev.manoj.demo.model.CodeVersion;
import dev.manoj.demo.model.User;
import dev.manoj.demo.enums.CodeReviewStatus;

@Service
@Transactional
public class WorkSpaceService {

    private final FileNodeRepository fileNodeRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final RoomRepository roomRepository;
    private final CodeVersionRepository codeVersionRepository;
    private final UserRepository userRepository;
    private final RoomWebSocketHandler wsHandler;

    public WorkSpaceService(FileNodeRepository fileNodeRepository,
                            RoomParticipantRepository roomParticipantRepository,
                            RoomRepository roomRepository,
                            CodeVersionRepository codeVersionRepository,
                            UserRepository userRepository,
                            @Lazy RoomWebSocketHandler wsHandler) {
        this.fileNodeRepository = fileNodeRepository;
        this.roomParticipantRepository = roomParticipantRepository;
        this.roomRepository = roomRepository;
        this.codeVersionRepository = codeVersionRepository;
        this.userRepository = userRepository;
        this.wsHandler = wsHandler;
    }

    // ── Sanitize content: strip null bytes that PostgreSQL rejects in UTF-8 columns ──
    private String sanitizeContent(String content) {
        if (content == null) return null;
        // Remove null bytes (0x00) which are illegal in PostgreSQL TEXT columns
        return content.replace("\u0000", "");
    }

    // ── Auth helpers ──────────────────────────────────────────────────────────

    private RoomParticipant requireParticipant(UUID roomId, UUID userId) {
        return roomParticipantRepository.findByRoom_IdAndUser_Id(roomId, userId)
                .orElseThrow(() -> new RuntimeException("Access denied: not a participant of this room"));
    }

    private void requireAdmin(UUID roomId, UUID userId) {
        RoomParticipant p = requireParticipant(roomId, userId);
        if (p.getRole() != RoomRole.ADMIN) {
            throw new RuntimeException("Access denied: admin privileges required");
        }
    }

    // ── File operations ───────────────────────────────────────────────────────

    public String getFile(UUID roomId, UUID fileNodeId, UUID userId) {
        requireParticipant(roomId, userId);
        FileNode fileNode = fileNodeRepository
                .findByIdAndRoom_Id(fileNodeId, roomId)
                .orElseThrow(() -> new RuntimeException("File not found in this room"));
        return fileNode.getContent();
    }

    /**
     * Save code edit from a participant.
     *
     * ADMIN → updates fileNode.content directly (canonical) + creates REVIEWED version.
     * USER  → creates PENDING version only. Does NOT overwrite fileNode.content so the
     *          admin-approved version stays intact until an admin reviews it.
     */
    public String updateCode(UpdateCodeDto dto) {
        requireParticipant(dto.getRoomId(), dto.getUserId());
        FileNode fileNode = fileNodeRepository
                .findByIdAndRoom_Id(dto.getFileNodeId(), dto.getRoomId())
                .orElseThrow(() -> new RuntimeException("File not found in this room"));

        String safeContent = sanitizeContent(dto.getContent());

        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        RoomParticipant p = roomParticipantRepository
                .findByRoom_IdAndUser_Id(dto.getRoomId(), dto.getUserId()).orElse(null);
        boolean isAdmin = p != null && p.getRole() == RoomRole.ADMIN;

        if (isAdmin) {
            // Admin edits are immediately canonical
            fileNode.setContent(safeContent);
            fileNodeRepository.save(fileNode);
        }
        // For normal users we deliberately do NOT update fileNode.content here —
        // the WS auto-save in RoomWebSocketHandler still writes the live content
        // for collaboration purposes, but the official reviewed content remains
        // the last admin-approved value until an admin approves this version.

        CodeReviewStatus status = isAdmin ? CodeReviewStatus.REVIEWED : CodeReviewStatus.PENDING;
        CodeVersion version = new CodeVersion();
        version.setFileNode(fileNode);
        version.setUser(user);
        version.setContent(safeContent);
        version.setStatus(status);
        if (isAdmin) {
            String reviewer = user.getUsername() != null ? user.getUsername() : user.getEmail();
            version.setReviewedBy(reviewer);
            version.setReviewedAt(LocalDateTime.now());
        }
        codeVersionRepository.save(version);

        return isAdmin ? "Code saved (admin — approved immediately)" : "Code submitted for review";
    }

    public List<CodeVersionDto> getFileVersions(UUID roomId, UUID fileNodeId, UUID userId) {
        requireParticipant(roomId, userId);
        FileNode file = fileNodeRepository.findByIdAndRoom_Id(fileNodeId, roomId)
                .orElseThrow(() -> new RuntimeException("File not found in this room"));

        List<CodeVersion> versions = codeVersionRepository.findByFileNode_IdOrderByCreatedAtDesc(fileNodeId);
        return versions.stream().map(v -> toDto(v, file.getName())).toList();
    }

    private CodeVersionDto toDto(CodeVersion v, String fileName) {
        CodeVersionDto dto = new CodeVersionDto();
        dto.setId(v.getId());
        dto.setFileNodeId(v.getFileNode().getId());
        dto.setFileName(fileName);
        dto.setUserId(v.getUser().getId());
        dto.setUsername(v.getUser().getUsername() != null ? v.getUser().getUsername() : v.getUser().getEmail());
        dto.setContent(v.getContent());
        dto.setStatus(v.getStatus());
        dto.setCreatedAt(v.getCreatedAt() != null ? v.getCreatedAt().toString() : null);
        dto.setReviewedBy(v.getReviewedBy());
        dto.setReviewedAt(v.getReviewedAt() != null ? v.getReviewedAt().toString() : null);
        dto.setReviewComment(v.getReviewComment());
        return dto;
    }

    /**
     * Returns all PENDING versions in a room — for the admin review dashboard.
     * Only admins of the room may call this.
     */
    public List<CodeVersionDto> getPendingVersions(UUID roomId, UUID adminId) {
        requireAdmin(roomId, adminId);
        List<FileNode> roomFiles = fileNodeRepository.findAllByRoom_Id(roomId);
        List<CodeVersionDto> result = new ArrayList<>();
        for (FileNode file : roomFiles) {
            List<CodeVersion> pending = codeVersionRepository
                    .findByFileNode_IdOrderByCreatedAtDesc(file.getId())
                    .stream()
                    .filter(v -> v.getStatus() == CodeReviewStatus.PENDING)
                    .toList();
            for (CodeVersion v : pending) {
                result.add(toDto(v, file.getName()));
            }
        }
        result.sort(Comparator.comparing(CodeVersionDto::getCreatedAt,
                Comparator.nullsLast(Comparator.naturalOrder())).reversed());
        return result;
    }

    /**
     * Admin approves or rejects a pending version.
     *
     * REVIEWED (approve) → updates fileNode.content to the approved version content.
     *                       Broadcasts REVISION_APPROVED over WebSocket so live collaborators
     *                       can refresh their editor to the now-official content.
     * REJECTED            → marks the version rejected, stores optional comment.
     *                       fileNode.content remains unchanged.
     * NO_CHANGE           → legacy revert-to-previous behaviour.
     */
    public String updateVersionStatus(UUID roomId, UUID versionId,
                                      CodeReviewStatus status, UUID adminId,
                                      String reviewComment) {
        requireAdmin(roomId, adminId);
        CodeVersion version = codeVersionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        if (!version.getFileNode().getRoom().getId().equals(roomId)) {
            throw new RuntimeException("Version does not belong to this room");
        }

        User admin = userRepository.findById(adminId).orElseThrow();
        String reviewerName = admin.getUsername() != null ? admin.getUsername() : admin.getEmail();

        version.setStatus(status);
        version.setReviewedBy(reviewerName);
        version.setReviewedAt(LocalDateTime.now());
        if (reviewComment != null && !reviewComment.isBlank()) {
            version.setReviewComment(reviewComment.trim());
        }
        codeVersionRepository.save(version);

        FileNode fileNode = version.getFileNode();

        if (status == CodeReviewStatus.REVIEWED) {
            // Approval: the pending content becomes the canonical version
            String approvedContent = sanitizeContent(version.getContent());
            fileNode.setContent(approvedContent);
            fileNodeRepository.save(fileNode);

            // Notify all connected clients in this room that the official
            // file content has changed so they can refresh their editors
            wsHandler.broadcastToAllInRoom(roomId.toString(), Map.of(
                "type",       "REVISION_APPROVED",
                "fileId",     fileNode.getId().toString(),
                "content",    approvedContent != null ? approvedContent : "",
                "approvedBy", reviewerName,
                "versionId",  versionId.toString()
            ));

        } else if (status == CodeReviewStatus.REJECTED) {
            // Rejection: fileNode.content stays as-is (the last approved version)
            wsHandler.broadcastToAllInRoom(roomId.toString(), Map.of(
                "type",      "REVISION_REJECTED",
                "fileId",    fileNode.getId().toString(),
                "versionId", versionId.toString(),
                "reason",    reviewComment != null ? reviewComment : ""
            ));

        } else if (status == CodeReviewStatus.NO_CHANGE) {
            // Legacy: revert to previous approved version
            List<CodeVersion> allVersions = codeVersionRepository
                    .findByFileNode_IdOrderByCreatedAtDesc(fileNode.getId());
            CodeVersion previousVersion = allVersions.stream()
                    .filter(v -> v.getCreatedAt().isBefore(version.getCreatedAt()))
                    .findFirst().orElse(null);
            if (previousVersion != null) {
                String revertContent = sanitizeContent(previousVersion.getContent());
                fileNode.setContent(revertContent);
                fileNodeRepository.save(fileNode);

                CodeVersion revertVersion = new CodeVersion();
                revertVersion.setFileNode(fileNode);
                revertVersion.setUser(admin);
                revertVersion.setContent(revertContent);
                revertVersion.setStatus(CodeReviewStatus.REVIEWED);
                revertVersion.setReviewedBy(reviewerName);
                revertVersion.setReviewedAt(LocalDateTime.now());
                codeVersionRepository.save(revertVersion);
            }
        }

        return "Status updated to " + status.name();
    }

    /** Backward-compat overload without comment */
    public String updateVersionStatus(UUID roomId, UUID versionId, CodeReviewStatus status, UUID adminId) {
        return updateVersionStatus(roomId, versionId, status, adminId, null);
    }

    public String revertToVersion(UUID roomId, UUID fileNodeId, UUID versionId, UUID userId) {
        requireParticipant(roomId, userId);
        FileNode fileNode = fileNodeRepository.findByIdAndRoom_Id(fileNodeId, roomId)
                .orElseThrow(() -> new RuntimeException("File not found in this room"));
        CodeVersion version = codeVersionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        if (!version.getFileNode().getId().equals(fileNodeId)) {
            throw new RuntimeException("Version does not belong to this file");
        }

        String safeContent = sanitizeContent(version.getContent());
        fileNode.setContent(safeContent);
        fileNodeRepository.save(fileNode);

        User user = userRepository.findById(userId).orElseThrow();
        CodeVersion revertVersion = new CodeVersion();
        revertVersion.setFileNode(fileNode);
        revertVersion.setUser(user);
        revertVersion.setContent(safeContent);
        revertVersion.setStatus(CodeReviewStatus.PENDING);
        codeVersionRepository.save(revertVersion);

        return safeContent != null ? safeContent : "";
    }

    /**
     * ANY participant (ADMIN or USER) can create files and folders.
     */
    public FileNode createFileNode(CreateFileNodeDto dto, UUID requestingUserId) {
        requireParticipant(dto.getRoomId(), requestingUserId);

        Room room = roomRepository.findById(dto.getRoomId())
                .orElseThrow(() -> new RuntimeException("Room not found"));

        FileNode node = new FileNode();
        node.setName(dto.getName());
        node.setType(dto.getType());
        node.setRoom(room);
        node.setLanguage(dto.getLanguage());

        if (dto.getParentId() != null) {
            FileNode parent = fileNodeRepository.findById(dto.getParentId())
                    .orElseThrow(() -> new RuntimeException("Parent folder not found"));
            node.setParent(parent);
        }

        return fileNodeRepository.save(node);
    }

    /**
     * Returns a virtual root wrapping all top-level nodes.
     * Fixes the case where there is no single root node, multiple roots, or empty room.
     */
    /**
     * Returns the file/folder tree for a room.
     *
     * Uses a lightweight projection query (findMetadataByRoom_Id) that fetches
     * ONLY id, name, type, language, and parentId — it intentionally skips the
     * "content" TEXT column. Loading the full content for every file just to
     * render a file tree was the primary cause of lag in rooms with many files.
     */
    public FileTreeDto getFileTree(UUID roomId, UUID userId) {
        requireParticipant(roomId, userId);

        // Lightweight query — does NOT load file content
        List<FileNodeInfo> fileNodes = fileNodeRepository.findMetadataByRoom_Id(roomId);

        if (fileNodes.isEmpty()) {
            return null;
        }

        Map<UUID, FileTreeDto> dtoMap = new LinkedHashMap<>();

        for (FileNodeInfo node : fileNodes) {
            FileTreeDto dto = new FileTreeDto();
            dto.setId(node.getId());
            dto.setName(node.getName());
            dto.setFileType(node.getType());
            dto.setLanguage(node.getLanguage());
            dtoMap.put(node.getId(), dto);
        }

        // Wire up parent → children using the projected parentId
        List<FileTreeDto> roots = new ArrayList<>();
        for (FileNodeInfo node : fileNodes) {
            FileTreeDto dto = dtoMap.get(node.getId());
            if (node.getParentId() == null) {
                roots.add(dto);
            } else {
                FileTreeDto parentDto = dtoMap.get(node.getParentId());
                if (parentDto != null) {
                    parentDto.addChild(dto);
                } else {
                    roots.add(dto); // orphan → treat as root
                }
            }
        }

        // If exactly one root, return it directly (backward compat)
        if (roots.size() == 1) {
            return roots.get(0);
        }

        // Multiple roots → wrap in a virtual root container
        FileTreeDto virtualRoot = new FileTreeDto();
        virtualRoot.setId(null);
        virtualRoot.setName("__root__");
        virtualRoot.setFileType(dev.manoj.demo.enums.FileType.FOLDER);
        roots.forEach(virtualRoot::addChild);
        return virtualRoot;
    }

    public RoomParticipantDto getRoomParticipants(UUID roomId, UUID userId) {
        requireParticipant(roomId, userId);
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Room not found"));

        List<RoomParticipant> participants = roomParticipantRepository.findByRoom_Id(roomId);

        List<ParticipantInfoDto> participantDtos = participants.stream()
                .map(p -> {
                    ParticipantInfoDto info = new ParticipantInfoDto();
                    info.setUserId(p.getUser().getId());
                    info.setCandidateName(p.getUser().getUsername());
                    info.setEmail(p.getUser().getEmail());
                    info.setRole(p.getRole());
                    info.setJoinedAt(p.getJoinedAt());
                    return info;
                })
                .toList();

        RoomParticipantDto dto = new RoomParticipantDto();
        dto.setRoomId(roomId);
        dto.setRoomName(room.getName());
        dto.setInviteCode(room.getInviteCode());
        dto.setParticipants(participantDtos);
        return dto;
    }

    // ── Delete file/folder ────────────────────────────────────────────────────

    /**
     * Delete a file node (and all its children recursively via CascadeType.ALL).
     * Any participant can delete.
     */
    public void deleteFileNode(UUID roomId, UUID fileNodeId, UUID userId) {
        requireParticipant(roomId, userId);
        FileNode node = fileNodeRepository.findByIdAndRoom_Id(fileNodeId, roomId)
                .orElseThrow(() -> new RuntimeException("File not found in this room"));
        fileNodeRepository.delete(node);
    }

    // ── Rename file/folder ────────────────────────────────────────────────────

    public FileNode renameFileNode(UUID roomId, UUID fileNodeId, String newName, UUID userId) {
        requireParticipant(roomId, userId);
        FileNode node = fileNodeRepository.findByIdAndRoom_Id(fileNodeId, roomId)
                .orElseThrow(() -> new RuntimeException("File not found in this room"));
        node.setName(newName);
        return fileNodeRepository.save(node);
    }
}
