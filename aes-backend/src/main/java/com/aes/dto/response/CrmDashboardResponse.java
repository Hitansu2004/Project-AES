package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * CRM dashboard response DTO.
 * Per Section 4.11, lines 868-878.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CrmDashboardResponse {

    private long myInboxCount;
    private long criticalCount;
    private long slaBreachCount;
    private long resolvedToday;
    private double avgResponseMinutes;
    private List<TicketResponse> tickets;
}
