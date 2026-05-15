package com.aes.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Notification list-item DTO — what the client renders in the bell drawer
 * and the {@code /notifications} page.
 *
 * <p>Per Section 14 (lines 2068-2070) we surface the persisted
 * {@code notifications} row, lazily marking it read once the user opens it.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class NotificationResponse {

    private UUID id;
    private String title;
    private String body;
    private String type;
    private UUID referenceId;
    private String referenceType;
    /** Convenience for the frontend: e.g. {@code /tickets/TKT-2025-0001}. */
    private String link;
    private boolean read;
    private OffsetDateTime createdAt;
}
