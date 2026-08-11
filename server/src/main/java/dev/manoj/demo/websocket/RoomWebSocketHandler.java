package dev.manoj.demo.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.manoj.demo.repository.UserRepository;
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

    // fileId → list of raw Yjs updates
    private final Map<String, List<JsonNode>> yjsFileBuffers = new ConcurrentHashMap<>();



    private final UserRepository userRepository;

    public RoomWebSocketHandler(UserRepository userRepository) {
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
            case "CURSOR_UPDATE" -> handleCursorUpdate(session, node, info);
            case "TYPING"        -> handleTyping(session, node, info);
            case "YJS_UPDATE"    -> handleYjsUpdate(session, node, info);
            case "YJS_AWARENESS" -> handleYjsAwareness(session, node, info);
            case "YJS_REQUEST_STATE" -> handleYjsRequestState(session, node, info);
            default              -> log.debug("[WS] Unknown message type: {}", type);
        }
    }

    private void handleYjsUpdate(WebSocketSession session, JsonNode node, SessionInfo info) {
        String fileId = node.path("fileId").asText("");
        if (!fileId.isBlank()) {
            JsonNode updateNode = node.path("update");
            if (updateNode != null && !updateNode.isMissingNode()) {
                yjsFileBuffers.computeIfAbsent(fileId, k -> new CopyOnWriteArrayList<>()).add(updateNode);
            }
        }
        // Forward Yjs updates to all OTHER participants in the room unchanged
        broadcastToRoom(info.roomId, session.getId(), node);
    }

    private void handleYjsAwareness(WebSocketSession session, JsonNode node, SessionInfo info) {
        broadcastToRoom(info.roomId, session.getId(), node);
    }

    private void handleYjsRequestState(WebSocketSession session, JsonNode node, SessionInfo info) {
        String fileId = node.path("fileId").asText("");
        if (fileId.isBlank()) return;
        List<JsonNode> buffer = yjsFileBuffers.getOrDefault(fileId, Collections.emptyList());
        sendTo(session, Map.of(
            "type", "YJS_STATE_RESPONSE",
            "fileId", fileId,
            "updates", buffer
        ));
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

    public void clearYjsBuffer(String fileId) {
        yjsFileBuffers.remove(fileId);
    }

    public void broadcastToRoom(String roomId, String excludeSessionId, Object data) {
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

    /**
     * Public broadcast used by the HTTP layer (e.g. WorkSpaceService) to notify
     * ALL connected clients in a room of server-side events such as REVISION_APPROVED
     * or REVISION_REJECTED — where there is no "sender" session to exclude.
     */
    public void broadcastToAllInRoom(String roomId, Object data) {
        broadcastToRoom(roomId, null, data);
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



    // ── Session metadata ──────────────────────────────────────────────────────

    private record SessionInfo(String userId, String username, String roomId, String color) {}
}
