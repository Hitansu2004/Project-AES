package com.aes.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Create installation request DTO.
 * Per Section 4.5, lines 590-607.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateInstallationRequest {

    private UUID propertyId;

    private String propertyAddress;

    @NotBlank(message = "AC type is required")
    private String acType;

    private String brand;

    private String modelNumber;

    private BigDecimal tonnage;

    private Integer energyRating;

    private List<RoomDetail> rooms;

    @NotNull(message = "Scheduled date is required")
    private LocalDate scheduledDate;

    @NotBlank(message = "Scheduled slot is required")
    private String scheduledSlot;

    private String notes;

    /**
     * Room detail for installation request.
     * Per lines 601-603.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoomDetail {
        private String roomType;
        private Integer sizeSqft;
        private String acType;
    }
}
