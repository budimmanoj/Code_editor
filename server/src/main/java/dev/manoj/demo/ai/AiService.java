package dev.manoj.demo.ai;

import org.springframework.stereotype.Service;

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
