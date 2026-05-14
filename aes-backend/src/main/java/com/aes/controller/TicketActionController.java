package com.aes.controller;

import com.aes.dto.request.*;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.TicketResponse;
import com.aes.service.TicketActionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
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

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/acknowledge
     * Per lines 671-677.
     */
    @PostMapping("/{ticketNumber}/acknowledge")
    public ResponseEntity<ApiResponse<TicketResponse>> acknowledge(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId) {
        TicketResponse response = ticketActionService.acknowledgeTicket(ticketNumber, userId);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket acknowledged"));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/assign-engineer
     * Per lines 679-685.
     */
    @PostMapping("/{ticketNumber}/assign-engineer")
    public ResponseEntity<ApiResponse<TicketResponse>> assignEngineer(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody AssignEngineerRequest request) {
        TicketResponse response = ticketActionService.assignEngineer(ticketNumber, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Engineer assigned"));
    }

    /**
     * POST /api/v1/service-tickets/{ticketNumber}/escalate
     * Per lines 687-692.
     */
    @PostMapping("/{ticketNumber}/escalate")
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
     */
    @PostMapping("/{ticketNumber}/rate")
    public ResponseEntity<ApiResponse<TicketResponse>> rate(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody RateTicketRequest request) {
        TicketResponse response = ticketActionService.rateTicket(ticketNumber, userId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Ticket rated and closed"));
    }
}
