package com.aes.service;

import com.aes.config.AppProperties;
import com.aes.dto.request.CustomerQuoteDecisionRequest;
import com.aes.dto.request.DraftQuoteRequest;
import com.aes.dto.request.QuoteLineItemRequest;
import com.aes.dto.response.QuoteResponse;
import com.aes.entity.*;
import com.aes.enums.*;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.Year;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Quote workflow (PLAN.md §7.4, FLOW.md C3 / C21–C24).
 *
 * <p>One service covers both shapes:</p>
 * <ul>
 *   <li>Installation quote → {@link #draftForInstall(UUID, UUID, DraftQuoteRequest)}.</li>
 *   <li>P3 estimate → {@link #draftForTicket(UUID, UUID, DraftQuoteRequest)}.</li>
 * </ul>
 *
 * <p>Lifecycle: {@code DRAFT → PENDING_APPROVAL → APPROVED → SENT_TO_CUSTOMER
 * → CUSTOMER_ACCEPTED | CUSTOMER_REJECTED | NEGOTIATING (→ DRAFT v+1)}.</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class QuoteService {

    private static final Set<QuoteStatus> EDITABLE_STATUSES =
            Set.of(QuoteStatus.DRAFT, QuoteStatus.REJECTED_INTERNAL);

    private final QuoteRepository quoteRepository;
    private final InstallationRequestRepository installRepository;
    private final ServiceTicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final WebSocketService webSocketService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    // ─────────────────────────────────────────────────────────────
    //  DRAFT
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public QuoteResponse draftForInstall(UUID actingUserId, UUID installId, DraftQuoteRequest req) {
        InstallationRequest install = installRepository.findById(installId)
                .orElseThrow(() -> new NotFoundException("InstallationRequest", installId.toString()));
        User actor = requireUser(actingUserId);

        assertCanDraftForInstall(install, actor);

        int version = nextInstallVersion(installId);
        Quote quote = buildQuoteSkeleton(actor, req, version);
        quote.setInstall(install);
        quote = quoteRepository.save(quote);

        install.setStatus(InstallationStatus.QUOTE_DRAFT);
        installRepository.save(install);

        log.info("Quote {} drafted for install {} by {}",
                quote.getQuoteNumber(), install.getRequestNumber(), actor.getName());
        return toResponse(quote);
    }

    @Transactional
    public QuoteResponse draftForTicket(UUID actingUserId, UUID ticketId, DraftQuoteRequest req) {
        ServiceTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketId.toString()));
        User actor = requireUser(actingUserId);

        assertCanDraftForTicket(ticket, actor);

        int version = nextTicketVersion(ticketId);
        Quote quote = buildQuoteSkeleton(actor, req, version);
        quote.setTicket(ticket);

        // P3 estimate ≤ auto-approve ceiling → skip the approval queue entirely.
        BigDecimal autoCeiling = appProperties.getApproval().getQuoteAutoApproveCeiling();
        if (quote.getTotal().compareTo(autoCeiling) <= 0) {
            quote.setStatus(QuoteStatus.APPROVED);
            quote.setApprovedBy(actor);
            quote.setApprovedAt(OffsetDateTime.now());
        }
        quote = quoteRepository.save(quote);

        ticket.setStatus(TicketStatus.WAITING_CUSTOMER_APPROVAL);
        ticket.setEstimatedCharge(quote.getTotal());
        ticketRepository.save(ticket);

        log.info("Estimate {} drafted for ticket {} (total ₹{}) by {}",
                quote.getQuoteNumber(), ticket.getTicketNumber(), quote.getTotal(), actor.getName());
        return toResponse(quote);
    }

    private Quote buildQuoteSkeleton(User actor, DraftQuoteRequest req, int version) {
        Totals totals = computeTotals(req.getLineItems(), req.getDiscount());
        String quoteNumber = nextQuoteNumber();

        return Quote.builder()
                .quoteNumber(quoteNumber)
                .version(version)
                .lineItemsJson(serializeLineItems(req.getLineItems()))
                .subtotal(totals.subtotal)
                .tax(totals.tax)
                .discount(req.getDiscount() != null ? req.getDiscount() : BigDecimal.ZERO)
                .total(totals.total)
                .validUntil(req.getValidUntil())
                .status(QuoteStatus.DRAFT)
                .preparedBy(actor)
                .notes(req.getNotes())
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    //  REVISE (creates a new version after NEGOTIATING)
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public QuoteResponse revise(UUID actingUserId, String quoteNumber, DraftQuoteRequest req) {
        Quote prev = quoteRepository.findByQuoteNumber(quoteNumber)
                .orElseThrow(() -> new NotFoundException("Quote", quoteNumber));
        if (prev.getStatus() != QuoteStatus.NEGOTIATING
                && prev.getStatus() != QuoteStatus.CUSTOMER_REJECTED
                && prev.getStatus() != QuoteStatus.REJECTED_INTERNAL) {
            throw new BusinessException("BAD_STATE",
                    "Only NEGOTIATING / CUSTOMER_REJECTED / REJECTED_INTERNAL quotes "
                            + "can be revised (current: " + prev.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
        prev.setStatus(QuoteStatus.SUPERSEDED);
        quoteRepository.save(prev);

        QuoteResponse nextResp = (prev.getInstall() != null)
                ? draftForInstall(actingUserId, prev.getInstall().getId(), req)
                : draftForTicket(actingUserId, prev.getTicket().getId(), req);
        Quote next = quoteRepository.findById(nextResp.getId()).orElseThrow();
        next.setNotes(prev.getNotes() + "\n[Revised from " + prev.getQuoteNumber() + "]");
        return toResponse(quoteRepository.save(next));
    }

    // ─────────────────────────────────────────────────────────────
    //  SUBMIT FOR APPROVAL
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public QuoteResponse submitForApproval(UUID actingUserId, String quoteNumber) {
        Quote quote = requireQuote(quoteNumber);
        User actor = requireUser(actingUserId);
        if (!EDITABLE_STATUSES.contains(quote.getStatus())) {
            throw new BusinessException("BAD_STATE",
                    "Only DRAFT / REJECTED_INTERNAL quotes can be submitted (current: "
                            + quote.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }

        ApprovalBand band = requiredApprovalBand(quote);
        quote.setStatus(QuoteStatus.PENDING_APPROVAL);
        quoteRepository.save(quote);

        // Notify the approvers (band → role).
        UserRole approverRole = approverRoleFor(band);
        if (approverRole != null) {
            List<User> approvers = userRepository.findByRoleAndIsActiveTrue(approverRole);
            for (User a : approvers) {
                notificationService.notifyUser(a.getId(),
                        "Quote awaiting approval — " + quote.getQuoteNumber(),
                        "Quote total ₹" + quote.getTotal() + " submitted by " + actor.getName()
                                + ". Band: " + band,
                        NotificationType.TICKET_ESCALATED, quote.getId());
            }
        }
        log.info("Quote {} submitted for approval (band {})", quote.getQuoteNumber(), band);
        return toResponse(quote);
    }

    // ─────────────────────────────────────────────────────────────
    //  APPROVE / REJECT (internal)
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public QuoteResponse approve(UUID actingUserId, String quoteNumber) {
        Quote quote = requireQuote(quoteNumber);
        User actor = requireUser(actingUserId);
        if (quote.getStatus() != QuoteStatus.PENDING_APPROVAL) {
            throw new BusinessException("BAD_STATE",
                    "Only PENDING_APPROVAL quotes can be approved (current: "
                            + quote.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
        ApprovalBand requiredBand = requiredApprovalBand(quote);
        assertActorCanApprove(actor, requiredBand);

        quote.setStatus(QuoteStatus.APPROVED);
        quote.setApprovedBy(actor);
        quote.setApprovedAt(OffsetDateTime.now());
        quoteRepository.save(quote);

        log.info("Quote {} approved by {} ({})",
                quote.getQuoteNumber(), actor.getName(), actor.getRole());
        return toResponse(quote);
    }

    @Transactional
    public QuoteResponse rejectInternal(UUID actingUserId, String quoteNumber, String reason) {
        Quote quote = requireQuote(quoteNumber);
        User actor = requireUser(actingUserId);
        if (quote.getStatus() != QuoteStatus.PENDING_APPROVAL) {
            throw new BusinessException("BAD_STATE",
                    "Only PENDING_APPROVAL quotes can be rejected internally (current: "
                            + quote.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
        quote.setStatus(QuoteStatus.REJECTED_INTERNAL);
        quote.setNotes((quote.getNotes() == null ? "" : quote.getNotes() + "\n")
                + "[Internal reject by " + actor.getName() + "] " + (reason == null ? "" : reason));
        quoteRepository.save(quote);

        if (quote.getPreparedBy() != null) {
            notificationService.notifyUser(quote.getPreparedBy().getId(),
                    "Quote " + quote.getQuoteNumber() + " sent back for rework",
                    "Reviewer " + actor.getName() + " asked for changes" + (reason == null ? "" : ": " + reason),
                    NotificationType.GENERAL, quote.getId());
        }
        return toResponse(quote);
    }

    // ─────────────────────────────────────────────────────────────
    //  SEND TO CUSTOMER
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public QuoteResponse sendToCustomer(UUID actingUserId, String quoteNumber) {
        Quote quote = requireQuote(quoteNumber);
        User actor = requireUser(actingUserId);
        if (quote.getStatus() != QuoteStatus.APPROVED) {
            throw new BusinessException("BAD_STATE",
                    "Only APPROVED quotes can be sent to the customer (current: "
                            + quote.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
        quote.setStatus(QuoteStatus.SENT_TO_CUSTOMER);
        quote.setSentAt(OffsetDateTime.now());
        quoteRepository.save(quote);

        if (quote.getInstall() != null) {
            InstallationRequest install = quote.getInstall();
            install.setStatus(InstallationStatus.QUOTE_SENT);
            install.setEstimatedCost(quote.getTotal());
            installRepository.save(install);
            User customer = install.getCustomer();
            notificationService.notifyUser(customer.getId(),
                    "Your installation quote is ready",
                    "Quote " + quote.getQuoteNumber() + " (₹" + quote.getTotal()
                            + ") is ready for your review.",
                    NotificationType.GENERAL, quote.getId());
        } else if (quote.getTicket() != null) {
            ServiceTicket ticket = quote.getTicket();
            ticket.setStatus(TicketStatus.WAITING_CUSTOMER_APPROVAL);
            ticket.setEstimatedCharge(quote.getTotal());
            ticketRepository.save(ticket);
            notificationService.notifyUser(ticket.getCustomer().getId(),
                    "Estimate ready for " + ticket.getTicketNumber(),
                    "Estimate ₹" + quote.getTotal() + " — please review and accept to proceed.",
                    NotificationType.GENERAL, quote.getId());
        }
        log.info("Quote {} sent to customer by {}", quote.getQuoteNumber(), actor.getName());
        return toResponse(quote);
    }

    // ─────────────────────────────────────────────────────────────
    //  CUSTOMER DECISION
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public QuoteResponse customerDecision(UUID customerId, String quoteNumber, CustomerQuoteDecisionRequest req) {
        Quote quote = requireQuote(quoteNumber);
        assertCustomerOwnsQuote(quote, customerId);
        if (quote.getStatus() != QuoteStatus.SENT_TO_CUSTOMER) {
            throw new BusinessException("BAD_STATE",
                    "Quote is not awaiting a customer decision (current: " + quote.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }

        OffsetDateTime now = OffsetDateTime.now();
        quote.setCustomerDecision(req.getDecision());
        quote.setCustomerDecidedAt(now);
        quote.setCustomerResponse(req.getResponse());

        switch (req.getDecision()) {
            case "ACCEPTED" -> handleAccept(quote, now);
            case "REJECTED" -> handleReject(quote, now);
            case "NEGOTIATE" -> handleNegotiate(quote, now);
            default -> throw new BusinessException("BAD_DECISION",
                    "Decision must be ACCEPTED / REJECTED / NEGOTIATE.",
                    HttpStatus.BAD_REQUEST);
        }
        quoteRepository.save(quote);
        return toResponse(quote);
    }

    private void handleAccept(Quote quote, OffsetDateTime now) {
        quote.setStatus(QuoteStatus.CUSTOMER_ACCEPTED);
        if (quote.getInstall() != null) {
            InstallationRequest install = quote.getInstall();
            install.setStatus(InstallationStatus.QUOTE_ACCEPTED);
            installRepository.save(install);
            notifyOpsAndOwner(install, "Quote " + quote.getQuoteNumber() + " accepted",
                    "Customer accepted. Schedule the installation crew.");
        } else if (quote.getTicket() != null) {
            ServiceTicket ticket = quote.getTicket();
            ticket.setStatus(TicketStatus.IN_PROGRESS);
            ticket.setChargeAccepted(true);
            ticketRepository.save(ticket);
            notifyTicketOwners(ticket, "Estimate accepted",
                    "Customer accepted estimate for " + ticket.getTicketNumber()
                            + " — proceed with the repair.");
        }
    }

    private void handleReject(Quote quote, OffsetDateTime now) {
        quote.setStatus(QuoteStatus.CUSTOMER_REJECTED);
        if (quote.getInstall() != null) {
            InstallationRequest install = quote.getInstall();
            install.setStatus(InstallationStatus.CANCELLED);
            installRepository.save(install);
            notifyOpsAndOwner(install, "Quote " + quote.getQuoteNumber() + " declined",
                    "Customer declined. Install cancelled.");
        } else if (quote.getTicket() != null) {
            ServiceTicket ticket = quote.getTicket();
            ticket.setStatus(TicketStatus.CANCELLED);
            ticket.setChargeAccepted(false);
            ticketRepository.save(ticket);
            notifyTicketOwners(ticket, "Estimate declined",
                    "Customer declined the estimate for " + ticket.getTicketNumber() + ".");
        }
    }

    private void handleNegotiate(Quote quote, OffsetDateTime now) {
        quote.setStatus(QuoteStatus.NEGOTIATING);
        if (quote.getInstall() != null) {
            InstallationRequest install = quote.getInstall();
            install.setStatus(InstallationStatus.QUOTE_NEGOTIATING);
            installRepository.save(install);
            notifyOpsAndOwner(install, "Customer wants quote " + quote.getQuoteNumber() + " revised",
                    "Customer note: " + (quote.getCustomerResponse() == null ? "(none)" : quote.getCustomerResponse()));
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  READ HELPERS
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public QuoteResponse getByNumber(String quoteNumber) {
        return toResponse(requireQuote(quoteNumber));
    }

    @Transactional(readOnly = true)
    public List<QuoteResponse> listApprovalQueue() {
        return quoteRepository.findByStatusOrderByCreatedAtAsc(QuoteStatus.PENDING_APPROVAL)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<QuoteResponse> listForCustomer(UUID customerId) {
        return quoteRepository.findAllForCustomer(customerId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<QuoteResponse> listForInstall(UUID installId) {
        return quoteRepository.findByInstallIdOrderByVersionDesc(installId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<QuoteResponse> listForTicket(UUID ticketId) {
        return quoteRepository.findByTicketIdOrderByVersionDesc(ticketId).stream()
                .map(this::toResponse).toList();
    }

    public QuoteResponse toResponse(Quote q) {
        QuoteResponse.QuoteResponseBuilder b = QuoteResponse.builder()
                .id(q.getId())
                .quoteNumber(q.getQuoteNumber())
                .version(q.getVersion())
                .lineItemsJson(q.getLineItemsJson())
                .subtotal(q.getSubtotal())
                .tax(q.getTax())
                .discount(q.getDiscount())
                .total(q.getTotal())
                .validUntil(q.getValidUntil())
                .status(q.getStatus().name())
                .requiredApprovalBand(requiredApprovalBand(q).name())
                .sentAt(q.getSentAt())
                .customerDecision(q.getCustomerDecision())
                .customerDecidedAt(q.getCustomerDecidedAt())
                .customerResponse(q.getCustomerResponse())
                .approvedAt(q.getApprovedAt())
                .notes(q.getNotes())
                .createdAt(q.getCreatedAt())
                .updatedAt(q.getUpdatedAt());
        if (q.getInstall() != null) {
            b.installId(q.getInstall().getId())
             .installNumber(q.getInstall().getRequestNumber());
            if (q.getInstall().getCustomer() != null) {
                b.customerId(q.getInstall().getCustomer().getId())
                 .customerName(q.getInstall().getCustomer().getName());
            }
        }
        if (q.getTicket() != null) {
            b.ticketId(q.getTicket().getId())
             .ticketNumber(q.getTicket().getTicketNumber());
            if (q.getTicket().getCustomer() != null) {
                b.customerId(q.getTicket().getCustomer().getId())
                 .customerName(q.getTicket().getCustomer().getName());
            }
        }
        if (q.getPreparedBy() != null) {
            b.preparedByName(q.getPreparedBy().getName());
        }
        if (q.getApprovedBy() != null) {
            b.approvedByName(q.getApprovedBy().getName());
        }
        return b.build();
    }

    // ─────────────────────────────────────────────────────────────
    //  APPROVAL BAND LOGIC
    // ─────────────────────────────────────────────────────────────

    public ApprovalBand requiredApprovalBand(Quote q) {
        BigDecimal total = q.getTotal() == null ? BigDecimal.ZERO : q.getTotal();
        AppProperties.Approval cfg = appProperties.getApproval();
        if (q.getTicket() != null) {
            // P3 estimate bands.
            if (total.compareTo(cfg.getQuoteAutoApproveCeiling()) <= 0) return ApprovalBand.AUTO;
            if (total.compareTo(cfg.getPartCrmCeiling()) <= 0) return ApprovalBand.CRM;
            if (total.compareTo(cfg.getQuoteManagerCeiling()) <= 0) return ApprovalBand.SERVICE_MANAGER;
            return ApprovalBand.ADMIN;
        }
        // Installation bands — SM up to manager ceiling, Admin above.
        if (total.compareTo(cfg.getQuoteManagerCeiling()) <= 0) return ApprovalBand.SERVICE_MANAGER;
        return ApprovalBand.ADMIN;
    }

    private UserRole approverRoleFor(ApprovalBand band) {
        return switch (band) {
            case CRM -> UserRole.CRM_AGENT;
            case SERVICE_MANAGER -> UserRole.SERVICE_MANAGER;
            case ADMIN -> UserRole.ADMIN;
            case AUTO -> null;
        };
    }

    private void assertActorCanApprove(User actor, ApprovalBand band) {
        UserRole role = actor.getRole();
        boolean ok = switch (band) {
            case AUTO -> true;
            case CRM -> role == UserRole.CRM_AGENT || role == UserRole.SERVICE_MANAGER
                    || role == UserRole.ADMIN;
            case SERVICE_MANAGER -> role == UserRole.SERVICE_MANAGER || role == UserRole.ADMIN;
            case ADMIN -> role == UserRole.ADMIN;
        };
        if (!ok) {
            throw new BusinessException("FORBIDDEN",
                    "Your role (" + role + ") cannot approve a " + band + " quote.",
                    HttpStatus.FORBIDDEN);
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Internals
    // ─────────────────────────────────────────────────────────────

    private void assertCanDraftForInstall(InstallationRequest install, User actor) {
        UserRole role = actor.getRole();
        boolean isOwner = install.getOwnerCrm() != null
                && install.getOwnerCrm().getId().equals(actor.getId());
        boolean supervisor = role == UserRole.SERVICE_MANAGER
                || role == UserRole.ADMIN || role == UserRole.OPS_MANAGER;
        if (!isOwner && !supervisor) {
            throw new BusinessException("FORBIDDEN",
                    "Only the owning CRM (or a supervisor) can draft a quote for this install.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private void assertCanDraftForTicket(ServiceTicket ticket, User actor) {
        UserRole role = actor.getRole();
        boolean isOwner = ticket.getCurrentAssignee() != null
                && ticket.getCurrentAssignee().getId().equals(actor.getId());
        boolean isEngineer = ticket.getEngineer() != null
                && ticket.getEngineer().getId().equals(actor.getId());
        boolean supervisor = role == UserRole.SERVICE_MANAGER
                || role == UserRole.ADMIN || role == UserRole.OPS_MANAGER;
        if (!isOwner && !isEngineer && !supervisor) {
            throw new BusinessException("FORBIDDEN",
                    "Only the owner CRM, dispatched engineer, or a supervisor "
                            + "can draft an estimate for this ticket.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private void assertCustomerOwnsQuote(Quote quote, UUID customerId) {
        UUID owner = null;
        if (quote.getInstall() != null && quote.getInstall().getCustomer() != null) {
            owner = quote.getInstall().getCustomer().getId();
        } else if (quote.getTicket() != null && quote.getTicket().getCustomer() != null) {
            owner = quote.getTicket().getCustomer().getId();
        }
        if (owner == null || !owner.equals(customerId)) {
            throw new BusinessException("FORBIDDEN",
                    "You can only decide on your own quote.", HttpStatus.FORBIDDEN);
        }
    }

    private void notifyOpsAndOwner(InstallationRequest install, String title, String body) {
        if (install.getOwnerCrm() != null) {
            notificationService.notifyUser(install.getOwnerCrm().getId(), title, body,
                    NotificationType.GENERAL, install.getId());
        }
        for (User ops : userRepository.findByRoleAndIsActiveTrue(UserRole.OPS_MANAGER)) {
            notificationService.notifyUser(ops.getId(), title, body,
                    NotificationType.GENERAL, install.getId());
        }
    }

    private void notifyTicketOwners(ServiceTicket ticket, String title, String body) {
        if (ticket.getCurrentAssignee() != null) {
            notificationService.notifyUser(ticket.getCurrentAssignee().getId(), title, body,
                    NotificationType.GENERAL, ticket.getId());
        }
        if (ticket.getEngineer() != null) {
            notificationService.notifyUser(ticket.getEngineer().getId(), title, body,
                    NotificationType.GENERAL, ticket.getId());
        }
    }

    private Quote requireQuote(String quoteNumber) {
        return quoteRepository.findByQuoteNumber(quoteNumber)
                .orElseThrow(() -> new NotFoundException("Quote", quoteNumber));
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User", id.toString()));
    }

    private int nextInstallVersion(UUID installId) {
        Integer v = quoteRepository.findMaxVersionByInstallId(installId);
        return v == null ? 1 : v + 1;
    }

    private int nextTicketVersion(UUID ticketId) {
        Integer v = quoteRepository.findMaxVersionByTicketId(ticketId);
        return v == null ? 1 : v + 1;
    }

    private String nextQuoteNumber() {
        Long seq = quoteRepository.getNextQuoteSequence();
        return String.format("QUO-%d-%04d", Year.now().getValue(), seq);
    }

    private String serializeLineItems(List<QuoteLineItemRequest> items) {
        try {
            return objectMapper.writeValueAsString(items);
        } catch (JsonProcessingException e) {
            throw new BusinessException("BAD_LINE_ITEMS",
                    "Could not serialise line items: " + e.getMessage(),
                    HttpStatus.BAD_REQUEST);
        }
    }

    private record Totals(BigDecimal subtotal, BigDecimal tax, BigDecimal total) {}

    private Totals computeTotals(List<QuoteLineItemRequest> items, BigDecimal discount) {
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        for (QuoteLineItemRequest li : items) {
            BigDecimal line = li.getQty().multiply(li.getUnitPrice())
                    .setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(line);
            BigDecimal gst = li.getGstPct() == null ? new BigDecimal("18") : li.getGstPct();
            tax = tax.add(line.multiply(gst).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP));
        }
        BigDecimal disc = discount == null ? BigDecimal.ZERO : discount;
        BigDecimal total = subtotal.add(tax).subtract(disc).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        return new Totals(subtotal.setScale(2, RoundingMode.HALF_UP),
                tax.setScale(2, RoundingMode.HALF_UP), total);
    }
}
