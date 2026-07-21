package dev.manoj.demo.controllers;

import dev.manoj.demo.dto.AuthResponseDto;
import dev.manoj.demo.dto.RegisterUserDto;
import dev.manoj.demo.dto.UserProfileDto;
import dev.manoj.demo.service.UserService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /** POST /api/users/register */
    @PostMapping("/register")
    public AuthResponseDto register(@RequestBody RegisterUserDto dto) {
        return userService.register(dto);
    }

    /** POST /api/users/login — returns JWT */
    @PostMapping("/login")
    public AuthResponseDto login(@RequestBody Map<String, String> body) {
        return userService.login(body.get("email"), body.get("password"));
    }

    /** GET /api/users/me — profile of the logged-in user */
    @GetMapping("/me")
    public UserProfileDto getMyProfile(Authentication auth) {
        UUID userId = (UUID) auth.getPrincipal();
        return userService.getProfile(userId);
    }
}
