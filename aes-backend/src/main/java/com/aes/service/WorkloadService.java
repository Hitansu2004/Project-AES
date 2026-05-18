package com.aes.service;

import com.aes.dto.response.CrmWorkloadDto;
import com.aes.dto.response.EngineerAvailabilityDto;
import com.aes.entity.StaffProfile;
import com.aes.entity.User;
import com.aes.enums.OfferStatus;
import com.aes.enums.OfferType;
import com.aes.enums.UserRole;
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
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Aggregates "who is free, who is drowning" snapshots used by the Ops
 * Manager dashboard and the Engineer Picker modal (PLAN.md §9.1).
 *
 * <p>Each query joins three sources:</p>
 * <ol>
 *   <li>{@code users} — the staff identity.</li>
 *   <li>{@code staff_profiles} — branch / shift / skills / cap.</li>
 *   <li>Live tables — open ticket / install / offer counts.</li>
 * </ol>
 *
 * <p>This is intentionally an in-memory aggregation: there are only a
 * handful of CRMs and engineers per branch, so a few `count` queries per
 * row are far cheaper to ship than a custom native projection — and far
 * easier to evolve in the next phases.</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class WorkloadService {

    private final UserRepository userRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final ServiceTicketRepository ticketRepository;
    private final InstallationRequestRepository installationRepository;
    private final AssignmentOfferRepository offerRepository;

    /**
     * Workload snapshot for every CRM agent + Service Manager (both can be
     * offered ticket ownership in this phase).
     */
    @Transactional(readOnly = true)
    public List<CrmWorkloadDto> getCrmWorkload() {
        List<User> staff = userRepository.findByRoleAndIsActiveTrue(UserRole.CRM_AGENT);
        staff.addAll(userRepository.findByRoleAndIsActiveTrue(UserRole.SERVICE_MANAGER));

        Map<UUID, StaffProfile> profiles = profilesById();
        OffsetDateTime startOfToday = OffsetDateTime.now()
                .toLocalDate()
                .atStartOfDay(ZoneOffset.UTC)
                .toOffsetDateTime();

        return staff.stream()
                .map(u -> buildCrmRow(u, profiles.get(u.getId()), startOfToday))
                .toList();
    }

    /**
     * Availability snapshot for every Site Engineer.
     */
    @Transactional(readOnly = true)
    public List<EngineerAvailabilityDto> getEngineerAvailability() {
        List<User> engineers = userRepository.findByRoleAndIsActiveTrue(UserRole.SITE_ENGINEER);
        Map<UUID, StaffProfile> profiles = profilesById();

        return engineers.stream()
                .map(u -> buildEngineerRow(u, profiles.get(u.getId())))
                .toList();
    }

    // ─────────────────────────────────────────────────────────────
    //  Internals
    // ─────────────────────────────────────────────────────────────

    private Map<UUID, StaffProfile> profilesById() {
        Map<UUID, StaffProfile> out = new HashMap<>();
        for (StaffProfile p : staffProfileRepository.findAll()) {
            out.put(p.getUserId(), p);
        }
        return out;
    }

    private CrmWorkloadDto buildCrmRow(User u, StaffProfile p, OffsetDateTime startOfToday) {
        long activeTickets = ticketRepository.countActiveByAssignee(u.getId());
        long activeInstalls = installationRepository.countActiveByOwner(u.getId());
        long pendingOffers = offerRepository.countByOfferedToIdAndOfferTypeAndStatus(
                u.getId(), OfferType.CRM_OWNER, OfferStatus.OFFERED);
        long resolvedToday = ticketRepository.countResolvedByAssigneeSince(u.getId(), startOfToday);

        int cap = p != null ? p.getMaxConcurrentLoad() : 8;
        long load = activeTickets + activeInstalls + pendingOffers;
        boolean overloaded = cap > 0 && (load * 100) >= (cap * 80L);

        return CrmWorkloadDto.builder()
                .userId(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .phoneNumber(u.getPhoneNumber())
                .role(u.getRole().name())
                .branch(p != null ? p.getBranch() : null)
                .onShift(p != null && Boolean.TRUE.equals(p.getOnShift()))
                .shiftStart(p != null && p.getShiftStart() != null ? p.getShiftStart().toString() : null)
                .shiftEnd(p != null && p.getShiftEnd() != null ? p.getShiftEnd().toString() : null)
                .activeTickets(activeTickets)
                .activeInstalls(activeInstalls)
                .pendingOffers(pendingOffers)
                .resolvedToday(resolvedToday)
                .maxConcurrentLoad(cap)
                .overloaded(overloaded)
                .avgResolutionMinutes(p != null ? p.getAvgResolutionMinutes() : null)
                .csatScore(p != null ? p.getCsatScore() : null)
                .build();
    }

    private EngineerAvailabilityDto buildEngineerRow(User u, StaffProfile p) {
        long activeJobs = ticketRepository.countActiveByEngineer(u.getId());
        long pendingOffers = offerRepository.countByOfferedToIdAndOfferTypeAndStatus(
                u.getId(), OfferType.ENGINEER_DISPATCH, OfferStatus.OFFERED);
        int cap = p != null ? p.getMaxConcurrentLoad() : 4;

        return EngineerAvailabilityDto.builder()
                .userId(u.getId())
                .name(u.getName())
                .phoneNumber(u.getPhoneNumber())
                .branch(p != null ? p.getBranch() : null)
                .onShift(p != null && Boolean.TRUE.equals(p.getOnShift()))
                .shiftStart(p != null && p.getShiftStart() != null ? p.getShiftStart().toString() : null)
                .shiftEnd(p != null && p.getShiftEnd() != null ? p.getShiftEnd().toString() : null)
                .skills(toList(p != null ? p.getSkills() : null))
                .localities(toList(p != null ? p.getLocalities() : null))
                .activeJobs(activeJobs)
                .pendingOffers(pendingOffers)
                .maxConcurrentLoad(cap)
                .overloaded(activeJobs + pendingOffers > cap)
                .avgResolutionMinutes(p != null ? p.getAvgResolutionMinutes() : null)
                .csatScore(p != null ? p.getCsatScore() : null)
                .build();
    }

    private static List<String> toList(String[] arr) {
        if (arr == null || arr.length == 0) return List.of();
        return Arrays.stream(arr).filter(Objects::nonNull).toList();
    }
}
