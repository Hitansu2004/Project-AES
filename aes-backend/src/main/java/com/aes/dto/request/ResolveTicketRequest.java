package com.aes.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

/**
 * Resolve ticket request DTO.
 * Per Section 4.7, line 696.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResolveTicketRequest {

    @NotBlank(message = "Resolution notes are required")
    private String resolutionNotes;

    private BigDecimal finalCharge;
}
