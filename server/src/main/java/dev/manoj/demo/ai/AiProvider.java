package dev.manoj.demo.ai;

/**
 * Pluggable AI provider interface.
 * Swap implementations (Gemini, OpenAI, Ollama) without touching AiService.
 */
public interface AiProvider {
    String complete(String prompt);
}
