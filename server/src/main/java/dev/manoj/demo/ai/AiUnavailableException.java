package dev.manoj.demo.ai;

/**
 * Thrown when the AI provider is misconfigured (missing API key)
 * or the API call fails. Mapped to HTTP 503 by GlobalExceptionHandler.
 */
public class AiUnavailableException extends RuntimeException {

    public AiUnavailableException(String message) {
        super(message);
    }

    public AiUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
