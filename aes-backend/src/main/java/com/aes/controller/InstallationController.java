package com.aes.controller;

import com.aes.dto.request.CreateInstallationRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.InstallationRequestResponse;
import com.aes.enums.UserRole;
import com.aes.service.InstallationRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Installation Controller — manages installation requests.
 *
 * Per Section 4.5 (lines 586-621):
 *   POST /api/v1/installation-requests      → create request
 *   GET  /api/v1/installation-requests      → list (filtered, paginated)
 *   GET  /api/v1/installation-requests/{id} → get single request
 */
@RestController
@RequestMapping("/api/v1/installation-requests")
@Slf4j
@RequiredArgsConstructor
public class InstallationController {

    private final InstallationRequestService installationRequestService;

    /**
     * POST /api/v1/installation-requests
     * Create new installation request (lines 590-614).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<InstallationRequestResponse>> createInstallationRequest(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody CreateInstallationRequest request) {
        InstallationRequestResponse response = installationRequestService
                .createInstallationRequest(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Installation request submitted"));
    }

    /**
     * GET /api/v1/installation-requests
     * List installation requests (lines 616-618).
     * Query: ?status=PENDING&page=0&size=20
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<InstallationRequestResponse>>> listInstallationRequests(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UserRole role = extractUserRole();
        Pageable pageable = PageRequest.of(page, size);
        Page<InstallationRequestResponse> result = installationRequestService
                .listInstallationRequests(userId, role, status, pageable);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * GET /api/v1/installation-requests/{id}
     * Get single installation request (lines 620-621).
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<InstallationRequestResponse>> getInstallationRequest(
            @PathVariable UUID id,
            @AuthenticationPrincipal UUID userId) {
        UserRole role = extractUserRole();
        InstallationRequestResponse response = installationRequestService
                .getInstallationRequest(id, userId, role);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /** Lookup by human-readable request number (e.g. INS-2026-2201). */
    @GetMapping("/by-number/{requestNumber}")
    public ResponseEntity<ApiResponse<InstallationRequestResponse>> getByRequestNumber(
            @PathVariable String requestNumber,
            @AuthenticationPrincipal UUID userId) {
        UserRole role = extractUserRole();
        InstallationRequestResponse response = installationRequestService
                .getByRequestNumber(requestNumber, userId, role);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Extract user role from SecurityContext.
     */
    private UserRole extractUserRole() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))) return UserRole.ADMIN;
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_OPS_MANAGER"))) return UserRole.OPS_MANAGER;
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_SERVICE_MANAGER"))) return UserRole.SERVICE_MANAGER;
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_CRM_AGENT"))) return UserRole.CRM_AGENT;
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_SITE_ENGINEER"))) return UserRole.SITE_ENGINEER;
        return UserRole.CUSTOMER;
    }
}
