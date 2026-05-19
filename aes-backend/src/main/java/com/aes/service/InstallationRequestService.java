package com.aes.service;

import com.aes.config.AppProperties;
import com.aes.dto.request.CreateInstallationRequest;
import com.aes.dto.response.InstallationRequestResponse;
import com.aes.entity.InstallationRequest;
import com.aes.entity.Property;
import com.aes.entity.User;
import com.aes.enums.InstallationStatus;
import com.aes.enums.UserRole;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.InstallationRequestRepository;
import com.aes.repository.PropertyRepository;
import com.aes.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Year;
import java.util.List;
import java.util.UUID;

/**
 * Installation Request Service — creates and manages installation requests.
 *
 * Per Section 4.5 (lines 586-621):
 *   POST /api/v1/installation-requests  → create new installation request
 *   GET  /api/v1/installation-requests  → list (paginated, filtered)
 *   GET  /api/v1/installation-requests/{id}
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class InstallationRequestService {

    private final InstallationRequestRepository installationRequestRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;
    private final AppProperties appProperties;

    /**
     * Create a new installation request.
     * Per lines 590-614:
     *   1. Generate request number: REQ-{YYYY}-{4-digit-seq}
     *   2. Save installation request
     *   3. Send notification to customer
     *   4. Notify CRM agents
     */
    @Transactional
    public InstallationRequestResponse createInstallationRequest(UUID customerId,
                                                                  CreateInstallationRequest request) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("User", customerId.toString()));

        // Validate scheduled date is tomorrow or later
        if (request.getScheduledDate() != null && !request.getScheduledDate().isAfter(LocalDate.now())) {
            throw new BusinessException("INVALID_DATE", "Scheduled date must be tomorrow or later",
                    HttpStatus.BAD_REQUEST);
        }

        // Resolve property if ID provided
        Property property = null;
        if (request.getPropertyId() != null) {
            property = propertyRepository.findById(request.getPropertyId())
                    .orElseThrow(() -> new NotFoundException("Property", request.getPropertyId().toString()));

            if (!property.getCustomer().getId().equals(customerId)) {
                throw new BusinessException("FORBIDDEN", "Property does not belong to you",
                        HttpStatus.FORBIDDEN);
            }
        }

        // 1. Generate request number: REQ-{YYYY}-{4-digit-seq} (line 609)
        String requestNumber = generateRequestNumber();

        // Convert rooms to JSON
        String roomsJson = null;
        if (request.getRooms() != null && !request.getRooms().isEmpty()) {
            try {
                roomsJson = objectMapper.writeValueAsString(request.getRooms());
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize rooms JSON", e);
                roomsJson = "[]";
            }
        }

        // Annotate notes with the building type so sales / design see it
        // in the CRM list even though we don't have a dedicated column yet.
        String annotatedNotes = request.getNotes();
        if (request.getPropertyType() != null) {
            String label = "[Space: " + request.getPropertyType().name() + "]";
            annotatedNotes = annotatedNotes == null || annotatedNotes.isBlank()
                    ? label
                    : label + " " + annotatedNotes;
        }

        InstallationRequest installReq = InstallationRequest.builder()
                .requestNumber(requestNumber)
                .customer(customer)
                .property(property)
                .propertyAddress(request.getPropertyAddress())
                .acType(request.getAcType())
                .brand(request.getBrand())
                .modelNumber(request.getModelNumber())
                .tonnage(request.getTonnage())
                .energyRating(request.getEnergyRating())
                .roomsJson(roomsJson)
                .scheduledDate(request.getScheduledDate())
                .scheduledSlot(request.getScheduledSlot() != null ? request.getScheduledSlot().name() : null)
                .status(appProperties.getWorkflow().isOpsTriageEnabled()
                        ? InstallationStatus.NEW
                        : InstallationStatus.PENDING)
                .notes(annotatedNotes)
                .build();

        installReq = installationRequestRepository.save(installReq);
        log.info("Installation request created: {} by customer {}", requestNumber, customerId);

        // 4. Send notification to customer (line 612)
        notificationService.notifyInstallation(
                customerId,
                "Installation Request Received",
                "Your installation request " + requestNumber +
                        " has been received. Our team will contact you within 2 hours.",
                installReq.getId()
        );

        // 5. Notify the right inbox — Ops Manager triage queue if the
        //    workflow re-design is enabled, otherwise the legacy broadcast to
        //    every CRM agent (which is what the V4 demo expects).
        UserRole notifyRole = appProperties.getWorkflow().isOpsTriageEnabled()
                ? UserRole.OPS_MANAGER
                : UserRole.CRM_AGENT;
        String body = appProperties.getWorkflow().isOpsTriageEnabled()
                ? "New installation request " + requestNumber + " from " + customer.getName()
                        + " — needs triage (route to a CRM agent or site engineer for survey)."
                : "New installation request " + requestNumber + " from " + customer.getName();

        List<User> recipients = userRepository.findByRoleAndIsActiveTrue(notifyRole);
        for (User recipient : recipients) {
            notificationService.notifyInstallation(
                    recipient.getId(),
                    "New Installation Request",
                    body,
                    installReq.getId()
            );
        }

        return toResponse(installReq);
    }

    /**
     * List installation requests with pagination and filtering.
     * Per lines 616-618.
     */
    @Transactional(readOnly = true)
    public Page<InstallationRequestResponse> listInstallationRequests(
            UUID requesterId, UserRole role, String statusFilter, Pageable pageable) {

        Page<InstallationRequest> page;

        if (role == UserRole.CUSTOMER) {
            page = installationRequestRepository.findByCustomerIdOrderByCreatedAtDesc(requesterId, pageable);
        } else if (statusFilter != null && !statusFilter.isBlank()) {
            page = installationRequestRepository.findByStatusOrderByCreatedAtDesc(
                    parseInstallationStatus(statusFilter), pageable);
        } else {
            page = installationRequestRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        return page.map(this::toResponse);
    }

    private InstallationStatus parseInstallationStatus(String value) {
        try {
            return InstallationStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("INVALID_STATUS",
                    "Unknown installation status '" + value + "'. Valid values: PENDING, NEW, "
                            + "OFFERED_CRM, CONFIRMED, SURVEY_SCHEDULED, SITE_VISIT_DONE, SITE_VISITED, "
                            + "QUOTE_DRAFT, QUOTE_PENDING_APPROVAL, QUOTE_REJECTED_INTERNAL, QUOTE_SENT, "
                            + "QUOTE_NEGOTIATING, QUOTE_ACCEPTED, INSTALLATION_SCHEDULED, "
                            + "INSTALLATION_IN_PROGRESS, COMPLETED, CANCELLED.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Get a single installation request by ID.
     * Per lines 620-621.
     */
    @Transactional(readOnly = true)
    public InstallationRequestResponse getInstallationRequest(UUID requestId, UUID requesterId,
                                                               UserRole role) {
        InstallationRequest request = installationRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("InstallationRequest", requestId.toString()));

        // CUSTOMER can only access own requests
        if (role == UserRole.CUSTOMER && !request.getCustomer().getId().equals(requesterId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this request",
                    HttpStatus.FORBIDDEN);
        }

        return toResponse(request);
    }

    @Transactional(readOnly = true)
    public InstallationRequestResponse getByRequestNumber(String requestNumber, UUID requesterId,
                                                          UserRole role) {
        InstallationRequest request = installationRequestRepository.findByRequestNumber(requestNumber)
                .orElseThrow(() -> new NotFoundException("InstallationRequest", requestNumber));

        if (role == UserRole.CUSTOMER && !request.getCustomer().getId().equals(requesterId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this request",
                    HttpStatus.FORBIDDEN);
        }

        return toResponse(request);
    }

    /**
     * Generate request number: REQ-{YYYY}-{4-digit-seq} (line 609, 1664-1665).
     */
    private String generateRequestNumber() {
        Long seq = installationRequestRepository.getNextSequenceValue();
        // Runtime now matches the seeded demo prefix (PLAN.md F21).
        return String.format("INS-%d-%04d", Year.now().getValue(), seq);
    }

    /**
     * Convert entity to response DTO.
     */
    private InstallationRequestResponse toResponse(InstallationRequest req) {
        return InstallationRequestResponse.builder()
                .id(req.getId())
                .requestNumber(req.getRequestNumber())
                .customerId(req.getCustomer().getId())
                .propertyId(req.getProperty() != null ? req.getProperty().getId() : null)
                .propertyLabel(req.getProperty() != null ? req.getProperty().getLabel() : null)
                .propertyAddress(req.getPropertyAddress() != null ? req.getPropertyAddress() :
                        (req.getProperty() != null ? req.getProperty().getAddressLine1() : null))
                .acType(req.getAcType().name())
                .brand(req.getBrand())
                .modelNumber(req.getModelNumber())
                .tonnage(req.getTonnage())
                .energyRating(req.getEnergyRating())
                .roomsJson(req.getRoomsJson())
                .scheduledDate(req.getScheduledDate())
                .scheduledSlot(req.getScheduledSlot())
                .status(req.getStatus().name())
                .assignedEngineerName(req.getAssignedEngineer() != null ?
                        req.getAssignedEngineer().getName() : null)
                .estimatedCost(req.getEstimatedCost())
                .notes(req.getNotes())
                .createdAt(req.getCreatedAt())
                .updatedAt(req.getUpdatedAt())
                .build();
    }
}
