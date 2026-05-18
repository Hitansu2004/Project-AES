package com.aes.controller;

import com.aes.dto.request.BypassToL2Request;
import com.aes.dto.request.OfferInstallRequest;
import com.aes.dto.request.OfferTicketRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.AssignmentOfferResponse;
import com.aes.dto.response.OpsInboxItemDto;
import com.aes.service.AssignmentOfferService;
import com.aes.service.TriageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Ops Manager triage surface — all routes under {@code /api/v1/ops/triage/*}.
 *
 * <p>Locked to {@code OPS_MANAGER} + {@code ADMIN} via the role guard in
 * {@link com.aes.config.SecurityConfig} ({@code /api/v1/ops/**}); the
 * {@code @PreAuthorize} here is belt-and-braces.</p>
 */
@RestController
@RequestMapping("/api/v1/ops/triage")
@Slf4j
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('OPS_MANAGER','ADMIN')")
public class OpsTriageController {

    private final TriageService triageService;
    private final AssignmentOfferService offerService;

    /** Flat inbox feed (tickets + installs) — alternative to GET /dashboard/ops. */
    @GetMapping("/inbox")
    public ResponseEntity<ApiResponse<List<OpsInboxItemDto>>> inbox() {
        return ResponseEntity.ok(ApiResponse.success(triageService.getInbox()));
    }

    @PostMapping("/tickets/{ticketNumber}/offer")
    public ResponseEntity<ApiResponse<AssignmentOfferResponse>> offerTicket(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID opsUserId,
            @Valid @RequestBody OfferTicketRequest body) {
        var offer = triageService.offerTicket(ticketNumber, opsUserId,
                body.getCrmId(), body.getMode(), body.getNote());
        return ResponseEntity.ok(ApiResponse.success(
                offerService.toResponse(offer), "Offer sent"));
    }

    @PostMapping("/tickets/{ticketNumber}/bypass-l2")
    public ResponseEntity<ApiResponse<AssignmentOfferResponse>> bypassL2(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID opsUserId,
            @RequestBody(required = false) BypassToL2Request body) {
        UUID sm = body != null ? body.getServiceManagerId() : null;
        String note = body != null ? body.getNote() : null;
        var offer = triageService.bypassTicketToL2(ticketNumber, opsUserId, sm, note);
        return ResponseEntity.ok(ApiResponse.success(
                offerService.toResponse(offer), "Bypassed to L2"));
    }

    /** Recall (withdraw) the still-OFFERED offer on a ticket so it can be re-routed. */
    @PostMapping("/tickets/{ticketNumber}/recall-offer")
    public ResponseEntity<ApiResponse<AssignmentOfferResponse>> recallTicket(
            @PathVariable String ticketNumber,
            @AuthenticationPrincipal UUID opsUserId) {
        var offer = triageService.recallTicketOffer(ticketNumber, opsUserId);
        return ResponseEntity.ok(ApiResponse.success(
                offerService.toResponse(offer), "Offer recalled"));
    }

    @PostMapping("/installs/{installId}/offer")
    public ResponseEntity<ApiResponse<AssignmentOfferResponse>> offerInstall(
            @PathVariable UUID installId,
            @AuthenticationPrincipal UUID opsUserId,
            @Valid @RequestBody OfferInstallRequest body) {
        var offer = triageService.offerInstall(installId, opsUserId,
                body.getCrmId(), body.getMode(), body.getNote());
        return ResponseEntity.ok(ApiResponse.success(
                offerService.toResponse(offer), "Install offer sent"));
    }
}
