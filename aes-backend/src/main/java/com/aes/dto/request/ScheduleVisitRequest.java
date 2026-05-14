package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Schedule AMC visit request DTO.
 * Per Section 4.10, line 850.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleVisitRequest {

    @NotNull(message = "Scheduled date is required")
    private LocalDate scheduledDate;

    @NotBlank(message = "Scheduled slot is required")
    private String scheduledSlot;
}
