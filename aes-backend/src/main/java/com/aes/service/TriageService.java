package com.aes.service;

import com.aes.dto.response.OpsDashboardResponse;
import com.aes.dto.response.OpsInboxItemDto;
import com.aes.entity.AssignmentOffer;
import com.aes.entity.InstallationRequest;
import com.aes.entity.ServiceTicket;
import com.aes.entity.User;
import com.aes.enums.OfferMode;
import com.aes.enums.OfferStatus;
import com.aes.enums.OfferType;
import com.aes.enums.TicketStatus;
import com.aes.enums.UserRole;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.AssignmentOfferRepository;
import com.aes.repository.InstallationRequestRepository;
import com.aes.repository.ServiceTicketRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * The Ops Manager's "brain" — exposes the inbox + the four primary triage
 * actions (PLAN.md §10.2 + FLOW.md C1 / C9 / C10 / C11 / C16).
 *
 * <p>This service does the heavy lifting around the inbox composition and
 * permission checks; the actual offer-lifecycle work is delegated to
 * {@link AssignmentOfferService}. Keeping the two concerns separate lets
 * the offer service stay focused on a single entity while triage can grow
 * its own bypass / recall / merge primitives without bloating it.</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class TriageService {

    private final ServiceTicketRepository ticketRepository;
    private final InstallationRequestRepository installationRepository;
    private final UserRepository userRepository;
    private final AssignmentOfferRepository offerRepository;
    private final AssignmentOfferService offerService;
    private final WorkloadService workloadService;

    // ─────────────────────────────────────────────────────────────
    //  Reads — inbox + dashboard
    // ─────────────────────────────────────────────────────────────

    /** The flat triage inbox (tickets + installs interleaved, P1 → P3 → age). */
    @Transactional(readOnly = true)
    public List<OpsInboxItemDto> getInbox() {
        List<OpsInboxItemDto> out = new ArrayList<>();
        for (ServiceTicket t : ticketRepository.findOpsInbox()) {
            out.add(toItem(t));
        }
        for (InstallationRequest i : installationRepository.findOpsInbox()) {
            out.add(toItem(i));
        }
        out.sort(Comparator
                .comparing(OpsInboxItemDto::getPriority, Comparator.nullsLast(String::compareTo))
                .thenComparing(OpsInboxItemDto::getCreatedAt));
        return out;
    }

    /** Single-call dashboard payload — KPI tiles + inbox + workload boards. */
    @Transactional(readOnly = true)
    public OpsDashboardResponse getDashboard() {
        List<OpsInboxItemDto> inbox = getInbox();
        OffsetDateTime now = OffsetDateTime.now();

        long untriagedTickets = inbox.stream()
                .filter(it -> "TICKET".equals(it.getKind()) && "NEW".equals(it.getStatus()))
                .count();
        long awaitingCrmAccept = inbox.stream()
                .filter(it -> "OFFERED_CRM".equals(it.getStatus()))
                .count();
        long escalatedByCustomer = inbox.stream()
                .filter(it -> "ESCALATED_BY_CUSTOMER".equals(it.getStatus()))
                .count();
        long untriagedInstalls = inbox.stream()
                .filter(it -> "INSTALL".equals(it.getKind()))
                .count();

        long awaitingEngineerAccept = offerRepository
                .countByOfferTypeAndStatus(OfferType.ENGINEER_DISPATCH, OfferStatus.OFFERED);

        long activeTicketsAll = ticketRepository.countActive();
        long slaRedZone = ticketRepository.countFinalSlaBreached(now);

        return OpsDashboardResponse.builder()
                .untriagedTickets(untriagedTickets)
                .awaitingCrmAccept(awaitingCrmAccept)
                .awaitingEngineerAccept(awaitingEngineerAccept)
                .escalatedByCustomer(escalatedByCustomer)
                .untriagedInstalls(untriagedInstalls)
                .slaRedZone(slaRedZone)
                .activeTicketsAll(activeTicketsAll)
                .inbox(inbox)
                .crmWorkload(workloadService.getCrmWorkload())
                .engineers(workloadService.getEngineerAvailability())
                .build();
    }

    // ─────────────────────────────────────────────────────────────
    //  Writes — offer to CRM / SM bypass / recall pending offer
    // ─────────────────────────────────────────────────────────────

    /** Ops Manager assigns or invites a CRM agent to take this ticket. */
    @Transactional
    public AssignmentOffer offerTicket(String ticketNumber, UUID opsUserId,
                                        UUID recipientId, OfferMode mode, String note) {
        ServiceTicket ticket = mustFindTicket(ticketNumber);
        if (ticket.getStatus() != TicketStatus.NEW
                && ticket.getStatus() != TicketStatus.ESCALATED_BY_CUSTOMER) {
            throw new BusinessException("BAD_STATE",
                    "Ticket " + ticketNumber + " is " + ticket.getStatus()
                            + " — only NEW or ESCALATED_BY_CUSTOMER tickets can be re-offered.",
                    HttpStatus.CONFLICT);
        }
        User ops = mustFindUser(opsUserId, "Ops Manager");
        User recipient = mustFindUser(recipientId, "Recipient");
        return offerService.offerTicketToCrm(ticket, ops, recipient, mode, note);
    }

    /** Ops Manager assigns a CRM agent to own this installation lead. */
    @Transactional
    public AssignmentOffer offerInstall(UUID installId, UUID opsUserId,
                                         UUID recipientId, OfferMode mode, String note) {
        InstallationRequest install = installationRepository.findById(installId)
                .orElseThrow(() -> new NotFoundException("InstallationRequest", installId.toString()));
        if (install.getOwnerCrm() != null) {
            throw new BusinessException("ALREADY_OWNED",
                    "Installation " + install.getRequestNumber() + " is already owned by "
                            + install.getOwnerCrm().getName(),
                    HttpStatus.CONFLICT);
        }
        User ops = mustFindUser(opsUserId, "Ops Manager");
        User recipient = mustFindUser(recipientId, "Recipient");
        return offerService.offerInstallToCrm(install, ops, recipient, mode, note);
    }

    /**
     * Bypass-to-L2 — Ops Manager skips the CRM layer and pushes the ticket
     * to a Service Manager (FLOW.md C11). When {@code smId} is null the
     * service picks the first on-shift Service Manager and falls back to
     * any active SM if none are on shift.
     */
    @Transactional
    public AssignmentOffer bypassTicketToL2(String ticketNumber, UUID opsUserId,
                                              UUID smId, String note) {
        ServiceTicket ticket = mustFindTicket(ticketNumber);
        if (ticket.getStatus() != TicketStatus.NEW
                && ticket.getStatus() != TicketStatus.ESCALATED_BY_CUSTOMER) {
            throw new BusinessException("BAD_STATE",
                    "Only NEW / ESCALATED_BY_CUSTOMER tickets can be bypassed to L2.",
                    HttpStatus.CONFLICT);
        }
        User ops = mustFindUser(opsUserId, "Ops Manager");
        User sm = (smId != null)
                ? mustFindUser(smId, "Service Manager")
                : pickFirstActiveSm();
        if (sm.getRole() != UserRole.SERVICE_MANAGER) {
            throw new BusinessException("INVALID_RECIPIENT",
                    "Bypass-to-L2 target must be a SERVICE_MANAGER.",
                    HttpStatus.BAD_REQUEST);
        }
        String fullNote = "[BYPASS-L2] " + (note == null ? "" : note);
        return offerService.offerTicketToCrm(ticket, ops, sm, OfferMode.DIRECT, fullNote);
    }

    /**
     * Recall (withdraw) the pending offer on a ticket — used when the Ops
     * Manager wants to redirect a still-open offer to a different person.
     */
    @Transactional
    public AssignmentOffer recallTicketOffer(String ticketNumber, UUID opsUserId) {
        ServiceTicket ticket = mustFindTicket(ticketNumber);
        AssignmentOffer offer = offerRepository
                .findFirstByTicketIdAndStatusOrderByCreatedAtDesc(ticket.getId(), OfferStatus.OFFERED)
                .orElseThrow(() -> new BusinessException("NO_PENDING_OFFER",
                        "No pending offer to recall on ticket " + ticketNumber,
                        HttpStatus.CONFLICT));
        return offerService.withdraw(offer.getId(), opsUserId);
    }

    // ─────────────────────────────────────────────────────────────
    //  Mappers
    // ─────────────────────────────────────────────────────────────

    private OpsInboxItemDto toItem(ServiceTicket t) {
        OffsetDateTime now = OffsetDateTime.now();
        AssignmentOffer pending = offerRepository
                .findFirstByTicketIdAndStatusOrderByCreatedAtDesc(t.getId(), OfferStatus.OFFERED)
                .orElse(null);

        return OpsInboxItemDto.builder()
                .kind("TICKET")
                .id(t.getId())
                .referenceNumber(t.getTicketNumber())
                .customerId(t.getCustomer().getId())
                .customerName(t.getCustomer().getName())
                .priority(t.getPriority().name())
                .status(t.getStatus().name())
                .stage(stageLabel(t))
                .headline(headlineFor(t))
                .branch(t.getBranch())
                .locality(t.getLocality())
                .offeredToId(pending != null ? pending.getOfferedTo().getId() : null)
                .offeredToName(pending != null ? pending.getOfferedTo().getName() : null)
                .offerExpiresAt(pending != null ? pending.getExpiresAt() : null)
                .offerSecondsUntilExpiry(pending != null
                        ? Math.max(0, ChronoUnit.SECONDS.between(now, pending.getExpiresAt()))
                        : null)
                .escalationReason(t.getEscalationReason())
                .ageMinutes(ChronoUnit.MINUTES.between(t.getCreatedAt(), now))
                .createdAt(t.getCreatedAt())
                .build();
    }

    private OpsInboxItemDto toItem(InstallationRequest i) {
        OffsetDateTime now = OffsetDateTime.now();
        AssignmentOffer pending = offerRepository
                .findFirstByInstallIdAndStatusOrderByCreatedAtDesc(i.getId(), OfferStatus.OFFERED)
                .orElse(null);

        return OpsInboxItemDto.builder()
                .kind("INSTALL")
                .id(i.getId())
                .referenceNumber(i.getRequestNumber())
                .customerId(i.getCustomer().getId())
                .customerName(i.getCustomer().getName())
                .status(i.getStatus().name())
                .stage(pending != null ? "Awaiting CRM accept" : "Untriaged install")
                .headline(i.getAcType().name() + (i.getBrand() != null ? " · " + i.getBrand() : ""))
                .branch(i.getBranch())
                .locality(i.getLocality())
                .offeredToId(pending != null ? pending.getOfferedTo().getId() : null)
                .offeredToName(pending != null ? pending.getOfferedTo().getName() : null)
                .offerExpiresAt(pending != null ? pending.getExpiresAt() : null)
                .offerSecondsUntilExpiry(pending != null
                        ? Math.max(0, ChronoUnit.SECONDS.between(now, pending.getExpiresAt()))
                        : null)
                .ageMinutes(ChronoUnit.MINUTES.between(i.getCreatedAt(), now))
                .createdAt(i.getCreatedAt())
                .build();
    }

    private String stageLabel(ServiceTicket t) {
        return switch (t.getStatus()) {
            case NEW -> "Untriaged ticket";
            case OFFERED_CRM -> "Awaiting CRM accept";
            case ESCALATED_BY_CUSTOMER -> "Customer escalated";
            default -> t.getStatus().name();
        };
    }

    private String headlineFor(ServiceTicket t) {
        String cat = t.getProblemCategory() != null ? t.getProblemCategory().name() : "ISSUE";
        String unit = (t.getAcUnit() != null && t.getAcUnit().getRoomLabel() != null)
                ? " · " + t.getAcUnit().getRoomLabel()
                : "";
        return cat + unit;
    }

    private ServiceTicket mustFindTicket(String ticketNumber) {
        return ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));
    }

    private User mustFindUser(UUID id, String label) {
        return userRepository.findById(id)
                .orElseThrow(() -> new BusinessException("NOT_FOUND",
                        label + " not found: " + id, HttpStatus.BAD_REQUEST));
    }

    private User pickFirstActiveSm() {
        List<User> pool = userRepository.findByRoleAndIsActiveTrue(UserRole.SERVICE_MANAGER);
        if (pool.isEmpty()) {
            throw new BusinessException("NO_STAFF_AVAILABLE",
                    "No active SERVICE_MANAGER available for bypass-to-L2.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        return pool.get(0);
    }
}
