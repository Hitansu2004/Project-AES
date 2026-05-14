package com.aes.controller;

import com.aes.dto.request.CreatePropertyRequest;
import com.aes.dto.request.UpdatePropertyRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.PropertyResponse;
import com.aes.service.PropertyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Property Controller — CRUD endpoints for customer properties.
 *
 * Per Section 4.3 (lines 551-568):
 *   GET    /api/v1/properties             → CUSTOMER (own properties)
 *   POST   /api/v1/properties             → CUSTOMER
 *   GET    /api/v1/properties/{id}        → CUSTOMER (own), ADMIN
 *   PUT    /api/v1/properties/{id}        → CUSTOMER (own)
 */
@RestController
@RequestMapping("/api/v1/properties")
@Slf4j
@RequiredArgsConstructor
public class PropertyController {

    private final PropertyService propertyService;

    /**
     * GET /api/v1/properties
     * List of properties with AC unit count (line 555-557).
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<PropertyResponse>>> getMyProperties(
            @AuthenticationPrincipal UUID userId) {
        List<PropertyResponse> properties = propertyService.getCustomerProperties(userId);
        return ResponseEntity.ok(ApiResponse.success(properties));
    }

    /**
     * POST /api/v1/properties
     * Create new property (lines 559-561).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<PropertyResponse>> createProperty(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody CreatePropertyRequest request) {
        PropertyResponse response = propertyService.createProperty(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response, "Property created"));
    }

    /**
     * GET /api/v1/properties/{propertyId}
     * Property with full AC units list (lines 563-565).
     */
    @GetMapping("/{propertyId}")
    public ResponseEntity<ApiResponse<PropertyResponse>> getProperty(
            @PathVariable UUID propertyId,
            @AuthenticationPrincipal UUID userId) {
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"));
        PropertyResponse response = propertyService.getPropertyById(propertyId, userId, isAdmin);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * PUT /api/v1/properties/{propertyId}
     * Update property (lines 567-568).
     */
    @PutMapping("/{propertyId}")
    public ResponseEntity<ApiResponse<PropertyResponse>> updateProperty(
            @PathVariable UUID propertyId,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody UpdatePropertyRequest request) {
        PropertyResponse response = propertyService.updateProperty(propertyId, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Property updated"));
    }
}
