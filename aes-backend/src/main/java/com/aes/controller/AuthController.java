package com.aes.controller;

import com.aes.dto.request.*;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.AuthResponse;
import com.aes.dto.response.OtpResponse;
import com.aes.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Auth Controller — unified phone+OTP authentication for all roles.
 *
 * <p>Customers, ops managers, CRM agents, engineers, service managers and
 * admins all sign in through {@code /verify-otp}. There is no separate staff
 * password endpoint — staff users already exist in {@code users} with their
 * role, and the OTP flow resolves them automatically.</p>
 *
 * Per Section 4.1 (lines 489-537):
 *   POST /api/v1/auth/send-otp     — Public, send OTP to any phone number
 *   POST /api/v1/auth/verify-otp   — Public, verify OTP and return JWT tokens
 *   POST /api/v1/auth/refresh      — Public, refresh access token
 *   POST /api/v1/auth/logout       — Auth required, invalidate refresh token
 */
@RestController
@RequestMapping("/api/v1/auth")
@Slf4j
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /api/v1/auth/send-otp
     * Send OTP to a phone number (any role). Works for staff and customers alike.
     */
    @PostMapping("/send-otp")
    public ResponseEntity<ApiResponse<OtpResponse>> sendOtp(@Valid @RequestBody SendOtpRequest request) {
        log.info("OTP request for phone: {}", request.getPhoneNumber().substring(0, 6) + "****");
        OtpResponse response = authService.sendOtp(request.getPhoneNumber());
        return ResponseEntity.ok(ApiResponse.success(response, "OTP sent successfully"));
    }

    /**
     * POST /api/v1/auth/verify-otp
     * Verify OTP and return JWT tokens. Resolves the user (any role) by phone number.
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<AuthResponse>> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        log.info("OTP verification for phone: {}", request.getPhoneNumber().substring(0, 6) + "****");
        AuthResponse response = authService.verifyOtp(request.getPhoneNumber(), request.getOtp());
        return ResponseEntity.ok(ApiResponse.success(response, "Login successful"));
    }

    /**
     * POST /api/v1/auth/refresh
     * Get new access token using refresh token (lines 527-531).
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refreshAccessToken(request.getRefreshToken());
        return ResponseEntity.ok(ApiResponse.success(response, "Token refreshed"));
    }

    /**
     * POST /api/v1/auth/logout
     * Invalidate refresh token (lines 533-537).
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request.getRefreshToken());
        return ResponseEntity.ok(ApiResponse.success(null, "Logged out successfully"));
    }
}
