package com.aes.service;

import com.aes.entity.OtpToken;
import com.aes.exception.BusinessException;
import com.aes.repository.OtpTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * OTP Service — generates, validates, and rate-limits OTPs.
 *
 * Per Section 4.1 (lines 493-504) and Section 7 (lines 1675-1678):
 *   - Max 3 OTP requests per phone per 10 minutes
 *   - Max 5 verification attempts per OTP
 *   - OTP validity: 10 minutes
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OtpService {

    private final OtpTokenRepository otpTokenRepository;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();


    /**
     * Generate and save a 6-digit OTP for the given phone number.
     * Rate-limited to max 3 OTPs per phone per 10 minutes (line 499, 1676).
     *
     * @return the generated OTP code
     */
    @Transactional
    public String generateOtp(String phoneNumber) {
        // Check rate limit: max 3 OTPs per phone per 10 minutes
        OffsetDateTime tenMinutesAgo = OffsetDateTime.now().minusMinutes(10);
        long recentCount = otpTokenRepository.countByPhoneNumberAndCreatedAtAfter(phoneNumber, tenMinutesAgo);

        if (recentCount >= 3) {
            throw new BusinessException("OTP_RATE_LIMIT", "Too many OTP requests. Please wait before trying again.",
                    HttpStatus.TOO_MANY_REQUESTS);
        }

        // Generate 6-digit OTP
        String otpCode = String.format("%06d", SECURE_RANDOM.nextInt(1000000));

        // Save to otp_tokens with expires_at = NOW() + 10 minutes
        OtpToken otpToken = OtpToken.builder()
                .phoneNumber(phoneNumber)
                .otpCode(otpCode)
                .expiresAt(OffsetDateTime.now().plusMinutes(10))
                .isUsed(false)
                .attemptCount(0)
                .build();

        otpTokenRepository.save(otpToken);

        // In production: would call Twilio SMS API here

        return otpCode;
    }

    /**
     * Verify OTP for the given phone number.
     *
     * Per lines 510-514:
     *   1. Find latest unused OTP for phone where is_used=false and expires_at > NOW()
     *   2. Increment attempt_count; if > 5, invalidate OTP and return error
     *   3. Compare OTP code (case-insensitive)
     *   4. Mark OTP as used
     *
     * @return true if OTP is valid
     */
    @Transactional
    public boolean verifyOtp(String phoneNumber, String otp) {
        OffsetDateTime now = OffsetDateTime.now();



        // Find latest unused, non-expired OTP for this phone
        Optional<OtpToken> otpTokenOpt = otpTokenRepository
                .findFirstByPhoneNumberAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(phoneNumber, now);

        if (otpTokenOpt.isEmpty()) {
            throw new BusinessException("OTP_EXPIRED", "OTP has expired or not found. Please request a new one.",
                    HttpStatus.BAD_REQUEST);
        }

        OtpToken otpToken = otpTokenOpt.get();

        // Increment attempt count
        otpToken.setAttemptCount(otpToken.getAttemptCount() + 1);

        // Max 5 verification attempts per OTP (line 512, 1677)
        if (otpToken.getAttemptCount() > 5) {
            otpToken.setIsUsed(true); // invalidate
            otpTokenRepository.save(otpToken);
            throw new BusinessException("OTP_MAX_ATTEMPTS", "Maximum verification attempts exceeded. Request a new OTP.",
                    HttpStatus.TOO_MANY_REQUESTS);
        }

        // Compare OTP code (case-insensitive as per line 513)
        if (!otpToken.getOtpCode().equalsIgnoreCase(otp)) {
            otpTokenRepository.save(otpToken);
            throw new BusinessException("OTP_INVALID", "Invalid OTP. Please try again.",
                    HttpStatus.BAD_REQUEST);
        }

        // Mark OTP as used (line 514)
        otpToken.setIsUsed(true);
        otpTokenRepository.save(otpToken);

        return true;
    }
}
