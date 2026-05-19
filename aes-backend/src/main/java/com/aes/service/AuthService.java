package com.aes.service;

import com.aes.config.AppProperties;
import com.aes.config.JwtConfig;
import com.aes.dto.response.AuthResponse;
import com.aes.dto.response.OtpResponse;
import com.aes.dto.response.UserResponse;
import com.aes.entity.RefreshToken;
import com.aes.entity.User;
import com.aes.enums.UserRole;
import com.aes.exception.BusinessException;
import com.aes.exception.UnauthorizedException;
import com.aes.repository.RefreshTokenRepository;
import com.aes.repository.StaffProfileRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Auth Service — orchestrates the unified OTP flow, token refresh and logout.
 *
 * <p>Every role — customer, ops manager, CRM agent, engineer, service manager
 * and admin — authenticates via {@link #verifyOtp(String, String)}. Staff
 * records already exist in the {@code users} table with their role; the OTP
 * resolution looks the phone number up, finds the matching user and mints
 * tokens against that role. The auto-create branch only fires for unknown
 * numbers, which become customers.</p>
 *
 * <p>Per Section 4.1 (lines 493-537):</p>
 * <ul>
 *   <li>{@link #sendOtp(String)} — generate OTP, dispatch SMS, return demo echo when applicable.</li>
 *   <li>{@link #verifyOtp(String, String)} — validate OTP, find/create user, mint tokens.</li>
 *   <li>{@link #refreshAccessToken(String)} — exchange refresh token for a new access token.</li>
 *   <li>{@link #logout(String)} — invalidate refresh token.</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private static final int OTP_VALIDITY_SECONDS = 600;

    private final OtpService otpService;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final AppProperties appProperties;
    private final JwtConfig jwtConfig;

    /**
     * Send an OTP to the customer's phone number.
     *
     * <p>The generated OTP is echoed back in the response only when
     * {@code app.demo-mode=true} (Section 4.1 line 504). In production the
     * {@code otpForDemo} field is omitted entirely.</p>
     */
    public OtpResponse sendOtp(String phoneNumber) {
        String otpCode = otpService.generateOtp(phoneNumber);

        return OtpResponse.builder()
                .expiresInSeconds(OTP_VALIDITY_SECONDS)
                .otpForDemo(appProperties.isDemoMode() ? otpCode : null)
                .build();
    }

    /**
     * Verify the submitted OTP, find or create the customer record, and mint tokens.
     */
    @Transactional
    public AuthResponse verifyOtp(String phoneNumber, String otp) {
        otpService.verifyOtp(phoneNumber, otp);

        User user = userRepository.findByPhoneNumber(phoneNumber)
                .orElseGet(() -> userRepository.save(User.builder()
                        .phoneNumber(phoneNumber)
                        .role(UserRole.CUSTOMER)
                        .isActive(true)
                        .build()));

        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new BusinessException("USER_INACTIVE",
                    "Account is deactivated. Please contact support.",
                    HttpStatus.FORBIDDEN);
        }

        return generateAuthResponse(user);
    }

    /**
     * Mint a new access token from a still-valid refresh token.
     */
    @Transactional
    public AuthResponse refreshAccessToken(String refreshTokenStr) {
        UUID userId = jwtService.extractUserId(refreshTokenStr);
        if (userId == null) {
            throw new UnauthorizedException("Invalid or expired refresh token");
        }

        RefreshToken storedToken = refreshTokenRepository.findByToken(refreshTokenStr)
                .orElseThrow(() -> new UnauthorizedException("Refresh token not found. Please log in again."));

        if (storedToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
            refreshTokenRepository.delete(storedToken);
            throw new UnauthorizedException("Refresh token expired. Please log in again.");
        }

        User user = storedToken.getUser();
        String newAccessToken = jwtService.generateAccessToken(user.getId(), user.getRole().name());

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .build();
    }

    /**
     * Invalidate the refresh token (best effort — silent on unknown token).
     */
    @Transactional
    public void logout(String refreshTokenStr) {
        refreshTokenRepository.findByToken(refreshTokenStr)
                .ifPresent(refreshTokenRepository::delete);
    }

    private AuthResponse generateAuthResponse(User user) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(user.getId());

        RefreshToken refreshTokenEntity = RefreshToken.builder()
                .user(user)
                .token(refreshToken)
                .expiresAt(OffsetDateTime.now().plusSeconds(jwtConfig.getRefreshTokenExpiry()))
                .build();
        refreshTokenRepository.save(refreshTokenEntity);

        UserResponse.UserResponseBuilder urb = UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .role(user.getRole().name());
        staffProfileRepository.findById(user.getId()).ifPresent(sp -> {
            urb.onShift(Boolean.TRUE.equals(sp.getOnShift()));
            urb.branch(sp.getBranch());
        });
        UserResponse userResponse = urb.build();

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(userResponse)
                .build();
    }
}
