package dev.manoj.demo.dto;

import java.util.UUID;

public class JoinRoomDto {

    private UUID roomId;
    private UUID userId;       // user must exist to join
    private String candidateName;

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getCandidateName() { return candidateName; }
    public void setCandidateName(String candidateName) { this.candidateName = candidateName; }
}
