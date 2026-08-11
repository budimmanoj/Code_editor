package dev.manoj.demo.controllers;

import dev.manoj.demo.dto.*;
import dev.manoj.demo.security.JwtUtil;
import dev.manoj.demo.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final JwtUtil jwtUtil;

    public UserController(UserService userService, JwtUtil jwtUtil) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
    }

    // ── 1. Registration ─────────────────────────────────────────────────────────

    @PostMapping("/register")
    public MessageResponseDto initiateRegistration(@Valid @RequestBody RegisterUserDto dto) {
        return userService.initiateRegistration(dto);
    }

    @PostMapping("/register/verify")
    public AuthResponseDto verifyRegistrationOtp(@Valid @RequestBody OtpVerifyDto dto) {
        return userService.verifyRegistrationOtp(dto);
    }

    @PostMapping("/register/resend")
    public MessageResponseDto resendRegistrationOtp(@RequestBody Map<String, String> body) {
        return userService.resendRegistrationOtp(body.get("email"));
    }

    // ── 2. Login ────────────────────────────────────────────────────────────────

    @PostMapping("/login")
    public AuthResponseDto login(@RequestBody Map<String, String> body) {
        return userService.login(body.get("email"), body.get("password"));
    }

    // ── 3. Forgot Password ──────────────────────────────────────────────────────

    @PostMapping("/forgot-password")
    public MessageResponseDto initiateForgotPassword(@Valid @RequestBody ForgotPasswordDto dto) {
        return userService.initiateForgotPassword(dto);
    }

    @PostMapping("/forgot-password/verify")
    public TokenResponseDto verifyForgotPasswordOtp(@Valid @RequestBody OtpVerifyDto dto) {
        return userService.verifyForgotPasswordOtp(dto);
    }

    @PostMapping("/reset-password")
    public MessageResponseDto resetPassword(@Valid @RequestBody ResetPasswordDto dto, HttpServletRequest request) {
        String token = extractToken(request);
        if (token == null || !jwtUtil.isValidResetToken(token)) {
            throw new RuntimeException("Invalid or expired reset token");
        }
        UUID userId = jwtUtil.extractUserId(token);
        return userService.resetPassword(userId, dto);
    }

    // ── 4. Change Password (Authenticated) ──────────────────────────────────────

    @PostMapping("/change-password")
    public MessageResponseDto changePasswordWithCurrentPassword(
            @Valid @RequestBody ChangePasswordDto dto, Authentication auth) {
        return userService.changePasswordWithCurrentPassword((UUID) auth.getPrincipal(), dto);
    }

    @PostMapping("/change-password/send-otp")
    public MessageResponseDto sendChangePasswordOtp(Authentication auth) {
        return userService.sendChangePasswordOtp((UUID) auth.getPrincipal());
    }

    @PostMapping("/change-password/verify-otp")
    public MessageResponseDto changePasswordWithOtp(
            @Valid @RequestBody OtpChangePasswordDto dto, Authentication auth) {
        return userService.changePasswordWithOtp((UUID) auth.getPrincipal(), dto);
    }

    // ── 5. Profile ──────────────────────────────────────────────────────────────

    @GetMapping("/me")
    public UserProfileDto getMyProfile(Authentication auth) {
        return userService.getProfile((UUID) auth.getPrincipal());
    }

    // ── Helper ──────────────────────────────────────────────────────────────────

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
