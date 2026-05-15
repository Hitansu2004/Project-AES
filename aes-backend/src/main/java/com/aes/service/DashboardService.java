package com.aes.service;

import com.aes.dto.response.*;
import com.aes.entity.*;
import com.aes.enums.TicketStatus;
import com.aes.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

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

    /**
     * Customer dashboard (lines 856-866).
     */
    @Transactional(readOnly = true)
    public CustomerDashboardResponse getCustomerDashboard(UUID customerId) {
        // Active projects = properties count
        long activeProjects = propertyRepository.countByCustomerId(customerId);

        // Open tickets
        long openTickets = ticketRepository.countByCustomerIdAndStatusIn(
                customerId, List.of(TicketStatus.OPEN, TicketStatus.ACKNOWLEDGED,
                        TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS));

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
     * Escalation dashboard (lines 880-892).
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

        var l1Page = ticketRepository.findByCurrentLevelOrderByCreatedAtDesc(1, PageRequest.of(0, 20));
        var l2Page = ticketRepository.findByCurrentLevelOrderByCreatedAtDesc(2, PageRequest.of(0, 20));
        var l3Page = ticketRepository.findByCurrentLevelOrderByCreatedAtDesc(3, PageRequest.of(0, 20));

        List<TicketResponse> l1Tickets = l1Page.getContent().stream()
                .map(ticketService::toFullResponse).collect(Collectors.toList());
        List<TicketResponse> l2Tickets = l2Page.getContent().stream()
                .map(ticketService::toFullResponse).collect(Collectors.toList());
        List<TicketResponse> l3Tickets = l3Page.getContent().stream()
                .map(ticketService::toFullResponse).collect(Collectors.toList());

        List<TicketEscalationLog> logEntities = escalationLogRepository.findAllByOrderByEscalatedAtDesc();
        List<TicketResponse.EscalationLogResponse> escalationLog = logEntities.stream()
                .limit(50)
                .map(l -> TicketResponse.EscalationLogResponse.builder()
                        .id(l.getId())
                        .fromLevel(l.getFromLevel())
                        .toLevel(l.getToLevel())
                        .fromUserId(l.getFromUserId())
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
                .l1Tickets(l1Tickets)
                .l2Tickets(l2Tickets)
                .l3Tickets(l3Tickets)
                .escalationLog(escalationLog)
                .build();
    }
}
