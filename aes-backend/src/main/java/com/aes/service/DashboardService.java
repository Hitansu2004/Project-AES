package com.aes.service;

import com.aes.dto.response.*;
import com.aes.entity.*;
import com.aes.enums.Priority;
import com.aes.enums.TicketStatus;
import com.aes.enums.UserRole;
import com.aes.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Dashboard Service — analytics endpoints.
 *
 * Per Section 4.11 (lines 852-892):
 *   GET /api/v1/dashboard/customer    → customer overview
 *   GET /api/v1/dashboard/crm         → CRM agent inbox
 *   GET /api/v1/dashboard/escalation  → escalation management
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class DashboardService {

    private final ServiceTicketRepository ticketRepository;
    private final PropertyRepository propertyRepository;
    private final AmcContractRepository contractRepository;
    private final AmcVisitRepository visitRepository;
    private final TicketEscalationLogRepository escalationLogRepository;
    private final ServiceTicketService ticketService;
    private final PropertyService propertyService;
    private final UserRepository userRepository;
    private final InstallationRequestRepository installationRequestRepository;

    /**
     * Customer dashboard (lines 856-866).
     */
    @Transactional(readOnly = true)
    public CustomerDashboardResponse getCustomerDashboard(UUID customerId) {
        // "Active projects" = in-flight installation requests (matches the
        // "My Projects" rail on the customer home — properties alone are
        // just static addresses and don't represent a piece of work).
        long activeProjects = installationRequestRepository.countActiveByCustomer(customerId);

        // Open tickets — any non-terminal status counts (NEW/OPEN through WAITING_*).
        long openTickets = ticketRepository.countByCustomerIdAndStatusIn(customerId,
                List.of(TicketStatus.NEW, TicketStatus.OPEN, TicketStatus.ACKNOWLEDGED,
                        TicketStatus.ASSIGNED, TicketStatus.EN_ROUTE, TicketStatus.ON_SITE,
                        TicketStatus.IN_PROGRESS, TicketStatus.WAITING_PART,
                        TicketStatus.WAITING_CUSTOMER_APPROVAL));

        // AMC status
        List<AmcContract> contracts = contractRepository.findByCustomerIdAndIsActiveTrue(customerId);
        String amcStatus = contracts.isEmpty() ? "NONE" : "ACTIVE";

        // Next AMC visit
        CustomerDashboardResponse.NextAmcVisit nextVisit = null;
        for (AmcContract contract : contracts) {
            List<AmcVisit> scheduled = visitRepository
                    .findByContractIdAndStatusOrderByScheduledDateAsc(contract.getId(), "SCHEDULED");
            if (!scheduled.isEmpty()) {
                AmcVisit next = scheduled.get(0);
                nextVisit = CustomerDashboardResponse.NextAmcVisit.builder()
                        .date(next.getScheduledDate())
                        .slot(next.getScheduledTimeSlot())
                        .build();
                break;
            }
        }

        // Recent tickets (last 2)
        List<ServiceTicket> recentTicketEntities = ticketRepository
                .findTop2ByCustomerIdOrderByCreatedAtDesc(customerId);
        List<TicketResponse> recentTickets = recentTicketEntities.stream()
                .map(ticketService::toFullResponse)
                .collect(Collectors.toList());

        // Properties
        List<PropertyResponse> properties = propertyService.getCustomerProperties(customerId);

        return CustomerDashboardResponse.builder()
                .activeProjects(activeProjects)
                .openTickets(openTickets)
                .amcStatus(amcStatus)
                .nextAmcVisit(nextVisit)
                .recentTickets(recentTickets)
                .properties(properties)
                .build();
    }

    /**
     * CRM dashboard (lines 868-878).
     */
    @Transactional(readOnly = true)
    public CrmDashboardResponse getCrmDashboard(UUID agentId) {
        // My inbox: tickets assigned to me at L1
        var inboxPage = ticketRepository.findByCurrentLevelAndCurrentAssigneeIdOrderByCreatedAtDesc(
                1, agentId, PageRequest.of(0, 50));
        long myInboxCount = inboxPage.getTotalElements();

        // Critical count: P1 tickets in my inbox
        long criticalCount = inboxPage.getContent().stream()
                .filter(t -> t.getPriority() == com.aes.enums.Priority.P1)
                .count();

        // SLA breach count
        OffsetDateTime now = OffsetDateTime.now();
        long slaBreachCount = inboxPage.getContent().stream()
                .filter(t -> t.getSlaDeadlineL1() != null && now.isAfter(t.getSlaDeadlineL1()))
                .count();

        OffsetDateTime startOfDay = LocalDate.now().atStartOfDay().atOffset(now.getOffset());
        long resolvedToday = ticketRepository.countResolvedSince(startOfDay);

        Double avgFromDb = ticketRepository.avgAcknowledgmentMinutesSince(startOfDay);
        double avgResponseMinutes = avgFromDb != null
                ? Math.round(avgFromDb * 10.0) / 10.0
                : 0.0;

        List<TicketResponse> tickets = inboxPage.getContent().stream()
                .map(ticketService::toFullResponse)
                .collect(Collectors.toList());

        return CrmDashboardResponse.builder()
                .myInboxCount(myInboxCount)
                .criticalCount(criticalCount)
                .slaBreachCount(slaBreachCount)
                .resolvedToday(resolvedToday)
                .avgResponseMinutes(avgResponseMinutes)
                .tickets(tickets)
                .build();
    }

    /**
     * Escalation / Admin "eagle-view" dashboard (lines 880-892).
     *
     * Beyond the spec, this also returns:
     *   - Per-level active counts (l1Count / l2Count / l3Count + totalActive + criticalActive)
     *   - Per-staff workload list ({@code teamWorkload}) covering every active CRM_AGENT,
     *     SERVICE_MANAGER and ADMIN — even those with an empty inbox — so the admin
     *     view always renders the full team grid.
     *   - {@code fromUserName} on each escalation log row so the admin can see at a
     *     glance who triggered each escalation, not just the UUID.
     */
    @Transactional(readOnly = true)
    public EscalationDashboardResponse getEscalationDashboard() {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime startOfDay = LocalDate.now().atStartOfDay().atOffset(now.getOffset());

        long escalatedNow = ticketRepository.countCurrentlyEscalated();
        long resolvedToday = ticketRepository.countResolvedSince(startOfDay);
        long slaBreachToday = ticketRepository.countFinalSlaBreached(now);

        Double avgFromDb = ticketRepository.avgAcknowledgmentMinutesSince(startOfDay);
        double avgResponseMinutes = avgFromDb != null
                ? Math.round(avgFromDb * 10.0) / 10.0
                : 0.0;

        long l1Count = ticketRepository.countActiveAtLevel(1);
        long l2Count = ticketRepository.countActiveAtLevel(2);
        long l3Count = ticketRepository.countActiveAtLevel(3);
        long totalActive = ticketRepository.countActive();
        long criticalActive = ticketRepository.countActiveCritical();

        var l1Page = ticketRepository.findByCurrentLevelOrderByCreatedAtDesc(1, PageRequest.of(0, 20));
        var l2Page = ticketRepository.findByCurrentLevelOrderByCreatedAtDesc(2, PageRequest.of(0, 20));
        var l3Page = ticketRepository.findByCurrentLevelOrderByCreatedAtDesc(3, PageRequest.of(0, 20));

        List<TicketResponse> l1Tickets = l1Page.getContent().stream()
                .map(ticketService::toFullResponse).collect(Collectors.toList());
        List<TicketResponse> l2Tickets = l2Page.getContent().stream()
                .map(ticketService::toFullResponse).collect(Collectors.toList());
        List<TicketResponse> l3Tickets = l3Page.getContent().stream()
                .map(ticketService::toFullResponse).collect(Collectors.toList());

        // ── Team workload ───────────────────────────────────────────────
        // Every active CRM_AGENT, SERVICE_MANAGER and ADMIN gets a card,
        // even if their queue is empty.  Sorted by role-level ascending,
        // then by name, so the grid renders L1 → L2 → L3.
        List<User> staff = Stream.of(UserRole.CRM_AGENT, UserRole.SERVICE_MANAGER, UserRole.ADMIN)
                .flatMap(r -> userRepository.findByRoleAndIsActiveTrue(r).stream())
                .sorted((a, b) -> {
                    int la = canonicalLevelForRole(a.getRole());
                    int lb = canonicalLevelForRole(b.getRole());
                    if (la != lb) return Integer.compare(la, lb);
                    return a.getName().compareToIgnoreCase(b.getName());
                })
                .collect(Collectors.toList());

        List<EscalationDashboardResponse.TeamWorkload> teamWorkload = staff.stream()
                .map(s -> buildTeamWorkload(s, now))
                .collect(Collectors.toList());

        // ── Escalation log w/ resolved fromUserName ────────────────────
        List<TicketEscalationLog> logEntities = escalationLogRepository.findAllByOrderByEscalatedAtDesc();
        Map<UUID, String> staffNamesById = staff.stream()
                .collect(Collectors.toMap(User::getId, User::getName));
        // Some escalations may be raised by users not in the staff list (e.g. customers
        // raising tickets on themselves wouldn't escalate, but defensively we still
        // resolve any unknown UUIDs against the user repo).
        List<UUID> missing = logEntities.stream()
                .map(TicketEscalationLog::getFromUserId)
                .filter(java.util.Objects::nonNull)
                .filter(id -> !staffNamesById.containsKey(id))
                .distinct()
                .collect(Collectors.toList());
        if (!missing.isEmpty()) {
            userRepository.findAllById(missing).forEach(u -> staffNamesById.put(u.getId(), u.getName()));
        }
        List<TicketResponse.EscalationLogResponse> escalationLog = logEntities.stream()
                .limit(50)
                .map(l -> TicketResponse.EscalationLogResponse.builder()
                        .id(l.getId())
                        .ticketNumber(l.getTicket() != null ? l.getTicket().getTicketNumber() : null)
                        .fromLevel(l.getFromLevel())
                        .toLevel(l.getToLevel())
                        .fromUserId(l.getFromUserId())
                        .fromUserName(l.getFromUserId() != null ? staffNamesById.get(l.getFromUserId()) : null)
                        .reason(l.getReason())
                        .escalationType(l.getEscalationType().name())
                        .escalatedAt(l.getEscalatedAt())
                        .build())
                .collect(Collectors.toList());

        return EscalationDashboardResponse.builder()
                .escalatedNow(escalatedNow)
                .avgResponseMinutes(avgResponseMinutes)
                .slaBreachToday(slaBreachToday)
                .resolvedToday(resolvedToday)
                .l1Count(l1Count)
                .l2Count(l2Count)
                .l3Count(l3Count)
                .totalActive(totalActive)
                .criticalActive(criticalActive)
                .l1Tickets(l1Tickets)
                .l2Tickets(l2Tickets)
                .l3Tickets(l3Tickets)
                .teamWorkload(teamWorkload)
                .escalationLog(escalationLog)
                .build();
    }

    /** Build a team-workload card for a single staff user. */
    private EscalationDashboardResponse.TeamWorkload buildTeamWorkload(User staff, OffsetDateTime now) {
        List<ServiceTicket> active = ticketRepository.findActiveByAssignee(staff.getId());
        int activeCount = active.size();
        int criticalCount = (int) active.stream()
                .filter(t -> t.getPriority() == Priority.P1)
                .count();
        int breachedCount = (int) active.stream()
                .filter(t -> isFinalBreached(t, now))
                .count();
        List<TicketResponse> tickets = active.stream()
                .map(ticketService::toFullResponse)
                .collect(Collectors.toList());
        return EscalationDashboardResponse.TeamWorkload.builder()
                .userId(staff.getId())
                .name(staff.getName())
                .role(staff.getRole().name())
                .level(canonicalLevelForRole(staff.getRole()))
                .activeCount(activeCount)
                .criticalCount(criticalCount)
                .breachedCount(breachedCount)
                .tickets(tickets)
                .build();
    }

    private static boolean isFinalBreached(ServiceTicket t, OffsetDateTime now) {
        return t.getSlaDeadlineFinal() != null && t.getSlaDeadlineFinal().isBefore(now);
    }

    private static int canonicalLevelForRole(UserRole role) {
        return switch (role) {
            case CRM_AGENT -> 1;
            case SERVICE_MANAGER -> 2;
            case ADMIN -> 3;
            default -> 0;
        };
    }
}
