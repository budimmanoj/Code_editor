package dev.manoj.demo.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import dev.manoj.demo.enums.FileType;

public class FileTreeDto {

    private UUID id;
    private String name;
    private FileType fileType;
    private String language;
    private List<FileTreeDto> children = new ArrayList<>();  // initialized — avoids NPE in addChild

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public FileType getFileType() { return fileType; }
    public void setFileType(FileType fileType) { this.fileType = fileType; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public List<FileTreeDto> getChildren() { return children; }
    public void setChildren(List<FileTreeDto> children) { this.children = children; }

    public void addChild(FileTreeDto child) { this.children.add(child); }
}
