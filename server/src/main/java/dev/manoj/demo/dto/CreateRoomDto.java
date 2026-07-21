package dev.manoj.demo.dto;

import java.util.UUID;

public class CreateRoomDto {

    private String name; // room name 
    private UUID ownerId;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
}
