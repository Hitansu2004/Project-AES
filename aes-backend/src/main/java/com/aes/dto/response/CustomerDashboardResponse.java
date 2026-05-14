package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * Customer dashboard response DTO.
 * Per Section 4.11, lines 856-866.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CustomerDashboardResponse {

    private long activeProjects;
    private long openTickets;
    private String amcStatus;
    private NextAmcVisit nextAmcVisit;
    private List<TicketResponse> recentTickets;
    private List<PropertyResponse> properties;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NextAmcVisit {
        private LocalDate date;
        private String slot;
    }
}
