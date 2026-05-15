package com.aes.service;

import com.aes.config.AppProperties;
import com.aes.entity.OtpToken;
import com.aes.exception.BusinessException;
import com.aes.repository.OtpTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * OTP service — generates, dispatches, and verifies one-time passwords.
 *
 * <p>Per Section 4.1 (lines 493-518) and Section 7 (lines 1675-1678):</p>
 * <ul>
 *   <li>Six-digit numeric OTPs generated with {@link SecureRandom}.</li>
 *   <li>Rate limit: max 3 OTP requests per phone per 10 minutes.</li>
 *   <li>Verification: max 5 attempts per OTP; OTP valid for 10 minutes.</li>
 *   <li>Demo bypass: when {@code app.demo-mode=true}, the value of
 *       {@code app.demo-otp-bypass} is accepted as a universal OTP
 *       (spec line 2013 — "OTP always succeed with '000000' as fallback").
 *       The bypass never triggers in production where the property is empty.</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OtpService {

    private static final int OTP_LENGTH_DIGITS = 6;
    private static final int OTP_VALIDITY_MINUTES = 10;
    private static final int OTP_RATE_LIMIT_WINDOW_MINUTES = 10;
    private static final int OTP_RATE_LIMIT_COUNT = 3;
    private static final int OTP_MAX_VERIFICATION_ATTEMPTS = 5;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final OtpTokenRepository otpTokenRepository;
    private final SmsService smsService;
    private final AppProperties appProperties;

    /**
     * Generate, persist and dispatch a fresh OTP for the given phone number.
     *
     * @return the generated OTP code (callers expose it only when demo mode is enabled).
     */
    @Transactional
    public String generateOtp(String phoneNumber) {
        OffsetDateTime windowStart = OffsetDateTime.now().minusMinutes(OTP_RATE_LIMIT_WINDOW_MINUTES);
        long recentCount = otpTokenRepository.countByPhoneNumberAndCreatedAtAfter(phoneNumber, windowStart);
        if (recentCount >= OTP_RATE_LIMIT_COUNT) {
            throw new BusinessException(
                    "OTP_RATE_LIMIT",
                    "Too many OTP requests. Please wait a few minutes before trying again.",
                    HttpStatus.TOO_MANY_REQUESTS);
        }

        String otpCode = generateSecureOtp();

        OtpToken otpToken = OtpToken.builder()
                .phoneNumber(phoneNumber)
                .otpCode(otpCode)
                .expiresAt(OffsetDateTime.now().plusMinutes(OTP_VALIDITY_MINUTES))
                .isUsed(false)
                .attemptCount(0)
                .build();
        otpTokenRepository.save(otpToken);

        smsService.sendOtpSms(phoneNumber, otpCode);

        return otpCode;
    }

    /**
     * Verify a submitted OTP for the given phone number.
     *
     * @throws BusinessException with code {@code OTP_EXPIRED}, {@code OTP_INVALID},
     *         or {@code OTP_MAX_ATTEMPTS} on failure paths.
     */
    @Transactional
    public void verifyOtp(String phoneNumber, String submittedOtp) {
        // Demo bypass — only honored when explicitly enabled via configuration.
        if (isDemoBypass(submittedOtp)) {
            log.warn("Demo OTP bypass accepted for {}", phoneNumber);
            return;
        }

        OffsetDateTime now = OffsetDateTime.now();
        Optional<OtpToken> latest = otpTokenRepository
                .findFirstByPhoneNumberAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(phoneNumber, now);

        if (latest.isEmpty()) {
            throw new BusinessException(
                    "OTP_EXPIRED",
                    "OTP has expired or was not found. Please request a new one.",
                    HttpStatus.BAD_REQUEST);
        }

        OtpToken otpToken = latest.get();
        otpToken.setAttemptCount(otpToken.getAttemptCount() + 1);

        if (otpToken.getAttemptCount() > OTP_MAX_VERIFICATION_ATTEMPTS) {
            otpToken.setIsUsed(true);
            otpTokenRepository.save(otpToken);
            throw new BusinessException(
                    "OTP_MAX_ATTEMPTS",
                    "Maximum verification attempts exceeded. Please request a new OTP.",
                    HttpStatus.TOO_MANY_REQUESTS);
        }

        if (!otpToken.getOtpCode().equalsIgnoreCase(submittedOtp)) {
            otpTokenRepository.save(otpToken);
            throw new BusinessException(
                    "OTP_INVALID",
                    "Invalid OTP. Please try again.",
                    HttpStatus.BAD_REQUEST);
        }

        otpToken.setIsUsed(true);
        otpTokenRepository.save(otpToken);
    }

    private String generateSecureOtp() {
        int max = (int) Math.pow(10, OTP_LENGTH_DIGITS);
        return String.format("%0" + OTP_LENGTH_DIGITS + "d", SECURE_RANDOM.nextInt(max));
    }

    private boolean isDemoBypass(String submittedOtp) {
        if (!appProperties.isDemoMode()) {
            return false;
        }
        String bypass = appProperties.getDemoOtpBypass();
        return bypass != null && !bypass.isBlank() && bypass.equals(submittedOtp);
    }
}
