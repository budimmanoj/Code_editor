
package dev.manoj.demo.dto;

import dev.manoj.demo.enums.CodeReviewStatus;
import java.util.UUID;

public class CodeVersionDto {
    private UUID id;
    private UUID fileNodeId;
    private String fileName;   // name of the file this version belongs to
    private UUID userId;
    private String username;
    private String content;
    private CodeReviewStatus status;
    private String createdAt;
    private String reviewedBy;
    private String reviewedAt;
    private String reviewComment; // rejection/review note

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getFileNodeId() { return fileNodeId; }
    public void setFileNodeId(UUID fileNodeId) { this.fileNodeId = fileNodeId; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public CodeReviewStatus getStatus() { return status; }
    public void setStatus(CodeReviewStatus status) { this.status = status; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }

    public String getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(String reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewComment() { return reviewComment; }
    public void setReviewComment(String reviewComment) { this.reviewComment = reviewComment; }
}
