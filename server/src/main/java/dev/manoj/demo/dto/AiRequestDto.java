package dev.manoj.demo.dto;

import java.util.List;
import java.util.UUID;

/**
 * General-purpose request body for all AI endpoints.
 * Fields are optional depending on the endpoint.
 */
public class AiRequestDto {

    /** Inline code (used if roomId/fileNodeId not provided) */
    private String code;

    /** Programming language (e.g. "java", "python", "javascript") */
    private String language;

    /** Error or stack trace — used for /debug */
    private String error;

    /** Natural language prompt — used for /generate */
    private String prompt;

    /** User question — used for /chat */
    private String message;

    /** Description of what changed — used for /commit-message */
    private String changes;

    /** Filename — used for /review-before-commit */
    private String filename;

    /** Fetch code from DB instead of using inline code */
    private UUID roomId;
    private UUID fileNodeId;

    // ── Workspace-aware AI context ────────────────────────────────────────────

    /** Active file name (e.g. "code.js") for workspace-aware chat */
    private String activeFileName;

    /** Active file path (e.g. "src/code.js") for workspace-aware chat */
    private String activeFilePath;

    /**
     * Compact workspace tree sent as a list of lightweight descriptors.
     * Each entry: { id, name, type (FILE/FOLDER), language, path }
     * Content is NOT included here to keep the payload small.
     */
    private List<WorkspaceFileInfo> workspaceTree;

    /**
     * Additional files explicitly referenced by the user (e.g. via @file).
     * Each entry: { id, name, language, content }
     */
    private List<AdditionalFileContext> additionalFiles;

    // ── Nested types ─────────────────────────────────────────────────────────

    public static class WorkspaceFileInfo {
        private String id;
        private String name;
        private String type;
        private String language;
        private String path;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getLanguage() { return language; }
        public void setLanguage(String language) { this.language = language; }
        public String getPath() { return path; }
        public void setPath(String path) { this.path = path; }
    }

    public static class AdditionalFileContext {
        private String id;
        private String name;
        private String language;
        private String content;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getLanguage() { return language; }
        public void setLanguage(String language) { this.language = language; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }

    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getChanges() { return changes; }
    public void setChanges(String changes) { this.changes = changes; }

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public UUID getRoomId() { return roomId; }
    public void setRoomId(UUID roomId) { this.roomId = roomId; }

    public UUID getFileNodeId() { return fileNodeId; }
    public void setFileNodeId(UUID fileNodeId) { this.fileNodeId = fileNodeId; }

    public String getActiveFileName() { return activeFileName; }
    public void setActiveFileName(String activeFileName) { this.activeFileName = activeFileName; }

    public String getActiveFilePath() { return activeFilePath; }
    public void setActiveFilePath(String activeFilePath) { this.activeFilePath = activeFilePath; }

    public List<WorkspaceFileInfo> getWorkspaceTree() { return workspaceTree; }
    public void setWorkspaceTree(List<WorkspaceFileInfo> workspaceTree) { this.workspaceTree = workspaceTree; }

    public List<AdditionalFileContext> getAdditionalFiles() { return additionalFiles; }
    public void setAdditionalFiles(List<AdditionalFileContext> additionalFiles) { this.additionalFiles = additionalFiles; }
}
