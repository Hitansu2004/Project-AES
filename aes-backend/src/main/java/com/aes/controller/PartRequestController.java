package com.aes.controller;

import com.aes.dto.request.OrderPartRequest;
import com.aes.dto.request.RaisePartRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.PartRequestResponse;
import com.aes.enums.UserRole;
import com.aes.service.PartRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Part-request API (PLAN.md §10.4, FLOW.md C13).
 */
@RestController
@RequestMapping("/api/v1")
@Slf4j
@RequiredArgsConstructor
public class PartRequestController {

    private final PartRequestService partService;

    @PostMapping("/service-tickets/{ticketNumber}/parts")
    @PreAuthorize("hasAnyRole('SITE_ENGINEER','CRM_AGENT','SERVICE_MANAGER','ADMIN','OPS_MANAGER')")
    public ResponseEntity<ApiResponse<PartRequestResponse>> raise(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody RaisePartRequest req) {
        var resp = partService.raise(ticketNumber, userId, req);
        return ResponseEntity.ok(ApiResponse.success(resp, "Part request raised"));
    }

    @GetMapping("/service-tickets/{ticketNumber}/parts")
    public ResponseEntity<ApiResponse<List<PartRequestResponse>>> forTicket(
            @PathVariable String ticketNumber) {
        return ResponseEntity.ok(ApiResponse.success(partService.forTicket(ticketNumber)));
    }

    @PostMapping("/parts/{partId}/approve")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<PartRequestResponse>> approve(
            @PathVariable UUID partId,
            @AuthenticationPrincipal UUID userId) {
        var resp = partService.approve(partId, userId);
        return ResponseEntity.ok(ApiResponse.success(resp, "Part approved"));
    }

    @PostMapping("/parts/{partId}/reject")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<PartRequestResponse>> reject(
            @PathVariable UUID partId,
            @AuthenticationPrincipal UUID userId,
            @RequestParam(required = false) String reason) {
        var resp = partService.reject(partId, userId, reason);
        return ResponseEntity.ok(ApiResponse.success(resp, "Part rejected"));
    }

    @PostMapping("/parts/{partId}/ordered")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<PartRequestResponse>> ordered(
            @PathVariable UUID partId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody(required = false) OrderPartRequest req) {
        var resp = partService.markOrdered(partId, userId, req);
        return ResponseEntity.ok(ApiResponse.success(resp, "Part marked ordered"));
    }

    @PostMapping("/parts/{partId}/delivered")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<PartRequestResponse>> delivered(
            @PathVariable UUID partId,
            @AuthenticationPrincipal UUID userId) {
        var resp = partService.markDelivered(partId, userId);
        return ResponseEntity.ok(ApiResponse.success(resp, "Part marked delivered"));
    }

    @PostMapping("/parts/{partId}/installed")
    @PreAuthorize("hasAnyRole('SITE_ENGINEER','CRM_AGENT','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<PartRequestResponse>> installed(
            @PathVariable UUID partId,
            @AuthenticationPrincipal UUID userId) {
        var resp = partService.markInstalled(partId, userId);
        return ResponseEntity.ok(ApiResponse.success(resp, "Part marked installed"));
    }

    @GetMapping("/parts/queue")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SERVICE_MANAGER','ADMIN','OPS_MANAGER')")
    public ResponseEntity<ApiResponse<List<PartRequestResponse>>> queue(Authentication auth) {
        UserRole role = roleFrom(auth);
        return ResponseEntity.ok(ApiResponse.success(partService.approvalQueueForRole(role)));
    }

    @GetMapping("/parts/mine")
    @PreAuthorize("hasRole('SITE_ENGINEER')")
    public ResponseEntity<ApiResponse<List<PartRequestResponse>>> mine(
            @AuthenticationPrincipal UUID engineerId) {
        return ResponseEntity.ok(ApiResponse.success(partService.openForEngineer(engineerId)));
    }

    private UserRole roleFrom(Authentication auth) {
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority().replace("ROLE_", ""))
                .filter(r -> {
                    try { UserRole.valueOf(r); return true; }
                    catch (IllegalArgumentException ex) { return false; }
                })
                .map(UserRole::valueOf)
                .findFirst()
                .orElse(UserRole.CRM_AGENT);
    }
}
