package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Escalation / Admin "eagle-view" dashboard response DTO.
 *
 * Per Section 4.11, lines 880-892 (escalation aggregates + level lists) plus
 * the admin extensions for team workload and lifecycle counts so an
 * administrator can see at a glance:
 *   - how many tickets sit at each level (L1 / L2 / L3)
 *   - which CRM agent / service manager / admin is currently holding what
 *   - who triggered each escalation and why (see TicketResponse.EscalationLogResponse)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EscalationDashboardResponse {

    // ── KPI aggregates ─────────────────────────────────────────
    private long escalatedNow;
    private double avgResponseMinutes;
    private long slaBreachToday;
    private long resolvedToday;

    // ── Level breakdown (active tickets only) ──────────────────
    private long l1Count;
    private long l2Count;
    private long l3Count;
    private long totalActive;
    private long criticalActive;

    // ── Pipeline (tickets per level, full detail) ──────────────
    private List<TicketResponse> l1Tickets;
    private List<TicketResponse> l2Tickets;
    private List<TicketResponse> l3Tickets;

    // ── Team workload (per-staff active workload) ──────────────
    private List<TeamWorkload> teamWorkload;

    // ── Escalation log (most recent first) ─────────────────────
    private List<TicketResponse.EscalationLogResponse> escalationLog;

    /**
     * Per-staff active workload snapshot.  Populated for every
     * CRM_AGENT, SERVICE_MANAGER and ADMIN regardless of whether
     * they currently own tickets — so the admin always sees the
     * full team grid, including idle members.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TeamWorkload {
        private UUID userId;
        private String name;
        private String role;          // UserRole.name() — CRM_AGENT / SERVICE_MANAGER / ADMIN
        private int level;            // canonical level for the role (1 / 2 / 3)
        private int activeCount;
        private int criticalCount;    // P1 active tickets
        private int breachedCount;    // active tickets where the relevant SLA deadline is past
        private List<TicketResponse> tickets;  // active ticket summaries
    }
}
