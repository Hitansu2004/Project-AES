package com.aes.controller;

import com.aes.dto.request.UpdateUserRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.UserResponse;
import com.aes.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * User Controller — profile management endpoints.
 *
 * Per Section 4.2 (lines 540-549):
 *   GET /api/v1/users/me   — Current user profile (any role)
 *   PUT /api/v1/users/me   — Update profile (name, email)
 */
@RestController
@RequestMapping("/api/v1/users")
@Slf4j
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * GET /api/v1/users/me
     * Get current user profile including properties + AC units count (line 543-545).
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getMyProfile(@AuthenticationPrincipal UUID userId) {
        UserResponse response = userService.getUserProfile(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * PUT /api/v1/users/me
     * Update user profile (lines 547-549).
     */
    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateMyProfile(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody UpdateUserRequest request) {
        UserResponse response = userService.updateProfile(userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Profile updated"));
    }
}
