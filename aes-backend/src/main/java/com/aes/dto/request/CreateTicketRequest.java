package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Create service ticket request DTO.
 * Per Section 4.6, lines 627-638.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTicketRequest {

    @NotNull(message = "AC unit ID is required")
    private UUID acUnitId;

    @NotBlank(message = "Problem category is required")
    private String problemCategory;

    private String errorCode;

    @Size(max = 2000)
    private String problemDescription;

    private List<String> photoUrls;

    @NotNull(message = "Scheduled date is required")
    private LocalDate scheduledDate;

    @NotBlank(message = "Scheduled slot is required")
    private String scheduledSlot;
}
