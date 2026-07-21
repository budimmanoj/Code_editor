package dev.manoj.demo.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.manoj.demo.repository.FileNodeRepository;
import dev.manoj.demo.repository.UserRepository;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.*;
import java.util.concurrent.*;

/**
 * Core real-time collaboration handler.
 *
 * Features:
 *  - Presence: USER_JOINED, USER_LEFT, PRESENCE_INIT
 *  - Code sync: CODE_UPDATE broadcast to all other users in the room
 *  - Cursor positions: CURSOR_UPDATE
 *  - Typing indicators: TYPING
 *  - Debounced auto-save to DB: writes content to FileNode every 3 seconds
 */
@Component
public class RoomWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(RoomWebSocketHandler.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String[] COLORS = {
        "#f87171", "#34d399", "#60a5fa", "#fbbf24", "#a78bfa",
        "#f472b6", "#2dd4bf", "#fb923c", "#818cf8", "#4ade80"
    };

    // roomId → active sessions
    private final Map<String, Set<WebSocketSession>> roomSessions = new ConcurrentHashMap<>();
    // sessionId → metadata
    private final Map<String, SessionInfo> sessionInfoMap = new ConcurrentHashMap<>();
    // roomId → (userId → color)
    private final Map<String, Map<String, String>> roomUserColors = new ConcurrentHashMap<>();

    // Debounced DB saves: fileId → pending future
    private final Map<String, ScheduledFuture<?>> saveTimers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "ws-db-save");
        t.setDaemon(true);
        return t;
    });

    private final FileNodeRepository fileNodeRepository;
    private final UserRepository userRepository;

    public RoomWebSocketHandler(FileNodeRepository fileNodeRepository, UserRepository userRepository) {
        this.fileNodeRepository = fileNodeRepository;
        this.userRepository = userRepository;
    }

    // ── Connection lifecycle ───────────────────────────────────────────────────

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String roomId = (String) session.getAttributes().get("roomId");
        UUID userId = (UUID) session.getAttributes().get("userId");
        String email = (String) session.getAttributes().get("email");

        // Resolve display name
        String username = email;
        try {
            var opt = userRepository.findById(userId);
            if (opt.isPresent()) {
                String uname = opt.get().getUsername();
                if (uname != null && !uname.isBlank()) username = uname;
            }
        } catch (Exception e) {
            log.warn("Could not resolve username for {}", userId);
        }
        if (username == null || username.isBlank()) {
            username = "User-" + userId.toString().substring(0, 4);
        }

        String color = assignColor(roomId, userId.toString());
        SessionInfo info = new SessionInfo(userId.toString(), username, roomId, color);
        sessionInfoMap.put(session.getId(), info);
        roomSessions.computeIfAbsent(roomId, k -> new CopyOnWriteArraySet<>()).add(session);

        // Send existing participants to the new user
        sendTo(session, Map.of(
            "type", "PRESENCE_INIT",
            "participants", buildParticipantList(roomId, session.getId())
        ));

        // Notify everyone else
        broadcastToRoom(roomId, session.getId(), Map.of(
            "type", "USER_JOINED",
            "userId", info.userId,
            "username", info.username,
            "color", info.color
        ));

        log.info("[WS] {} joined room {}", username, roomId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        SessionInfo info = sessionInfoMap.get(session.getId());
        if (info == null) return;

        JsonNode node;
        try {
            node = MAPPER.readTree(message.getPayload());
        } catch (Exception e) {
            log.warn("[WS] Invalid JSON from session {}: {}", session.getId(), e.getMessage());
            return;
        }

        String type = node.path("type").asText("");
        switch (type) {
            case "CODE_UPDATE"   -> handleCodeUpdate(session, node, info);
            case "CURSOR_UPDATE" -> handleCursorUpdate(session, node, info);
            case "TYPING"        -> handleTyping(session, node, info);
            default              -> log.debug("[WS] Unknown message type: {}", type);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        SessionInfo info = sessionInfoMap.remove(session.getId());
        if (info == null) return;

        Set<WebSocketSession> sessions = roomSessions.get(info.roomId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                roomSessions.remove(info.roomId);
                roomUserColors.remove(info.roomId);
            }
        }

        broadcastToRoom(info.roomId, session.getId(), Map.of(
            "type", "USER_LEFT",
            "userId", info.userId,
            "username", info.username
        ));

        log.info("[WS] {} left room {}", info.username, info.roomId);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("[WS] Transport error for session {}: {}", session.getId(), exception.getMessage());
    }

    // ── Message handlers ──────────────────────────────────────────────────────

    private void handleCodeUpdate(WebSocketSession session, JsonNode node, SessionInfo info) {
        String fileId = node.path("fileId").asText("");
        String content = node.path("content").asText("");
        if (fileId.isBlank()) return;

        // Broadcast to all other users in this room
        broadcastToRoom(info.roomId, session.getId(), Map.of(
            "type", "CODE_UPDATE",
            "fileId", fileId,
            "content", content,
            "userId", info.userId,
            "username", info.username
        ));

        // Debounced DB save (3 seconds after last update)
        scheduleDbSave(fileId, content);
    }

    private void handleCursorUpdate(WebSocketSession session, JsonNode node, SessionInfo info) {
        String fileId = node.path("fileId").asText("");
        if (fileId.isBlank()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CURSOR_UPDATE");
        payload.put("fileId", fileId);
        payload.put("userId", info.userId);
        payload.put("username", info.username);
        payload.put("color", info.color);
        payload.put("line", node.path("line").asInt(0));
        payload.put("col", node.path("col").asInt(0));

        broadcastToRoom(info.roomId, session.getId(), payload);
    }

    private void handleTyping(WebSocketSession session, JsonNode node, SessionInfo info) {
        String fileId = node.path("fileId").asText("");
        boolean typing = node.path("typing").asBoolean(false);

        broadcastToRoom(info.roomId, session.getId(), Map.of(
            "type", "TYPING",
            "fileId", fileId,
            "userId", info.userId,
            "username", info.username,
            "color", info.color,
            "typing", typing
        ));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void sendTo(WebSocketSession session, Object data) {
        try {
            if (session.isOpen()) {
                String json = MAPPER.writeValueAsString(data);
                synchronized (session) {
                    session.sendMessage(new TextMessage(json));
                }
            }
        } catch (Exception e) {
            log.error("[WS] Error sending message: {}", e.getMessage());
        }
    }

    private void broadcastToRoom(String roomId, String excludeSessionId, Object data) {
        Set<WebSocketSession> sessions = roomSessions.getOrDefault(roomId, Collections.emptySet());
        if (sessions.isEmpty()) return;

        String json;
        try {
            json = MAPPER.writeValueAsString(data);
        } catch (Exception e) {
            log.error("[WS] Serialization error: {}", e.getMessage());
            return;
        }

        for (WebSocketSession s : sessions) {
            if (!s.getId().equals(excludeSessionId) && s.isOpen()) {
                try {
                    synchronized (s) {
                        s.sendMessage(new TextMessage(json));
                    }
                } catch (Exception e) {
                    log.warn("[WS] Failed to send to session {}: {}", s.getId(), e.getMessage());
                }
            }
        }
    }

    private String assignColor(String roomId, String userId) {
        Map<String, String> colorMap = roomUserColors
                .computeIfAbsent(roomId, k -> new ConcurrentHashMap<>());
        return colorMap.computeIfAbsent(userId, k -> {
            Set<String> used = new HashSet<>(colorMap.values());
            for (String c : COLORS) {
                if (!used.contains(c)) return c;
            }
            return COLORS[colorMap.size() % COLORS.length];
        });
    }

    private List<Map<String, String>> buildParticipantList(String roomId, String excludeSessionId) {
        List<Map<String, String>> list = new ArrayList<>();
        for (WebSocketSession s : roomSessions.getOrDefault(roomId, Collections.emptySet())) {
            if (!s.getId().equals(excludeSessionId)) {
                SessionInfo i = sessionInfoMap.get(s.getId());
                if (i != null) {
                    list.add(Map.of("userId", i.userId, "username", i.username, "color", i.color));
                }
            }
        }
        return list;
    }

    /** Save content to DB 3 seconds after the last CODE_UPDATE for this file. */
    private void scheduleDbSave(String fileId, String content) {
        ScheduledFuture<?> existing = saveTimers.remove(fileId);
        if (existing != null) existing.cancel(false);

        ScheduledFuture<?> future = scheduler.schedule(() -> {
            saveTimers.remove(fileId);
            try {
                UUID id = UUID.fromString(fileId);
                fileNodeRepository.findById(id).ifPresent(node -> {
                    // Strip null bytes that PostgreSQL rejects
                    String safe = content != null ? content.replace("\u0000", "") : "";
                    node.setContent(safe);
                    fileNodeRepository.save(node);
                    log.debug("[WS] Auto-saved file {}", fileId);
                });
            } catch (Exception e) {
                log.error("[WS] Failed to auto-save file {}: {}", fileId, e.getMessage());
            }
        }, 3, TimeUnit.SECONDS);

        saveTimers.put(fileId, future);
    }

    @PreDestroy
    public void destroy() {
        scheduler.shutdownNow();
    }

    // ── Session metadata ──────────────────────────────────────────────────────

    private record SessionInfo(String userId, String username, String roomId, String color) {}
}
