package dev.manoj.demo.exception;

import dev.manoj.demo.ai.AiUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** AI provider not configured or API call failed → 503 Service Unavailable */
    @ExceptionHandler(AiUnavailableException.class)
    public ResponseEntity<Map<String, String>> handleAiUnavailable(AiUnavailableException ex) {
        log.error("AI unavailable: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", ex.getMessage()));
    }

    /** Application-level business rule violations → 400 Bad Request */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntime(RuntimeException ex) {
        log.warn("Business error: {}", ex.getMessage());
        String msg = ex.getMessage() != null ? ex.getMessage() : "An error occurred";
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", msg));
    }

    /** Catch-all for unexpected errors → 500 Internal Server Error */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneral(Exception ex) {
        log.error("Unexpected error: {}", ex.getMessage(), ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Internal server error. Please try again."));
    }
}
