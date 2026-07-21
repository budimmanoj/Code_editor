package dev.manoj.demo.dto;

import java.util.List;
import java.util.UUID;

public class RoomParticipantDto {

    private UUID roomId;
    private String roomName;
    private String inviteCode;
    private List<ParticipantInfoDto> participants;

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public String getRoomName() { return roomName; }
    public void setRoomName(String roomName) { this.roomName = roomName; }

    public String getInviteCode() { return inviteCode; }
    public void setInviteCode(String inviteCode) { this.inviteCode = inviteCode; }

    public List<ParticipantInfoDto> getParticipants() { return participants; }
    public void setParticipants(List<ParticipantInfoDto> participants) { this.participants = participants; }
}
