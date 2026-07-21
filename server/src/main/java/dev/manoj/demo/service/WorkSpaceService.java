package dev.manoj.demo.service;
import java.time.LocalDateTime;
import dev.manoj.demo.dto.*;
import dev.manoj.demo.enums.RoomRole;
import dev.manoj.demo.model.FileNode;
import dev.manoj.demo.model.Room;
import dev.manoj.demo.model.RoomParticipant;
import dev.manoj.demo.repository.FileNodeRepository;
import dev.manoj.demo.repository.RoomParticipantRepository;
import dev.manoj.demo.repository.RoomRepository;
import org.springframework.stereotype.Service;

import java.util.*;

import dev.manoj.demo.repository.CodeVersionRepository;
import dev.manoj.demo.repository.UserRepository;
import dev.manoj.demo.model.CodeVersion;
import dev.manoj.demo.model.User;
import dev.manoj.demo.enums.CodeReviewStatus;

@Service
public class WorkSpaceService {

    private final FileNodeRepository fileNodeRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final RoomRepository roomRepository;
    private final CodeVersionRepository codeVersionRepository;
    private final UserRepository userRepository;

    public WorkSpaceService(FileNodeRepository fileNodeRepository,
                            RoomParticipantRepository roomParticipantRepository,
                            RoomRepository roomRepository,
                            CodeVersionRepository codeVersionRepository,
                            UserRepository userRepository) {
        this.fileNodeRepository = fileNodeRepository;
        this.roomParticipantRepository = roomParticipantRepository;
        this.roomRepository = roomRepository;
        this.codeVersionRepository = codeVersionRepository;
        this.userRepository = userRepository;
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

    public String updateCode(UpdateCodeDto dto) {
        // Both ADMINs and USERs can edit code
        requireParticipant(dto.getRoomId(), dto.getUserId());
        FileNode fileNode = fileNodeRepository
                .findByIdAndRoom_Id(dto.getFileNodeId(), dto.getRoomId())
                .orElseThrow(() -> new RuntimeException("File not found in this room"));

        // Sanitize: remove null bytes to prevent PostgreSQL UTF-8 encoding errors
        String safeContent = sanitizeContent(dto.getContent());

        fileNode.setContent(safeContent);
        fileNodeRepository.save(fileNode);

        User user = userRepository.findById(dto.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        CodeReviewStatus status = CodeReviewStatus.PENDING;
        RoomParticipant p = roomParticipantRepository.findByRoom_IdAndUser_Id(dto.getRoomId(), dto.getUserId()).orElse(null);
        if (p != null && p.getRole() == RoomRole.ADMIN) {
            status = CodeReviewStatus.REVIEWED;
        }

        CodeVersion version = new CodeVersion();
        version.setFileNode(fileNode);
        version.setUser(user);
        version.setContent(safeContent);
        version.setStatus(status);
        if (status == CodeReviewStatus.REVIEWED) {
            version.setReviewedBy(user.getUsername() != null ? user.getUsername() : user.getEmail());
            version.setReviewedAt(LocalDateTime.now());
        }
        codeVersionRepository.save(version);

        return "Code saved";
    }

    public List<CodeVersionDto> getFileVersions(UUID roomId, UUID fileNodeId, UUID userId) {
        requireParticipant(roomId, userId);
        fileNodeRepository.findByIdAndRoom_Id(fileNodeId, roomId)
                .orElseThrow(() -> new RuntimeException("File not found in this room"));

        List<CodeVersion> versions = codeVersionRepository.findByFileNode_IdOrderByCreatedAtDesc(fileNodeId);
        return versions.stream().map(v -> {
            CodeVersionDto dto = new CodeVersionDto();
            dto.setId(v.getId());
            dto.setFileNodeId(v.getFileNode().getId());
            dto.setUserId(v.getUser().getId());
            dto.setUsername(v.getUser().getUsername() != null ? v.getUser().getUsername() : v.getUser().getEmail());
            dto.setContent(v.getContent());
            dto.setStatus(v.getStatus());
            dto.setCreatedAt(v.getCreatedAt() != null ? v.getCreatedAt().toString() : null);
            dto.setReviewedBy(v.getReviewedBy());
            dto.setReviewedAt(v.getReviewedAt() != null ? v.getReviewedAt().toString() : null);
            return dto;
        }).toList();
    }

    public String updateVersionStatus(UUID roomId, UUID versionId, CodeReviewStatus status, UUID adminId) {
        requireAdmin(roomId, adminId);
        CodeVersion version = codeVersionRepository.findById(versionId)
                .orElseThrow(() -> new RuntimeException("Version not found"));

        if (!version.getFileNode().getRoom().getId().equals(roomId)) {
            throw new RuntimeException("Version does not belong to this room");
        }

        version.setStatus(status);

        User admin = userRepository.findById(adminId).orElseThrow();
        version.setReviewedBy(admin.getUsername() != null ? admin.getUsername() : admin.getEmail());
        version.setReviewedAt(LocalDateTime.now());

        codeVersionRepository.save(version);

        if (status == CodeReviewStatus.NO_CHANGE) {
            List<CodeVersion> allVersions = codeVersionRepository.findByFileNode_IdOrderByCreatedAtDesc(version.getFileNode().getId());
            CodeVersion previousVersion = null;
            for (CodeVersion v : allVersions) {
                if (v.getCreatedAt().isBefore(version.getCreatedAt())) {
                    previousVersion = v;
                    break;
                }
            }
            if (previousVersion != null) {
                FileNode fileNode = version.getFileNode();
                fileNode.setContent(sanitizeContent(previousVersion.getContent()));
                fileNodeRepository.save(fileNode);

                CodeVersion revertVersion = new CodeVersion();
                revertVersion.setFileNode(fileNode);
                revertVersion.setUser(admin);
                revertVersion.setContent(sanitizeContent(previousVersion.getContent()));
                revertVersion.setStatus(CodeReviewStatus.REVIEWED);
                revertVersion.setReviewedBy(admin.getUsername() != null ? admin.getUsername() : admin.getEmail());
                revertVersion.setReviewedAt(LocalDateTime.now());
                codeVersionRepository.save(revertVersion);
            }
        }

        return "Status updated to " + status.name();
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
    public FileTreeDto getFileTree(UUID roomId, UUID userId) {
        requireParticipant(roomId, userId);
        List<FileNode> fileNodes = fileNodeRepository.findAllByRoom_Id(roomId);

        if (fileNodes.isEmpty()) {
            return null;
        }

        Map<UUID, FileTreeDto> dtoMap = new LinkedHashMap<>();

        for (FileNode node : fileNodes) {
            FileTreeDto dto = new FileTreeDto();
            dto.setId(node.getId());
            dto.setName(node.getName());
            dto.setFileType(node.getType());
            dto.setLanguage(node.getLanguage());
            dtoMap.put(node.getId(), dto);
        }

        // Wire up parent → children
        List<FileTreeDto> roots = new ArrayList<>();
        for (FileNode node : fileNodes) {
            FileTreeDto dto = dtoMap.get(node.getId());
            if (node.getParent() == null) {
                roots.add(dto);
            } else {
                FileTreeDto parentDto = dtoMap.get(node.getParent().getId());
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
