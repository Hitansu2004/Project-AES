package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * SLA status response DTO.
 * Per Section 4.7, lines 711-724.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SlaStatusResponse {

    private String ticketNumber;
    private Integer currentLevel;
    private String status;
    private OffsetDateTime slaDeadlineL1;
    private Long slaRemainingSecondsL1;
    private OffsetDateTime slaDeadlineL2;
    private Long slaRemainingSecondsL2;
    private OffsetDateTime slaDeadlineFinal;
    private Long slaRemainingSecondsFinal;
    private Boolean isL1Breached;
    private Boolean isL2Breached;
    private Boolean isFinalBreached;
}
