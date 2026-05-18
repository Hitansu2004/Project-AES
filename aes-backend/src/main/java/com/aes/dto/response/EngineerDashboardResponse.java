package com.aes.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Payload for {@code GET /api/v1/engineer/dashboard} (PLAN.md §9.3).
 *
 * <p>Drives the engineer mobile dashboard: pending dispatch offers,
 * active jobs in priority order, and a "done today" tally.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EngineerDashboardResponse {

    private int pendingOffers;
    private int activeJobs;
    private int resolvedToday;
    private int enRoute;
    private int onSite;

    private List<AssignmentOfferResponse> offers;
    private List<EngineerJobDto> jobs;
    private List<EngineerJobDto> resolvedTodayList;
}
