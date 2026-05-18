package com.aes.controller;

import com.aes.dto.request.CustomerQuoteDecisionRequest;
import com.aes.dto.request.DraftQuoteRequest;
import com.aes.dto.response.ApiResponse;
import com.aes.dto.response.QuoteResponse;
import com.aes.exception.BusinessException;
import com.aes.service.QuoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Quote API (PLAN.md §10.4 + FLOW.md C3, C21–C24).
 *
 * <p>Two creator entry points: install draft + ticket estimate. Internal
 * approval band routing is handled by {@link QuoteService}; the controller
 * just exposes the verb endpoints.</p>
 */
@RestController
@RequestMapping("/api/v1/quotes")
@Slf4j
@RequiredArgsConstructor
public class QuoteController {

    private final QuoteService quoteService;

    // ─────────────────────────────────────────────────────────────
    //  CREATE
    // ─────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN','SITE_ENGINEER')")
    public ResponseEntity<ApiResponse<QuoteResponse>> draft(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody DraftQuoteRequest req) {
        if ((req.getInstallId() == null) == (req.getTicketId() == null)) {
            throw new BusinessException("BAD_TARGET",
                    "Exactly one of installId / ticketId must be supplied.",
                    HttpStatus.BAD_REQUEST);
        }
        var resp = req.getInstallId() != null
                ? quoteService.draftForInstall(userId, req.getInstallId(), req)
                : quoteService.draftForTicket(userId, req.getTicketId(), req);
        return ResponseEntity.ok(ApiResponse.success(resp, "Quote drafted"));
    }

    @PostMapping("/{quoteNumber}/revise")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<QuoteResponse>> revise(
            @PathVariable String quoteNumber,
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody DraftQuoteRequest req) {
        var resp = quoteService.revise(userId, quoteNumber, req);
        return ResponseEntity.ok(ApiResponse.success(resp, "Quote revised (new version created)"));
    }

    // ─────────────────────────────────────────────────────────────
    //  STAFF ACTIONS
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/{quoteNumber}/submit")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN','SITE_ENGINEER')")
    public ResponseEntity<ApiResponse<QuoteResponse>> submit(
            @PathVariable String quoteNumber,
            @AuthenticationPrincipal UUID userId) {
        var resp = quoteService.submitForApproval(userId, quoteNumber);
        return ResponseEntity.ok(ApiResponse.success(resp, "Submitted for internal approval"));
    }

    @PostMapping("/{quoteNumber}/approve")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<QuoteResponse>> approve(
            @PathVariable String quoteNumber,
            @AuthenticationPrincipal UUID userId) {
        var resp = quoteService.approve(userId, quoteNumber);
        return ResponseEntity.ok(ApiResponse.success(resp, "Quote approved"));
    }

    @PostMapping("/{quoteNumber}/reject")
    @PreAuthorize("hasAnyRole('CRM_AGENT','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<QuoteResponse>> reject(
            @PathVariable String quoteNumber,
            @AuthenticationPrincipal UUID userId,
            @RequestParam(required = false) String reason) {
        var resp = quoteService.rejectInternal(userId, quoteNumber, reason);
        return ResponseEntity.ok(ApiResponse.success(resp, "Quote sent back for rework"));
    }

    @PostMapping("/{quoteNumber}/send")
    @PreAuthorize("hasAnyRole('CRM_AGENT','OPS_MANAGER','SERVICE_MANAGER','ADMIN')")
    public ResponseEntity<ApiResponse<QuoteResponse>> send(
            @PathVariable String quoteNumber,
            @AuthenticationPrincipal UUID userId) {
        var resp = quoteService.sendToCustomer(userId, quoteNumber);
        return ResponseEntity.ok(ApiResponse.success(resp, "Quote delivered to customer"));
    }

    // ─────────────────────────────────────────────────────────────
    //  CUSTOMER DECISION
    // ─────────────────────────────────────────────────────────────

    @PostMapping("/{quoteNumber}/customer-decision")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<QuoteResponse>> customerDecision(
            @PathVariable String quoteNumber,
            @AuthenticationPrincipal UUID customerId,
            @Valid @RequestBody CustomerQuoteDecisionRequest req) {
        var resp = quoteService.customerDecision(customerId, quoteNumber, req);
        return ResponseEntity.ok(ApiResponse.success(resp, "Recorded: " + req.getDecision()));
    }

    // ─────────────────────────────────────────────────────────────
    //  READS
    // ─────────────────────────────────────────────────────────────

    @GetMapping("/{quoteNumber}")
    public ResponseEntity<ApiResponse<QuoteResponse>> get(@PathVariable String quoteNumber) {
        return ResponseEntity.ok(ApiResponse.success(quoteService.getByNumber(quoteNumber)));
    }

    @GetMapping("/queue")
    @PreAuthorize("hasAnyRole('SERVICE_MANAGER','ADMIN','OPS_MANAGER')")
    public ResponseEntity<ApiResponse<List<QuoteResponse>>> queue() {
        return ResponseEntity.ok(ApiResponse.success(quoteService.listApprovalQueue()));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<List<QuoteResponse>>> myQuotes(
            @AuthenticationPrincipal UUID customerId) {
        return ResponseEntity.ok(ApiResponse.success(quoteService.listForCustomer(customerId)));
    }

    @GetMapping("/install/{installId}")
    public ResponseEntity<ApiResponse<List<QuoteResponse>>> forInstall(@PathVariable UUID installId) {
        return ResponseEntity.ok(ApiResponse.success(quoteService.listForInstall(installId)));
    }

    @GetMapping("/ticket/{ticketId}")
    public ResponseEntity<ApiResponse<List<QuoteResponse>>> forTicket(@PathVariable UUID ticketId) {
        return ResponseEntity.ok(ApiResponse.success(quoteService.listForTicket(ticketId)));
    }
}
