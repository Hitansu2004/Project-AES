package com.aes.dto.request;

import com.aes.enums.TimeSlot;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Request body for {@code POST /api/v1/amc/visits/{visitId}/schedule}.
 * Per Section 4.10, line 850.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleVisitRequest {

    @NotNull(message = "Scheduled date is required")
    private LocalDate scheduledDate;

    @NotNull(message = "Scheduled slot is required (MORNING, AFTERNOON, or EVENING)")
    private TimeSlot scheduledSlot;
}
