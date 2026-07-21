package dev.manoj.demo.dto;

import dev.manoj.demo.enums.RoomRole;
import java.time.LocalDateTime;
import java.util.UUID;

public class ParticipantInfoDto {
    private UUID userId;
    private String candidateName;
    private String email;
    private RoomRole role;
    private LocalDateTime joinedAt;

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getCandidateName() { return candidateName; }
    public void setCandidateName(String candidateName) { this.candidateName = candidateName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public RoomRole getRole() { return role; }
    public void setRole(RoomRole role) { this.role = role; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
}
