package dev.manoj.demo.model;

import jakarta.persistence.*;
import java.util.UUID;
import java.util.List;
import java.time.LocalDateTime;
import dev.manoj.demo.enums.FileType;


@Entity
@Table(name = "file_nodes")
public class FileNode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    private FileType type;

    @ManyToOne
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne
    @JoinColumn(name = "parent_id")
    private FileNode parent;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    private List<FileNode> children;

    @Column(length = 20)
    private String language;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void updateTimestamp() {
        this.updatedAt = LocalDateTime.now();
    }

    // getters and setters

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public FileType getType() {
        return type;
    }

    public void setType(FileType type) {
        this.type = type;
    }

    public Room getRoom() {
        return room;
    }

    public void setRoom(Room room) {
        this.room = room;
    }

    public FileNode getParent() {
        return parent;
    }

    public void setParent(FileNode parent) {
        this.parent = parent;
    }

    public List<FileNode> getChildren() {
        return children;
    }

    public void setChildren(List<FileNode> children) {
        this.children = children;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
