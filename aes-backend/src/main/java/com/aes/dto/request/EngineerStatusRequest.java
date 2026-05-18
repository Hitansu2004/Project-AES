package com.aes.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Lightweight body for engineer status pings — {@code EN_ROUTE / ON_SITE /
 * DIAGNOSING}. All three accept an optional note (so the engineer can drop
 * context like "stuck in traffic, ETA 15 min"). No required fields.
 */
@Data
public class EngineerStatusRequest {

    @Size(max = 500)
    private String note;
}
