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
     */
    @Transactional
    public void escalateToLevel(ServiceTicket ticket, int fromLevel, int toLevel,
                                 String reason, EscalationType type) {
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
     */
    @Transactional
    public TicketResponse rateTicket(String ticketNumber, UUID customerId, RateTicketRequest request) {
        ServiceTicket ticket = findTicket(ticketNumber);

        // Validate: CUSTOMER (own ticket), status=RESOLVED (line 704)
        if (!ticket.getCustomer().getId().equals(customerId)) {
            throw new BusinessException("FORBIDDEN", "You can only rate your own tickets",
                    HttpStatus.FORBIDDEN);
        }
        if (ticket.getStatus() != TicketStatus.RESOLVED) {
            throw new BusinessException("INVALID_STATE", "Can only rate resolved tickets",
                    HttpStatus.BAD_REQUEST);
        }

        // 1. Set rating + feedback (line 707)
        ticket.setCustomerRating(request.getRating());
        ticket.setCustomerFeedback(request.getFeedback());

        // 2. Set status = CLOSED (line 708)
        ticket.setStatus(TicketStatus.CLOSED);
        ticket.setClosedAt(OffsetDateTime.now());
        ticketRepository.save(ticket);

        // 3. Create activity (line 709)
        User customer = userRepository.findById(customerId).orElse(null);
        ticketService.createActivity(ticket, customer, ActivityType.RATED,
                "Customer rated: " + request.getRating() + " stars" +
                        (request.getFeedback() != null ? ". Feedback: " + request.getFeedback() : ""));

        log.info("Ticket {} rated {} stars by customer", ticketNumber, request.getRating());
        return ticketService.toFullResponse(ticket);
    }

    private ServiceTicket findTicket(String ticketNumber) {
        return ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));
    }
}
