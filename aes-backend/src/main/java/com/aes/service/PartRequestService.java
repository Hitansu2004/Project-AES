package com.aes.service;

import com.aes.config.AppProperties;
import com.aes.dto.request.OrderPartRequest;
import com.aes.dto.request.RaisePartRequest;
import com.aes.dto.response.PartRequestResponse;
import com.aes.entity.PartRequest;
import com.aes.entity.ServiceTicket;
import com.aes.entity.User;
import com.aes.enums.ActivityType;
import com.aes.enums.ApprovalBand;
import com.aes.enums.NotificationType;
import com.aes.enums.PartRequestStatus;
import com.aes.enums.TicketStatus;
import com.aes.enums.UserRole;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.PartRequestRepository;
import com.aes.repository.ServiceTicketRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Part Request workflow (PLAN.md §7.5, FLOW.md C13).
 *
 * <p>Cost bands (configurable via {@code app.approval.*}):</p>
 * <ul>
 *   <li>≤ ₹5k → owner CRM (or higher) approves.</li>
 *   <li>≤ ₹50k → Service Manager (or Admin) approves.</li>
 *   <li>&gt; ₹50k → Admin only.</li>
 * </ul>
 *
 * <p>While {@code APPROVED → ORDERED → DELIVERED} the parent ticket flips
 * into {@link TicketStatus#WAITING_PART} so the customer sees a meaningful
 * status; on {@code INSTALLED} we revert to {@link TicketStatus#IN_PROGRESS}
 * so the engineer can resume the repair.</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PartRequestService {

    private final PartRequestRepository partRepo;
    private final ServiceTicketRepository ticketRepo;
    private final UserRepository userRepo;
    private final NotificationService notificationService;
    private final ServiceTicketService ticketService;
    private final AppProperties appProperties;

    // ─────────────────────────────────────────────────────────────
    //  RAISE
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public PartRequestResponse raise(String ticketNumber, UUID actingUserId, RaisePartRequest req) {
        ServiceTicket ticket = ticketRepo.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));
        User actor = requireUser(actingUserId);
        assertCanRaise(ticket, actor);

        BigDecimal qty = BigDecimal.valueOf(req.getQuantity());
        BigDecimal total = req.getUnitCost().multiply(qty);

        PartRequest pr = PartRequest.builder()
                .ticket(ticket)
                .requestedBy(actingUserId)
                .partName(req.getPartName())
                .quantity(req.getQuantity())
                .urgency(req.getUrgency() == null ? "NORMAL" : req.getUrgency())
                .unitCost(req.getUnitCost())
                .totalCost(total)
                .notes(req.getNotes())
                .status(PartRequestStatus.PENDING_APPROVAL)
                .build();
        pr = partRepo.save(pr);

        ticket.setStatus(TicketStatus.WAITING_PART);
        ticketRepo.save(ticket);

        ticketService.createActivity(ticket, actor, ActivityType.STATUS_CHANGED,
                "Part requested: " + req.getPartName() + " ×" + req.getQuantity()
                        + " (₹" + total + ", " + req.getUrgency() + ")");

        ApprovalBand band = requiredApprovalBand(pr);
        notifyApprovers(pr, ticket, band);
        notifyCustomerWaiting(ticket);

        log.info("Part {} raised for ticket {} by {} (₹{}, band {})",
                pr.getId(), ticket.getTicketNumber(), actor.getName(), total, band);
        return toResponse(pr);
    }

    // ─────────────────────────────────────────────────────────────
    //  APPROVE / REJECT
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public PartRequestResponse approve(UUID partId, UUID actingUserId) {
        PartRequest pr = require(partId);
        User actor = requireUser(actingUserId);
        if (pr.getStatus() != PartRequestStatus.PENDING_APPROVAL) {
            throw new BusinessException("BAD_STATE",
                    "Only PENDING_APPROVAL parts can be approved (current: " + pr.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
        ApprovalBand band = requiredApprovalBand(pr);
        assertCanApprove(actor, band);

        pr.setStatus(PartRequestStatus.APPROVED);
        pr.setApprovedBy(actingUserId);
        pr.setApprovedAt(OffsetDateTime.now());
        pr = partRepo.save(pr);

        ServiceTicket ticket = pr.getTicket();
        ticketService.createActivity(ticket, actor, ActivityType.STATUS_CHANGED,
                "Part approved: " + pr.getPartName() + " (by " + actor.getName() + ")");
        // Notify the requesting engineer / CRM.
        notifyRequester(pr, "Part approved",
                pr.getPartName() + " approved by " + actor.getName() + ". Place the order.");
        return toResponse(pr);
    }

    @Transactional
    public PartRequestResponse reject(UUID partId, UUID actingUserId, String reason) {
        PartRequest pr = require(partId);
        User actor = requireUser(actingUserId);
        if (pr.getStatus() != PartRequestStatus.PENDING_APPROVAL) {
            throw new BusinessException("BAD_STATE",
                    "Only PENDING_APPROVAL parts can be rejected (current: " + pr.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
        ApprovalBand band = requiredApprovalBand(pr);
        assertCanApprove(actor, band);

        pr.setStatus(PartRequestStatus.REJECTED);
        pr.setRejectedReason(reason);
        pr = partRepo.save(pr);

        ServiceTicket ticket = pr.getTicket();
        // Revert ticket to IN_PROGRESS so the engineer / CRM can re-plan.
        if (ticket.getStatus() == TicketStatus.WAITING_PART) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
            ticketRepo.save(ticket);
        }
        ticketService.createActivity(ticket, actor, ActivityType.STATUS_CHANGED,
                "Part rejected: " + pr.getPartName() + " — " + (reason == null ? "" : reason));
        notifyRequester(pr, "Part rejected",
                pr.getPartName() + " rejected by " + actor.getName()
                        + (reason == null ? "" : ": " + reason));
        return toResponse(pr);
    }

    // ─────────────────────────────────────────────────────────────
    //  ORDER / DELIVER / INSTALL
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public PartRequestResponse markOrdered(UUID partId, UUID actingUserId, OrderPartRequest req) {
        PartRequest pr = require(partId);
        User actor = requireUser(actingUserId);
        if (pr.getStatus() != PartRequestStatus.APPROVED) {
            throw new BusinessException("BAD_STATE",
                    "Only APPROVED parts can be marked ordered (current: " + pr.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
        pr.setStatus(PartRequestStatus.ORDERED);
        pr.setOrderedBy(actingUserId);
        pr.setOrderedAt(OffsetDateTime.now());
        if (req != null) pr.setExpectedDelivery(req.getExpectedDelivery());
        pr = partRepo.save(pr);

        ticketService.createActivity(pr.getTicket(), actor, ActivityType.STATUS_CHANGED,
                "Part ordered: " + pr.getPartName()
                        + (req != null && req.getExpectedDelivery() != null
                            ? " (ETA " + req.getExpectedDelivery() + ")" : ""));
        notifyCustomerWaiting(pr.getTicket());
        return toResponse(pr);
    }

    @Transactional
    public PartRequestResponse markDelivered(UUID partId, UUID actingUserId) {
        PartRequest pr = require(partId);
        User actor = requireUser(actingUserId);
        if (pr.getStatus() != PartRequestStatus.ORDERED) {
            throw new BusinessException("BAD_STATE",
                    "Only ORDERED parts can be marked delivered (current: " + pr.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
        pr.setStatus(PartRequestStatus.DELIVERED);
        pr.setDeliveredAt(OffsetDateTime.now());
        pr = partRepo.save(pr);

        ticketService.createActivity(pr.getTicket(), actor, ActivityType.STATUS_CHANGED,
                "Part delivered: " + pr.getPartName());
        notifyRequester(pr, "Part delivered",
                pr.getPartName() + " arrived. Schedule the engineer visit.");
        return toResponse(pr);
    }

    @Transactional
    public PartRequestResponse markInstalled(UUID partId, UUID actingUserId) {
        PartRequest pr = require(partId);
        User actor = requireUser(actingUserId);
        if (pr.getStatus() != PartRequestStatus.DELIVERED) {
            throw new BusinessException("BAD_STATE",
                    "Only DELIVERED parts can be marked installed (current: " + pr.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
        pr.setStatus(PartRequestStatus.INSTALLED);
        pr.setInstalledAt(OffsetDateTime.now());
        pr = partRepo.save(pr);

        ServiceTicket ticket = pr.getTicket();
        if (ticket.getStatus() == TicketStatus.WAITING_PART) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
            ticketRepo.save(ticket);
        }
        ticketService.createActivity(ticket, actor, ActivityType.STATUS_CHANGED,
                "Part installed: " + pr.getPartName());
        return toResponse(pr);
    }

    // ─────────────────────────────────────────────────────────────
    //  READS
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PartRequestResponse> forTicket(String ticketNumber) {
        ServiceTicket ticket = ticketRepo.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));
        return partRepo.findByTicketIdOrderByCreatedAtDesc(ticket.getId()).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PartRequestResponse> approvalQueueForRole(UserRole role) {
        return partRepo.findByStatusOrderByCreatedAtAsc(PartRequestStatus.PENDING_APPROVAL).stream()
                .filter(pr -> canApprove(role, requiredApprovalBand(pr)))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PartRequestResponse> openForEngineer(UUID engineerId) {
        return partRepo.findOpenByEngineer(engineerId).stream()
                .map(this::toResponse).toList();
    }

    public PartRequestResponse toResponse(PartRequest pr) {
        var b = PartRequestResponse.builder()
                .id(pr.getId())
                .partName(pr.getPartName())
                .quantity(pr.getQuantity())
                .urgency(pr.getUrgency())
                .unitCost(pr.getUnitCost())
                .totalCost(pr.getTotalCost())
                .notes(pr.getNotes())
                .status(pr.getStatus().name())
                .requiredApprovalBand(requiredApprovalBand(pr).name())
                .approvedById(pr.getApprovedBy())
                .approvedAt(pr.getApprovedAt())
                .rejectedReason(pr.getRejectedReason())
                .expectedDelivery(pr.getExpectedDelivery())
                .orderedAt(pr.getOrderedAt())
                .deliveredAt(pr.getDeliveredAt())
                .installedAt(pr.getInstalledAt())
                .createdAt(pr.getCreatedAt());
        if (pr.getTicket() != null) {
            b.ticketId(pr.getTicket().getId())
             .ticketNumber(pr.getTicket().getTicketNumber());
        }
        userRepo.findById(pr.getRequestedBy()).ifPresent(u -> {
            b.requestedById(u.getId()).requestedByName(u.getName());
        });
        if (pr.getApprovedBy() != null) {
            userRepo.findById(pr.getApprovedBy()).ifPresent(u -> b.approvedByName(u.getName()));
        }
        return b.build();
    }

    // ─────────────────────────────────────────────────────────────
    //  Internals
    // ─────────────────────────────────────────────────────────────

    public ApprovalBand requiredApprovalBand(PartRequest pr) {
        BigDecimal total = pr.getTotalCost() == null ? BigDecimal.ZERO : pr.getTotalCost();
        AppProperties.Approval cfg = appProperties.getApproval();
        if (total.compareTo(cfg.getPartCrmCeiling()) <= 0) return ApprovalBand.CRM;
        if (total.compareTo(cfg.getPartManagerCeiling()) <= 0) return ApprovalBand.SERVICE_MANAGER;
        return ApprovalBand.ADMIN;
    }

    private boolean canApprove(UserRole role, ApprovalBand band) {
        return switch (band) {
            case AUTO -> true;
            case CRM -> role == UserRole.CRM_AGENT || role == UserRole.SERVICE_MANAGER
                    || role == UserRole.ADMIN;
            case SERVICE_MANAGER -> role == UserRole.SERVICE_MANAGER || role == UserRole.ADMIN;
            case ADMIN -> role == UserRole.ADMIN;
        };
    }

    private void assertCanApprove(User actor, ApprovalBand band) {
        if (!canApprove(actor.getRole(), band)) {
            throw new BusinessException("FORBIDDEN",
                    "Role " + actor.getRole() + " cannot approve a " + band + " part request.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private static final Set<UserRole> RAISERS =
            Set.of(UserRole.SITE_ENGINEER, UserRole.CRM_AGENT,
                   UserRole.SERVICE_MANAGER, UserRole.ADMIN, UserRole.OPS_MANAGER);

    private void assertCanRaise(ServiceTicket ticket, User actor) {
        if (!RAISERS.contains(actor.getRole())) {
            throw new BusinessException("FORBIDDEN",
                    "Role " + actor.getRole() + " cannot raise a part request.",
                    HttpStatus.FORBIDDEN);
        }
        boolean isEngineer = ticket.getEngineer() != null
                && ticket.getEngineer().getId().equals(actor.getId());
        boolean isOwner = ticket.getCurrentAssignee() != null
                && ticket.getCurrentAssignee().getId().equals(actor.getId());
        boolean supervisor = actor.getRole() == UserRole.SERVICE_MANAGER
                || actor.getRole() == UserRole.ADMIN
                || actor.getRole() == UserRole.OPS_MANAGER;
        if (!isEngineer && !isOwner && !supervisor) {
            throw new BusinessException("FORBIDDEN",
                    "Only the dispatched engineer, the owner CRM, or a supervisor "
                            + "can raise a part request for this ticket.",
                    HttpStatus.FORBIDDEN);
        }
    }

    private void notifyApprovers(PartRequest pr, ServiceTicket ticket, ApprovalBand band) {
        UserRole role = switch (band) {
            case AUTO -> null;
            case CRM -> UserRole.CRM_AGENT;
            case SERVICE_MANAGER -> UserRole.SERVICE_MANAGER;
            case ADMIN -> UserRole.ADMIN;
        };
        if (role == null) return;
        for (User approver : userRepo.findByRoleAndIsActiveTrue(role)) {
            // For CRM band, only ping the owner CRM (others don't see it).
            if (band == ApprovalBand.CRM
                    && (ticket.getCurrentAssignee() == null
                        || !ticket.getCurrentAssignee().getId().equals(approver.getId()))) {
                continue;
            }
            notificationService.notifyUser(approver.getId(),
                    "Part request awaiting approval — " + ticket.getTicketNumber(),
                    pr.getPartName() + " ×" + pr.getQuantity()
                            + " (₹" + pr.getTotalCost() + ", band " + band + ")",
                    NotificationType.GENERAL, pr.getId());
        }
    }

    private void notifyRequester(PartRequest pr, String title, String body) {
        notificationService.notifyUser(pr.getRequestedBy(), title, body,
                NotificationType.GENERAL, pr.getId());
    }

    private void notifyCustomerWaiting(ServiceTicket ticket) {
        if (ticket.getCustomer() == null) return;
        notificationService.notifyUser(ticket.getCustomer().getId(),
                "Waiting for a spare part — " + ticket.getTicketNumber(),
                "Your repair is paused while we source a spare part. "
                        + "We'll update you as soon as it arrives.",
                NotificationType.GENERAL, ticket.getId());
    }

    private User requireUser(UUID id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("User", id.toString()));
    }

    private PartRequest require(UUID id) {
        return partRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("PartRequest", id.toString()));
    }
}
