package com.aes.service;

import com.aes.entity.AssignmentOffer;
import com.aes.entity.InstallationRequest;
import com.aes.entity.ServiceTicket;
import com.aes.entity.StaffProfile;
import com.aes.entity.User;
import com.aes.enums.ActivityType;
import com.aes.enums.InstallationStatus;
import com.aes.enums.NotificationType;
import com.aes.enums.OfferStatus;
import com.aes.enums.OfferType;
import com.aes.enums.TicketStatus;
import com.aes.enums.UserRole;
import com.aes.exception.NotFoundException;
import com.aes.repository.AssignmentOfferRepository;
import com.aes.repository.InstallationRequestRepository;
import com.aes.repository.ServiceTicketRepository;
import com.aes.repository.StaffProfileRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Shift toggle + handoff (PLAN.md §S11, FLOW.md C20).
 *
 * <p>When a CRM or SITE_ENGINEER ends their shift, their pending offers
 * are withdrawn and their active tickets are handed back to the Ops
 * Manager triage inbox so re-assignment can happen.</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class StaffShiftService {

    private final StaffProfileRepository profileRepo;
    private final UserRepository userRepo;
    private final ServiceTicketRepository ticketRepo;
    private final InstallationRequestRepository installRepo;
    private final AssignmentOfferRepository offerRepo;
    private final AssignmentOfferService offerService;
    private final ServiceTicketService ticketService;
    private final NotificationService notificationService;

    /**
     * Backwards-compatible single-arg overload — legacy callers (no
     * {@code handoffWork} flag) get the destructive hand-off so SLAs
     * aren't silently held by an offline owner.
     */
    @Transactional
    public StaffProfile toggle(UUID userId, boolean onShift, String note) {
        return toggle(userId, onShift, note, true);
    }

    /**
     * Toggle the shift flag.
     *
     * @param handoffWork when going off-shift: {@code true} → push every
     *                    open ticket/install/offer back to Ops (destructive,
     *                    end-of-day mode); {@code false} → soft pause that
     *                    keeps ownership intact so a quick break doesn't
     *                    lose the user's inbox.
     */
    @Transactional
    public StaffProfile toggle(UUID userId, boolean onShift, String note, boolean handoffWork) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId.toString()));
        StaffProfile profile = profileRepo.findById(userId)
                .orElseGet(() -> {
                    StaffProfile p = new StaffProfile();
                    p.setUserId(userId);
                    p.setOnShift(false);
                    p.setMaxConcurrentLoad(8);
                    p.setBranch("HYDERABAD");
                    return p;
                });

        boolean wasOnShift = Boolean.TRUE.equals(profile.getOnShift());
        profile.setOnShift(onShift);
        profile.setLastSeenAt(OffsetDateTime.now());
        profile = profileRepo.save(profile);

        if (wasOnShift && !onShift && handoffWork) {
            handOff(user, note);
        }
        log.info("Staff {} ({}) shift toggled {} → {} (handoffWork={})",
                user.getName(), user.getRole(),
                wasOnShift ? "ON" : "OFF", onShift ? "ON" : "OFF", handoffWork);
        return profile;
    }

    private void handOff(User user, String note) {
        UserRole role = user.getRole();
        if (role == UserRole.CRM_AGENT || role == UserRole.SERVICE_MANAGER) {
            handOffCrm(user, note);
        } else if (role == UserRole.SITE_ENGINEER) {
            handOffEngineer(user, note);
        }
    }

    private void handOffCrm(User crm, String note) {
        // 1) Withdraw any open offers we've sent (offered_to people we should
        //    not keep waiting on us).
        cancelOpenOffersFor(crm);

        // 2) Push every active ticket back to OPS triage (status → NEW, owner → null).
        List<ServiceTicket> active = ticketRepo.findActiveByAssignee(crm.getId());
        for (ServiceTicket t : active) {
            t.setStatus(TicketStatus.NEW);
            t.setCurrentAssignee(null);
            t.setAssignedAt(null);
            ticketRepo.save(t);
            ticketService.createActivity(t, crm, ActivityType.STATUS_CHANGED,
                    "CRM " + crm.getName() + " ended shift — ticket handed back to Ops triage"
                            + (note != null ? " (" + note + ")" : ""));
        }
        // 3) Same for installation leads.
        List<InstallationRequest> installs = installRepo.findActiveByOwner(crm.getId());
        for (InstallationRequest i : installs) {
            i.setStatus(InstallationStatus.NEW);
            i.setOwnerCrm(null);
            installRepo.save(i);
        }
        // 4) Page on-shift OPS so they see the load shift.
        for (User ops : userRepo.findByRoleAndIsActiveTrue(UserRole.OPS_MANAGER)) {
            notificationService.notifyUser(ops.getId(),
                    "Shift-end handoff from " + crm.getName(),
                    active.size() + " ticket(s) + " + installs.size()
                            + " install lead(s) need re-assignment"
                            + (note != null ? " — " + note : ""),
                    NotificationType.TICKET_ASSIGNED, null);
        }
    }

    private void handOffEngineer(User engineer, String note) {
        // 1) Withdraw any pending dispatch offers (they were heading to them).
        cancelOpenOffersFor(engineer);

        // 2) Active dispatched tickets revert to ACKNOWLEDGED so the owner CRM
        //    can re-dispatch a different engineer.
        List<ServiceTicket> jobs = ticketRepo.findActiveByEngineerOrdered(engineer.getId());
        for (ServiceTicket t : jobs) {
            // Don't ruin tickets the engineer has already started.
            if (t.getStatus() == TicketStatus.ON_SITE
                    || t.getStatus() == TicketStatus.IN_PROGRESS) {
                continue;
            }
            t.setStatus(TicketStatus.ACKNOWLEDGED);
            t.setEngineer(null);
            t.setEngineerAcceptedAt(null);
            ticketRepo.save(t);
            ticketService.createActivity(t, engineer, ActivityType.STATUS_CHANGED,
                    "Engineer " + engineer.getName() + " ended shift — re-dispatch needed"
                            + (note != null ? " (" + note + ")" : ""));
            if (t.getCurrentAssignee() != null) {
                notificationService.notifyUser(t.getCurrentAssignee().getId(),
                        "Engineer ended shift — re-dispatch needed for " + t.getTicketNumber(),
                        engineer.getName() + " is off-shift; please pick a different engineer.",
                        NotificationType.TICKET_ASSIGNED, t.getId());
            }
        }
    }

    private void cancelOpenOffersFor(User user) {
        // Offers sent BY this user that are still pending acceptance.
        List<AssignmentOffer> openOutgoing = offerRepo
                .findByOfferedByIdAndStatus(user.getId(), OfferStatus.OFFERED);
        for (AssignmentOffer o : openOutgoing) {
            try {
                offerService.withdraw(o.getId(), user.getId());
            } catch (Exception ex) {
                log.warn("Could not withdraw outgoing offer {}: {}", o.getId(), ex.getMessage());
            }
        }
        // Offers SENT TO this user that they have not yet acted on — auto-decline.
        List<AssignmentOffer> openIncoming = offerRepo
                .findByOfferedToIdAndStatus(user.getId(), OfferStatus.OFFERED);
        for (AssignmentOffer o : openIncoming) {
            try {
                offerService.decline(o.getId(), user.getId(),
                        "Auto-declined: end-of-shift handoff");
            } catch (Exception ex) {
                log.warn("Could not decline incoming offer {}: {}", o.getId(), ex.getMessage());
            }
        }
    }
}
