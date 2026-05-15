package com.aes.dto.request;

import com.aes.enums.PropertyType;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for {@code PUT /api/v1/properties/{propertyId}}.
 * All fields optional — partial update.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePropertyRequest {

    @Size(min = 1, max = 100, message = "Property label must be between 1 and 100 characters")
    private String label;

    @Size(max = 200, message = "Address line 1 must be at most 200 characters")
    private String addressLine1;

    @Size(max = 200, message = "Address line 2 must be at most 200 characters")
    private String addressLine2;

    @Size(max = 100, message = "City must be at most 100 characters")
    private String city;

    @Pattern(regexp = "^\\d{6}$", message = "PIN code must be exactly 6 digits")
    private String pincode;

    private PropertyType propertyType;

    private Boolean isPrimary;
}
