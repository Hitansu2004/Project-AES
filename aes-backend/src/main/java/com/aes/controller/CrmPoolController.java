package com.aes.controller;

import com.aes.dto.request.CreateTicketRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.TicketResponse;
import com.aes.entity.User;
import com.aes.repository.UserRepository;
import com.aes.service.CrmPoolService;
import com.aes.service.ServiceTicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Endpoints behind the new "stockbroker-style" CRM dispatch dashboard
 * (V14 — see {@link com.aes.service.CrmPoolService}).
 *
 * <ul>
 *   <li>{@code GET  /crm/pool}                     — FIFO queue of unassigned tickets</li>
 *   <li>{@code POST /crm/pool/&lcub;n&rcub;/pick}             — one-click claim</li>
 *   <li>{@code POST /crm/tickets/&lcub;n&rcub;/assign-team}   — pick a team (Team 01..15)</li>
 *   <li>{@code POST /crm/tickets/&lcub;n&rcub;/assign-engineer} — direct engineer assignment</li>
 *   <li>{@code GET  /crm/teams}                    — list teams + members for the dropdowns</li>
 *   <li>{@code GET  /crm/customers/search?q=...}   — picks a customer for the "create on behalf" flow</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/crm")
@RequiredArgsConstructor
public class CrmPoolController {

    private final CrmPoolService poolService;
    private final ServiceTicketService ticketService;
    private final UserRepository userRepo;
    private final com.aes.service.PropertyService propertyService;

    // ── 1. Pool feed ────────────────────────────────────────────────
    @GetMapping("/pool")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<Map<String, Object>> pool(@AuthenticationPrincipal UUID me) {
        // Map entities to DTOs inside the read-only transaction so the
        // lazy associations (customer, ac unit, property) are loaded
        // safely.  See CrmPoolService#poolDtos.
        List<TicketResponse> rows = poolService.poolDtos(ticketService::toResponse);
        long load = poolService.currentLoad(me);
        return ApiResponse.success(Map.of(
                "tickets",     rows,
                "currentLoad", load,
                "cap",         poolService.cap(),
                "remaining",   Math.max(0, poolService.cap() - load)));
    }

    // ── 2. One-click pick ──────────────────────────────────────────
    @PostMapping("/pool/{ticketNumber}/pick")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<TicketResponse> pick(@PathVariable String ticketNumber,
                                            @AuthenticationPrincipal UUID me) {
        return ApiResponse.success(poolService.pickFromPool(ticketNumber, me),
                "Ticket " + ticketNumber + " is now yours.");
    }

    // ── 3. Direct team assignment ──────────────────────────────────
    public record TeamRequest(String teamName) {}

    @PostMapping("/tickets/{ticketNumber}/assign-team")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<TicketResponse> assignTeam(@PathVariable String ticketNumber,
                                                   @RequestBody TeamRequest req) {
        return ApiResponse.success(poolService.assignTeam(ticketNumber, req.teamName()),
                "Assigned to " + req.teamName());
    }

    // ── 4. Direct engineer assignment ──────────────────────────────
    public record EngineerRequest(UUID engineerId) {}

    @PostMapping("/tickets/{ticketNumber}/assign-engineer")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<TicketResponse> assignEngineer(@PathVariable String ticketNumber,
                                                       @RequestBody EngineerRequest req) {
        return ApiResponse.success(poolService.assignEngineer(ticketNumber, req.engineerId()),
                "Engineer assigned.");
    }

    // ── 5. Team roster (drives the team + engineer dropdowns) ──────
    @GetMapping("/teams")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String, Object>>> teams() {
        List<String> teamNames = userRepo.findDistinctTeamNames();
        // Always materialise all 15 even when empty
        java.util.LinkedHashSet<String> set = new java.util.LinkedHashSet<>(teamNames);
        for (int i = 1; i <= 15; i++) set.add(String.format("Team %02d", i));
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        for (String tn : set) {
            List<User> members = userRepo
                    .findByTeamNameAndIsActiveTrueOrderByIsTeamLeadDescNameAsc(tn);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("teamName", tn);
            row.put("members", members.stream().map(m -> Map.of(
                    "id",         m.getId(),
                    "name",       m.getName(),
                    "role",       m.getRole().name(),
                    "isTeamLead", Boolean.TRUE.equals(m.getIsTeamLead())
            )).toList());
            row.put("engineers", members.stream()
                    .filter(u -> u.getRole().name().equals("SITE_ENGINEER"))
                    .map(m -> Map.of("id", m.getId(), "name", m.getName()))
                    .collect(Collectors.toList()));
            row.put("lead", members.stream()
                    .filter(u -> Boolean.TRUE.equals(u.getIsTeamLead()))
                    .findFirst()
                    .map(m -> Map.<String, Object>of("id", m.getId(), "name", m.getName()))
                    .orElse(null));
            out.add(row);
        }
        return ApiResponse.success(out);
    }

    // ── 6a. Create ticket on behalf of a customer (CRM front-desk) ─
    @PostMapping("/tickets/on-behalf/{customerId}")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<TicketResponse> createOnBehalf(
            @PathVariable UUID customerId,
            @Valid @RequestBody CreateTicketRequest body,
            @AuthenticationPrincipal UUID me) {
        var resp = ticketService.createTicket(customerId, body);
        // Auto-pick: the CRM agent who created it owns it.
        try {
            return ApiResponse.success(
                    poolService.pickFromPool(resp.getTicketNumber(), me),
                    "Ticket created on behalf of customer.");
        } catch (Exception ignored) {
            // OK if the create-flow already auto-assigned this ticket
            // (the legacy Ops triage path may have grabbed it first).
            return ApiResponse.success(resp,
                    "Ticket created — already auto-assigned, see the inbox.");
        }
    }

    // ── 6b. Customer search (for "create ticket on behalf") ────────
    @GetMapping("/customers/search")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<List<Map<String, Object>>> customerSearch(@RequestParam("q") String q) {
        if (q == null || q.trim().length() < 2) return ApiResponse.success(List.of());
        var hits = userRepo.searchCustomers(q.trim());
        return ApiResponse.success(hits.stream().limit(20).map(u -> Map.<String, Object>of(
                "id",          u.getId(),
                "name",        u.getName(),
                "phoneNumber", u.getPhoneNumber(),
                "email",       u.getEmail() == null ? "" : u.getEmail()
        )).toList());
    }

    // ── 6c. Customer's properties (for the on-behalf wizard) ──────
    @GetMapping("/customers/{customerId}/properties")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN','SUPER_ADMIN')")
    public ApiResponse<List<com.aes.dto.response.PropertyResponse>> customerProperties(
            @PathVariable UUID customerId) {
        return ApiResponse.success(propertyService.getCustomerProperties(customerId));
    }
}
