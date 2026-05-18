package com.aes.service;

import com.aes.config.AppProperties;
import com.aes.dto.request.*;
import com.aes.dto.response.TicketResponse;
import com.aes.entity.*;
import com.aes.enums.*;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Ticket Action Service — handles all ticket lifecycle operations.
 *
 * Per Section 4.7 (lines 667-724):
 *   acknowledge, assign-engineer, escalate, resolve, rate
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class TicketActionService {

    private final ServiceTicketRepository ticketRepository;
    private final TicketEscalationLogRepository escalationLogRepository;
    private final UserRepository userRepository;
    private final ServiceTicketService ticketService;
    private final NotificationService notificationService;
    private final WebSocketService webSocketService;
    private final AssignmentService assignmentService;
    private final AppProperties appProperties;
    private final SmsService smsService;

    /**
     * Acknowledge ticket.
     * Per lines 671-677.
     */
    @Transactional
    public TicketResponse acknowledgeTicket(String ticketNumber, UUID agentId) {
        ServiceTicket ticket = findTicket(ticketNumber);

        // Verify assigned CRM agent
        if (ticket.getCurrentAssignee() == null ||
                !ticket.getCurrentAssignee().getId().equals(agentId)) {
            throw new BusinessException("FORBIDDEN", "Only the assigned agent can acknowledge this ticket",
                    HttpStatus.FORBIDDEN);
        }

        if (ticket.getAcknowledgedAt() != null) {
            throw new BusinessException("ALREADY_ACKNOWLEDGED", "Ticket is already acknowledged",
                    HttpStatus.BAD_REQUEST);
        }

        // 1. Set status = ACKNOWLEDGED, acknowledged_at = NOW() (line 674)
        ticket.setStatus(TicketStatus.ACKNOWLEDGED);
        ticket.setAcknowledgedAt(OffsetDateTime.now());
        ticketRepository.save(ticket);

        // 2. Create activity (line 675)
        User agent = userRepository.findById(agentId).orElse(null);
        ticketService.createActivity(ticket, agent, ActivityType.ACKNOWLEDGED,
                "Acknowledged by CRM agent: " + (agent != null ? agent.getName() : "Unknown"));

        // 3. WebSocket broadcast (line 676)
        webSocketService.broadcastTicketUpdate(ticketNumber, "ACKNOWLEDGED",
                ticket.getCurrentLevel(), 0, agent != null ? agent.getName() : "CRM Agent");

        // 4. Notify customer (line 677) — in-app + best-effort SMS
        notificationService.notifyUser(ticket.getCustomer().getId(),
                "Ticket " + ticketNumber + " Acknowledged",
                "Your ticket has been acknowledged by our CRM team. We're working on it.",
                NotificationType.TICKET_ASSIGNED, ticket.getId());
        smsService.sendTicketSms(ticket.getCustomer().getPhoneNumber(),
                "AES: ticket " + ticketNumber + " acknowledged. Our team is on it.");

        log.info("Ticket {} acknowledged by {}", ticketNumber, agentId);
        return ticketService.toFullResponse(ticket);
    }

    /**
     * Assign engineer to ticket.
     * Per lines 679-685.
     */
    @Transactional
    public TicketResponse assignEngineer(String ticketNumber, UUID requesterId, AssignEngineerRequest request) {
        ServiceTicket ticket = findTicket(ticketNumber);

        User engineer = userRepository.findById(request.getEngineerId())
                .orElseThrow(() -> new NotFoundException("User", request.getEngineerId().toString()));

        // 1. Set assignee + status (line 683)
        ticket.setCurrentAssignee(engineer);
        ticket.setAssignedAt(OffsetDateTime.now());
        ticket.setStatus(TicketStatus.ASSIGNED);
        ticketRepository.save(ticket);

        // 2. Create activity (line 684)
        User requester = userRepository.findById(requesterId).orElse(null);
        String notes = request.getNotes() != null ? ". Notes: " + request.getNotes() : "";
        ticketService.createActivity(ticket, requester, ActivityType.ASSIGNED,
                "Engineer assigned: " + engineer.getName() + notes);

        // 3. Notify engineer (line 685)
        notificationService.notifyUser(engineer.getId(),
                "New Ticket Assignment",
                "Ticket " + ticketNumber + " has been assigned to you. Priority: " + ticket.getPriority().name(),
                NotificationType.TICKET_ASSIGNED, ticket.getId());

        // WebSocket update
        webSocketService.broadcastTicketUpdate(ticketNumber, "ENGINEER_ASSIGNED",
                ticket.getCurrentLevel(), 0, engineer.getName());

        log.info("Ticket {} assigned to engineer {}", ticketNumber, engineer.getName());
        return ticketService.toFullResponse(ticket);
    }

    /**
     * Manually escalate ticket.
     * Per lines 687-692.
     */
    @Transactional
    public TicketResponse escalateTicket(String ticketNumber, UUID requesterId, EscalateTicketRequest request) {
        ServiceTicket ticket = findTicket(ticketNumber);

        int currentLevel = ticket.getCurrentLevel();
        if (currentLevel >= 3) {
            throw new BusinessException("MAX_LEVEL", "Ticket is already at maximum escalation level",
                    HttpStatus.BAD_REQUEST);
        }

        if (currentLevel == 1) {
            escalateToLevel(ticket, 1, 2, request.getReason(), EscalationType.MANUAL);
        } else if (currentLevel == 2) {
            escalateToLevel(ticket, 2, 3, request.getReason(), EscalationType.MANUAL);
        }

        log.info("Ticket {} manually escalated by {}", ticketNumber, requesterId);
        return ticketService.toFullResponse(ticket);
    }

    /**
     * Core escalation logic — shared by manual and auto escalation.
     * Per lines 749-789 (L2) and 791-797 (L3).
     *
     * <p>{@code REQUIRED} propagation joins the manual-escalation transaction
     * and starts a fresh one when invoked by the {@link EscalationEngineService}
     * scheduler (which has no enclosing transaction). Every per-ticket
     * escalation therefore commits or rolls back atomically — escalation log,
     * ticket update and activity row stay consistent.</p>
     *
     * <p>The ticket is re-fetched by ID so we always operate on a managed
     * entity within this transaction. The auto-escalation scheduler reads the
     * candidates in a separate read-only session — by the time we land here
     * those entities are detached, so any subsequent lazy access (e.g.
     * {@code ticket.getCustomer()}) would otherwise fail with
     * {@code LazyInitializationException}.</p>
     */
    @Transactional
    public void escalateToLevel(ServiceTicket detached, int fromLevel, int toLevel,
                                 String reason, EscalationType type) {
        // Re-attach: scheduler hands us a detached entity, manual flow an
        // attached one. A re-fetch normalises both code paths.
        final UUID ticketId = detached.getId();
        ServiceTicket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketId.toString()));
        OffsetDateTime now = OffsetDateTime.now();

        TicketEscalationLog escLog = TicketEscalationLog.builder()
                .ticket(ticket)
                .fromLevel(fromLevel)
                .toLevel(toLevel)
                .fromUserId(ticket.getCurrentAssignee() != null
                        ? ticket.getCurrentAssignee().getId() : null)
                .reason(reason)
                .escalationType(type)
                .escalatedAt(now)
                .build();
        escalationLogRepository.save(escLog);

        ticket.setCurrentLevel(toLevel);

        User newAssignee;
        String assignedTeam;
        if (toLevel == 2) {
            ticket.setSlaDeadlineL2(now.plusMinutes(appProperties.getEscalation().getL2TimeoutMinutes()));
            newAssignee = assignmentService.getNextAvailableManager();
            assignedTeam = "Service Manager Team";
        } else {
            // Per spec lines 791-797 — Level 3 is "Management takes over" with no further SLA.
            newAssignee = assignmentService.getNextAvailableAdmin();
            assignedTeam = "Management Team";
        }

        ticket.setCurrentAssignee(newAssignee);
        ticket.setAssignedAt(now);
        ticketRepository.save(ticket);

        ticketService.createActivity(ticket, null, ActivityType.ESCALATED,
                (type == EscalationType.AUTO ? "Auto-escalated" : "Manually escalated")
                        + " to Level " + toLevel + ". Reason: " + reason);

        notificationService.notifyUser(ticket.getCustomer().getId(),
                "Update on ticket " + ticket.getTicketNumber(),
                "Your request has been escalated to our " + assignedTeam + " for faster resolution.",
                NotificationType.TICKET_ESCALATED, ticket.getId());
        smsService.sendTicketSms(ticket.getCustomer().getPhoneNumber(),
                "AES: ticket " + ticket.getTicketNumber() + " escalated to " + assignedTeam + ".");

        notificationService.notifyUser(newAssignee.getId(),
                "New escalated ticket",
                "Ticket " + ticket.getTicketNumber() + " has been escalated to you. Reason: " + reason,
                NotificationType.TICKET_ESCALATED, ticket.getId());

        webSocketService.broadcastTicketUpdate(ticket.getTicketNumber(),
                "ESCALATED_TO_L" + toLevel, toLevel, 0, assignedTeam);
        webSocketService.broadcastEscalationUpdate(ticket.getTicketNumber(), fromLevel, toLevel);

        log.info("Ticket {} escalated L{} → L{}: {}", ticket.getTicketNumber(), fromLevel, toLevel, reason);
    }

    /**
     * Resolve ticket.
     * Per lines 694-701.
     */
    @Transactional
    public TicketResponse resolveTicket(String ticketNumber, UUID resolverId, ResolveTicketRequest request) {
        ServiceTicket ticket = findTicket(ticketNumber);

        if (ticket.getStatus() == TicketStatus.RESOLVED || ticket.getStatus() == TicketStatus.CLOSED) {
            throw new BusinessException("ALREADY_RESOLVED", "Ticket is already resolved/closed",
                    HttpStatus.BAD_REQUEST);
        }

        // 1. Set status = RESOLVED, resolved_at = NOW() (line 698)
        ticket.setStatus(TicketStatus.RESOLVED);
        ticket.setResolvedAt(OffsetDateTime.now());

        // If P3, set final_charge (line 701)
        if (request.getFinalCharge() != null) {
            ticket.setFinalCharge(request.getFinalCharge());
        }

        ticketRepository.save(ticket);

        // 2. Create activity (line 699)
        User resolver = userRepository.findById(resolverId).orElse(null);
        ticketService.createActivity(ticket, resolver, ActivityType.RESOLVED,
                "Resolved. Notes: " + request.getResolutionNotes());

        // 3. Notify customer (line 700) — in-app + best-effort SMS
        notificationService.notifyUser(ticket.getCustomer().getId(),
                "Ticket " + ticketNumber + " Resolved",
                "Your ticket has been resolved. Please rate your experience.",
                NotificationType.TICKET_RESOLVED, ticket.getId());
        smsService.sendTicketSms(ticket.getCustomer().getPhoneNumber(),
                "AES: ticket " + ticketNumber + " resolved. We'd love your feedback in the app.");

        // WebSocket update
        webSocketService.broadcastTicketUpdate(ticketNumber, "RESOLVED",
                ticket.getCurrentLevel(), 0,
                resolver != null ? resolver.getName() : "Staff");

        log.info("Ticket {} resolved by {}", ticketNumber, resolverId);
        return ticketService.toFullResponse(ticket);
    }

    /**
     * Rate and close ticket.
     * Per lines 703-709.
     *
     * <p>When the rating is at or below {@code app.reopen.auto-reopen-rating}
     * (default 2★) the ticket is auto-reopened (FLOW.md C18 / S12) and put
     * back on the owner's queue with a {@code REOPENED} status instead of
     * being marked {@code CLOSED}.</p>
     */
    @Transactional
    public TicketResponse rateTicket(String ticketNumber, UUID customerId, RateTicketRequest request) {
        ServiceTicket ticket = findTicket(ticketNumber);

        if (!ticket.getCustomer().getId().equals(customerId)) {
            throw new BusinessException("FORBIDDEN", "You can only rate your own tickets",
                    HttpStatus.FORBIDDEN);
        }
        if (ticket.getStatus() != TicketStatus.RESOLVED) {
            throw new BusinessException("INVALID_STATE", "Can only rate resolved tickets",
                    HttpStatus.BAD_REQUEST);
        }

        ticket.setCustomerRating(request.getRating());
        ticket.setCustomerFeedback(request.getFeedback());

        int autoReopenAt = appProperties.getReopen().getAutoReopenRating();
        boolean shouldAutoReopen = request.getRating() != null && request.getRating() <= autoReopenAt;

        if (shouldAutoReopen) {
            ticket.setStatus(TicketStatus.REOPENED);
            ticket.setClosedAt(null);
        } else {
            ticket.setStatus(TicketStatus.CLOSED);
            ticket.setClosedAt(OffsetDateTime.now());
        }
        ticketRepository.save(ticket);

        User customer = userRepository.findById(customerId).orElse(null);
        ticketService.createActivity(ticket, customer, ActivityType.RATED,
                "Customer rated: " + request.getRating() + " stars" +
                        (request.getFeedback() != null ? ". Feedback: " + request.getFeedback() : "") +
                        (shouldAutoReopen ? " — AUTO REOPENED (rating ≤ " + autoReopenAt + ")" : ""));

        if (shouldAutoReopen) {
            if (ticket.getCurrentAssignee() != null) {
                notificationService.notifyUser(ticket.getCurrentAssignee().getId(),
                        "Ticket reopened — " + ticketNumber,
                        "Customer rated " + request.getRating() + "★ — please investigate.",
                        NotificationType.TICKET_ESCALATED, ticket.getId());
            }
            notifyOpsManagers(ticket, "Low-rating reopen — " + ticketNumber,
                    "Customer rated " + request.getRating() + "★ — reopened automatically.");
            webSocketService.broadcastTicketUpdate(ticketNumber, "REOPENED",
                    ticket.getCurrentLevel(), 0,
                    ticket.getCurrentAssignee() != null
                            ? ticket.getCurrentAssignee().getName() : "Owner CRM");
        }

        log.info("Ticket {} rated {}★ — {}", ticketNumber, request.getRating(),
                shouldAutoReopen ? "AUTO_REOPENED" : "CLOSED");
        return ticketService.toFullResponse(ticket);
    }

    // ─────────────────────────────────────────────────────────────
    //  Phase 6 — Customer T1 escalation (FLOW.md C16)
    // ─────────────────────────────────────────────────────────────

    /**
     * Customer-initiated escalation (T1). Status flips to
     * {@link TicketStatus#ESCALATED_BY_CUSTOMER}; the ticket re-surfaces in
     * the Ops Manager triage inbox with a red-flag so they can re-route.
     * The current owner stays as a courtesy assignee until OPS re-decides.
     */
    @Transactional
    public TicketResponse customerEscalate(String ticketNumber, UUID customerId,
                                            CustomerEscalateRequest request) {
        ServiceTicket ticket = findTicket(ticketNumber);
        if (!ticket.getCustomer().getId().equals(customerId)) {
            throw new BusinessException("FORBIDDEN",
                    "You can only escalate your own tickets.", HttpStatus.FORBIDDEN);
        }
        if (ticket.getStatus() == TicketStatus.RESOLVED
                || ticket.getStatus() == TicketStatus.CLOSED
                || ticket.getStatus() == TicketStatus.CANCELLED) {
            throw new BusinessException("INVALID_STATE",
                    "Cannot escalate a " + ticket.getStatus() + " ticket. "
                            + "Use re-open instead.", HttpStatus.CONFLICT);
        }

        OffsetDateTime now = OffsetDateTime.now();
        TicketStatus previousStatus = ticket.getStatus();
        ticket.setStatus(TicketStatus.ESCALATED_BY_CUSTOMER);
        ticket.setEscalationReason(request.getReason());
        ticketRepository.save(ticket);

        TicketEscalationLog escLog = TicketEscalationLog.builder()
                .ticket(ticket)
                .fromLevel(ticket.getCurrentLevel())
                .toLevel(ticket.getCurrentLevel())
                .fromUserId(customerId)
                .reason("Customer escalation: " + request.getReason()
                        + (request.getDetails() != null ? " — " + request.getDetails() : ""))
                .escalationType(EscalationType.MANUAL)
                .escalatedAt(now)
                .build();
        escalationLogRepository.save(escLog);

        User customer = userRepository.findById(customerId).orElse(null);
        ticketService.createActivity(ticket, customer, ActivityType.ESCALATED,
                "T1 customer escalation (" + request.getReason()
                        + (request.getDetails() != null ? " — " + request.getDetails() : "")
                        + "). Previous status: " + previousStatus);

        if (ticket.getCurrentAssignee() != null) {
            notificationService.notifyUser(ticket.getCurrentAssignee().getId(),
                    "Customer escalated " + ticketNumber,
                    "Reason: " + request.getReason()
                            + (request.getDetails() != null ? ". " + request.getDetails() : ""),
                    NotificationType.TICKET_ESCALATED, ticket.getId());
        }
        notifyOpsManagers(ticket, "T1 escalation — " + ticketNumber,
                "Customer flagged: " + request.getReason() + ". Re-triage required.");
        smsService.sendTicketSms(ticket.getCustomer().getPhoneNumber(),
                "AES: your escalation for " + ticketNumber
                        + " has been logged. Our manager will contact you shortly.");
        webSocketService.broadcastTicketUpdate(ticketNumber, "ESCALATED_BY_CUSTOMER",
                ticket.getCurrentLevel(), 0, "Customer");

        log.info("Ticket {} customer-escalated: {}", ticketNumber, request.getReason());
        return ticketService.toFullResponse(ticket);
    }

    // ─────────────────────────────────────────────────────────────
    //  Phase 6 — Customer reschedule (FLOW.md C19)
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public TicketResponse rescheduleTicket(String ticketNumber, UUID customerId,
                                            RescheduleTicketRequest request) {
        ServiceTicket ticket = findTicket(ticketNumber);
        if (!ticket.getCustomer().getId().equals(customerId)) {
            throw new BusinessException("FORBIDDEN",
                    "You can only reschedule your own tickets.", HttpStatus.FORBIDDEN);
        }
        TicketStatus s = ticket.getStatus();
        if (s == TicketStatus.EN_ROUTE || s == TicketStatus.ON_SITE
                || s == TicketStatus.IN_PROGRESS
                || s == TicketStatus.RESOLVED || s == TicketStatus.CLOSED
                || s == TicketStatus.CANCELLED) {
            throw new BusinessException("INVALID_STATE",
                    "Cannot reschedule a " + s + " ticket. Please call the engineer directly.",
                    HttpStatus.CONFLICT);
        }

        ticket.setScheduledDate(request.getNewDate());
        if (request.getNewSlot() != null) {
            ticket.setScheduledSlot(request.getNewSlot());
        }
        // If an engineer was already dispatched, drop them so the owner CRM can re-pick.
        if (ticket.getEngineer() != null) {
            ticket.setEngineer(null);
            ticket.setEngineerAcceptedAt(null);
            if (ticket.getStatus() == TicketStatus.ENGINEER_OFFERED
                    || ticket.getStatus() == TicketStatus.ASSIGNED) {
                ticket.setStatus(TicketStatus.ACKNOWLEDGED);
            }
        }
        ticketRepository.save(ticket);

        User customer = userRepository.findById(customerId).orElse(null);
        ticketService.createActivity(ticket, customer, ActivityType.STATUS_CHANGED,
                "Customer rescheduled to " + request.getNewDate()
                        + (request.getNewSlot() != null ? " (" + request.getNewSlot() + ")" : "")
                        + (request.getReason() != null ? " — " + request.getReason() : ""));
        if (ticket.getCurrentAssignee() != null) {
            notificationService.notifyUser(ticket.getCurrentAssignee().getId(),
                    "Customer rescheduled " + ticketNumber,
                    "New slot: " + request.getNewDate()
                            + (request.getNewSlot() != null ? " " + request.getNewSlot() : "")
                            + ". Re-dispatch the engineer if needed.",
                    NotificationType.TICKET_ASSIGNED, ticket.getId());
        }
        return ticketService.toFullResponse(ticket);
    }

    // ─────────────────────────────────────────────────────────────
    //  Phase 6 — Customer re-open (FLOW.md C18 / S12)
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public TicketResponse reopenTicket(String ticketNumber, UUID customerId,
                                        ReopenTicketRequest request) {
        ServiceTicket ticket = findTicket(ticketNumber);
        if (!ticket.getCustomer().getId().equals(customerId)) {
            throw new BusinessException("FORBIDDEN",
                    "You can only re-open your own tickets.", HttpStatus.FORBIDDEN);
        }
        if (ticket.getStatus() != TicketStatus.CLOSED
                && ticket.getStatus() != TicketStatus.RESOLVED) {
            throw new BusinessException("INVALID_STATE",
                    "Only CLOSED / RESOLVED tickets can be re-opened.", HttpStatus.CONFLICT);
        }
        int windowDays = appProperties.getReopen().getWindowDays();
        OffsetDateTime cutoff = ticket.getClosedAt() != null
                ? ticket.getClosedAt() : ticket.getResolvedAt();
        if (cutoff != null && cutoff.plusDays(windowDays).isBefore(OffsetDateTime.now())) {
            throw new BusinessException("WINDOW_EXPIRED",
                    "Re-open window of " + windowDays + " days has expired. "
                            + "Please raise a new ticket linked to " + ticketNumber + ".",
                    HttpStatus.CONFLICT);
        }

        ticket.setStatus(TicketStatus.REOPENED);
        ticket.setClosedAt(null);
        ticketRepository.save(ticket);

        User customer = userRepository.findById(customerId).orElse(null);
        ticketService.createActivity(ticket, customer, ActivityType.STATUS_CHANGED,
                "Re-opened by customer: " + request.getReason());
        if (ticket.getCurrentAssignee() != null) {
            notificationService.notifyUser(ticket.getCurrentAssignee().getId(),
                    "Ticket " + ticketNumber + " was re-opened",
                    "Customer reason: " + request.getReason(),
                    NotificationType.TICKET_ESCALATED, ticket.getId());
        }
        notifyOpsManagers(ticket, "Ticket re-opened — " + ticketNumber,
                "Customer reason: " + request.getReason());
        webSocketService.broadcastTicketUpdate(ticketNumber, "REOPENED",
                ticket.getCurrentLevel(), 0,
                ticket.getCurrentAssignee() != null
                        ? ticket.getCurrentAssignee().getName() : "Owner CRM");
        return ticketService.toFullResponse(ticket);
    }

    // ─────────────────────────────────────────────────────────────
    //  Helpers
    // ─────────────────────────────────────────────────────────────

    private void notifyOpsManagers(ServiceTicket ticket, String title, String body) {
        for (User ops : userRepository.findByRoleAndIsActiveTrue(UserRole.OPS_MANAGER)) {
            notificationService.notifyUser(ops.getId(), title, body,
                    NotificationType.TICKET_ESCALATED, ticket.getId());
        }
    }

    private ServiceTicket findTicket(String ticketNumber) {
        return ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));
    }
}
