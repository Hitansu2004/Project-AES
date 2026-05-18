package com.aes.service;

import com.aes.dto.request.CannotAttendRequest;
import com.aes.dto.request.NeedHelpRequest;
import com.aes.dto.response.EngineerDashboardResponse;
import com.aes.dto.response.EngineerJobDto;
import com.aes.entity.AssignmentOffer;
import com.aes.entity.ServiceTicket;
import com.aes.entity.User;
import com.aes.enums.ActivityType;
import com.aes.enums.NotificationType;
import com.aes.enums.OfferMode;
import com.aes.enums.TicketStatus;
import com.aes.enums.UserRole;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.ServiceTicketRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Owns the {@code SITE_ENGINEER} side of the workflow (PLAN.md §10.2,
 * FLOW.md C7 / C12 / C14 / C15).
 *
 * <ul>
 *   <li><strong>Dispatch</strong> — CRM/SM/OPS triggers an
 *       {@code ENGINEER_DISPATCH} offer; engineer accepts or declines
 *       (handled in {@link AssignmentOfferService}).</li>
 *   <li><strong>State pings</strong> — {@code EN_ROUTE → ON_SITE →
 *       IN_PROGRESS} pushed by the engineer.</li>
 *   <li><strong>Cannot attend</strong> (C15) — clears the engineer slot
 *       and bounces the ticket back to {@code ACKNOWLEDGED} so the owner
 *       CRM can re-dispatch.</li>
 *   <li><strong>Need help</strong> (C14) — T2 escalation ping to the
 *       owner CRM and on-shift Service Managers without dropping the
 *       engineer.</li>
 * </ul>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EngineerDispatchService {

    private static final Set<TicketStatus> EN_ROUTE_ALLOWED =
            Set.of(TicketStatus.ASSIGNED, TicketStatus.ACKNOWLEDGED);
    private static final Set<TicketStatus> ON_SITE_ALLOWED =
            Set.of(TicketStatus.EN_ROUTE, TicketStatus.ASSIGNED);
    private static final Set<TicketStatus> IN_PROGRESS_ALLOWED =
            Set.of(TicketStatus.ON_SITE, TicketStatus.EN_ROUTE,
                   TicketStatus.WAITING_PART);

    private final ServiceTicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final AssignmentOfferService offerService;
    private final ServiceTicketService ticketService;
    private final NotificationService notificationService;
    private final WebSocketService webSocketService;

    // ─────────────────────────────────────────────────────────────
    //  CRM-initiated dispatch (creates an offer to the engineer)
    // ─────────────────────────────────────────────────────────────

    /**
     * The owner CRM (or SM/OPS override) picks an engineer from the
     * availability board and sends a dispatch offer with the configured
     * engineer-expiry window.
     */
    @Transactional
    public AssignmentOffer dispatchEngineer(String ticketNumber, UUID actingUserId,
                                             UUID engineerId, OfferMode mode, String note) {
        ServiceTicket ticket = ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));

        User actor = userRepository.findById(actingUserId)
                .orElseThrow(() -> new NotFoundException("User", actingUserId.toString()));

        ensureCanDispatch(ticket, actor);

        User engineer = userRepository.findById(engineerId)
                .orElseThrow(() -> new NotFoundException("User", engineerId.toString()));

        AssignmentOffer offer = offerService.offerEngineerDispatch(
                ticket, actor, engineer, mode, note);

        ticketService.createActivity(ticket, actor, ActivityType.ASSIGNED,
                "Dispatch offered to engineer " + engineer.getName()
                        + (note != null && !note.isBlank() ? " — " + note : ""));

        log.info("Ticket {} — engineer {} dispatched by {} (offer {})",
                ticket.getTicketNumber(), engineer.getName(), actor.getName(), offer.getId());
        return offer;
    }

    private void ensureCanDispatch(ServiceTicket ticket, User actor) {
        // Only the owning CRM (or a supervisor / OPS override) can dispatch.
        UserRole role = actor.getRole();
        boolean isOwner = ticket.getCurrentAssignee() != null
                && ticket.getCurrentAssignee().getId().equals(actor.getId());
        boolean isSupervisor = role == UserRole.SERVICE_MANAGER
                || role == UserRole.OPS_MANAGER
                || role == UserRole.ADMIN;
        if (!isOwner && !isSupervisor) {
            throw new BusinessException("FORBIDDEN",
                    "Only the owning CRM or a supervisor can dispatch the engineer.",
                    HttpStatus.FORBIDDEN);
        }
        if (ticket.getStatus() != TicketStatus.ACKNOWLEDGED
                && ticket.getStatus() != TicketStatus.OPEN
                && ticket.getStatus() != TicketStatus.IN_PROGRESS) {
            throw new BusinessException("BAD_STATE",
                    "Ticket must be ACKNOWLEDGED before an engineer can be dispatched (current: "
                            + ticket.getStatus() + ").",
                    HttpStatus.CONFLICT);
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Engineer status pings — EN_ROUTE / ON_SITE / IN_PROGRESS
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public ServiceTicket markEnRoute(String ticketNumber, UUID engineerId, String note) {
        ServiceTicket ticket = loadAndAssertEngineer(ticketNumber, engineerId);
        assertTransition(ticket.getStatus(), EN_ROUTE_ALLOWED, "EN_ROUTE");

        OffsetDateTime now = OffsetDateTime.now();
        ticket.setStatus(TicketStatus.EN_ROUTE);
        ticket.setEnRouteAt(now);
        ticketRepository.save(ticket);

        recordActivity(ticket, engineerId, ActivityType.STATUS_CHANGED,
                "Engineer en-route" + suffix(note));
        notifyCustomer(ticket, "Engineer is on the way",
                "Your engineer is en-route. Please be ready at the site.",
                NotificationType.TICKET_ASSIGNED);
        webSocketService.broadcastTicketUpdate(ticket.getTicketNumber(), "EN_ROUTE",
                ticket.getCurrentLevel(), 0,
                ticket.getEngineer() != null ? ticket.getEngineer().getName() : "Engineer");
        return ticket;
    }

    @Transactional
    public ServiceTicket markOnSite(String ticketNumber, UUID engineerId, String note) {
        ServiceTicket ticket = loadAndAssertEngineer(ticketNumber, engineerId);
        assertTransition(ticket.getStatus(), ON_SITE_ALLOWED, "ON_SITE");

        OffsetDateTime now = OffsetDateTime.now();
        ticket.setStatus(TicketStatus.ON_SITE);
        ticket.setOnSiteAt(now);
        ticketRepository.save(ticket);

        recordActivity(ticket, engineerId, ActivityType.STATUS_CHANGED,
                "Engineer on site" + suffix(note));
        notifyCustomer(ticket, "Engineer has arrived",
                "Your engineer is on site and beginning diagnosis.",
                NotificationType.TICKET_ASSIGNED);
        webSocketService.broadcastTicketUpdate(ticket.getTicketNumber(), "ON_SITE",
                ticket.getCurrentLevel(), 0,
                ticket.getEngineer() != null ? ticket.getEngineer().getName() : "Engineer");
        return ticket;
    }

    @Transactional
    public ServiceTicket markInProgress(String ticketNumber, UUID engineerId, String note) {
        ServiceTicket ticket = loadAndAssertEngineer(ticketNumber, engineerId);
        assertTransition(ticket.getStatus(), IN_PROGRESS_ALLOWED, "IN_PROGRESS");

        ticket.setStatus(TicketStatus.IN_PROGRESS);
        ticketRepository.save(ticket);

        recordActivity(ticket, engineerId, ActivityType.STATUS_CHANGED,
                "Engineer began diagnosis / repair" + suffix(note));
        webSocketService.broadcastTicketUpdate(ticket.getTicketNumber(), "IN_PROGRESS",
                ticket.getCurrentLevel(), 0,
                ticket.getEngineer() != null ? ticket.getEngineer().getName() : "Engineer");
        return ticket;
    }

    // ─────────────────────────────────────────────────────────────
    //  Cannot attend (C15)
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public ServiceTicket cannotAttend(String ticketNumber, UUID engineerId, CannotAttendRequest req) {
        ServiceTicket ticket = loadAndAssertEngineer(ticketNumber, engineerId);
        if (ticket.getStatus() == TicketStatus.ON_SITE
                || ticket.getStatus() == TicketStatus.IN_PROGRESS) {
            throw new BusinessException("BAD_STATE",
                    "Cannot bail out once you're already on site. Use 'Need Help' instead.",
                    HttpStatus.CONFLICT);
        }
        User engineer = ticket.getEngineer();
        ticket.setStatus(TicketStatus.ACKNOWLEDGED);
        ticket.setEngineer(null);
        ticket.setEngineerAcceptedAt(null);
        ticket.setEnRouteAt(null);
        ticket.setOnSiteAt(null);
        ticketRepository.save(ticket);

        String reasonLabel = req.getReason()
                + (req.getDetails() != null ? " — " + req.getDetails() : "");
        recordActivity(ticket, engineerId, ActivityType.STATUS_CHANGED,
                "Engineer " + (engineer != null ? engineer.getName() : "")
                        + " cannot attend (" + reasonLabel + ")");

        // Owner CRM gets pinged so they can re-dispatch.
        User owner = ticket.getCurrentAssignee();
        if (owner != null) {
            notificationService.notifyUser(owner.getId(),
                    "Engineer dropped — re-dispatch needed for " + ticket.getTicketNumber(),
                    (engineer != null ? engineer.getName() : "Engineer")
                            + " can't attend (" + req.getReason() + "). Please pick another engineer.",
                    NotificationType.TICKET_ASSIGNED, ticket.getId());
        }
        // Ops Manager(s) so the roster board reflects it.
        notifyOpsManagers(ticket, "Engineer drop",
                "Ticket " + ticket.getTicketNumber() + " — engineer "
                        + (engineer != null ? engineer.getName() : "")
                        + " can't attend (" + req.getReason() + "). CRM will re-dispatch.");

        webSocketService.broadcastTicketUpdate(ticket.getTicketNumber(),
                "ENGINEER_CANNOT_ATTEND", ticket.getCurrentLevel(), 0,
                engineer != null ? engineer.getName() : "Engineer");
        return ticket;
    }

    // ─────────────────────────────────────────────────────────────
    //  Need help (C14 — T2 escalation, no ownership change)
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public ServiceTicket needHelp(String ticketNumber, UUID engineerId, NeedHelpRequest req) {
        ServiceTicket ticket = loadAndAssertEngineer(ticketNumber, engineerId);
        User engineer = ticket.getEngineer();

        String reasonLabel = req.getReason()
                + (req.getDetails() != null ? " — " + req.getDetails() : "");

        recordActivity(ticket, engineerId, ActivityType.ESCALATED,
                "Engineer raised T2 'Need Help': " + reasonLabel);

        // Owner CRM is the first responder.
        User owner = ticket.getCurrentAssignee();
        if (owner != null) {
            notificationService.notifyUser(owner.getId(),
                    "Engineer needs help — " + ticket.getTicketNumber(),
                    (engineer != null ? engineer.getName() : "Engineer")
                            + " flagged: " + req.getReason(),
                    NotificationType.TICKET_ESCALATED, ticket.getId());
        }
        // All on-shift Service Managers see it on /admin.
        List<User> sms = userRepository.findByRoleAndIsActiveTrue(UserRole.SERVICE_MANAGER);
        for (User sm : sms) {
            notificationService.notifyUser(sm.getId(),
                    "Engineer needs help — " + ticket.getTicketNumber(),
                    (engineer != null ? engineer.getName() : "Engineer")
                            + " flagged: " + req.getReason(),
                    NotificationType.TICKET_ESCALATED, ticket.getId());
        }
        notifyCustomer(ticket, "A senior technician is being arranged",
                "Our engineer needs additional support — a senior technician is being arranged.",
                NotificationType.TICKET_ESCALATED);
        webSocketService.broadcastTicketUpdate(ticket.getTicketNumber(),
                "ENGINEER_NEED_HELP", ticket.getCurrentLevel(), 0,
                engineer != null ? engineer.getName() : "Engineer");
        return ticket;
    }

    // ─────────────────────────────────────────────────────────────
    //  Dashboard reads
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public EngineerDashboardResponse getDashboard(UUID engineerId) {
        OffsetDateTime startOfDay = OffsetDateTime.now(ZoneOffset.UTC)
                .with(LocalTime.MIDNIGHT);
        List<ServiceTicket> active = ticketRepository.findActiveByEngineerOrdered(engineerId);
        List<ServiceTicket> doneToday = ticketRepository
                .findResolvedByEngineerSince(engineerId, startOfDay);

        var offers = offerService.listMyPendingOffers(engineerId);

        int enRoute = (int) active.stream()
                .filter(t -> t.getStatus() == TicketStatus.EN_ROUTE).count();
        int onSite = (int) active.stream()
                .filter(t -> t.getStatus() == TicketStatus.ON_SITE
                          || t.getStatus() == TicketStatus.IN_PROGRESS).count();

        return EngineerDashboardResponse.builder()
                .pendingOffers(offers.size())
                .activeJobs(active.size())
                .resolvedToday(doneToday.size())
                .enRoute(enRoute)
                .onSite(onSite)
                .offers(offers)
                .jobs(active.stream().map(this::toJobDto).toList())
                .resolvedTodayList(doneToday.stream().map(this::toJobDto).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public List<EngineerJobDto> getMyJobs(UUID engineerId) {
        return ticketRepository.findActiveByEngineerOrdered(engineerId).stream()
                .map(this::toJobDto)
                .toList();
    }

    // ─────────────────────────────────────────────────────────────
    //  Internals
    // ─────────────────────────────────────────────────────────────

    private ServiceTicket loadAndAssertEngineer(String ticketNumber, UUID engineerId) {
        ServiceTicket ticket = ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));
        if (ticket.getEngineer() == null
                || !ticket.getEngineer().getId().equals(engineerId)) {
            throw new BusinessException("FORBIDDEN",
                    "Only the engineer dispatched to this ticket can update its status.",
                    HttpStatus.FORBIDDEN);
        }
        return ticket;
    }

    private void assertTransition(TicketStatus current, Set<TicketStatus> allowed, String target) {
        if (!allowed.contains(current)) {
            throw new BusinessException("BAD_STATE",
                    "Cannot transition to " + target + " from " + current
                            + ". Allowed previous states: " + allowed,
                    HttpStatus.CONFLICT);
        }
    }

    private void recordActivity(ServiceTicket ticket, UUID actorId, ActivityType type, String message) {
        User actor = userRepository.findById(actorId).orElse(null);
        ticketService.createActivity(ticket, actor, type, message);
    }

    private void notifyCustomer(ServiceTicket ticket, String title, String body, NotificationType type) {
        if (ticket.getCustomer() != null) {
            notificationService.notifyUser(ticket.getCustomer().getId(), title, body, type, ticket.getId());
        }
    }

    private void notifyOpsManagers(ServiceTicket ticket, String title, String body) {
        for (User ops : userRepository.findByRoleAndIsActiveTrue(UserRole.OPS_MANAGER)) {
            notificationService.notifyUser(ops.getId(), title, body,
                    NotificationType.TICKET_ASSIGNED, ticket.getId());
        }
    }

    private String suffix(String note) {
        return note == null || note.isBlank() ? "" : " — " + note;
    }

    private EngineerJobDto toJobDto(ServiceTicket t) {
        var b = EngineerJobDto.builder()
                .ticketId(t.getId())
                .ticketNumber(t.getTicketNumber())
                .status(t.getStatus().name())
                .priority(t.getPriority() != null ? t.getPriority().name() : null)
                .problemCategory(t.getProblemCategory() != null ? t.getProblemCategory().name() : null)
                .problemDescription(t.getProblemDescription())
                .locality(t.getLocality())
                .branch(t.getBranch())
                .scheduledDate(t.getScheduledDate())
                .scheduledSlot(t.getScheduledSlot())
                .assignedAt(t.getAssignedAt())
                .engineerAcceptedAt(t.getEngineerAcceptedAt())
                .enRouteAt(t.getEnRouteAt())
                .onSiteAt(t.getOnSiteAt())
                .resolvedAt(t.getResolvedAt());

        if (t.getCustomer() != null) {
            b.customerId(t.getCustomer().getId())
             .customerName(t.getCustomer().getName())
             .customerPhone(t.getCustomer().getPhoneNumber());
        }
        if (t.getProperty() != null) {
            b.propertyLabel(safe(t.getProperty().getLabel()));
        }
        if (t.getAcUnit() != null) {
            b.acBrand(t.getAcUnit().getBrand())
             .acModel(t.getAcUnit().getModelNumber())
             .acRoomLabel(t.getAcUnit().getRoomLabel());
        }
        return b.build();
    }

    private String safe(String s) { return s == null ? "" : s; }
}
