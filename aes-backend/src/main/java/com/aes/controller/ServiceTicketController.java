package com.aes.controller;

import com.aes.dto.request.CreateTicketRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.SlaStatusResponse;
import com.aes.dto.response.TicketResponse;
import com.aes.enums.UserRole;
import com.aes.service.ServiceTicketService;
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
 * Service Ticket Controller — core ticket CRUD.
 *
 * Per Section 4.6 (lines 624-665):
 *   POST /api/v1/service-tickets              → create ticket
 *   GET  /api/v1/service-tickets              → list (paginated, role-based)
 *   GET  /api/v1/service-tickets/{number}     → full detail
 *   GET  /api/v1/service-tickets/{number}/sla-status → SLA remaining
 */
@RestController
@RequestMapping("/api/v1/service-tickets")
@Slf4j
@RequiredArgsConstructor
public class ServiceTicketController {

    private final ServiceTicketService ticketService;

    /**
     * POST /api/v1/service-tickets
     * Create new service ticket (lines 627-654).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<TicketResponse>> createTicket(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody CreateTicketRequest request) {
        TicketResponse response = ticketService.createTicket(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Service ticket created"));
    }

    /**
     * GET /api/v1/service-tickets
     * List tickets with role-based filtering (lines 656-661).
     * Query: ?status=OPEN&priority=P1&level=1&page=0&size=20
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<TicketResponse>>> listTickets(
            @AuthenticationPrincipal UUID userId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UserRole role = extractUserRole();
        Pageable pageable = PageRequest.of(page, size);
        Page<TicketResponse> result = ticketService.listTickets(userId, role, status, pageable);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * GET /api/v1/service-tickets/{ticketNumber}
     * Full ticket detail (lines 663-665).
     */
    @GetMapping("/{ticketNumber}")
    public ResponseEntity<ApiResponse<TicketResponse>> getTicket(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID userId) {
        UserRole role = extractUserRole();
        TicketResponse response = ticketService.getTicketByNumber(ticketNumber, userId, role);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * GET /api/v1/service-tickets/{ticketNumber}/sla-status
     * SLA remaining seconds (lines 711-724).
     */
    @GetMapping("/{ticketNumber}/sla-status")
    public ResponseEntity<ApiResponse<SlaStatusResponse>> getSlaStatus(
            @PathVariable String ticketNumber) {
        SlaStatusResponse response = ticketService.getSlaStatus(ticketNumber);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    private UserRole extractUserRole() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN"))) return UserRole.ADMIN;
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_SERVICE_MANAGER"))) return UserRole.SERVICE_MANAGER;
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_CRM_AGENT"))) return UserRole.CRM_AGENT;
        return UserRole.CUSTOMER;
    }
}
