package com.aes.dto.request;

import com.aes.enums.ProblemCategory;
import com.aes.enums.TimeSlot;
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
 * Request body for {@code POST /api/v1/service-tickets}.
 *
 * <p>Per Section 4.6 (lines 627-638) and Section 7 (lines 1686-1690):</p>
 * <ul>
 *   <li>{@code acUnitId} must belong to the authenticated customer (enforced in service).</li>
 *   <li>{@code scheduledDate} must be tomorrow or later (validated in service).</li>
 *   <li>{@code scheduledSlot} restricted to {@link TimeSlot} values.</li>
 *   <li>{@code photoUrls} array max 4 items.</li>
 * </ul>
 *
 * <p>Note: {@code priority} and {@code serviceType} are <strong>not</strong>
 * accepted from the client — they are derived server-side from the AC unit's
 * {@code service_status} (see Section 6, lines 1654-1657).</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTicketRequest {

    @NotNull(message = "AC unit ID is required")
    private UUID acUnitId;

    @NotNull(message = "Problem category is required")
    private ProblemCategory problemCategory;

    @Size(max = 10, message = "Error code must be at most 10 characters")
    private String errorCode;

    @Size(max = 2000, message = "Problem description must be at most 2000 characters")
    private String problemDescription;

    @Size(max = 4, message = "A maximum of 4 photo URLs is allowed")
    private List<@Size(max = 500, message = "Photo URL is too long") String> photoUrls;

    @NotNull(message = "Scheduled date is required")
    private LocalDate scheduledDate;

    @NotNull(message = "Scheduled slot is required (MORNING, AFTERNOON, or EVENING)")
    private TimeSlot scheduledSlot;
}
