package dev.manoj.demo.controllers;

import dev.manoj.demo.dto.CreateRoomDto;
import dev.manoj.demo.dto.JoinByCodeDto;
import dev.manoj.demo.dto.RoomResponseDto;
import dev.manoj.demo.enums.RoomRole;
import dev.manoj.demo.service.RoomService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    /** POST /api/rooms/create — authenticated user becomes ADMIN */
    @PostMapping("/create")
    public RoomResponseDto createRoom(@RequestBody CreateRoomDto dto, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return roomService.createRoom(dto, userId);
    }

    /** POST /api/rooms/join — join with an 8-char invite code */
    @PostMapping("/join")
    public RoomResponseDto joinRoom(@RequestBody JoinByCodeDto dto, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return roomService.joinByCode(dto.getInviteCode(), userId);
    }

    /** GET /api/rooms/{roomId}/myRole — returns current user's role in this room */
    @GetMapping("/{roomId}/myRole")
    public Map<String, String> getMyRole(@PathVariable UUID roomId, Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        RoomRole role = roomService.getRoleInRoom(roomId, userId);
        return Map.of("role", role.name());
    }
}
