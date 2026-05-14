package com.aes.controller;

import com.aes.dto.response.*;
import com.aes.service.DashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Dashboard Controller — analytics endpoints.
 *
 * Per Section 4.11 (lines 852-892):
 *   GET /api/v1/dashboard/customer    → CUSTOMER
 *   GET /api/v1/dashboard/crm         → CRM_AGENT
 *   GET /api/v1/dashboard/escalation  → SERVICE_MANAGER, ADMIN
 */
@RestController
@RequestMapping("/api/v1/dashboard")
@Slf4j
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    /**
     * GET /api/v1/dashboard/customer
     * Customer overview (lines 856-866).
     */
    @GetMapping("/customer")
    public ResponseEntity<ApiResponse<CustomerDashboardResponse>> getCustomerDashboard(
            @AuthenticationPrincipal UUID userId) {
        CustomerDashboardResponse response = dashboardService.getCustomerDashboard(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * GET /api/v1/dashboard/crm
     * CRM agent inbox (lines 868-878).
     */
    @GetMapping("/crm")
    public ResponseEntity<ApiResponse<CrmDashboardResponse>> getCrmDashboard(
            @AuthenticationPrincipal UUID userId) {
        CrmDashboardResponse response = dashboardService.getCrmDashboard(userId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * GET /api/v1/dashboard/escalation
     * Escalation management (lines 880-892).
     */
    @GetMapping("/escalation")
    public ResponseEntity<ApiResponse<EscalationDashboardResponse>> getEscalationDashboard() {
        EscalationDashboardResponse response = dashboardService.getEscalationDashboard();
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
