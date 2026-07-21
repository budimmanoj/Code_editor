package dev.manoj.demo.dto;

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
}
