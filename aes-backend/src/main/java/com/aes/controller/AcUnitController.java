package com.aes.controller;

import com.aes.dto.request.CreateAcUnitRequest;
import com.aes.dto.request.UpdateAcUnitRequest;
import com.aes.dto.response.AcUnitResponse;
import com.aes.dto.response.ApiResponse;
import com.aes.service.AcUnitService;
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
 * AC Unit Controller — CRUD endpoints for AC units.
 *
 * Per Section 4.4 (lines 570-584):
 *   GET  /api/v1/properties/{propertyId}/ac-units   → list units
 *   POST /api/v1/properties/{propertyId}/ac-units   → add unit
 *   PUT  /api/v1/ac-units/{acUnitId}                → update unit
 */
@RestController
@Slf4j
@RequiredArgsConstructor
public class AcUnitController {

    private final AcUnitService acUnitService;

    /**
     * GET /api/v1/properties/{propertyId}/ac-units
     * List AC units for a property (lines 574-576).
     */
    @GetMapping("/api/v1/properties/{propertyId}/ac-units")
    public ResponseEntity<ApiResponse<List<AcUnitResponse>>> getAcUnits(
            @PathVariable UUID propertyId,
            @AuthenticationPrincipal UUID userId) {
        List<AcUnitResponse> units = acUnitService.getAcUnitsByProperty(propertyId, userId);
        return ResponseEntity.ok(ApiResponse.success(units));
    }

    /**
     * POST /api/v1/properties/{propertyId}/ac-units
     * Create AC unit for a property (lines 578-581).
     */
    @PostMapping("/api/v1/properties/{propertyId}/ac-units")
    public ResponseEntity<ApiResponse<AcUnitResponse>> createAcUnit(
            @PathVariable UUID propertyId,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody CreateAcUnitRequest request) {
        AcUnitResponse response = acUnitService.createAcUnit(propertyId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response, "AC unit added"));
    }

    /**
     * PUT /api/v1/ac-units/{acUnitId}
     * Update AC unit (lines 583-584). CUSTOMER (own) or ADMIN.
     */
    @PutMapping("/api/v1/ac-units/{acUnitId}")
    public ResponseEntity<ApiResponse<AcUnitResponse>> updateAcUnit(
            @PathVariable UUID acUnitId,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody UpdateAcUnitRequest request) {
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"));
        AcUnitResponse response = acUnitService.updateAcUnit(acUnitId, userId, isAdmin, request);
        return ResponseEntity.ok(ApiResponse.success(response, "AC unit updated"));
    }
}
