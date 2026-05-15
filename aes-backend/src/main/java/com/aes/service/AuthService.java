package com.aes.service;

import com.aes.dto.request.StaffLoginRequest;
import com.aes.dto.response.AuthResponse;
import com.aes.dto.response.OtpResponse;
import com.aes.dto.response.UserResponse;
import com.aes.entity.RefreshToken;
import com.aes.entity.User;
import com.aes.enums.UserRole;
import com.aes.exception.BusinessException;
import com.aes.exception.UnauthorizedException;
import com.aes.repository.RefreshTokenRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Auth Service — orchestrates OTP flow, staff login, token refresh, logout.
 *
 * Per Section 4.1 (lines 493-537):
 *   - send-otp: validate phone, rate limit, generate OTP
 *   - verify-otp: verify OTP, find/create user, generate tokens
 *   - staff-login: BCrypt password verification
 *   - refresh: new access token from refresh token
 *   - logout: delete refresh token
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private final OtpService otpService;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;



    @Value("${jwt.refresh-token-expiry}")
    private long refreshTokenExpirySeconds;

    /**
     * Send OTP to customer phone number.
     * Per lines 493-504.
     */
    public OtpResponse sendOtp(String phoneNumber) {
        String otpCode = otpService.generateOtp(phoneNumber);

        OtpResponse response = OtpResponse.builder()
                .expiresInSeconds(600) // 10 minutes

                .build();


        return response;
    }

    /**
     * Verify OTP and return JWT tokens.
     * Per lines 506-518:
     *   5. Find or create user record with role=CUSTOMER
     *   6. Generate JWT access token (15 min) + refresh token (7 days)
     *   7. Save refresh token to refresh_tokens table
     */
    @Transactional
    public AuthResponse verifyOtp(String phoneNumber, String otp) {
        otpService.verifyOtp(phoneNumber, otp);

        // Find or create user with role=CUSTOMER (line 515)
        User user = userRepository.findByPhoneNumber(phoneNumber)
                .orElseGet(() -> {
                    User newUser = User.builder()
                            .phoneNumber(phoneNumber)
                            .role(UserRole.CUSTOMER)
                            .isActive(true)
                            .build();
                    return userRepository.save(newUser);
                });

        if (!user.getIsActive()) {
            throw new BusinessException("USER_INACTIVE", "Account is deactivated. Contact support.",
                    HttpStatus.FORBIDDEN);
        }

        return generateAuthResponse(user);
    }

    /**
     * Staff login with phone + password (BCrypt).
     * Per lines 520-525.
     */
    @Transactional
    public AuthResponse staffLogin(StaffLoginRequest request) {
        User user = userRepository.findByPhoneNumber(request.getPhoneNumber())
                .orElseThrow(() -> new UnauthorizedException("Invalid credentials"));

        // Verify staff role
        if (user.getRole() == UserRole.CUSTOMER) {
            throw new UnauthorizedException("This login is for staff only. Customers use OTP login.");
        }

        // Verify password (BCrypt, strength 12 — Section 12, line 2002)
        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid credentials");
        }

        if (!user.getIsActive()) {
            throw new BusinessException("USER_INACTIVE", "Account is deactivated. Contact admin.",
                    HttpStatus.FORBIDDEN);
        }

        return generateAuthResponse(user);
    }

    /**
     * Refresh access token using refresh token.
     * Per lines 527-531.
     */
    @Transactional
    public AuthResponse refreshAccessToken(String refreshTokenStr) {
        // Validate the refresh JWT itself
        UUID userId = jwtService.extractUserId(refreshTokenStr);
        if (userId == null) {
            throw new UnauthorizedException("Invalid or expired refresh token");
        }

        // Find refresh token in DB
        RefreshToken storedToken = refreshTokenRepository.findByToken(refreshTokenStr)
                .orElseThrow(() -> new UnauthorizedException("Refresh token not found. Please login again."));

        // Check expiry
        if (storedToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
            refreshTokenRepository.delete(storedToken);
            throw new UnauthorizedException("Refresh token expired. Please login again.");
        }

        // Get user
        User user = storedToken.getUser();

        // Generate new access token only
        String newAccessToken = jwtService.generateAccessToken(user.getId(), user.getRole().name());

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .build();
    }

    /**
     * Logout — delete refresh token.
     * Per lines 533-537.
     */
    @Transactional
    public void logout(String refreshTokenStr) {
        refreshTokenRepository.findByToken(refreshTokenStr)
                .ifPresent(refreshTokenRepository::delete);
    }

    /**
     * Generate full auth response with access + refresh tokens + user info.
     */
    private AuthResponse generateAuthResponse(User user) {
        // Generate JWT tokens (lines 516-517)
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(user.getId());

        // Save refresh token to DB (line 517)
        RefreshToken refreshTokenEntity = RefreshToken.builder()
                .user(user)
                .token(refreshToken)
                .expiresAt(OffsetDateTime.now().plusSeconds(refreshTokenExpirySeconds))
                .build();
        refreshTokenRepository.save(refreshTokenEntity);

        // Build user response (line 518)
        UserResponse userResponse = UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .user(userResponse)
                .build();
    }
}
