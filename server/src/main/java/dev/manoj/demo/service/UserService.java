package dev.manoj.demo.service;

import dev.manoj.demo.dto.*;
import dev.manoj.demo.enums.RoomRole;
import dev.manoj.demo.model.User;
import dev.manoj.demo.repository.RoomParticipantRepository;
import dev.manoj.demo.repository.UserRepository;
import dev.manoj.demo.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public UserService(UserRepository userRepository,
                       RoomParticipantRepository roomParticipantRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.roomParticipantRepository = roomParticipantRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public AuthResponseDto register(RegisterUserDto dto) {
        if (userRepository.existsByEmail(dto.getEmail())) {
            throw new RuntimeException("Email already registered");
        }
        User user = new User();
        user.setUsername(dto.getUsername());
        user.setEmail(dto.getEmail());
        user.setPasswordHash(passwordEncoder.encode(dto.getPassword()));
        User saved = userRepository.save(user);

        String token = jwtUtil.generate(saved.getId(), saved.getEmail());
        return new AuthResponseDto(token, saved.getId(), saved.getUsername(), saved.getEmail());
    }

    public AuthResponseDto login(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }
        String token = jwtUtil.generate(user.getId(), user.getEmail());
        return new AuthResponseDto(token, user.getId(), user.getUsername(), user.getEmail());
    }

    public UserProfileDto getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Rooms created = rooms where user is ADMIN participant
        List<RoomSummaryDto> created = roomParticipantRepository
                .findByUser_IdAndRole(userId, RoomRole.ADMIN)
                .stream()
                .map(p -> {
                    var r = p.getRoom();
                    RoomSummaryDto s = new RoomSummaryDto();
                    s.setId(r.getId());
                    s.setName(r.getName());
                    s.setInviteCode(r.getInviteCode());
                    s.setCreatedAt(r.getCreatedAt());
                    s.setParticipantCount(roomParticipantRepository.findByRoom_Id(r.getId()).size());
                    return s;
                }).toList();

        // Rooms joined as USER (member)
        List<RoomSummaryDto> joined = roomParticipantRepository
                .findByUser_IdAndRole(userId, RoomRole.USER)
                .stream()
                .map(p -> {
                    var r = p.getRoom();
                    RoomSummaryDto s = new RoomSummaryDto();
                    s.setId(r.getId());
                    s.setName(r.getName());
                    s.setInviteCode(r.getInviteCode());
                    s.setCreatedAt(r.getCreatedAt());
                    s.setParticipantCount(roomParticipantRepository.findByRoom_Id(r.getId()).size());
                    return s;
                }).toList();

        UserProfileDto profile = new UserProfileDto();
        profile.setId(user.getId());
        profile.setUsername(user.getUsername());
        profile.setEmail(user.getEmail());
        profile.setRoomsCreated(created);
        profile.setRoomsJoined(joined);
        return profile;
    }
}
