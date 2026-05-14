package com.aes.controller;

import com.aes.dto.request.ScheduleVisitRequest;
import com.aes.dto.response.AmcContractResponse;
import com.aes.dto.response.ApiResponse;
import com.aes.service.AmcService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * AMC Controller — AMC contract and visit management.
 *
 * Per Section 4.10 (lines 836-850):
 *   GET  /api/v1/amc/my-contracts              → list own contracts
 *   GET  /api/v1/amc/contracts/{contractId}     → contract detail
 *   POST /api/v1/amc/visits/{visitId}/schedule  → schedule a visit
 */
@RestController
@RequestMapping("/api/v1/amc")
@Slf4j
@RequiredArgsConstructor
public class AmcController {

    private final AmcService amcService;

    /**
     * GET /api/v1/amc/my-contracts
     * List own AMC contracts with visit schedule (lines 840-842).
     */
    @GetMapping("/my-contracts")
    public ResponseEntity<ApiResponse<List<AmcContractResponse>>> getMyContracts(
            @AuthenticationPrincipal UUID userId) {
        List<AmcContractResponse> contracts = amcService.getCustomerContracts(userId);
        return ResponseEntity.ok(ApiResponse.success(contracts));
    }

    /**
     * GET /api/v1/amc/contracts/{contractId}
     * Full AMC contract with all visits (lines 844-846).
     */
    @GetMapping("/contracts/{contractId}")
    public ResponseEntity<ApiResponse<AmcContractResponse>> getContract(
            @PathVariable UUID contractId,
            @AuthenticationPrincipal UUID userId) {
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"));
        AmcContractResponse response = amcService.getContractById(contractId, userId, isAdmin);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * POST /api/v1/amc/visits/{visitId}/schedule
     * Schedule an AMC visit (lines 848-850).
     */
    @PostMapping("/visits/{visitId}/schedule")
    public ResponseEntity<ApiResponse<AmcContractResponse.AmcVisitResponse>> scheduleVisit(
            @PathVariable UUID visitId,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody ScheduleVisitRequest request) {
        boolean isAdmin = SecurityContextHolder.getContext().getAuthentication()
                .getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"));
        AmcContractResponse.AmcVisitResponse response = amcService.scheduleVisit(
                visitId, userId, isAdmin, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Visit scheduled"));
    }
}
