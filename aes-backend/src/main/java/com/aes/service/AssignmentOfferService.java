package com.aes.service;

import com.aes.config.AppProperties;
import com.aes.dto.response.AssignmentOfferResponse;
import com.aes.entity.AssignmentOffer;
import com.aes.entity.InstallationRequest;
import com.aes.entity.ServiceTicket;
import com.aes.entity.User;
import com.aes.enums.InstallationStatus;
import com.aes.enums.NotificationType;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Owns the lifecycle of {@link AssignmentOffer} rows — the
 * <strong>"Hey, will you take this work?"</strong> primitive used by both
 * Ops-Manager-to-CRM and CRM-to-Engineer dispatch flows (PLAN.md §7.3,
 * FLOW.md C1 / C7 / C9 / C10 / C11 / C12).
 *
 * <h3>State transitions enforced here</h3>
 * <pre>
 *   OFFERED → ACCEPTED   (recipient acted in time)
 *   OFFERED → DECLINED   (recipient said no)
 *   OFFERED → EXPIRED    (timer ran out — handled by {@link #expireOverdueOffers})
 *   OFFERED → WITHDRAWN  (sender cancelled before recipient acted)
 * </pre>
 *
 * <p>Every transition also updates the underlying ticket / install so the
 * status enum and {@code currentAssignee} reflect the offer outcome.</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AssignmentOfferService {

    private final AssignmentOfferRepository offerRepository;
    private final ServiceTicketRepository ticketRepository;
    private final InstallationRequestRepository installationRepository;
    private final NotificationService notificationService;
    private final WebSocketService webSocketService;
    private final AppProperties appProperties;

    // ─────────────────────────────────────────────────────────────
    //  Creation
    // ─────────────────────────────────────────────────────────────

    /**
     * Offer a service ticket to a CRM agent / Service Manager.
     * Used by {@code TriageService} when the Ops Manager assigns / invites.
     *
     * <p>Side effects: ticket status flips to {@link TicketStatus#OFFERED_CRM},
     * {@code currentAssignee} is set to the recipient (provisional — only
     * a successful accept makes the ownership real), the recipient gets a
     * notification + a STOMP push on their personal offer topic.</p>
     */
    @Transactional
    public AssignmentOffer offerTicketToCrm(ServiceTicket ticket, User offeredBy,
                                             User offeredTo, OfferMode mode, String note) {
        validateOfferRecipientForCrmOwner(offeredTo);
        guardSingleOpenOffer(ticket);

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusMinutes(
                appProperties.getOffer().getCrmExpiryMinutes());

        AssignmentOffer offer = AssignmentOffer.builder()
                .ticket(ticket)
                .offeredBy(offeredBy)
                .offeredTo(offeredTo)
                .offerType(OfferType.CRM_OWNER)
                .mode(mode != null ? mode : OfferMode.DIRECT)
                .note(note)
                .status(OfferStatus.OFFERED)
                .expiresAt(expiresAt)
                .build();
        offer = offerRepository.save(offer);

        // Provisional assignment — until accepted/declined this is the visible
        // owner on the ticket so the workload board doesn't double-count.
        ticket.setStatus(TicketStatus.OFFERED_CRM);
        ticket.setCurrentAssignee(offeredTo);
        ticket.setAssignedAt(now);
        if (ticket.getTriageAt() == null) {
            ticket.setTriageAt(now);
            ticket.setTriagedBy(offeredBy);
        }
        ticketRepository.save(ticket);

        notifyRecipientOfNewOffer(offer);
        return offer;
    }

    /**
     * Offer a site-engineer dispatch (10-min window by default). Used by
     * {@code EngineerDispatchService} when the owner CRM picks an engineer
     * from the picker. Ticket flips to {@link TicketStatus#ENGINEER_OFFERED};
     * on accept the engineer is committed and status becomes
     * {@link TicketStatus#ASSIGNED}.
     */
    @Transactional
    public AssignmentOffer offerEngineerDispatch(ServiceTicket ticket, User offeredBy,
                                                  User offeredTo, OfferMode mode, String note) {
        validateOfferRecipientForEngineerDispatch(offeredTo);
        guardSingleOpenOffer(ticket);

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusMinutes(
                appProperties.getOffer().getEngineerExpiryMinutes());

        AssignmentOffer offer = AssignmentOffer.builder()
                .ticket(ticket)
                .offeredBy(offeredBy)
                .offeredTo(offeredTo)
                .offerType(OfferType.ENGINEER_DISPATCH)
                .mode(mode != null ? mode : OfferMode.DIRECT)
                .note(note)
                .status(OfferStatus.OFFERED)
                .expiresAt(expiresAt)
                .build();
        offer = offerRepository.save(offer);

        ticket.setStatus(TicketStatus.ENGINEER_OFFERED);
        ticket.setEngineer(offeredTo);
        ticketRepository.save(ticket);

        notifyRecipientOfNewOffer(offer);
        return offer;
    }

    /**
     * Offer an installation lead to a CRM agent / Service Manager.
     * Same mechanics as {@link #offerTicketToCrm} but the underlying entity
     * is an {@link InstallationRequest}; install status flips to PENDING
     * (already the default) but {@code ownerCrm} stays null until accept.
     */
    @Transactional
    public AssignmentOffer offerInstallToCrm(InstallationRequest install, User offeredBy,
                                              User offeredTo, OfferMode mode, String note) {
        validateOfferRecipientForCrmOwner(offeredTo);
        guardSingleOpenOffer(install);

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusMinutes(
                appProperties.getOffer().getCrmExpiryMinutes());

        AssignmentOffer offer = AssignmentOffer.builder()
                .install(install)
                .offeredBy(offeredBy)
                .offeredTo(offeredTo)
                .offerType(OfferType.CRM_OWNER)
                .mode(mode != null ? mode : OfferMode.DIRECT)
                .note(note)
                .status(OfferStatus.OFFERED)
                .expiresAt(expiresAt)
                .build();
        offer = offerRepository.save(offer);

        if (install.getTriageAt() == null) {
            install.setTriageAt(now);
            install.setTriagedBy(offeredBy);
            installationRepository.save(install);
        }

        notifyRecipientOfNewOffer(offer);
        return offer;
    }

    // ─────────────────────────────────────────────────────────────
    //  Responses (accept / decline / withdraw)
    // ─────────────────────────────────────────────────────────────

    /**
     * Recipient accepts the offer.
     *
     * <ul>
     *   <li>Ticket: status → ACKNOWLEDGED, acknowledgedAt = now, ownership
     *       remains on the recipient. currentLevel jumps to 2 when the
     *       recipient is a Service Manager (the bypass-to-L2 case).</li>
     *   <li>Install: status → CONFIRMED, ownerCrm = recipient.</li>
     * </ul>
     */
    @Transactional
    public AssignmentOffer accept(UUID offerId, UUID actingUserId) {
        AssignmentOffer offer = loadOpenOffer(offerId);
        if (!offer.getOfferedTo().getId().equals(actingUserId)) {
            throw new BusinessException("FORBIDDEN",
                    "Only the recipient of the offer can accept it.",
                    HttpStatus.FORBIDDEN);
        }
        OffsetDateTime now = OffsetDateTime.now();
        offer.setStatus(OfferStatus.ACCEPTED);
        offer.setRespondedAt(now);
        offerRepository.save(offer);

        if (offer.getTicket() != null) {
            ServiceTicket ticket = offer.getTicket();
            if (offer.getOfferType() == OfferType.ENGINEER_DISPATCH) {
                // Engineer accepted dispatch — commit them as the field owner.
                ticket.setStatus(TicketStatus.ASSIGNED);
                ticket.setEngineer(offer.getOfferedTo());
                ticket.setEngineerAcceptedAt(now);
            } else {
                // CRM accepted ownership of the ticket.
                ticket.setStatus(TicketStatus.ACKNOWLEDGED);
                ticket.setAcknowledgedAt(now);
                ticket.setCurrentAssignee(offer.getOfferedTo());
                ticket.setAssignedAt(now);
                if (offer.getOfferedTo().getRole() == UserRole.SERVICE_MANAGER) {
                    ticket.setCurrentLevel(2);
                }
            }
            ticketRepository.save(ticket);

            notifyOfferAccepted(offer, ticket);
        } else if (offer.getInstall() != null) {
            InstallationRequest install = offer.getInstall();
            install.setOwnerCrm(offer.getOfferedTo());
            install.setStatus(InstallationStatus.CONFIRMED);
            installationRepository.save(install);

            notifyInstallOfferAccepted(offer, install);
        }
        log.info("Offer {} ACCEPTED by {}", offerId, actingUserId);
        return offer;
    }

    /**
     * Recipient declines (with optional reason). Ticket / install bounces
     * back to the Ops Manager inbox.
     */
    @Transactional
    public AssignmentOffer decline(UUID offerId, UUID actingUserId, String reason) {
        AssignmentOffer offer = loadOpenOffer(offerId);
        if (!offer.getOfferedTo().getId().equals(actingUserId)) {
            throw new BusinessException("FORBIDDEN",
                    "Only the recipient of the offer can decline it.",
                    HttpStatus.FORBIDDEN);
        }
        return closeAndBounce(offer, OfferStatus.DECLINED, reason);
    }

    /** Sender (Ops Manager) cancels an offer that hasn't been responded to yet. */
    @Transactional
    public AssignmentOffer withdraw(UUID offerId, UUID actingUserId) {
        AssignmentOffer offer = loadOpenOffer(offerId);
        if (!offer.getOfferedBy().getId().equals(actingUserId)) {
            throw new BusinessException("FORBIDDEN",
                    "Only the sender of the offer can withdraw it.",
                    HttpStatus.FORBIDDEN);
        }
        return closeAndBounce(offer, OfferStatus.WITHDRAWN, null);
    }

    // ─────────────────────────────────────────────────────────────
    //  Scheduled expiry (Phase 2 Stage A from FLOW.md C17)
    // ─────────────────────────────────────────────────────────────

    /**
     * Every 30 s flip any {@code OFFERED} row past its {@code expires_at}
     * to {@code EXPIRED} and bounce the ticket/install back to the Ops
     * Manager inbox.
     *
     * <p>{@code @Transactional} so the {@link ServiceTicket}/{@link InstallationRequest}
     * lazy proxies on each loaded offer can be safely dereferenced inside
     * {@link #closeAndBounce}; without it Hibernate throws
     * "could not initialize proxy ... no Session".</p>
     */
    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void expireOverdueOffers() {
        List<AssignmentOffer> overdue = offerRepository.findExpired(OffsetDateTime.now());
        if (overdue.isEmpty()) return;
        for (AssignmentOffer offer : overdue) {
            try {
                closeAndBounce(offer, OfferStatus.EXPIRED, "Offer expired without response");
                log.warn("Offer {} EXPIRED (window was {} min)",
                        offer.getId(),
                        appProperties.getOffer().getCrmExpiryMinutes());
            } catch (Exception e) {
                log.error("Failed to expire offer {}: {}", offer.getId(), e.getMessage());
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Reads
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AssignmentOfferResponse> listMyPendingOffers(UUID recipientId) {
        return offerRepository
                .findByOfferedToIdAndStatusOrderByCreatedAtDesc(recipientId, OfferStatus.OFFERED)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AssignmentOfferResponse toResponseFor(UUID offerId) {
        AssignmentOffer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new NotFoundException("AssignmentOffer", offerId.toString()));
        return toResponse(offer);
    }

    public AssignmentOfferResponse toResponse(AssignmentOffer offer) {
        OffsetDateTime now = OffsetDateTime.now();
        AssignmentOfferResponse.AssignmentOfferResponseBuilder b = AssignmentOfferResponse.builder()
                .id(offer.getId())
                .offerType(offer.getOfferType().name())
                .mode(offer.getMode().name())
                .status(offer.getStatus().name())
                .declineReason(offer.getDeclineReason())
                .note(offer.getNote())
                .offeredToId(offer.getOfferedTo().getId())
                .offeredToName(offer.getOfferedTo().getName())
                .offeredToRole(offer.getOfferedTo().getRole().name())
                .offeredById(offer.getOfferedBy().getId())
                .offeredByName(offer.getOfferedBy().getName())
                .offeredByRole(offer.getOfferedBy().getRole().name())
                .expiresAt(offer.getExpiresAt())
                .respondedAt(offer.getRespondedAt())
                .createdAt(offer.getCreatedAt());

        if (offer.getExpiresAt() != null) {
            long secs = ChronoUnit.SECONDS.between(now, offer.getExpiresAt());
            b.secondsUntilExpiry(Math.max(0, secs));
        }

        if (offer.getTicket() != null) {
            ServiceTicket t = offer.getTicket();
            b.ticketId(t.getId())
             .ticketNumber(t.getTicketNumber())
             .ticketPriority(t.getPriority().name())
             .ticketProblemCategory(t.getProblemCategory().name())
             .customerId(t.getCustomer().getId())
             .customerName(t.getCustomer().getName());
        } else if (offer.getInstall() != null) {
            InstallationRequest i = offer.getInstall();
            b.installId(i.getId())
             .installRequestNumber(i.getRequestNumber())
             .customerId(i.getCustomer().getId())
             .customerName(i.getCustomer().getName());
        }
        return b.build();
    }

    // ─────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────

    private AssignmentOffer loadOpenOffer(UUID offerId) {
        AssignmentOffer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new NotFoundException("AssignmentOffer", offerId.toString()));
        if (offer.getStatus() != OfferStatus.OFFERED) {
            throw new BusinessException("OFFER_CLOSED",
                    "This offer has already been " + offer.getStatus().name().toLowerCase() + ".",
                    HttpStatus.CONFLICT);
        }
        return offer;
    }

    private void validateOfferRecipientForCrmOwner(User recipient) {
        UserRole role = recipient.getRole();
        if (role != UserRole.CRM_AGENT && role != UserRole.SERVICE_MANAGER) {
            throw new BusinessException("INVALID_RECIPIENT",
                    "CRM ownership offers can only be sent to CRM_AGENT or SERVICE_MANAGER "
                            + "users (you offered to " + role + ").",
                    HttpStatus.BAD_REQUEST);
        }
        if (Boolean.FALSE.equals(recipient.getIsActive())) {
            throw new BusinessException("RECIPIENT_INACTIVE",
                    "Recipient is not active.", HttpStatus.BAD_REQUEST);
        }
    }

    private void validateOfferRecipientForEngineerDispatch(User recipient) {
        UserRole role = recipient.getRole();
        if (role != UserRole.SITE_ENGINEER) {
            throw new BusinessException("INVALID_RECIPIENT",
                    "Engineer dispatch offers can only be sent to SITE_ENGINEER users "
                            + "(you offered to " + role + ").",
                    HttpStatus.BAD_REQUEST);
        }
        if (Boolean.FALSE.equals(recipient.getIsActive())) {
            throw new BusinessException("RECIPIENT_INACTIVE",
                    "Recipient is not active.", HttpStatus.BAD_REQUEST);
        }
    }

    private void guardSingleOpenOffer(ServiceTicket ticket) {
        offerRepository.findFirstByTicketIdAndStatusOrderByCreatedAtDesc(
                        ticket.getId(), OfferStatus.OFFERED)
                .ifPresent(existing -> {
                    throw new BusinessException("OFFER_PENDING",
                            "An offer is already pending on this ticket (offered to "
                                    + existing.getOfferedTo().getName() + "). "
                                    + "Withdraw it before sending a new one.",
                            HttpStatus.CONFLICT);
                });
    }

    private void guardSingleOpenOffer(InstallationRequest install) {
        offerRepository.findFirstByInstallIdAndStatusOrderByCreatedAtDesc(
                        install.getId(), OfferStatus.OFFERED)
                .ifPresent(existing -> {
                    throw new BusinessException("OFFER_PENDING",
                            "An offer is already pending on this installation (offered to "
                                    + existing.getOfferedTo().getName() + ").",
                            HttpStatus.CONFLICT);
                });
    }

    private AssignmentOffer closeAndBounce(AssignmentOffer offer, OfferStatus terminal, String reason) {
        OffsetDateTime now = OffsetDateTime.now();
        offer.setStatus(terminal);
        offer.setRespondedAt(now);
        if (reason != null && !reason.isBlank()) {
            offer.setDeclineReason(reason);
        }
        offerRepository.save(offer);

        if (offer.getTicket() != null) {
            ServiceTicket ticket = offer.getTicket();
            if (offer.getOfferType() == OfferType.ENGINEER_DISPATCH) {
                // Engineer declined / expired / withdrawn — ticket reverts to
                // the CRM's "ready to dispatch" state (ACKNOWLEDGED) and the
                // pending engineer is cleared so the picker can re-fire.
                ticket.setStatus(TicketStatus.ACKNOWLEDGED);
                ticket.setEngineer(null);
                ticket.setEngineerAcceptedAt(null);
            } else {
                ticket.setStatus(TicketStatus.NEW);
                ticket.setCurrentAssignee(null);
                ticket.setAssignedAt(null);
            }
            ticketRepository.save(ticket);
            notifyOfferBounced(offer, ticket, terminal);
        }
        // Installations don't change status on bounce — they stay PENDING with
        // ownerCrm=null. Just notify Ops + the recipient (the latter so a
        // toast can be dismissed).
        if (offer.getInstall() != null) {
            notifyInstallOfferBounced(offer, terminal);
        }
        return offer;
    }

    // ── Notification fan-out ─────────────────────────────────────

    private void notifyRecipientOfNewOffer(AssignmentOffer offer) {
        String refNumber = offer.getTicket() != null
                ? offer.getTicket().getTicketNumber()
                : offer.getInstall().getRequestNumber();

        String title = offer.getMode() == OfferMode.INVITE
                ? "Invitation: take extra work?"
                : "New assignment offered";

        String customerName = offer.getTicket() != null
                ? offer.getTicket().getCustomer().getName()
                : offer.getInstall().getCustomer().getName();

        StringBuilder body = new StringBuilder()
                .append(refNumber)
                .append(" — ").append(customerName);
        if (offer.getNote() != null && !offer.getNote().isBlank()) {
            body.append(" · ").append(offer.getNote());
        }
        body.append(" · respond within ")
                .append(appProperties.getOffer().getCrmExpiryMinutes())
                .append(" min.");

        notificationService.notifyUser(offer.getOfferedTo().getId(),
                title, body.toString(), NotificationType.TICKET_ASSIGNED,
                offer.getTicket() != null ? offer.getTicket().getId() : offer.getInstall().getId());

        webSocketService.broadcastOfferToUser(offer.getOfferedTo().getId(),
                "OFFER_RECEIVED", toResponse(offer));

        // Ops Manager inbox gets a "waiting for accept" pulse so the card
        // can flip from NEW to OFFERED_CRM in real time.
        webSocketService.broadcastOpsInbox("OFFER_SENT", refNumber, Map.of(
                "offeredTo", offer.getOfferedTo().getName(),
                "offeredToId", offer.getOfferedTo().getId().toString()
        ));
    }

    private void notifyOfferAccepted(AssignmentOffer offer, ServiceTicket ticket) {
        notificationService.notifyUser(offer.getOfferedBy().getId(),
                "Offer accepted",
                offer.getOfferedTo().getName() + " accepted ticket " + ticket.getTicketNumber() + ".",
                NotificationType.TICKET_ASSIGNED, ticket.getId());

        notificationService.notifyUser(ticket.getCustomer().getId(),
                "Ticket " + ticket.getTicketNumber() + " acknowledged",
                "Your ticket is now being handled by " + offer.getOfferedTo().getName() + ".",
                NotificationType.TICKET_ASSIGNED, ticket.getId());

        webSocketService.broadcastTicketUpdate(ticket.getTicketNumber(),
                "ACKNOWLEDGED", ticket.getCurrentLevel(), 0,
                offer.getOfferedTo().getName());

        webSocketService.broadcastOpsInbox("TRIAGED", ticket.getTicketNumber(), Map.of(
                "acceptedBy", offer.getOfferedTo().getName()
        ));
    }

    private void notifyInstallOfferAccepted(AssignmentOffer offer, InstallationRequest install) {
        notificationService.notifyUser(offer.getOfferedBy().getId(),
                "Install offer accepted",
                offer.getOfferedTo().getName() + " accepted " + install.getRequestNumber() + ".",
                NotificationType.INSTALLATION_UPDATE, install.getId());

        notificationService.notifyUser(install.getCustomer().getId(),
                "Installation " + install.getRequestNumber() + " confirmed",
                offer.getOfferedTo().getName() + " from AES will be in touch shortly.",
                NotificationType.INSTALLATION_UPDATE, install.getId());

        webSocketService.broadcastOpsInbox("TRIAGED", install.getRequestNumber(), Map.of(
                "acceptedBy", offer.getOfferedTo().getName()
        ));
    }

    private void notifyOfferBounced(AssignmentOffer offer, ServiceTicket ticket, OfferStatus terminal) {
        // Sender (Ops Manager) hears about it so they can re-route.
        notificationService.notifyUser(offer.getOfferedBy().getId(),
                "Offer " + terminal.name().toLowerCase() + " — " + ticket.getTicketNumber(),
                offer.getOfferedTo().getName() + " " + terminal.name().toLowerCase()
                        + (offer.getDeclineReason() != null
                                ? " (" + offer.getDeclineReason() + ")"
                                : "")
                        + ". Ticket is back in your triage inbox.",
                NotificationType.TICKET_ESCALATED, ticket.getId());

        webSocketService.broadcastOpsInbox("OFFER_" + terminal.name(),
                ticket.getTicketNumber(),
                Map.of("offeredTo", offer.getOfferedTo().getName(),
                       "reason", offer.getDeclineReason() == null ? "" : offer.getDeclineReason()));

        // Recipient still gets a per-user push so a "withdrawn"/"expired"
        // banner dismisses cleanly.
        webSocketService.broadcastOfferToUser(offer.getOfferedTo().getId(),
                "OFFER_" + terminal.name(), toResponse(offer));
    }

    private void notifyInstallOfferBounced(AssignmentOffer offer, OfferStatus terminal) {
        InstallationRequest install = offer.getInstall();
        notificationService.notifyUser(offer.getOfferedBy().getId(),
                "Install offer " + terminal.name().toLowerCase() + " — " + install.getRequestNumber(),
                offer.getOfferedTo().getName() + " " + terminal.name().toLowerCase()
                        + ". Lead is back in your triage inbox.",
                NotificationType.INSTALLATION_UPDATE, install.getId());

        webSocketService.broadcastOpsInbox("OFFER_" + terminal.name(),
                install.getRequestNumber(),
                Map.of("offeredTo", offer.getOfferedTo().getName()));

        webSocketService.broadcastOfferToUser(offer.getOfferedTo().getId(),
                "OFFER_" + terminal.name(), toResponse(offer));
    }
}
