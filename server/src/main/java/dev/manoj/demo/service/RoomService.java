package dev.manoj.demo.service;

import dev.manoj.demo.dto.*;
import dev.manoj.demo.enums.RoomRole;
import dev.manoj.demo.model.Room;
import dev.manoj.demo.model.RoomParticipant;
import dev.manoj.demo.model.User;
import dev.manoj.demo.repository.RoomParticipantRepository;
import dev.manoj.demo.repository.RoomRepository;
import dev.manoj.demo.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.UUID;

@Service
@Transactional
public class RoomService {

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final RoomParticipantRepository roomParticipantRepository;

    public RoomService(RoomRepository roomRepository,
                       UserRepository userRepository,
                       RoomParticipantRepository roomParticipantRepository) {
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.roomParticipantRepository = roomParticipantRepository;
    }

    /** Creates a room; the caller (ownerId) becomes ADMIN. */
    public RoomResponseDto createRoom(CreateRoomDto request, UUID requestingUserId) {
        // Security: use the JWT-authenticated userId, not whatever was sent in body
        User owner = userRepository.findById(requestingUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Room room = new Room();
        room.setName(request.getName());
        room.setOwner(owner);
        room.setInviteCode(generateInviteCode());
        Room saved = roomRepository.save(room);

        // Creator gets ADMIN role
        RoomParticipant ownerParticipant = new RoomParticipant();
        ownerParticipant.setRoom(saved);
        ownerParticipant.setUser(owner);
        ownerParticipant.setRole(RoomRole.ADMIN);
        roomParticipantRepository.save(ownerParticipant);

        return toDto(saved);
    }

    /** Join by invite code; joiner gets USER role. */
    public RoomResponseDto joinByCode(String inviteCode, UUID requestingUserId) {
        Room room = roomRepository.findByInviteCode(inviteCode.toUpperCase())
                .orElseThrow(() -> new RuntimeException("Invalid invite code"));

        User user = userRepository.findById(requestingUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        boolean alreadyJoined = roomParticipantRepository
                .existsByRoom_IdAndUser_Id(room.getId(), user.getId());

        if (!alreadyJoined) {
            RoomParticipant participant = new RoomParticipant();
            participant.setRoom(room);
            participant.setUser(user);
            participant.setRole(RoomRole.USER);
            roomParticipantRepository.save(participant);
        }

        return toDto(room);
    }

    /** Get a participant's role in a given room. */
    public RoomRole getRoleInRoom(UUID roomId, UUID userId) {
        return roomParticipantRepository.findByRoom_IdAndUser_Id(roomId, userId)
                .map(RoomParticipant::getRole)
                .orElseThrow(() -> new RuntimeException("User is not a participant in this room"));
    }

    private String generateInviteCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
            code = sb.toString();
        } while (roomRepository.findByInviteCode(code).isPresent());
        return code;
    }

    private RoomResponseDto toDto(Room room) {
        RoomResponseDto dto = new RoomResponseDto();
        dto.setId(room.getId());
        dto.setName(room.getName());
        dto.setInviteCode(room.getInviteCode());
        dto.setOwnerUsername(room.getOwner().getUsername());
        dto.setCreatedAt(room.getCreatedAt());
        return dto;
    }
}
