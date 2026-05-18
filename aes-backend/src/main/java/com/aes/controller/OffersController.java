package com.aes.controller;

import com.aes.dto.request.DeclineOfferRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.AssignmentOfferResponse;
import com.aes.service.AssignmentOfferService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Recipient-side surface for {@link com.aes.entity.AssignmentOffer}.
 *
 * <p>Exposed to every staff role that can receive an offer:
 * {@code CRM_AGENT}, {@code SITE_ENGINEER}, {@code SERVICE_MANAGER}
 * (bypass-to-L2 target), plus {@code ADMIN} for support purposes.</p>
 *
 * <p>{@code SITE_ENGINEER} is allowed here in advance of Phase 3 so the
 * dispatch flow can be exercised end-to-end the moment those endpoints
 * land — no security change required at that point.</p>
 */
@RestController
@RequestMapping("/api/v1/offers")
@Slf4j
@RequiredArgsConstructor
public class OffersController {

    private final AssignmentOfferService offerService;

    /** Recipient's pending offers — drives the CRM and engineer inbox cards. */
    @GetMapping("/mine")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SITE_ENGINEER','SERVICE_MANAGER','OPS_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<List<AssignmentOfferResponse>>> myPendingOffers(
            @AuthenticationPrincipal UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(offerService.listMyPendingOffers(userId)));
    }

    @PostMapping("/{offerId}/accept")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SITE_ENGINEER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<AssignmentOfferResponse>> accept(
            @PathVariable UUID offerId,
            @AuthenticationPrincipal UUID userId) {
        offerService.accept(offerId, userId);
        return ResponseEntity.ok(ApiResponse.success(
                offerService.toResponseFor(offerId),
                "Offer accepted"));
    }

    @PostMapping("/{offerId}/decline")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SITE_ENGINEER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<AssignmentOfferResponse>> decline(
            @PathVariable UUID offerId,
            @AuthenticationPrincipal UUID userId,
            @RequestBody(required = false) DeclineOfferRequest body) {
        String reason = body != null ? body.getReason() : null;
        offerService.decline(offerId, userId, reason);
        return ResponseEntity.ok(ApiResponse.success(
                offerService.toResponseFor(offerId),
                "Offer declined"));
    }

    /** Sender (Ops Manager or whoever issued the offer) cancels it before response. */
    @PostMapping("/{offerId}/withdraw")
    @PreAuthorize("hasAnyRole('OPS_MANAGER','CRM_AGENT','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<AssignmentOfferResponse>> withdraw(
            @PathVariable UUID offerId,
            @AuthenticationPrincipal UUID userId) {
        offerService.withdraw(offerId, userId);
        return ResponseEntity.ok(ApiResponse.success(
                offerService.toResponseFor(offerId),
                "Offer withdrawn"));
    }
}
