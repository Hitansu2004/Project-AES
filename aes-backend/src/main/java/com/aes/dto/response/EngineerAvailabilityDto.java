package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * One row on the Ops Manager engineer availability board (PLAN.md §9.1).
 * Drives the engineer picker modal that CRM/SM use in Phase 3.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EngineerAvailabilityDto {

    private UUID userId;
    private String name;
    private String phoneNumber;
    private String branch;

    private boolean onShift;
    private String shiftStart;
    private String shiftEnd;

    private List<String> skills;
    private List<String> localities;

    private long activeJobs;
    private long pendingOffers;
    private int maxConcurrentLoad;
    /** True when active + pending exceeds maxConcurrentLoad. */
    private boolean overloaded;

    private Integer avgResolutionMinutes;
    private BigDecimal csatScore;
}
