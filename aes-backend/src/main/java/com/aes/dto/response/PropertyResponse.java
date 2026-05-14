package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Property response DTO.
 * Per Section 4.3: property with AC unit count.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PropertyResponse {

    private UUID id;
    private String label;
    private String addressLine1;
    private String addressLine2;
    private String city;
    private String pincode;
    private String propertyType;
    private Boolean isPrimary;
    private long acUnitsCount;
    private List<AcUnitResponse> acUnits;
    private OffsetDateTime createdAt;
}
