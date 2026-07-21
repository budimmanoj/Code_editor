package dev.manoj.demo.dto;

import java.util.UUID;
import dev.manoj.demo.enums.FileType;

public class CreateFileNodeDto {

    private UUID roomId;
    private UUID parentId;   // null = root
    private String name;
    private FileType type;   // FILE or FOLDER
    private String language; // e.g. "java", "python" — only relevant for FILE type

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public UUID getParentId() { return parentId; }
    public void setParentId(UUID parentId) { this.parentId = parentId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public FileType getType() { return type; }
    public void setType(FileType type) { this.type = type; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
}
