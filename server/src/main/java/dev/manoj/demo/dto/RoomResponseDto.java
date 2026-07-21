package dev.manoj.demo.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class RoomResponseDto {
    private UUID id;
    private String name;
    private String inviteCode;
    private String ownerUsername;
    private LocalDateTime createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getInviteCode() { return inviteCode; }
    public void setInviteCode(String inviteCode) { this.inviteCode = inviteCode; }

    public String getOwnerUsername() { return ownerUsername; }
    public void setOwnerUsername(String ownerUsername) { this.ownerUsername = ownerUsername; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
