package dev.manoj.demo.service;

import dev.manoj.demo.dto.*;
import dev.manoj.demo.enums.OtpPurpose;
import dev.manoj.demo.enums.RoomRole;
import dev.manoj.demo.model.OtpRecord;
import dev.manoj.demo.model.PendingRegistration;
import dev.manoj.demo.model.User;
import dev.manoj.demo.repository.OtpRecordRepository;
import dev.manoj.demo.repository.PendingRegistrationRepository;
import dev.manoj.demo.repository.RoomParticipantRepository;
import dev.manoj.demo.repository.UserRepository;
import dev.manoj.demo.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.UUID;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final PendingRegistrationRepository pendingRegistrationRepository;
    private final OtpRecordRepository otpRecordRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final EmailService emailService;
    private final Random random = new Random();

    public UserService(UserRepository userRepository,
                       RoomParticipantRepository roomParticipantRepository,
                       PendingRegistrationRepository pendingRegistrationRepository,
                       OtpRecordRepository otpRecordRepository,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil,
                       EmailService emailService) {
        this.userRepository = userRepository;
        this.roomParticipantRepository = roomParticipantRepository;
        this.pendingRegistrationRepository = pendingRegistrationRepository;
        this.otpRecordRepository = otpRecordRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.emailService = emailService;
    }

    private String normalizeEmail(String email) {
        return email != null ? email.trim().toLowerCase(Locale.ROOT) : null;
    }

    private String generateOtp() {
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    // ── 1. Registration ─────────────────────────────────────────────────────────

    public MessageResponseDto initiateRegistration(RegisterUserDto dto) {
        if (!dto.getPassword().equals(dto.getConfirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }
        
        String normalized = normalizeEmail(dto.getEmail());
        if (userRepository.existsByEmail(normalized)) {
            throw new RuntimeException("Email already registered");
        }
        if (userRepository.findByUsername(dto.getUsername()).isPresent()) {
            throw new RuntimeException("Username already exists");
        }

        // Cleanup any old pending registration for this email
        pendingRegistrationRepository.deleteByNormalizedEmail(normalized);

        String otp = generateOtp();
        
        PendingRegistration pending = new PendingRegistration();
        pending.setUsername(dto.getUsername());
        pending.setNormalizedEmail(normalized);
        pending.setPasswordHash(passwordEncoder.encode(dto.getPassword()));
        pending.setOtpHash(passwordEncoder.encode(otp));
        pending.setOtpExpiresAt(LocalDateTime.now().plusMinutes(5));
        pending.setLastOtpSentAt(LocalDateTime.now());
        
        pendingRegistrationRepository.save(pending);
        
        emailService.sendRegistrationOtp(normalized, otp);
        
        return new MessageResponseDto("OTP sent to your email.");
    }

    public MessageResponseDto resendRegistrationOtp(String email) {
        String normalized = normalizeEmail(email);
        PendingRegistration pending = pendingRegistrationRepository.findByNormalizedEmail(normalized)
                .orElseThrow(() -> new RuntimeException("No pending registration found for this email"));

        if (pending.getLastOtpSentAt().plusSeconds(30).isAfter(LocalDateTime.now())) {
            throw new RuntimeException("Please wait before requesting a new OTP.");
        }

        String otp = generateOtp();
        pending.setOtpHash(passwordEncoder.encode(otp));
        pending.setOtpExpiresAt(LocalDateTime.now().plusMinutes(5));
        pending.setLastOtpSentAt(LocalDateTime.now());
        pending.setOtpAttempts(0);
        
        pendingRegistrationRepository.save(pending);
        emailService.sendRegistrationOtp(normalized, otp);

        return new MessageResponseDto("New OTP sent to your email.");
    }

    public AuthResponseDto verifyRegistrationOtp(OtpVerifyDto dto) {
        String normalized = normalizeEmail(dto.getEmail());
        PendingRegistration pending = pendingRegistrationRepository.findByNormalizedEmail(normalized)
                .orElseThrow(() -> new RuntimeException("No pending registration found for this email"));

        if (LocalDateTime.now().isAfter(pending.getOtpExpiresAt())) {
            throw new RuntimeException("OTP has expired. Please request a new one.");
        }

        if (pending.getOtpAttempts() >= 5) {
            pendingRegistrationRepository.delete(pending);
            throw new RuntimeException("Too many invalid attempts. Registration cancelled.");
        }

        if (!passwordEncoder.matches(dto.getOtp(), pending.getOtpHash())) {
            pending.setOtpAttempts(pending.getOtpAttempts() + 1);
            pendingRegistrationRepository.save(pending);
            throw new RuntimeException("Invalid OTP");
        }

        // Check uniqueness again just to be safe
        if (userRepository.existsByEmail(normalized) || userRepository.findByUsername(pending.getUsername()).isPresent()) {
            pendingRegistrationRepository.delete(pending);
            throw new RuntimeException("Email or username taken during verification");
        }

        // Success -> Create User
        User user = new User();
        user.setUsername(pending.getUsername());
        user.setEmail(normalized);
        user.setPasswordHash(pending.getPasswordHash());
        user.setEmailVerified(true);
        User saved = userRepository.save(user);

        // Delete pending record
        pendingRegistrationRepository.delete(pending);

        String token = jwtUtil.generate(saved.getId(), saved.getEmail());
        return new AuthResponseDto(token, saved.getId(), saved.getUsername(), saved.getEmail());
    }

    // ── 2. Login ────────────────────────────────────────────────────────────────

    public AuthResponseDto login(String email, String password) {
        String normalized = normalizeEmail(email);
        User user = userRepository.findByEmail(normalized)
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));
        
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }

        String token = jwtUtil.generate(user.getId(), user.getEmail());
        return new AuthResponseDto(token, user.getId(), user.getUsername(), user.getEmail());
    }

    // ── 3. Forgot Password ──────────────────────────────────────────────────────

    public MessageResponseDto initiateForgotPassword(ForgotPasswordDto dto) {
        String normalized = normalizeEmail(dto.getEmail());
        userRepository.findByEmail(normalized).ifPresent(user -> {
            // Check cooldown silently to avoid email enumeration
            boolean inCooldown = otpRecordRepository
                .findTopByUserIdAndPurposeAndUsedFalseOrderByCreatedAtDesc(user.getId(), OtpPurpose.PASSWORD_RESET)
                .map(r -> r.getLastOtpSentAt().plusSeconds(30).isAfter(LocalDateTime.now()))
                .orElse(false);

            if (!inCooldown) {
                invalidateOldOtps(user.getId(), OtpPurpose.PASSWORD_RESET);
                
                String otp = generateOtp();
                OtpRecord record = new OtpRecord();
                record.setUserId(user.getId());
                record.setPurpose(OtpPurpose.PASSWORD_RESET);
                record.setOtpHash(passwordEncoder.encode(otp));
                record.setOtpExpiresAt(LocalDateTime.now().plusMinutes(5));
                record.setLastOtpSentAt(LocalDateTime.now());
                
                otpRecordRepository.save(record);
                emailService.sendPasswordResetOtp(normalized, otp);
            }
        });
        
        // Always return generic response to prevent account enumeration
        return new MessageResponseDto("If an account exists for this email, an OTP has been sent. Please wait a moment before requesting again.");
    }

    public TokenResponseDto verifyForgotPasswordOtp(OtpVerifyDto dto) {
        String normalized = normalizeEmail(dto.getEmail());
        User user = userRepository.findByEmail(normalized)
                .orElseThrow(() -> new RuntimeException("Invalid OTP")); // generic error

        OtpRecord record = getValidOtpRecord(user.getId(), OtpPurpose.PASSWORD_RESET, dto.getOtp());
        
        // Mark as used so it can't be used again
        record.setUsed(true);
        otpRecordRepository.save(record);

        // Generate short-lived reset token
        String resetToken = jwtUtil.generateResetToken(user.getId(), user.getEmail());
        return new TokenResponseDto(resetToken);
    }

    public MessageResponseDto resetPassword(UUID userId, ResetPasswordDto dto) {
        if (!dto.getNewPassword().equals(dto.getConfirmPassword())) {
            throw new RuntimeException("Passwords do not match");
        }
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setPasswordHash(passwordEncoder.encode(dto.getNewPassword()));
        userRepository.save(user);
        
        // Cleanup OTP records
        otpRecordRepository.deleteByUserId(user.getId());
        
        return new MessageResponseDto("Password reset successfully.");
    }

    // ── 4. Change Password ──────────────────────────────────────────────────────

    public MessageResponseDto changePasswordWithCurrentPassword(UUID userId, ChangePasswordDto dto) {
        if (!dto.getNewPassword().equals(dto.getConfirmPassword())) {
            throw new RuntimeException("New passwords do not match");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(dto.getCurrentPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(dto.getNewPassword()));
        userRepository.save(user);

        return new MessageResponseDto("Password changed successfully.");
    }

    public MessageResponseDto sendChangePasswordOtp(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        otpRecordRepository.findTopByUserIdAndPurposeAndUsedFalseOrderByCreatedAtDesc(user.getId(), OtpPurpose.CHANGE_PASSWORD)
                .ifPresent(lastRecord -> {
                    if (lastRecord.getLastOtpSentAt().plusSeconds(30).isAfter(LocalDateTime.now())) {
                        throw new RuntimeException("Please wait before requesting a new OTP.");
                    }
                });

        invalidateOldOtps(user.getId(), OtpPurpose.CHANGE_PASSWORD);

        String otp = generateOtp();
        OtpRecord record = new OtpRecord();
        record.setUserId(user.getId());
        record.setPurpose(OtpPurpose.CHANGE_PASSWORD);
        record.setOtpHash(passwordEncoder.encode(otp));
        record.setOtpExpiresAt(LocalDateTime.now().plusMinutes(5));
        record.setLastOtpSentAt(LocalDateTime.now());
        
        otpRecordRepository.save(record);
        emailService.sendPasswordChangeOtp(user.getEmail(), otp);

        return new MessageResponseDto("OTP sent to your registered email.");
    }

    public MessageResponseDto changePasswordWithOtp(UUID userId, OtpChangePasswordDto dto) {
        if (!dto.getNewPassword().equals(dto.getConfirmPassword())) {
            throw new RuntimeException("New passwords do not match");
        }

        getValidOtpRecord(userId, OtpPurpose.CHANGE_PASSWORD, dto.getOtp());
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(dto.getNewPassword()));
        userRepository.save(user);

        // Cleanup
        otpRecordRepository.deleteByUserId(user.getId());

        return new MessageResponseDto("Password changed successfully.");
    }

    // ── Helper ──────────────────────────────────────────────────────────────────

    private void invalidateOldOtps(UUID userId, OtpPurpose purpose) {
        List<OtpRecord> existing = otpRecordRepository.findByUserIdAndPurposeAndUsedFalse(userId, purpose);
        for (OtpRecord r : existing) {
            r.setUsed(true);
        }
        otpRecordRepository.saveAll(existing);
    }

    private OtpRecord getValidOtpRecord(UUID userId, OtpPurpose purpose, String otp) {
        OtpRecord record = otpRecordRepository.findTopByUserIdAndPurposeAndUsedFalseOrderByCreatedAtDesc(userId, purpose)
                .orElseThrow(() -> new RuntimeException("No active OTP found or OTP has expired."));

        if (LocalDateTime.now().isAfter(record.getOtpExpiresAt())) {
            throw new RuntimeException("OTP has expired. Please request a new one.");
        }

        if (record.getOtpAttempts() >= 5) {
            record.setUsed(true);
            otpRecordRepository.save(record);
            throw new RuntimeException("Too many invalid attempts. OTP invalidated.");
        }

        if (!passwordEncoder.matches(otp, record.getOtpHash())) {
            record.setOtpAttempts(record.getOtpAttempts() + 1);
            otpRecordRepository.save(record);
            throw new RuntimeException("Invalid OTP");
        }

        return record;
    }

    // ── Profile ─────────────────────────────────────────────────────────────────

    public UserProfileDto getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<RoomSummaryDto> created = roomParticipantRepository
                .findByUser_IdAndRole(userId, RoomRole.ADMIN)
                .stream()
                .map(p -> {
                    var r = p.getRoom();
                    RoomSummaryDto s = new RoomSummaryDto();
                    s.setId(r.getId());
                    s.setName(r.getName());
                    s.setInviteCode(r.getInviteCode());
                    s.setCreatedAt(r.getCreatedAt());
                    s.setParticipantCount(roomParticipantRepository.findByRoom_Id(r.getId()).size());
                    return s;
                }).toList();

        List<RoomSummaryDto> joined = roomParticipantRepository
                .findByUser_IdAndRole(userId, RoomRole.USER)
                .stream()
                .map(p -> {
                    var r = p.getRoom();
                    RoomSummaryDto s = new RoomSummaryDto();
                    s.setId(r.getId());
                    s.setName(r.getName());
                    s.setInviteCode(r.getInviteCode());
                    s.setCreatedAt(r.getCreatedAt());
                    s.setParticipantCount(roomParticipantRepository.findByRoom_Id(r.getId()).size());
                    return s;
                }).toList();

        UserProfileDto profile = new UserProfileDto();
        profile.setId(user.getId());
        profile.setUsername(user.getUsername());
        profile.setEmail(user.getEmail());
        profile.setRoomsCreated(created);
        profile.setRoomsJoined(joined);
        return profile;
    }
}
