package com.aes.service;

import com.aes.dto.response.TicketResponse;
import com.aes.entity.ServiceTicket;
import com.aes.entity.User;
import com.aes.enums.NotificationType;
import com.aes.enums.TicketStatus;
import com.aes.enums.UserRole;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.ServiceTicketRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The new V14 dispatch model.
 *
 * <p>Replaces the legacy "Ops Manager offers ticket → CRM accepts /
 * declines" handshake with a stockbroker-style <strong>pool</strong>:
 * every unassigned ticket sits in a FIFO queue and any on-shift CRM
 * agent can one-click pick the one they want, up to a per-agent cap
 * of {@value #DAILY_PICK_CAP} active tickets.</p>
 *
 * <p>Once picked, the CRM agent assigns the ticket to one of the 15
 * named teams.  The team lead (or the CRM agent themselves) then
 * assigns a Service Engineer.  No offer / accept loop — direct
 * assignment everywhere.</p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CrmPoolService {

    private static final int DEFAULT_CAP = 30;

    private final ServiceTicketRepository ticketRepo;
    private final UserRepository userRepo;
    private final NotificationService notificationService;
    private final WebSocketService webSocketService;
    /** Lazy to avoid the circular bean issue between this and ServiceTicketService. */
    private final @Lazy com.aes.service.ServiceTicketService ticketService;

    @Value("${app.scheduling.crm-daily-cap:30}")
    private int dailyCap;

    /**
     * Live FIFO queue of unassigned tickets — sorted by priority then created_at.
     *
     * <p>Returns DTOs (not entities) so the surrounding controller can
     * stream the result without leaving the read-only transaction —
     * avoids the classic {@code LazyInitializationException} when the
     * mapper later touches {@code customer.name}.</p>
     */
    @Transactional(readOnly = true)
    public List<com.aes.dto.response.TicketResponse> poolDtos(
            java.util.function.Function<ServiceTicket, com.aes.dto.response.TicketResponse> mapper) {
        return ticketRepo.findPool().stream().map(mapper).toList();
    }

    /** Raw entity variant — only safe to call inside another @Transactional method. */
    @Transactional(readOnly = true)
    public List<ServiceTicket> pool() {
        return ticketRepo.findPool();
    }

    /** How many active tickets the given CRM agent is currently holding. */
    @Transactional(readOnly = true)
    public long currentLoad(UUID crmId) {
        return ticketRepo.countOwnedByAssignee(crmId);
    }

    /** Cap (per CRM agent / per day) — exposed for the dashboard banner. */
    public int cap() { return dailyCap > 0 ? dailyCap : DEFAULT_CAP; }

    /**
     * One-click pick from the pool.  Atomically:
     * <ul>
     *   <li>verifies the ticket is still unassigned (race-safe),</li>
     *   <li>checks the picker hasn't exceeded the daily cap,</li>
     *   <li>sets currentAssignee / assignedAt / status = ACKNOWLEDGED,</li>
     *   <li>broadcasts a WebSocket ping so other agents' pools refresh.</li>
     * </ul>
     */
    @Transactional
    public TicketResponse pickFromPool(String ticketNumber, UUID crmId) {
        if (currentLoad(crmId) >= cap()) {
            throw new BusinessException("DAILY_CAP",
                    "You're at your " + cap() + "-ticket daily cap. Close some before picking more.");
        }

        ServiceTicket t = ticketRepo.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));

        if (t.getCurrentAssignee() != null) {
            throw new BusinessException("ALREADY_PICKED",
                    "Ticket " + ticketNumber + " was picked by " + t.getCurrentAssignee().getName());
        }

        User crm = userRepo.findById(crmId)
                .orElseThrow(() -> new NotFoundException("User", crmId.toString()));
        if (crm.getRole() != UserRole.CRM_AGENT
                && crm.getRole() != UserRole.OPS_MANAGER
                && crm.getRole() != UserRole.SERVICE_MANAGER
                && crm.getRole() != UserRole.ADMIN
                && crm.getRole() != UserRole.SUPER_ADMIN) {
            throw new BusinessException("FORBIDDEN",
                    "Only CRM / Ops / Admin staff can pick from the pool.");
        }

        OffsetDateTime now = OffsetDateTime.now();
        t.setCurrentAssignee(crm);
        t.setAssignedAt(now);
        t.setCurrentLevel(1);
        // CRM agent's own team becomes the default team — they can change it.
        if (t.getAssignedTeamName() == null && crm.getTeamName() != null) {
            t.setAssignedTeamName(crm.getTeamName());
        }
        if (t.getStatus() == TicketStatus.NEW || t.getStatus() == TicketStatus.OFFERED_CRM) {
            t.setStatus(TicketStatus.ACKNOWLEDGED);
            t.setAcknowledgedAt(now);
        }
        ServiceTicket saved = ticketRepo.save(t);

        // Notify the customer + push pool refresh ping
        notificationService.createNotification(
                t.getCustomer().getId(),
                "Your ticket " + t.getTicketNumber() + " is now with " + crm.getName(),
                "Our team has picked up your request and will reach out shortly.",
                NotificationType.TICKET_ASSIGNED,
                t.getId(),
                "TICKET");
        webSocketService.broadcastOpsInbox("POOL_PICK", t.getTicketNumber(),
                Map.<String, Object>of("crm", crm.getName(),
                                       "team", String.valueOf(crm.getTeamName())));
        return ticketService.toResponse(saved);
    }

    /** Direct team re-assignment.  No offer/accept handshake. */
    @Transactional
    public TicketResponse assignTeam(String ticketNumber, String teamName) {
        ServiceTicket t = ticketRepo.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));
        if (teamName == null || teamName.isBlank()) {
            throw new BusinessException("BAD_TEAM", "Team name is required.");
        }
        t.setAssignedTeamName(teamName.trim());
        ServiceTicket saved = ticketRepo.save(t);
        webSocketService.broadcastOpsInbox("TEAM_ASSIGNED", t.getTicketNumber(),
                Map.<String, Object>of("team", teamName));
        return ticketService.toResponse(saved);
    }

    /**
     * Direct engineer assignment.  Sets the {@code engineer} FK on the
     * ticket and copies the engineer's team onto the ticket if no team
     * was set yet.  No offer is created.
     */
    @Transactional
    public TicketResponse assignEngineer(String ticketNumber, UUID engineerId) {
        ServiceTicket t = ticketRepo.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));
        User eng = userRepo.findById(engineerId)
                .orElseThrow(() -> new NotFoundException("User", engineerId.toString()));
        if (eng.getRole() != UserRole.SITE_ENGINEER) {
            throw new BusinessException("BAD_ENGINEER",
                    eng.getName() + " is not a Service Engineer.");
        }
        t.setEngineer(eng);
        if (t.getAssignedTeamName() == null && eng.getTeamName() != null) {
            t.setAssignedTeamName(eng.getTeamName());
        }
        if (t.getStatus() == TicketStatus.ACKNOWLEDGED
                || t.getStatus() == TicketStatus.OPEN) {
            t.setStatus(TicketStatus.ASSIGNED);
        }
        ServiceTicket saved = ticketRepo.save(t);
        notificationService.createNotification(
                eng.getId(),
                "Job assigned: " + t.getTicketNumber(),
                t.getProblemDescription() != null ? t.getProblemDescription() : "Open the ticket for details.",
                NotificationType.TICKET_ASSIGNED,
                t.getId(),
                "TICKET");
        webSocketService.broadcastOpsInbox("ENGINEER_ASSIGNED", t.getTicketNumber(),
                Map.<String, Object>of("engineer", eng.getName(),
                                       "team", String.valueOf(eng.getTeamName())));
        return ticketService.toResponse(saved);
    }
}
