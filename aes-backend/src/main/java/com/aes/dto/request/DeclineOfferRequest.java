package com.aes.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body for {@code POST /api/v1/offers/{id}/decline}. Reason is optional
 * but strongly encouraged so the Ops Manager has something to work with
 * when re-routing.
 */
@Data
public class DeclineOfferRequest {

    @Size(max = 500)
    private String reason;
}
