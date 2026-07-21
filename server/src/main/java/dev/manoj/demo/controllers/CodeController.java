package dev.manoj.demo.controllers;

import dev.manoj.demo.dto.UpdateCodeDto;
import dev.manoj.demo.dto.CodeVersionDto;
import dev.manoj.demo.enums.CodeReviewStatus;
import dev.manoj.demo.service.WorkSpaceService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import java.util.UUID;

@RestController
@RequestMapping("/api/code")
public class CodeController {

    private final WorkSpaceService workSpaceService;

    public CodeController(WorkSpaceService workSpaceService) {
        this.workSpaceService = workSpaceService;
    }

    @PutMapping("/update")
    public String updateCode(@RequestBody UpdateCodeDto dto, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        dto.setUserId(userId); // always use JWT identity
        return workSpaceService.updateCode(dto);
    }

    @GetMapping("/versions/{roomId}/{fileNodeId}")
    public List<CodeVersionDto> getFileVersions(@PathVariable UUID roomId, @PathVariable UUID fileNodeId, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return workSpaceService.getFileVersions(roomId, fileNodeId, userId);
    }

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
