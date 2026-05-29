package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.entity.AmcUpgradeRequest;
import com.aes.service.AmcUpgradeService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * AMC Upgrade Request endpoints.
 *
 * <ul>
 *   <li>{@code POST /api/v1/amc-upgrades}      — customer creates a lead</li>
 *   <li>{@code GET  /api/v1/amc-upgrades/mine} — customer sees their leads</li>
 *   <li>{@code GET  /api/v1/amc-upgrades/open} — Ops/CRM/Admin triage queue</li>
 *   <li>{@code POST /api/v1/amc-upgrades/{id}/assign}    — Ops assigns CRM</li>
 *   <li>{@code POST /api/v1/amc-upgrades/{id}/contacted} — CRM marks contacted</li>
 *   <li>{@code POST /api/v1/amc-upgrades/{id}/cancel}    — any owner cancels</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/amc-upgrades")
@RequiredArgsConstructor
public class AmcUpgradeController {

    private final AmcUpgradeService service;

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<Map<String, Object>> create(
            @AuthenticationPrincipal UUID customerId,
            @RequestBody CreateRequest req) {
        AmcUpgradeRequest r = service.createRequest(
                customerId, req.propertyId, req.acUnitId, req.preferredPlan, req.notes);
        return ApiResponse.success(toMap(r), "AMC upgrade request submitted");
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ApiResponse<List<Map<String, Object>>> mine(@AuthenticationPrincipal UUID customerId) {
        return ApiResponse.success(service.requestsForCustomer(customerId).stream()
                .map(AmcUpgradeController::toMap).toList());
    }

    @GetMapping("/open")
    @PreAuthorize("hasAnyRole('OPS_MANAGER','CRM_AGENT','SERVICE_MANAGER','ADMIN')")
    public ApiResponse<List<Map<String, Object>>> open() {
        return ApiResponse.success(service.openRequests().stream()
                .map(AmcUpgradeController::toMap).toList());
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('OPS_MANAGER','ADMIN')")
    public ApiResponse<Map<String, Object>> assign(@PathVariable UUID id,
                                                   @RequestBody AssignRequest req) {
        return ApiResponse.success(toMap(service.assignToCrm(id, req.crmId)));
    }

    @PostMapping("/{id}/contacted")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','ADMIN')")
    public ApiResponse<Map<String, Object>> contacted(@PathVariable UUID id) {
        return ApiResponse.success(toMap(service.markContacted(id)));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> cancel(@PathVariable UUID id,
                                                   @RequestBody(required = false) CancelRequest req) {
        String reason = req == null ? null : req.reason;
        return ApiResponse.success(toMap(service.cancel(id, reason)));
    }

    // ── DTOs ─────────────────────────────────────────────────────

    @Data
    public static class CreateRequest {
        public UUID propertyId;
        public UUID acUnitId;
        public String preferredPlan;
        public String notes;
    }

    @Data
    public static class AssignRequest {
        public UUID crmId;
    }

    @Data
    public static class CancelRequest {
        public String reason;
    }

    private static Map<String, Object> toMap(AmcUpgradeRequest r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("requestNumber", r.getRequestNumber());
        m.put("status", r.getStatus());
        m.put("preferredPlan", r.getPreferredPlan());
        m.put("notes", r.getNotes());
        m.put("createdAt", r.getCreatedAt());
        m.put("updatedAt", r.getUpdatedAt());
        if (r.getCustomer() != null) {
            m.put("customerId", r.getCustomer().getId());
            m.put("customerName", r.getCustomer().getName());
            m.put("customerPhone", r.getCustomer().getPhoneNumber());
        }
        if (r.getProperty() != null) {
            m.put("propertyId", r.getProperty().getId());
            m.put("propertyLabel", r.getProperty().getLabel());
        }
        if (r.getAcUnit() != null) {
            m.put("acUnitId", r.getAcUnit().getId());
            m.put("acRoomLabel", r.getAcUnit().getRoomLabel());
        }
        if (r.getAssignedCrm() != null) {
            m.put("assignedCrmId", r.getAssignedCrm().getId());
            m.put("assignedCrmName", r.getAssignedCrm().getName());
        }
        return m;
    }
}
