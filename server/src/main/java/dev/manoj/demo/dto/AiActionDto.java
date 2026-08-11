package dev.manoj.demo.dto;

import java.util.List;

/**
 * Represents a structured action the AI wants to perform.
 * The frontend shows a confirmation card; only after user confirms
 * is POST /api/ai/workspace-action called to execute the action.
 */
public class AiActionDto {

    /** Action type: CREATE_FILE | UPDATE_FILE | CREATE_FOLDER */
    private String type;

    // ── CREATE_FILE / CREATE_FOLDER fields ────────────────────────────────────
    /** Suggested file name (e.g. "sum.cpp") */
    private String fileName;

    /** Programming language */
    private String language;

    /** Parent folder ID — null means room root */
    private String parentFolderId;

    /** Full initial content for the new file */
    private String content;

    // ── UPDATE_FILE fields ────────────────────────────────────────────────────
    /** ID of the file to update (frontend validates this belongs to the room) */
    private String fileId;

    /** Human-readable file name shown in the diff card */
    private String fileNameForDisplay;

    /**
     * Full replacement content proposed by AI.
     */
    private String newContent;

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getParentFolderId() { return parentFolderId; }
    public void setParentFolderId(String parentFolderId) { this.parentFolderId = parentFolderId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }

    public String getFileNameForDisplay() { return fileNameForDisplay; }
    public void setFileNameForDisplay(String fileNameForDisplay) { this.fileNameForDisplay = fileNameForDisplay; }

    public String getNewContent() { return newContent; }
    public void setNewContent(String newContent) { this.newContent = newContent; }
}
