package com.aes.controller;

import com.aes.dto.request.*;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.AssignmentOfferResponse;
import com.aes.dto.response.TicketResponse;
import com.aes.service.AssignmentOfferService;
import com.aes.service.EngineerDispatchService;
import com.aes.service.TicketActionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Ticket Action Controller — lifecycle operations on tickets.
 *
 * Per Section 4.7 (lines 667-724):
 *   POST .../acknowledge       → CRM agent acknowledges
 *   POST .../assign-engineer   → assign field engineer
 *   POST .../escalate          → manual escalation
 *   POST .../resolve           → resolve ticket
 *   POST .../rate              → customer rates + closes
 */
@RestController
@RequestMapping("/api/v1/service-tickets")
@Slf4j
@RequiredArgsConstructor
public class TicketActionController {

    private final TicketActionService ticketActionService;
    private final EngineerDispatchService engineerDispatchService;
    private final AssignmentOfferService offerService;

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/acknowledge
     * Per lines 671-677.
     *
     * <p>Closes F12 (PLAN.md) — previously any authenticated user could
     * call this. Now restricted to staff that may legitimately own a ticket.</p>
     */
    @PostMapping("/{ticketNumber}/acknowledge")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<TicketResponse>> acknowledge(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId) {
        TicketResponse response = ticketActionService.acknowledgeTicket(ticketNumber, userId);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket acknowledged"));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/assign-engineer
     * Per lines 679-685.
     *
     * <p><strong>Legacy direct-assign path.</strong> Kept for the existing
     * UI so the demo doesn't break; the new workflow uses
     * {@code /dispatch-engineer} below which routes through an
     * AssignmentOffer with a 10-minute accept window.</p>
     */
    @PostMapping("/{ticketNumber}/assign-engineer")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<TicketResponse>> assignEngineer(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody AssignEngineerRequest request) {
        TicketResponse response = ticketActionService.assignEngineer(ticketNumber, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Engineer assigned"));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/dispatch-engineer
     *
     * <p>New offer-based dispatch path (PLAN.md §10.2, FLOW.md C7 / C12).
     * Creates an {@code ENGINEER_DISPATCH} {@link com.aes.entity.AssignmentOffer}
     * with the configured engineer-expiry window; engineer accepts via
     * {@code POST /api/v1/offers/{id}/accept} or declines via
     * {@code /decline}. On accept the ticket flips to
     * {@link com.aes.enums.TicketStatus#ASSIGNED}.</p>
     */
    @PostMapping("/{ticketNumber}/dispatch-engineer")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<AssignmentOfferResponse>> dispatchEngineer(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody DispatchEngineerRequest request) {
        var offer = engineerDispatchService.dispatchEngineer(
                ticketNumber, userId,
                request.getEngineerId(), request.getMode(), request.getNote());
        return ResponseEntity.ok(ApiResponse.success(
                offerService.toResponse(offer), "Dispatch offer sent to engineer"));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/escalate
     * Per lines 687-692.
     *
     * <p>Staff-side escalation (T3 in the new ladder — see FLOW.md C17).
     * Customers use a separate dedicated endpoint (T1, added in Phase 3).</p>
     */
    @PostMapping("/{ticketNumber}/escalate")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<TicketResponse>> escalate(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody EscalateTicketRequest request) {
        TicketResponse response = ticketActionService.escalateTicket(ticketNumber, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket escalated"));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/resolve
     * Per lines 694-701.
     */
    @PostMapping("/{ticketNumber}/resolve")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SITE_ENGINEER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<TicketResponse>> resolve(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody ResolveTicketRequest request) {
        TicketResponse response = ticketActionService.resolveTicket(ticketNumber, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket resolved"));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/rate
     * Per lines 703-709.
     *
     * <p>Customer-only — the service layer additionally checks that the
     * caller owns the ticket, but the role guard is the first line of
     * defence.</p>
     */
    @PostMapping("/{ticketNumber}/rate")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<TicketResponse>> rate(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody RateTicketRequest request) {
        TicketResponse response = ticketActionService.rateTicket(ticketNumber, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket rated"));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/customer-escalate (T1 — FLOW.md C16).
     */
    @PostMapping("/{ticketNumber}/customer-escalate")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<TicketResponse>> customerEscalate(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody CustomerEscalateRequest request) {
        TicketResponse response = ticketActionService.customerEscalate(ticketNumber, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response,
                "Escalation logged — Ops Manager will re-triage."));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/reschedule (FLOW.md C19).
     */
    @PostMapping("/{ticketNumber}/reschedule")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<TicketResponse>> reschedule(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody RescheduleTicketRequest request) {
        TicketResponse response = ticketActionService.rescheduleTicket(ticketNumber, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Visit rescheduled"));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/reopen (FLOW.md C18 / S12).
     */
    @PostMapping("/{ticketNumber}/reopen")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<TicketResponse>> reopen(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody ReopenTicketRequest request) {
        TicketResponse response = ticketActionService.reopenTicket(ticketNumber, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket re-opened"));
    }
}
