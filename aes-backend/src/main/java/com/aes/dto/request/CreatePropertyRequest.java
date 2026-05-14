package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Create property request DTO.
 * Per Section 4.3, line 561.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatePropertyRequest {

    @NotBlank(message = "Property label is required")
    @Size(max = 100)
    private String label;

    @NotBlank(message = "Address line 1 is required")
    @Size(max = 200)
    private String addressLine1;

    @Size(max = 200)
    private String addressLine2;

    @Size(max = 100)
    @Builder.Default
    private String city = "Hyderabad";

    @Size(max = 10)
    private String pincode;

    @Builder.Default
    private String propertyType = "RESIDENTIAL";

    @Builder.Default
    private Boolean isPrimary = false;
}
