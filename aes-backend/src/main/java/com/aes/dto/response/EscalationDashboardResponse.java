package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Escalation dashboard response DTO.
 * Per Section 4.11, lines 880-892.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EscalationDashboardResponse {

    private long escalatedNow;
    private double avgResponseMinutes;
    private long slaBreachToday;
    private long resolvedToday;
    private List<TicketResponse> l1Tickets;
    private List<TicketResponse> l2Tickets;
    private List<TicketResponse> l3Tickets;
    private List<TicketResponse.EscalationLogResponse> escalationLog;
}
