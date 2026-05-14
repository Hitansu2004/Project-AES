package com.aes.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Assign engineer request DTO.
 * Per Section 4.7, line 681.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignEngineerRequest {

    @NotNull(message = "Engineer ID is required")
    private UUID engineerId;

    private String notes;
}
