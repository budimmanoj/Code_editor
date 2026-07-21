package dev.manoj.demo.websocket;

import dev.manoj.demo.security.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Registers the /ws/room/{roomId} WebSocket endpoint.
 * CORS for WebSocket is handled here separately from the REST CORS config.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final RoomWebSocketHandler roomWebSocketHandler;
    private final JwtUtil jwtUtil;

    @Value("${ws.allowed-origins:http://localhost:3000,http://localhost:3001,http://localhost:3002}")
    private String allowedOrigins;

    public WebSocketConfig(RoomWebSocketHandler roomWebSocketHandler, JwtUtil jwtUtil) {
        this.roomWebSocketHandler = roomWebSocketHandler;
        this.jwtUtil = jwtUtil;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .toArray(String[]::new);

        registry.addHandler(roomWebSocketHandler, "/ws/room/*")
                .addInterceptors(new JwtHandshakeInterceptor(jwtUtil))
                .setAllowedOrigins(origins);
    }
}
