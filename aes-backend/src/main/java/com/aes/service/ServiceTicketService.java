package com.aes.service;

import com.aes.config.AppProperties;
import com.aes.dto.request.CreateTicketRequest;
import com.aes.dto.response.SlaStatusResponse;
import com.aes.dto.response.TicketResponse;
import com.aes.entity.*;
import com.aes.enums.*;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.*;
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
import java.time.OffsetDateTime;
import java.time.Year;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service Ticket Service — creates and queries service tickets.
 *
 * Per Section 4.6 (lines 624-665):
 *   POST /api/v1/service-tickets          → create ticket with SLA
 *   GET  /api/v1/service-tickets          → list with role-based filtering
 *   GET  /api/v1/service-tickets/{number} → full ticket detail
 *   GET  .../sla-status                   → SLA remaining seconds
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ServiceTicketService {

    private static final int MAX_PHOTO_URLS = 4;

    private final ServiceTicketRepository ticketRepository;
    private final AcUnitRepository acUnitRepository;
    private final TicketActivityRepository activityRepository;
    private final TicketEscalationLogRepository escalationLogRepository;
    private final AssignmentService assignmentService;
    private final NotificationService notificationService;
    private final WebSocketService webSocketService;
    private final ObjectMapper objectMapper;
    private final AppProperties appProperties;

    /**
     * Create a new service ticket.
     * Per lines 627-654 — ALL 10 steps implemented.
     */
    @Transactional
    public TicketResponse createTicket(UUID customerId, CreateTicketRequest request) {
        AcUnit acUnit = acUnitRepository.findById(request.getAcUnitId())
                .orElseThrow(() -> new NotFoundException("AcUnit", request.getAcUnitId().toString()));

        if (!acUnit.getCustomer().getId().equals(customerId)) {
            throw new BusinessException("FORBIDDEN", "This AC unit does not belong to you",
                    HttpStatus.FORBIDDEN);
        }

        // Per Section 7 line 1688 — scheduled date must be tomorrow or later.
        if (request.getScheduledDate() != null
                && !request.getScheduledDate().isAfter(LocalDate.now())) {
            throw new BusinessException("INVALID_DATE",
                    "Scheduled date must be tomorrow or later.",
                    HttpStatus.BAD_REQUEST);
        }

        User customer = acUnit.getCustomer();

        Priority priority = determinePriority(acUnit.getServiceStatus());
        ServiceType serviceType = determineServiceType(acUnit.getServiceStatus());
        String ticketNumber = generateTicketNumber();

        String photosJson = serializePhotos(request.getPhotoUrls());

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime slaDeadlineL1 = now.plusMinutes(appProperties.getEscalation().getL1TimeoutMinutes());
        OffsetDateTime slaDeadlineFinal = calculateFinalSla(now, priority);

        User assignedAgent = assignmentService.getNextAvailableCrmAgent();

        ServiceTicket ticket = ServiceTicket.builder()
                .ticketNumber(ticketNumber)
                .customer(customer)
                .property(acUnit.getProperty())
                .acUnit(acUnit)
                .priority(priority)
                .serviceType(serviceType)
                .problemCategory(request.getProblemCategory())
                .errorCode(request.getErrorCode())
                .problemDescription(request.getProblemDescription())
                .photosJson(photosJson)
                .scheduledDate(request.getScheduledDate())
                .scheduledSlot(request.getScheduledSlot() != null ? request.getScheduledSlot().name() : null)
                .currentLevel(1)
                .currentAssignee(assignedAgent)
                .assignedAt(now)
                .status(TicketStatus.OPEN)
                .slaDeadlineL1(slaDeadlineL1)
                .slaDeadlineFinal(slaDeadlineFinal)
                .build();

        ticket = ticketRepository.save(ticket);

        createActivity(ticket, customer, ActivityType.TICKET_RAISED,
                "Ticket raised by customer");
        createActivity(ticket, null, ActivityType.ASSIGNED,
                "Assigned to CRM Level 1: " + assignedAgent.getName());

        int l1Minutes = appProperties.getEscalation().getL1TimeoutMinutes();
        notificationService.notifyUser(customerId,
                "Ticket " + ticketNumber + " raised",
                "Your service ticket " + ticketNumber + " has been raised. "
                        + "Our CRM team will respond within " + l1Minutes + " minutes.",
                NotificationType.TICKET_RAISED, ticket.getId());

        notificationService.notifyUser(assignedAgent.getId(),
                "New ticket assigned",
                "Ticket " + ticketNumber + " has been assigned to you. Priority: " + priority.name(),
                NotificationType.TICKET_ASSIGNED, ticket.getId());

        webSocketService.broadcastNewTicketToCrm(ticketNumber, priority.name(), customer.getName());

        log.info("Service ticket created: {} priority={} assignedTo={}",
                ticketNumber, priority, assignedAgent.getName());

        return toFullResponse(ticket);
    }

    private String serializePhotos(List<String> photoUrls) {
        if (photoUrls == null || photoUrls.isEmpty()) {
            return null;
        }
        if (photoUrls.size() > MAX_PHOTO_URLS) {
            throw new BusinessException("VALIDATION_ERROR",
                    "A maximum of " + MAX_PHOTO_URLS + " photos is allowed.",
                    HttpStatus.BAD_REQUEST);
        }
        try {
            return objectMapper.writeValueAsString(photoUrls);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize photo URLs; persisting empty array instead", e);
            return "[]";
        }
    }

    /**
     * List service tickets with role-based filtering.
     * Per lines 656-661.
     */
    @Transactional(readOnly = true)
    public Page<TicketResponse> listTickets(UUID requesterId, UserRole role,
                                             String statusFilter, Pageable pageable) {
        Page<ServiceTicket> page;

        switch (role) {
            case CUSTOMER -> {
                if (statusFilter != null && !statusFilter.isBlank()) {
                    TicketStatus status = parseTicketStatus(statusFilter);
                    page = ticketRepository.findByCustomerIdAndStatusOrderByCreatedAtDesc(
                            requesterId, status, pageable);
                } else {
                    page = ticketRepository.findByCustomerIdOrderByCreatedAtDesc(requesterId, pageable);
                }
            }
            case CRM_AGENT -> page = ticketRepository
                    .findByCurrentLevelAndCurrentAssigneeIdOrderByCreatedAtDesc(1, requesterId, pageable);
            case SERVICE_MANAGER -> page = ticketRepository
                    .findByCurrentLevelOrderByCreatedAtDesc(2, pageable);
            case ADMIN -> page = ticketRepository.findAllByOrderByCreatedAtDesc(pageable);
            default -> page = ticketRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        return page.map(this::toSummaryResponse);
    }

    private TicketStatus parseTicketStatus(String value) {
        try {
            return TicketStatus.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("INVALID_STATUS",
                    "Unknown ticket status '" + value + "'. Valid values: OPEN, ACKNOWLEDGED, "
                            + "ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Get full ticket detail by ticket number.
     * Per lines 663-665.
     */
    @Transactional(readOnly = true)
    public TicketResponse getTicketByNumber(String ticketNumber, UUID requesterId, UserRole role) {
        ServiceTicket ticket = ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));

        // CUSTOMER can only see own tickets
        if (role == UserRole.CUSTOMER && !ticket.getCustomer().getId().equals(requesterId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this ticket",
                    HttpStatus.FORBIDDEN);
        }

        return toFullResponse(ticket);
    }

    /**
     * Get SLA status for a ticket.
     * Per lines 711-724.
     */
    @Transactional(readOnly = true)
    public SlaStatusResponse getSlaStatus(String ticketNumber) {
        ServiceTicket ticket = ticketRepository.findByTicketNumber(ticketNumber)
                .orElseThrow(() -> new NotFoundException("ServiceTicket", ticketNumber));

        OffsetDateTime now = OffsetDateTime.now();

        return SlaStatusResponse.builder()
                .ticketNumber(ticket.getTicketNumber())
                .currentLevel(ticket.getCurrentLevel())
                .status(ticket.getStatus().name())
                .slaDeadlineL1(ticket.getSlaDeadlineL1())
                .slaRemainingSecondsL1(calculateRemaining(ticket.getSlaDeadlineL1(), now))
                .slaDeadlineL2(ticket.getSlaDeadlineL2())
                .slaRemainingSecondsL2(calculateRemaining(ticket.getSlaDeadlineL2(), now))
                .slaDeadlineFinal(ticket.getSlaDeadlineFinal())
                .slaRemainingSecondsFinal(calculateRemaining(ticket.getSlaDeadlineFinal(), now))
                .isL1Breached(ticket.getSlaDeadlineL1() != null && now.isAfter(ticket.getSlaDeadlineL1()))
                .isL2Breached(ticket.getSlaDeadlineL2() != null && now.isAfter(ticket.getSlaDeadlineL2()))
                .isFinalBreached(ticket.getSlaDeadlineFinal() != null && now.isAfter(ticket.getSlaDeadlineFinal()))
                .build();
    }

    // ─── Internal helpers ───────────────────────────────────────────────

    /**
     * Determine priority from AC unit service_status.
     * P1_AMC → P1, P2_WARRANTY → P2, P3_PAID → P3
     */
    private Priority determinePriority(ServiceStatus serviceStatus) {
        return switch (serviceStatus) {
            case P1_AMC -> Priority.P1;
            case P2_WARRANTY -> Priority.P2;
            case P3_PAID -> Priority.P3;
        };
    }

    private ServiceType determineServiceType(ServiceStatus serviceStatus) {
        return switch (serviceStatus) {
            case P1_AMC -> ServiceType.AMC;
            case P2_WARRANTY -> ServiceType.WARRANTY;
            case P3_PAID -> ServiceType.PAID;
        };
    }

    /**
     * Calculate final SLA deadline.
     * P1: 4 hours, P2: 8 hours, P3: 24 hours (line 645).
     */
    private OffsetDateTime calculateFinalSla(OffsetDateTime createdAt, Priority priority) {
        return switch (priority) {
            case P1 -> createdAt.plusHours(4);
            case P2 -> createdAt.plusHours(8);
            case P3 -> createdAt.plusHours(24);
        };
    }

    private Long calculateRemaining(OffsetDateTime deadline, OffsetDateTime now) {
        if (deadline == null) return null;
        long remaining = ChronoUnit.SECONDS.between(now, deadline);
        return Math.max(0, remaining);
    }

    private String generateTicketNumber() {
        Long seq = ticketRepository.getNextTicketSequence();
        return String.format("TKT-%d-%04d", Year.now().getValue(), seq);
    }

    void createActivity(ServiceTicket ticket, User user, ActivityType type, String description) {
        TicketActivity activity = TicketActivity.builder()
                .ticket(ticket)
                .user(user)
                .activityType(type)
                .description(description)
                .build();
        activityRepository.save(activity);
    }

    /**
     * Full response including activities + escalation logs.
     */
    TicketResponse toFullResponse(ServiceTicket ticket) {
        OffsetDateTime now = OffsetDateTime.now();
        TicketResponse.TicketResponseBuilder builder = buildBaseResponse(ticket, now);

        // Load activities
        List<TicketActivity> activities = activityRepository
                .findByTicketIdOrderByCreatedAtAsc(ticket.getId());
        builder.activities(activities.stream().map(a ->
                TicketResponse.ActivityResponse.builder()
                        .id(a.getId())
                        .activityType(a.getActivityType().name())
                        .description(a.getDescription())
                        .metadataJson(a.getMetadataJson())
                        .userId(a.getUser() != null ? a.getUser().getId() : null)
                        .userName(a.getUser() != null ? a.getUser().getName() : null)
                        .createdAt(a.getCreatedAt())
                        .build()
        ).collect(Collectors.toList()));

        // Load escalation logs
        List<TicketEscalationLog> logs = escalationLogRepository
                .findByTicketIdOrderByEscalatedAtAsc(ticket.getId());
        builder.escalationLogs(logs.stream().map(l ->
                TicketResponse.EscalationLogResponse.builder()
                        .id(l.getId())
                        .fromLevel(l.getFromLevel())
                        .toLevel(l.getToLevel())
                        .fromUserId(l.getFromUserId())
                        .reason(l.getReason())
                        .escalationType(l.getEscalationType().name())
                        .escalatedAt(l.getEscalatedAt())
                        .build()
        ).collect(Collectors.toList()));

        return builder.build();
    }

    /**
     * Summary response without activities/logs (for list views).
     */
    private TicketResponse toSummaryResponse(ServiceTicket ticket) {
        return buildBaseResponse(ticket, OffsetDateTime.now()).build();
    }

    private TicketResponse.TicketResponseBuilder buildBaseResponse(ServiceTicket ticket, OffsetDateTime now) {
        return TicketResponse.builder()
                .id(ticket.getId())
                .ticketNumber(ticket.getTicketNumber())
                .customerId(ticket.getCustomer().getId())
                .customerName(ticket.getCustomer().getName())
                .acUnitId(ticket.getAcUnit().getId())
                .acUnitRoom(ticket.getAcUnit().getRoomLabel())
                .acBrand(ticket.getAcUnit().getBrand())
                .acModel(ticket.getAcUnit().getModelNumber())
                .propertyId(ticket.getProperty().getId())
                .propertyLabel(ticket.getProperty().getLabel())
                .priority(ticket.getPriority().name())
                .serviceType(ticket.getServiceType().name())
                .problemCategory(ticket.getProblemCategory().name())
                .errorCode(ticket.getErrorCode())
                .problemDescription(ticket.getProblemDescription())
                .photosJson(ticket.getPhotosJson())
                .scheduledDate(ticket.getScheduledDate())
                .scheduledSlot(ticket.getScheduledSlot())
                .currentLevel(ticket.getCurrentLevel())
                .currentAssigneeId(ticket.getCurrentAssignee() != null ?
                        ticket.getCurrentAssignee().getId() : null)
                .currentAssigneeName(ticket.getCurrentAssignee() != null ?
                        ticket.getCurrentAssignee().getName() : null)
                .assignedAt(ticket.getAssignedAt())
                .status(ticket.getStatus().name())
                .acknowledgedAt(ticket.getAcknowledgedAt())
                .resolvedAt(ticket.getResolvedAt())
                .closedAt(ticket.getClosedAt())
                .slaDeadlineL1(ticket.getSlaDeadlineL1())
                .slaDeadlineL2(ticket.getSlaDeadlineL2())
                .slaDeadlineFinal(ticket.getSlaDeadlineFinal())
                .slaRemainingSecondsL1(calculateRemaining(ticket.getSlaDeadlineL1(), now))
                .slaRemainingSecondsL2(calculateRemaining(ticket.getSlaDeadlineL2(), now))
                .slaRemainingSecondsFinal(calculateRemaining(ticket.getSlaDeadlineFinal(), now))
                .isL1Breached(ticket.getSlaDeadlineL1() != null && now.isAfter(ticket.getSlaDeadlineL1()))
                .isL2Breached(ticket.getSlaDeadlineL2() != null && now.isAfter(ticket.getSlaDeadlineL2()))
                .isFinalBreached(ticket.getSlaDeadlineFinal() != null && now.isAfter(ticket.getSlaDeadlineFinal()))
                .estimatedCharge(ticket.getEstimatedCharge())
                .finalCharge(ticket.getFinalCharge())
                .chargeAccepted(ticket.getChargeAccepted())
                .customerRating(ticket.getCustomerRating())
                .customerFeedback(ticket.getCustomerFeedback())
                .createdAt(ticket.getCreatedAt())
                .updatedAt(ticket.getUpdatedAt());
    }
}
