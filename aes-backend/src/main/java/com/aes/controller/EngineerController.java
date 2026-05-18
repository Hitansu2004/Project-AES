package com.aes.controller;

import com.aes.dto.request.CannotAttendRequest;
import com.aes.dto.request.EngineerStatusRequest;
import com.aes.dto.request.NeedHelpRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.EngineerDashboardResponse;
import com.aes.dto.response.EngineerJobDto;
import com.aes.service.EngineerDispatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Engineer-facing API (PLAN.md §9.3, FLOW.md C7 / C12 / C14 / C15).
 *
 * <p>All routes under {@code /api/v1/engineer/*} are restricted to
 * {@code SITE_ENGINEER} (with {@code ADMIN} for support overrides).
 * The {@code SecurityConfig} matcher
 * ({@code /api/v1/engineer/**}) is the first line of defence; the
 * {@code @PreAuthorize} below is belt-and-braces.</p>
 */
@RestController
@RequestMapping("/api/v1/engineer")
@Slf4j
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SITE_ENGINEER','ADMIN')")
public class EngineerController {

    private final EngineerDispatchService dispatchService;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<EngineerDashboardResponse>> dashboard(
            @AuthenticationPrincipal UUID engineerId) {
        return ResponseEntity.ok(ApiResponse.success(dispatchService.getDashboard(engineerId)));
    }

    @GetMapping("/my-jobs")
    public ResponseEntity<ApiResponse<List<EngineerJobDto>>> myJobs(
            @AuthenticationPrincipal UUID engineerId) {
        return ResponseEntity.ok(ApiResponse.success(dispatchService.getMyJobs(engineerId)));
    }

    @PostMapping("/tickets/{ticketNumber}/en-route")
    public ResponseEntity<ApiResponse<Void>> enRoute(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID engineerId,
            @RequestBody(required = false) EngineerStatusRequest body) {
        dispatchService.markEnRoute(ticketNumber, engineerId, body != null ? body.getNote() : null);
        return ResponseEntity.ok(ApiResponse.success(null, "Marked en-route"));
    }

    @PostMapping("/tickets/{ticketNumber}/on-site")
    public ResponseEntity<ApiResponse<Void>> onSite(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID engineerId,
            @RequestBody(required = false) EngineerStatusRequest body) {
        dispatchService.markOnSite(ticketNumber, engineerId, body != null ? body.getNote() : null);
        return ResponseEntity.ok(ApiResponse.success(null, "Marked on site"));
    }

    @PostMapping("/tickets/{ticketNumber}/in-progress")
    public ResponseEntity<ApiResponse<Void>> inProgress(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID engineerId,
            @RequestBody(required = false) EngineerStatusRequest body) {
        dispatchService.markInProgress(ticketNumber, engineerId, body != null ? body.getNote() : null);
        return ResponseEntity.ok(ApiResponse.success(null, "Marked in progress"));
    }

    @PostMapping("/tickets/{ticketNumber}/cannot-attend")
    public ResponseEntity<ApiResponse<Void>> cannotAttend(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID engineerId,
            @Valid @RequestBody CannotAttendRequest body) {
        dispatchService.cannotAttend(ticketNumber, engineerId, body);
        return ResponseEntity.ok(ApiResponse.success(null, "Engineer slot released"));
    }

    @PostMapping("/tickets/{ticketNumber}/need-help")
    public ResponseEntity<ApiResponse<Void>> needHelp(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID engineerId,
            @Valid @RequestBody NeedHelpRequest body) {
        dispatchService.needHelp(ticketNumber, engineerId, body);
        return ResponseEntity.ok(ApiResponse.success(null, "Need-Help raised — owner CRM and SMs notified"));
    }
}
