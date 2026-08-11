package dev.manoj.demo.repository;

import dev.manoj.demo.enums.OtpPurpose;
import dev.manoj.demo.model.OtpRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OtpRecordRepository extends JpaRepository<OtpRecord, UUID> {

    /** Find the most recent active (non-used) OTP for a user+purpose. */
    Optional<OtpRecord> findTopByUserIdAndPurposeAndUsedFalseOrderByCreatedAtDesc(
            UUID userId, OtpPurpose purpose);

    /** Delete all OTP records for a user (cleanup on password change). */
    void deleteByUserId(UUID userId);

    /** Find all unused OTPs for a user+purpose (to invalidate old ones). */
    List<OtpRecord> findByUserIdAndPurposeAndUsedFalse(UUID userId, OtpPurpose purpose);
}
