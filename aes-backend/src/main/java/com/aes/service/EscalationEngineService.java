package com.aes.service;

import com.aes.entity.ServiceTicket;
import com.aes.enums.EscalationType;
import com.aes.repository.ServiceTicketRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Escalation Engine Service — THE MOST CRITICAL BACKEND COMPONENT.
 *
 * Per Section 4.8 (lines 726-810):
 *   @Scheduled(fixedDelay = 30000) — runs every 30 seconds
 *   Checks for SLA breaches at L1 and L2, auto-escalates.
 *
 * L1 breach: ticket at level 1, sla_deadline_l1 < NOW(), not acknowledged
 *   → escalate to L2 (assign to SERVICE_MANAGER, set sla_deadline_l2 = NOW() + 60min)
 *
 * L2 breach: ticket at level 2, sla_deadline_l2 < NOW()
 *   → escalate to L3 (assign to ADMIN)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EscalationEngineService {

    private final ServiceTicketRepository ticketRepository;
    private final TicketActionService ticketActionService;

    /**
     * Scheduled SLA check — runs every 30 seconds.
     * Per line 734: @Scheduled(fixedDelay = 30000)
     */
    @Scheduled(fixedDelay = 30000)
    public void checkAndEscalate() {
        OffsetDateTime now = OffsetDateTime.now();

        // Find tickets where L1 SLA is breached (lines 736-740, 800-804)
        List<ServiceTicket> l1Overdue = ticketRepository.findL1OverdueTickets(now);
        for (ServiceTicket ticket : l1Overdue) {
            try {
                ticketActionService.escalateToLevel(ticket, 1, 2,
                        "Auto: 30min L1 timeout — CRM agent did not respond within SLA",
                        EscalationType.AUTO);
                log.warn("AUTO-ESCALATED L1→L2: {}", ticket.getTicketNumber());
            } catch (Exception e) {
                log.error("Failed to auto-escalate L1→L2 for ticket {}: {}",
                        ticket.getTicketNumber(), e.getMessage());
            }
        }

        // Find tickets where L2 SLA is breached (lines 742-746, 806-809)
        List<ServiceTicket> l2Overdue = ticketRepository.findL2OverdueTickets(now);
        for (ServiceTicket ticket : l2Overdue) {
            try {
                ticketActionService.escalateToLevel(ticket, 2, 3,
                        "Auto: 60min L2 timeout — Service Manager did not resolve within SLA",
                        EscalationType.AUTO);
                log.warn("AUTO-ESCALATED L2→L3: {}", ticket.getTicketNumber());
            } catch (Exception e) {
                log.error("Failed to auto-escalate L2→L3 for ticket {}: {}",
                        ticket.getTicketNumber(), e.getMessage());
            }
        }

        if (!l1Overdue.isEmpty() || !l2Overdue.isEmpty()) {
            log.info("Escalation check: {} L1 breaches, {} L2 breaches processed",
                    l1Overdue.size(), l2Overdue.size());
        }
    }
}
