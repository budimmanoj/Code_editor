package dev.manoj.demo.service;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.CreateEmailResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final Resend resend;
    private final String fromAddress;

    public EmailService(
            @Value("${resend.api-key}") String apiKey,
            @Value("${resend.from-email:CodeRoom <onboarding@resend.dev>}") String fromAddress) {
        this.resend = new Resend(apiKey);
        this.fromAddress = fromAddress;
    }

    public void sendRegistrationOtp(String toEmail, String otp) {
        send(
            toEmail,
            "CodeRoom — Verify Your Email",
            "Your registration OTP is: " + otp + "\n\n" +
            "This code expires in 5 minutes.\n" +
            "If you did not request this, please ignore this email."
        );
    }

    public void sendPasswordResetOtp(String toEmail, String otp) {
        send(
            toEmail,
            "CodeRoom — Password Reset OTP",
            "Your password reset OTP is: " + otp + "\n\n" +
            "This code expires in 5 minutes.\n" +
            "If you did not request a password reset, please ignore this email."
        );
    }

    public void sendPasswordChangeOtp(String toEmail, String otp) {
        send(
            toEmail,
            "CodeRoom — Password Change OTP",
            "Your password change OTP is: " + otp + "\n\n" +
            "This code expires in 5 minutes.\n" +
            "If you did not request this, please change your password immediately."
        );
    }

    private void send(String to, String subject, String body) {
        try {
            CreateEmailOptions params = CreateEmailOptions.builder()
                .from(fromAddress)
                .to(to)
                .subject(subject)
                .text(body)
                .build();

            CreateEmailResponse data = resend.emails().send(params);
            log.info("Email sent to {} — subject: {} (ID: {})", to, subject, data.getId());
        } catch (ResendException e) {
            // Log but do not expose internal Resend errors to the caller
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Failed to send email. Please try again later.");
        } catch (Exception e) {
            log.error("Unexpected error sending email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Failed to send email. Please try again later.");
        }
    }
}
