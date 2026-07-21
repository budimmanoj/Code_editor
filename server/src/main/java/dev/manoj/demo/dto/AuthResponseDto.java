package dev.manoj.demo.dto;

import java.util.UUID;

public class AuthResponseDto {
    private String token;
    private UUID id;
    private String username;
    private String email;

    public AuthResponseDto(String token, UUID id, String username, String email) {
        this.token = token; this.id = id; this.username = username; this.email = email;
    }

    public String getToken() { return token; }
    public UUID getId() { return id; }
    public String getUsername() { return username; }
    public String getEmail() { return email; }
}
