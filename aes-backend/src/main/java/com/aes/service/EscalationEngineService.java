package com.aes.service;

import com.aes.config.AppProperties;
import com.aes.entity.ServiceTicket;
import com.aes.entity.User;
import com.aes.enums.EscalationType;
import com.aes.enums.NotificationType;
import com.aes.enums.UserRole;
import com.aes.repository.ServiceTicketRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Escalation Engine — runs every 30 s and enforces the SLA ladder.
 *
 * <h3>Workflow re-design (PLAN.md §8.2 / FLOW.md C17)</h3>
 * The original engine had two auto-escalations:
 * <ol>
 *   <li>L1 SLA breach → bump to L2 (assign to Service Manager).</li>
 *   <li>L2 SLA breach → bump to L3 (assign to Admin).</li>
 * </ol>
 *
 * The re-design preserves (1) — staff inattention should still trigger
 * a Service Manager pickup — but flips (2) into a <strong>monitor-only</strong>
 * alert: Admin gets a "Needs Attention" notification, ownership stays with
 * the Service Manager. This avoids the anti-pattern of every late ticket
 * eventually landing on the CEO's desk.
 *
 * <p>The legacy auto-bump-to-L3 behaviour can be restored by setting
 * {@code app.escalation.l3-monitor-only=false}.</p>
 *
 * <p>The whole engine is still gated on {@code app.escalation.auto-enabled}.
 * In dev/demo it is OFF so the seeded fixtures stay put.</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EscalationEngineService {

    private final ServiceTicketRepository ticketRepository;
    private final TicketActionService ticketActionService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final WebSocketService webSocketService;
    private final AppProperties appProperties;

    /** Tickets we've already alerted on for Stage D — avoids spamming on every tick. */
    private final Set<UUID> stageDAlerted = new HashSet<>();

    @Transactional
    @Scheduled(fixedDelay = 30000)
    public void checkAndEscalate() {
        if (!appProperties.getEscalation().isAutoEnabled()) {
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();

        // ── L1 breach → auto-escalate to L2 (unchanged from legacy) ─────
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

        // ── L2 breach → monitor-only (new) OR auto-escalate (legacy) ────
        boolean monitorOnly = appProperties.getEscalation().isL3MonitorOnly();
        List<ServiceTicket> l2Overdue = ticketRepository.findL2OverdueTickets(now);
        for (ServiceTicket ticket : l2Overdue) {
            try {
                if (monitorOnly) {
                    raiseAdminMonitorAlert(ticket);
                } else {
                    ticketActionService.escalateToLevel(ticket, 2, 3,
                            "Auto: 60min L2 timeout — Service Manager did not resolve within SLA",
                            EscalationType.AUTO);
                    log.warn("AUTO-ESCALATED L2→L3: {}", ticket.getTicketNumber());
                }
            } catch (Exception e) {
                log.error("Failed to handle L2 breach for ticket {}: {}",
                        ticket.getTicketNumber(), e.getMessage());
            }
        }

        // ── Stage D — 2× final SLA breach (PLAN.md §8.2 last row, FLOW.md C17) ──
        List<ServiceTicket> doubleBreached = ticketRepository.findDoubleFinalSlaBreached(now);
        for (ServiceTicket ticket : doubleBreached) {
            if (stageDAlerted.contains(ticket.getId())) continue;
            try {
                raiseStageDCriticalBanner(ticket);
                stageDAlerted.add(ticket.getId());
            } catch (Exception e) {
                log.error("Failed to raise Stage D banner for {}: {}",
                        ticket.getTicketNumber(), e.getMessage());
            }
        }

        if (!l1Overdue.isEmpty() || !l2Overdue.isEmpty() || !doubleBreached.isEmpty()) {
            log.info("Escalation check: {} L1 breaches, {} L2 breaches, {} Stage-D breaches (l3MonitorOnly={})",
                    l1Overdue.size(), l2Overdue.size(), doubleBreached.size(), monitorOnly);
        }
    }

    /**
     * Stage D — ticket has blown through 2× its final SLA. Critical alert
     * for every admin + WebSocket banner push so the admin dashboard turns
     * red. Ownership stays put (still monitor-only).
     */
    private void raiseStageDCriticalBanner(ServiceTicket ticket) {
        List<User> admins = userRepository.findByRoleAndIsActiveTrue(UserRole.ADMIN);
        if (admins.isEmpty()) return;
        String title = "CRITICAL — " + ticket.getTicketNumber() + " is 2× past SLA";
        String body = "Ticket " + ticket.getTicketNumber()
                + " has exceeded 2× its final SLA and is still unresolved.";
        for (User admin : admins) {
            notificationService.notifyUser(admin.getId(), title, body,
                    NotificationType.TICKET_ESCALATED, ticket.getId());
        }
        webSocketService.broadcastTicketUpdate(ticket.getTicketNumber(),
                "STAGE_D_CRITICAL", ticket.getCurrentLevel(), 0,
                ticket.getCurrentAssignee() != null
                        ? ticket.getCurrentAssignee().getName() : "Unassigned");
        log.error("STAGE D BREACH — {} (2× final SLA): banner pushed", ticket.getTicketNumber());
    }

    /**
     * Raise a "Needs Attention" alert on every admin's bell — without
     * transferring ticket ownership. The Service Manager still owns the
     * ticket; the admin is only being kept aware.
     */
    private void raiseAdminMonitorAlert(ServiceTicket ticket) {
        List<User> admins = userRepository.findByRoleAndIsActiveTrue(UserRole.ADMIN);
        if (admins.isEmpty()) {
            log.warn("L2 breach on {} but no admin to notify", ticket.getTicketNumber());
            return;
        }
        String title = "L2 SLA breached — " + ticket.getTicketNumber();
        String body = "Ticket " + ticket.getTicketNumber()
                + " has exceeded its L2 SLA. Service Manager still owns it; please intervene if needed.";
        for (User admin : admins) {
            notificationService.notifyUser(admin.getId(), title, body,
                    NotificationType.TICKET_ESCALATED, ticket.getId());
        }
        log.warn("L2 BREACH alert sent to {} admin(s) for {} (no ownership change)",
                admins.size(), ticket.getTicketNumber());
    }
}
