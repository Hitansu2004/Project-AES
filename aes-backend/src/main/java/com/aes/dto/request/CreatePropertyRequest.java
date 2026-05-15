package com.aes.dto.request;

import com.aes.enums.PropertyType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for {@code POST /api/v1/properties}.
 * Per Section 4.3 (line 561).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreatePropertyRequest {

    @NotBlank(message = "Property label is required")
    @Size(max = 100, message = "Property label must be at most 100 characters")
    private String label;

    @NotBlank(message = "Address line 1 is required")
    @Size(max = 200, message = "Address line 1 must be at most 200 characters")
    private String addressLine1;

    @Size(max = 200, message = "Address line 2 must be at most 200 characters")
    private String addressLine2;

    @Size(max = 100, message = "City must be at most 100 characters")
    @Builder.Default
    private String city = "Hyderabad";

    @Pattern(regexp = "^\\d{6}$", message = "PIN code must be exactly 6 digits")
    private String pincode;

    @Builder.Default
    private PropertyType propertyType = PropertyType.RESIDENTIAL;

    @Builder.Default
    private Boolean isPrimary = false;
}
