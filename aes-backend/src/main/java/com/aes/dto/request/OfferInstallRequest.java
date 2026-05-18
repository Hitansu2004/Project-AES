package com.aes.dto.request;

import com.aes.enums.OfferMode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

/**
 * Body for {@code POST /api/v1/ops/triage/installs/{installId}/offer}.
 *
 * <p>Mirrors {@link OfferTicketRequest} but targets an installation lead
 * rather than a service ticket.</p>
 */
@Data
public class OfferInstallRequest {

    @NotNull
    private UUID crmId;

    @NotNull
    private OfferMode mode = OfferMode.DIRECT;

    @Size(max = 500)
    private String note;
}
