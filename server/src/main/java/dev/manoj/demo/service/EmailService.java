package dev.manoj.demo.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public EmailService(
            JavaMailSender mailSender,
            @Value("${mail.from:noreply@coderoom.dev}") String fromAddress) {
        this.mailSender = mailSender;
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
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(fromAddress);
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(body);
            mailSender.send(msg);
            log.info("Email sent to {} — subject: {}", to, subject);
        } catch (Exception e) {
            // Log but do not expose internal SMTP errors to the caller
            log.error("Failed to send email to {}: {}", to, e.getMessage());
            throw new RuntimeException("Failed to send email. Please try again later.");
        }
    }
}
