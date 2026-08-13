package dev.manoj.demo.ai;

import dev.manoj.demo.dto.AiRequestDto;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Builds task-specific prompts and delegates to the configured AiProvider.
 * Each method has a focused prompt tuned for that specific task.
 */
@Service
public class AiService {

    private final AiProvider aiProvider;

    public AiService(AiProvider aiProvider) {
        this.aiProvider = aiProvider;
    }

    public String reviewCode(String code, String language) {
        return aiProvider.complete("""
                You are an expert code reviewer. Analyze this %s code and give a thorough review.
                
                Focus on:
                - Bugs and logical errors
                - Security vulnerabilities (SQL injection, XSS, hardcoded secrets)
                - Performance issues
                - Code smells and bad practices
                - Naming and readability
                - Missing error handling
                
                Format your response with these sections:
                ## Summary
                ## Bugs Found
                ## Security Issues
                ## Performance Issues
                ## Code Quality
                ## Suggestions
                
                Code:
                ```%s
                %s
                ```
                """.formatted(language, language, code));
    }

    public String explainCode(String code, String language) {
        return aiProvider.complete("""
                Explain this %s code in clear, simple language.
                
                Include:
                - What this code does (high-level summary)
                - Step-by-step walkthrough of the logic
                - Time complexity (if applicable)
                - Space complexity (if applicable)
                - Key algorithms or patterns used
                - Potential edge cases
                
                Code:
                ```%s
                %s
                ```
                """.formatted(language, language, code));
    }

    public String refactorCode(String code, String language) {
        return aiProvider.complete("""
                Refactor this %s code to improve quality while preserving all functionality.
                
                Goals:
                - Improve readability and clarity
                - Apply SOLID principles where applicable
                - Remove code smells and duplication
                - Improve naming
                - Simplify complex logic
                - Add concise comments where helpful
                
                Return the refactored code first, then a brief "## Changes Made" section below.
                
                Original code:
                ```%s
                %s
                ```
                """.formatted(language, language, code));
    }

    public String debugCode(String code, String error, String language) {
        return aiProvider.complete("""
                Help debug this %s code that has an error.
                
                Error / Stack Trace:
                %s
                
                Code:
                ```%s
                %s
                ```
                
                Provide:
                1. Root cause of the error
                2. Why it happens
                3. The fixed code
                4. What you changed and why
                """.formatted(language, error.isBlank() ? "(no error provided — analyze code for bugs)" : error, language, code));
    }

    public String generateCode(String prompt, String language) {
        return aiProvider.complete("""
                Generate production-quality %s code for this requirement:
                
                %s
                
                Requirements:
                - Clean, well-commented code
                - Follow %s best practices
                - Include error handling where appropriate
                - Make it ready to use directly
                
                Return only the code with brief inline comments.
                """.formatted(language, prompt, language));
    }

    public String generateTests(String code, String language) {
        return aiProvider.complete("""
                Generate comprehensive unit tests for this %s code.
                
                Include:
                - Happy path tests
                - Edge case tests
                - Error / exception handling tests
                - Use the standard testing framework for %s (JUnit 5 for Java, Jest for JS/TS, pytest for Python)
                - Use mocking where appropriate
                - Meaningful assertions
                
                Code:
                ```%s
                %s
                ```
                """.formatted(language, language, language, code));
    }

    public String generateCommitMessage(String code, String changes) {
        return aiProvider.complete("""
                Generate a professional Git commit message for these code changes.
                
                Follow conventional commits format:
                type(scope): short description
                
                [optional body]
                
                Types: feat, fix, refactor, docs, test, style, perf, chore
                
                Keep the subject line under 72 characters.
                
                Code context (first 500 chars):
                %s
                
                What changed:
                %s
                
                Return ONLY the commit message, nothing else.
                """.formatted(
                        code.length() > 500 ? code.substring(0, 500) + "..." : code,
                        changes.isBlank() ? "General code improvements" : changes));
    }

    public String scanSecurity(String code, String language) {
        return aiProvider.complete("""
                Perform a security analysis of this %s code.
                
                Check for:
                - SQL Injection
                - XSS (Cross-Site Scripting)
                - CSRF vulnerabilities
                - JWT implementation issues
                - Hardcoded secrets or API keys
                - Insecure authentication / authorization
                - Unsafe deserialization
                - Exposed sensitive data
                - Missing input validation
                - Broken access control
                
                Format:
                ## Security Score: X/10
                ## Critical Issues
                ## High Issues
                ## Medium Issues
                ## Low Issues
                ## Recommendations
                
                Code:
                ```%s
                %s
                ```
                """.formatted(language, language, code));
    }

    public String reviewBeforeCommit(String code, String language, String filename) {
        return aiProvider.complete("""
                Perform a comprehensive pre-commit review of this %s file: %s
                
                ## Code Quality Score: X/100
                
                ## ✅ Code Review
                (bad practices, code smells, naming, readability)
                
                ## 🐞 Bug Detection
                (logical errors, null pointer risks, edge cases)
                
                ## 🔒 Security Scan
                (vulnerabilities, exposed secrets, injection risks)
                
                ## ⚡ Performance Analysis
                (bottlenecks, unnecessary complexity, N+1 queries)
                
                ## 💡 Improvement Suggestions
                (actionable, specific improvements)
                
                ## Commit Recommendation
                State APPROVE or NEEDS_WORK with a one-line reason.
                
                Code:
                ```%s
                %s
                ```
                """.formatted(language, filename, language, code));
    }

    public String chat(String message, String codeContext, String language) {
        String contextPart = codeContext != null && !codeContext.isBlank()
                ? "\n\nCurrent file context (%s):\n```%s\n%s\n```".formatted(language, language,
                        codeContext.length() > 3000 ? codeContext.substring(0, 3000) + "\n...(truncated)" : codeContext)
                : "";

        return aiProvider.complete("""
                You are an expert programming assistant embedded in a collaborative code editor.
                Answer the following question accurately and concisely.%s
                
                Question: %s
                """.formatted(contextPart, message));
    }

    /**
     * Workspace-aware chat: gives the AI rich context about the active file
     * and workspace structure, and instructs it to respond in structured JSON.
     *
     * The AI can respond in two ways:
     *
     * 1. Plain text answer:
     *    {"type":"TEXT","result":"..."}
     *
     * 2. File action (CREATE_FILE, UPDATE_FILE):
     *    {"type":"ACTION","action":{"type":"CREATE_FILE","fileName":"sum.cpp","language":"cpp","content":"..."}}
     *    {"type":"ACTION","action":{"type":"UPDATE_FILE","fileId":"...","fileNameForDisplay":"code.js","newContent":"..."}}
     */
    public String workspaceChat(AiRequestDto dto) {
        String message = dto.getMessage() != null ? dto.getMessage() : "";

        // Build active file context section
        String activeFileSection = buildActiveFileSection(dto);

        // Build workspace tree section (compact — names + types only, no content)
        String workspaceSection = buildWorkspaceSection(dto);

        // Build additional referenced files section
        String additionalFilesSection = buildAdditionalFilesSection(dto);

        // Build history section
        String historySection = buildHistorySection(dto);

        return aiProvider.complete("""
                You are an expert programming assistant embedded in CodeRoom, a collaborative code editor.
                You have access to the user's workspace and can read files and propose file operations.
                
                ## WORKSPACE CONTEXT
                %s
                %s
                %s
                
                ## YOUR CAPABILITIES
                You can respond in two formats ONLY:
                
                ### 1. Text answer (for explanations, questions, reviews):
                Return ONLY valid JSON:
                {"type":"TEXT","result":"your answer here (can include markdown)"}
                
                ### 2. File action(s) (when user asks to create or modify one OR MULTIPLE files):
                
                You can propose multiple actions at once by returning an array of actions:
                {"type":"ACTIONS","actions":[
                  {"type":"CREATE_FILE","fileName":"example.cpp","language":"cpp","content":"// The COMPLETE and FULL file content goes here. DO NOT truncate. You must provide the fully implemented, working code."},
                  {"type":"UPDATE_FILE","fileId":"%s","fileNameForDisplay":"%s","newContent":"// The COMPLETE new file content goes here. DO NOT truncate. You must provide the full, unmodified parts of the file alongside your changes."}
                ]}
                
                If it's just a single action, you MUST STILL return the array with one element (e.g. `{"type": "ACTIONS", "actions": [...] }`).
                
                ## IMPORTANT RULES
                - ALWAYS respond with valid JSON — never plain text outside JSON
                - For TEXT responses, escape special characters properly in the JSON string
                - For file content in JSON, escape newlines as \\n and quotes as \\"
                - When the user asks what code is in a file, describe it based on the ACTIVE FILE CONTEXT above
                - When the user asks to CREATE a file, use CREATE_FILE action
                - When the user asks to MODIFY/UPDATE/ADD TO the current file, use UPDATE_FILE action with the complete new content
                - NEVER TRUNCATE CODE. NEVER use '...' or comments like '// rest of code here'. You MUST provide the fully working, complete code for both CREATE_FILE and UPDATE_FILE actions. This is extremely important.
                - Never make up file IDs — use only the IDs provided above
                - If unsure whether to create or modify, ask the user (use TEXT type)
                
                ## PREVIOUS CONVERSATION
                %s
                
                ## USER MESSAGE
                %s
                """.formatted(
                        activeFileSection,
                        workspaceSection,
                        additionalFilesSection,
                        dto.getFileNodeId() != null ? dto.getFileNodeId().toString() : "null",
                        dto.getActiveFileName() != null ? dto.getActiveFileName() : "current file",
                        historySection,
                        message));
    }

    private String buildActiveFileSection(AiRequestDto dto) {
        if (dto.getCode() == null || dto.getCode().isBlank()) {
            return "### Active File\nNo file is currently open in the editor.";
        }

        String name = dto.getActiveFileName() != null ? dto.getActiveFileName() : (dto.getFilename() != null ? dto.getFilename() : "unknown");
        String lang = dto.getLanguage() != null ? dto.getLanguage() : "plaintext";
        String content = dto.getCode();
        if (content.length() > 4000) {
            content = content.substring(0, 4000) + "\n... (truncated — file continues)";
        }

        return """
                ### Active File
                Name: %s
                Language: %s
                File ID: %s
                
                Content:
                ```%s
                %s
                ```""".formatted(
                name, lang,
                dto.getFileNodeId() != null ? dto.getFileNodeId().toString() : "N/A",
                lang, content);
    }

    private String buildWorkspaceSection(AiRequestDto dto) {
        List<AiRequestDto.WorkspaceFileInfo> tree = dto.getWorkspaceTree();
        if (tree == null || tree.isEmpty()) {
            return "### Workspace\nWorkspace tree not available.";
        }

        StringBuilder sb = new StringBuilder("### Workspace Structure\n");
        // Limit to 80 files to avoid excessive token usage
        int limit = Math.min(tree.size(), 80);
        for (int i = 0; i < limit; i++) {
            AiRequestDto.WorkspaceFileInfo f = tree.get(i);
            String icon = "FILE".equals(f.getType()) ? "📄" : "📁";
            sb.append(icon).append(" ").append(f.getPath() != null ? f.getPath() : f.getName());
            if (f.getLanguage() != null && !f.getLanguage().isBlank() && !"FILE".equals(f.getType())) {
                // skip lang for folders
            } else if (f.getLanguage() != null && !f.getLanguage().isBlank()) {
                sb.append(" [").append(f.getLanguage()).append("]");
            }
            sb.append("\n");
        }
        if (tree.size() > 80) {
            sb.append("... and ").append(tree.size() - 80).append(" more files\n");
        }
        return sb.toString();
    }

    private String buildAdditionalFilesSection(AiRequestDto dto) {
        List<AiRequestDto.AdditionalFileContext> files = dto.getAdditionalFiles();
        if (files == null || files.isEmpty()) {
            return "";
        }

        StringBuilder sb = new StringBuilder("### Referenced Files\n");
        for (AiRequestDto.AdditionalFileContext f : files) {
            String content = f.getContent() != null ? f.getContent() : "";
            if (content.length() > 2000) {
                content = content.substring(0, 2000) + "\n...(truncated)";
            }
            sb.append("\n#### ").append(f.getName()).append("\n");
            sb.append("```").append(f.getLanguage() != null ? f.getLanguage() : "").append("\n");
            sb.append(content).append("\n```\n");
        }
        return sb.toString();
    }

    private String buildHistorySection(AiRequestDto dto) {
        List<AiRequestDto.ChatMessage> history = dto.getHistory();
        if (history == null || history.isEmpty()) {
            return "No previous messages.";
        }
        
        StringBuilder sb = new StringBuilder();
        for (AiRequestDto.ChatMessage msg : history) {
            String role = "user".equalsIgnoreCase(msg.getRole()) ? "User" : "AI";
            sb.append(role).append(": ").append(msg.getContent()).append("\n\n");
        }
        return sb.toString().trim();
    }

    public String optimizeCode(String code, String language) {
        return aiProvider.complete("""
                Optimize this %s code for performance and readability.
                
                - Reduce algorithmic complexity where possible
                - Use modern language features
                - Simplify nested logic
                - Improve maintainability
                
                Provide a side-by-side explanation of what changed and why, then the optimized code.
                
                Code:
                ```%s
                %s
                ```
                """.formatted(language, language, code));
    }

    public String generateDocs(String code, String language) {
        return aiProvider.complete("""
                Generate comprehensive documentation for this %s code.
                
                Include:
                - Function/class-level documentation (JavaDoc, JSDoc, docstrings as appropriate)
                - Parameter descriptions
                - Return value descriptions
                - Usage examples where helpful
                - Inline comments for complex logic
                
                Return the code with documentation added.
                
                Code:
                ```%s
                %s
                ```
                """.formatted(language, language, code));
    }
}
