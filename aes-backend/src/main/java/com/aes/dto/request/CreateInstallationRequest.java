package com.aes.dto.request;

import com.aes.enums.AcType;
import com.aes.enums.TimeSlot;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Request body for {@code POST /api/v1/installation-requests}.
 *
 * <p>Per Section 4.5 (lines 590-607).</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateInstallationRequest {

    /** Either {@link #propertyId} or {@link #propertyAddress} must be provided. */
    private UUID propertyId;

    @Size(max = 500, message = "Property address must be at most 500 characters")
    private String propertyAddress;

    @NotNull(message = "AC type is required")
    private AcType acType;

    @Size(max = 50, message = "Brand must be at most 50 characters")
    private String brand;

    @Size(max = 100, message = "Model number must be at most 100 characters")
    private String modelNumber;

    @DecimalMin(value = "0.5", message = "Tonnage must be at least 0.5")
    @DecimalMax(value = "20.0", message = "Tonnage must be at most 20.0")
    private BigDecimal tonnage;

    @Min(value = 1, message = "Energy rating must be between 1 and 5")
    @Max(value = 5, message = "Energy rating must be between 1 and 5")
    private Integer energyRating;

    @Valid
    private List<RoomDetail> rooms;

    @NotNull(message = "Scheduled date is required")
    private LocalDate scheduledDate;

    @NotNull(message = "Scheduled slot is required (MORNING, AFTERNOON, or EVENING)")
    private TimeSlot scheduledSlot;

    @Size(max = 1000, message = "Notes must be at most 1000 characters")
    private String notes;

    /** Per Section 4.5 (lines 601-603) — one entry per room being installed. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoomDetail {

        @Size(max = 100, message = "Room type must be at most 100 characters")
        private String roomType;

        @Min(value = 1, message = "Room size must be a positive number")
        @Max(value = 10_000, message = "Room size looks unrealistic")
        private Integer sizeSqft;

        private AcType acType;
    }
}
