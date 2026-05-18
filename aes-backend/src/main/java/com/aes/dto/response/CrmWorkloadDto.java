package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One row on the Ops Manager workload board (PLAN.md §9.1).
 *
 * <p>Each card surfaces: who they are, are they on shift, how many tickets
 * + installs are in their bucket right now, how many they resolved today,
 * and their headroom against {@code maxConcurrentLoad}.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CrmWorkloadDto {

    private UUID userId;
    private String name;
    private String email;
    private String phoneNumber;
    private String role;
    private String branch;

    private boolean onShift;
    private String shiftStart;
    private String shiftEnd;

    private long activeTickets;
    private long activeInstalls;
    private long pendingOffers;
    private long resolvedToday;

    private int maxConcurrentLoad;
    /** Convenience flag for UI colour-coding (>=80% load). */
    private boolean overloaded;

    private Integer avgResolutionMinutes;
    private BigDecimal csatScore;
}
