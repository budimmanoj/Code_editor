package dev.manoj.demo.dto;

import java.util.List;
import java.util.UUID;

public class UserProfileDto {
    private UUID id;
    private String username;
    private String email;
    private List<RoomSummaryDto> roomsCreated;
    private List<RoomSummaryDto> roomsJoined;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public List<RoomSummaryDto> getRoomsCreated() { return roomsCreated; }
    public void setRoomsCreated(List<RoomSummaryDto> roomsCreated) { this.roomsCreated = roomsCreated; }

    public List<RoomSummaryDto> getRoomsJoined() { return roomsJoined; }
    public void setRoomsJoined(List<RoomSummaryDto> roomsJoined) { this.roomsJoined = roomsJoined; }
}
