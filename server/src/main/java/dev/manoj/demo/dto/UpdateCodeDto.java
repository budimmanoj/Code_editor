package dev.manoj.demo.dto;

import java.util.UUID;

public class UpdateCodeDto {

    private UUID roomId;
    private UUID fileNodeId;
    private UUID userId;
    private String content;

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public UUID getFileNodeId() { return fileNodeId; }
    public void setFileNodeId(UUID fileNodeId) { this.fileNodeId = fileNodeId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
