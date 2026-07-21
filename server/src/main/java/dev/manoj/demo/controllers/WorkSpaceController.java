package dev.manoj.demo.controllers;

import dev.manoj.demo.dto.CreateFileNodeDto;
import dev.manoj.demo.dto.FileTreeDto;
import dev.manoj.demo.dto.RenameFileNodeDto;
import dev.manoj.demo.dto.RoomParticipantDto;
import dev.manoj.demo.model.FileNode;
import dev.manoj.demo.service.WorkSpaceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/workspace")
public class WorkSpaceController {

    private final WorkSpaceService workSpaceService;

    public WorkSpaceController(WorkSpaceService workSpaceService) {
        this.workSpaceService = workSpaceService;
    }

    @GetMapping("/{roomId}/fileNode/{fileNodeId}")
    public String getFile(@PathVariable UUID roomId,
                          @PathVariable UUID fileNodeId,
                          Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return workSpaceService.getFile(roomId, fileNodeId, userId);
    }

    @GetMapping("/{roomId}/fileTree")
    public FileTreeDto getFileTree(@PathVariable UUID roomId, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return workSpaceService.getFileTree(roomId, userId);
    }

    @GetMapping("/{roomId}/roomParticipants")
    public RoomParticipantDto getRoomParticipants(@PathVariable UUID roomId, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return workSpaceService.getRoomParticipants(roomId, userId);
    }

    /** ANY participant (ADMIN or USER) can create files/folders */
    @PostMapping("/fileNode")
    public FileNode createFileNode(@RequestBody CreateFileNodeDto dto, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return workSpaceService.createFileNode(dto, userId);
    }

    /** ANY participant can delete a file/folder */
    @DeleteMapping("/{roomId}/fileNode/{fileNodeId}")
    public ResponseEntity<Void> deleteFileNode(@PathVariable UUID roomId,
                                               @PathVariable UUID fileNodeId,
                                               Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        workSpaceService.deleteFileNode(roomId, fileNodeId, userId);
        return ResponseEntity.noContent().build();
    }

    /** ANY participant can rename a file/folder */
    @PatchMapping("/{roomId}/fileNode/{fileNodeId}/rename")
    public FileNode renameFileNode(@PathVariable UUID roomId,
                                   @PathVariable UUID fileNodeId,
                                   @RequestBody RenameFileNodeDto dto,
                                   Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return workSpaceService.renameFileNode(roomId, fileNodeId, dto.getName(), userId);
    }
}
