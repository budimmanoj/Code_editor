package dev.manoj.demo.controllers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.manoj.demo.ai.AiService;
import dev.manoj.demo.dto.AiActionDto;
import dev.manoj.demo.dto.AiRequestDto;
import dev.manoj.demo.dto.AiResponseDto;
import dev.manoj.demo.service.WorkSpaceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST endpoints for all AI features.
 * All endpoints require JWT authentication.
 * Code can be provided inline (dto.code) or fetched from the DB (dto.roomId + dto.fileNodeId).
 *
 * Endpoints:
 *   POST /api/ai/review           — code review (bugs, security, quality)
 *   POST /api/ai/explain          — explain code in plain language
 *   POST /api/ai/refactor         — refactor for quality
 *   POST /api/ai/debug            — debug with optional stack trace
 *   POST /api/ai/generate         — generate code from prompt
 *   POST /api/ai/tests            — generate unit tests
 *   POST /api/ai/commit-message   — generate Git commit message
 *   POST /api/ai/security         — security scan
 *   POST /api/ai/optimize         — optimize for performance
 *   POST /api/ai/docs             — generate documentation
 *   POST /api/ai/chat             — workspace-aware chat (structured JSON response)
 *   POST /api/ai/review-before-commit — comprehensive pre-commit review
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;
    private final WorkSpaceService workSpaceService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiController(AiService aiService, WorkSpaceService workSpaceService) {
        this.aiService = aiService;
        this.workSpaceService = workSpaceService;
    }

    @PostMapping("/review")
    public ResponseEntity<AiResponseDto> review(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        return ok(aiService.reviewCode(code, lang(dto)));
    }

    @PostMapping("/explain")
    public ResponseEntity<AiResponseDto> explain(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        return ok(aiService.explainCode(code, lang(dto)));
    }

    @PostMapping("/refactor")
    public ResponseEntity<AiResponseDto> refactor(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        return ok(aiService.refactorCode(code, lang(dto)));
    }

    @PostMapping("/debug")
    public ResponseEntity<AiResponseDto> debug(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        String error = dto.getError() != null ? dto.getError() : "";
        return ok(aiService.debugCode(code, error, lang(dto)));
    }

    @PostMapping("/generate")
    public ResponseEntity<AiResponseDto> generate(@RequestBody AiRequestDto dto) {
        String prompt = dto.getPrompt() != null ? dto.getPrompt() : "";
        return ok(aiService.generateCode(prompt, lang(dto)));
    }

    @PostMapping("/tests")
    public ResponseEntity<AiResponseDto> generateTests(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        return ok(aiService.generateTests(code, lang(dto)));
    }

    @PostMapping("/commit-message")
    public ResponseEntity<AiResponseDto> commitMessage(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        String changes = dto.getChanges() != null ? dto.getChanges() : "";
        return ok(aiService.generateCommitMessage(code, changes));
    }

    @PostMapping("/security")
    public ResponseEntity<AiResponseDto> securityScan(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        return ok(aiService.scanSecurity(code, lang(dto)));
    }

    @PostMapping("/optimize")
    public ResponseEntity<AiResponseDto> optimize(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        return ok(aiService.optimizeCode(code, lang(dto)));
    }

    @PostMapping("/docs")
    public ResponseEntity<AiResponseDto> generateDocs(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        return ok(aiService.generateDocs(code, lang(dto)));
    }

    /**
     * Workspace-aware chat endpoint.
     *
     * Accepts the extended AiRequestDto with optional:
     *   - code (live editor content for active file)
     *   - workspaceTree (compact file tree)
     *   - activeFileName, additionalFiles
     *
     * The AI returns structured JSON. This endpoint parses it and returns:
     *   - AiResponseDto with responseType="TEXT" for plain answers
     *   - AiResponseDto with responseType="ACTION" + action payload for file operations
     */
    @PostMapping("/chat")
    public ResponseEntity<AiResponseDto> chat(@RequestBody AiRequestDto dto, Authentication auth) {
        // Ensure inline code is resolved (if not already set via live editor)
        if ((dto.getCode() == null || dto.getCode().isBlank()) && auth != null) {
            String resolved = resolveCode(dto, auth);
            dto.setCode(resolved);
        }

        // Use workspace-aware chat for rich context
        String rawResponse = aiService.workspaceChat(dto);

        // Parse structured JSON response from AI
        return ResponseEntity.ok(parseAiResponse(rawResponse));
    }

    @PostMapping("/review-before-commit")
    public ResponseEntity<AiResponseDto> reviewBeforeCommit(@RequestBody AiRequestDto dto, Authentication auth) {
        String code = resolveCode(dto, auth);
        String filename = dto.getFilename() != null ? dto.getFilename() : "unknown";
        return ok(aiService.reviewBeforeCommit(code, lang(dto), filename));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private ResponseEntity<AiResponseDto> ok(String result) {
        return ResponseEntity.ok(new AiResponseDto(result, "gemini"));
    }

    private String lang(AiRequestDto dto) {
        return dto.getLanguage() != null && !dto.getLanguage().isBlank()
                ? dto.getLanguage() : "code";
    }

    /**
     * Resolve code: fetch from DB if roomId+fileNodeId provided, otherwise use inline dto.code.
     */
    private String resolveCode(AiRequestDto dto, Authentication auth) {
        if (dto.getRoomId() != null && dto.getFileNodeId() != null && auth != null) {
            try {
                UUID userId = (UUID) auth.getPrincipal();
                String content = workSpaceService.getFile(dto.getRoomId(), dto.getFileNodeId(), userId);
                if (content != null) return content;
            } catch (Exception ignored) {
                // Fall back to inline code
            }
        }
        return dto.getCode() != null ? dto.getCode() : "";
    }

    /**
     * Parse the structured JSON response from the workspace-aware AI.
     * Handles cases where the AI wraps JSON in markdown code blocks.
     *
     * Expected formats:
     *   {"type":"TEXT","result":"..."}
     *   {"type":"ACTION","action":{...}}
     */
    private AiResponseDto parseAiResponse(String rawResponse) {
        if (rawResponse == null || rawResponse.isBlank()) {
            return new AiResponseDto("No response from AI.", "gemini");
        }

        // Strip markdown code block wrappers if the AI added them
        String json = rawResponse.trim();
        if (json.startsWith("```json")) {
            json = json.substring(7);
            if (json.endsWith("```")) json = json.substring(0, json.length() - 3);
            json = json.trim();
        } else if (json.startsWith("```")) {
            json = json.substring(3);
            if (json.endsWith("```")) json = json.substring(0, json.length() - 3);
            json = json.trim();
        }

        try {
            JsonNode root = objectMapper.readTree(json);
            String type = root.path("type").asText("TEXT");

            if ("ACTIONS".equals(type)) {
                JsonNode actionsNode = root.path("actions");
                java.util.List<AiActionDto> actions = new java.util.ArrayList<>();
                if (actionsNode.isArray()) {
                    for (JsonNode actionNode : actionsNode) {
                        actions.add(objectMapper.treeToValue(actionNode, AiActionDto.class));
                    }
                }
                return new AiResponseDto(actions, "gemini");
            } else if ("ACTION".equals(type)) {
                JsonNode actionNode = root.path("action");
                AiActionDto action = objectMapper.treeToValue(actionNode, AiActionDto.class);
                return new AiResponseDto(action, "gemini");
            } else {
                // TEXT response
                String result = root.path("result").asText(rawResponse);
                return new AiResponseDto(result, "gemini");
            }
        } catch (Exception e) {
            // AI returned non-JSON — treat as plain text (fallback for non-workspace modes)
            return new AiResponseDto(rawResponse, "gemini");
        }
    }
}
