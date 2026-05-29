package com.aes.service;

import com.aes.entity.AcUnit;
import com.aes.entity.AmcUpgradeRequest;
import com.aes.entity.Property;
import com.aes.entity.User;
import com.aes.enums.NotificationType;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.AcUnitRepository;
import com.aes.repository.AmcUpgradeRequestRepository;
import com.aes.repository.PropertyRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Year;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Lifecycle of an "Upgrade to AMC" request.  See FLOW.md addendum.
 *
 * <ol>
 *   <li>Customer taps the CTA → request created with status {@code NEW}.</li>
 *   <li>Ops Manager picks it up from triage inbox → assigns a CRM agent
 *       → status {@code CONTACTED}.</li>
 *   <li>CRM calls the customer and drafts an AMC quote.</li>
 *   <li>Customer accepts → CRM converts → status {@code CONVERTED}, a real
 *       {@code amc_contracts} row is created.</li>
 *   <li>Or customer rejects → status {@code CANCELLED}.</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AmcUpgradeService {

    private final AmcUpgradeRequestRepository repo;
    private final UserRepository userRepo;
    private final PropertyRepository propertyRepo;
    private final AcUnitRepository acUnitRepo;
    private final NotificationService notificationService;

    @Transactional
    public AmcUpgradeRequest createRequest(UUID customerId,
                                           UUID propertyId,
                                           UUID acUnitId,
                                           String preferredPlan,
                                           String notes) {
        User customer = userRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer", customerId.toString()));

        Property property = propertyId == null ? null :
                propertyRepo.findById(propertyId).orElse(null);

        AcUnit acUnit = acUnitId == null ? null :
                acUnitRepo.findById(acUnitId).orElse(null);

        String number = "AMCUP-" + Year.now().getValue() + "-"
                + String.format("%04d", repo.getNextSequenceValue());

        AmcUpgradeRequest req = AmcUpgradeRequest.builder()
                .requestNumber(number)
                .customer(customer)
                .property(property)
                .acUnit(acUnit)
                .preferredPlan(preferredPlan == null ? "BASIC" : preferredPlan.toUpperCase())
                .notes(notes)
                .status("NEW")
                .build();

        AmcUpgradeRequest saved = repo.save(req);

        // Confirmation to the customer
        notificationService.createNotification(
                customer.getId(),
                "AMC upgrade request received",
                "We've received your AMC upgrade request " + number
                        + ". Our team will call you within 4 working hours to finalise your plan.",
                NotificationType.SYSTEM, saved.getId(), "AMC_UPGRADE"
        );

        // Notify all on-shift Ops Managers
        userRepo.findByRole(com.aes.enums.UserRole.OPS_MANAGER).forEach(ops ->
                notificationService.createNotification(
                        ops.getId(),
                        "New AMC upgrade lead",
                        customer.getName() + " requested an AMC upgrade (" + number + ").",
                        NotificationType.SYSTEM, saved.getId(), "AMC_UPGRADE"
                )
        );
        return saved;
    }

    @Transactional
    public AmcUpgradeRequest assignToCrm(UUID requestId, UUID crmId) {
        AmcUpgradeRequest req = repo.findById(requestId)
                .orElseThrow(() -> new NotFoundException("AmcUpgrade", requestId.toString()));
        User crm = userRepo.findById(crmId)
                .orElseThrow(() -> new NotFoundException("CrmUser", crmId.toString()));
        req.setAssignedCrm(crm);
        req.setAssignedAt(OffsetDateTime.now());
        if ("NEW".equals(req.getStatus())) req.setStatus("CONTACTED");
        AmcUpgradeRequest saved = repo.save(req);

        notificationService.createNotification(
                crm.getId(),
                "AMC upgrade assigned to you",
                "Please contact " + req.getCustomer().getName() + " about request " + req.getRequestNumber(),
                NotificationType.SYSTEM, saved.getId(), "AMC_UPGRADE"
        );
        return saved;
    }

    @Transactional
    public AmcUpgradeRequest markContacted(UUID requestId) {
        AmcUpgradeRequest req = repo.findById(requestId)
                .orElseThrow(() -> new NotFoundException("AmcUpgrade", requestId.toString()));
        req.setStatus("CONTACTED");
        req.setContactedAt(OffsetDateTime.now());
        return repo.save(req);
    }

    @Transactional
    public AmcUpgradeRequest cancel(UUID requestId, String reason) {
        AmcUpgradeRequest req = repo.findById(requestId)
                .orElseThrow(() -> new NotFoundException("AmcUpgrade", requestId.toString()));
        if ("CONVERTED".equals(req.getStatus())) {
            throw new BusinessException("ALREADY_CONVERTED", "Request was already converted to an AMC");
        }
        req.setStatus("CANCELLED");
        req.setCancelledAt(OffsetDateTime.now());
        req.setCancellationReason(reason);
        return repo.save(req);
    }

    public List<AmcUpgradeRequest> openRequests() {
        return repo.findByStatusInOrderByCreatedAtDesc(
                List.of("NEW", "CONTACTED", "QUOTED"));
    }

    public List<AmcUpgradeRequest> requestsForCustomer(UUID customerId) {
        return repo.findByCustomerIdOrderByCreatedAtDesc(customerId);
    }
}
