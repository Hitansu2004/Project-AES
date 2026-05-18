package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Composite Ops Manager dashboard payload — `GET /api/v1/dashboard/ops`.
 *
 * <p>Single round-trip for the dispatcher's home screen (PLAN.md §9.1):
 * KPI tiles, the triage inbox, the CRM workload board, and the engineer
 * availability board.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OpsDashboardResponse {

    // ── KPI tiles ─────────────────────────────────────────────────
    private long untriagedTickets;
    private long awaitingCrmAccept;
    private long awaitingEngineerAccept;
    private long escalatedByCustomer;
    private long untriagedInstalls;
    private long slaRedZone;
    private long activeTicketsAll;

    // ── Boards ────────────────────────────────────────────────────
    private List<OpsInboxItemDto> inbox;
    private List<CrmWorkloadDto> crmWorkload;
    private List<EngineerAvailabilityDto> engineers;
}
