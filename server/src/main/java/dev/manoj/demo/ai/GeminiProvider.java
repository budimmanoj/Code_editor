package dev.manoj.demo.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Gemini implementation of AiProvider.
 * Uses JDK 21's built-in HttpClient — no extra dependency needed.
 * Configure via: GEMINI_API_KEY, GEMINI_MODEL environment variables.
 */
@Component
public class GeminiProvider implements AiProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiProvider.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String apiUrl;

    public GeminiProvider(
            @Value("${gemini.api-key:}") String apiKey,
            @Value("${gemini.model:gemini-2.0-flash}") String model,
            @Value("${gemini.api-url:https://generativelanguage.googleapis.com/v1beta/models}") String apiUrl) {
        this.apiKey = apiKey;
        this.model = model;
        this.apiUrl = apiUrl;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    @Override
    public String complete(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiUnavailableException(
                    "Gemini API key is not configured. Set the GEMINI_API_KEY environment variable.");
        }

        try {
            // Build request body following Gemini REST API spec
            ObjectNode body = MAPPER.createObjectNode();
            ArrayNode contents = body.putArray("contents");
            ObjectNode content = contents.addObject();
            ArrayNode parts = content.putArray("parts");
            parts.addObject().put("text", prompt);

            ObjectNode genConfig = body.putObject("generationConfig");
            genConfig.put("maxOutputTokens", 8192);
            genConfig.put("temperature", 0.3);

            String url = apiUrl + "/" + model + ":generateContent?key=" + apiKey;
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(120))
                    .POST(HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Gemini API error {}: {}", response.statusCode(), response.body());
                throw new AiUnavailableException(
                        "Gemini API returned HTTP " + response.statusCode() + ". Check your API key and quota.");
            }

            JsonNode responseJson = MAPPER.readTree(response.body());
            JsonNode candidates = responseJson.path("candidates");

            if (!candidates.isArray() || candidates.isEmpty()) {
                throw new AiUnavailableException("Gemini returned no candidates. The prompt may have been blocked.");
            }

            String text = candidates.get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText();

            if (text == null || text.isBlank()) {
                throw new AiUnavailableException("Gemini returned an empty response.");
            }

            return text;

        } catch (AiUnavailableException e) {
            throw e;
        } catch (Exception e) {
            log.error("Gemini API call failed: {}", e.getMessage(), e);
            throw new AiUnavailableException("AI request failed: " + e.getMessage(), e);
        }
    }
}
