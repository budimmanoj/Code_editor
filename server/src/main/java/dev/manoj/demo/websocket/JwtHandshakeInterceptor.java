package dev.manoj.demo.websocket;

import dev.manoj.demo.security.JwtUtil;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;
import java.util.UUID;

/**
 * Validates JWT during the WebSocket upgrade handshake.
 * Browsers cannot set Authorization headers on WebSocket connections,
 * so the token is passed as a query parameter: ws://...?token=<jwt>
 */
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtUtil jwtUtil;

    public JwtHandshakeInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String query = request.getURI().getQuery();
        if (query == null) return false;

        String token = null;
        for (String param : query.split("&")) {
            if (param.startsWith("token=")) {
                token = param.substring("token=".length());
                break;
            }
        }

        if (token == null || !jwtUtil.isValid(token)) return false;

        UUID userId = jwtUtil.extractUserId(token);
        String email = jwtUtil.parse(token).get("email", String.class);

        // Extract roomId from path: /ws/room/{roomId}
        String path = request.getURI().getPath();
        String[] parts = path.split("/");
        String roomId = parts[parts.length - 1];

        attributes.put("userId", userId);
        attributes.put("roomId", roomId);
        attributes.put("email", email != null ? email : "");

        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // No-op
    }
}
