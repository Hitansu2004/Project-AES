package com.aes.service;

import com.aes.dto.request.ScheduleVisitRequest;
import com.aes.dto.response.AmcContractResponse;
import com.aes.entity.AmcContract;
import com.aes.entity.AmcVisit;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.AmcContractRepository;
import com.aes.repository.AmcVisitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * AMC Service — manages AMC contracts and visits.
 *
 * Per Section 4.10 (lines 836-850):
 *   GET /api/v1/amc/my-contracts              → list own contracts with visits
 *   GET /api/v1/amc/contracts/{contractId}     → full contract detail
 *   POST /api/v1/amc/visits/{visitId}/schedule → schedule a visit
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AmcService {

    private final AmcContractRepository contractRepository;
    private final AmcVisitRepository visitRepository;

    /**
     * List AMC contracts for a customer with visit schedule (line 840-842).
     */
    @Transactional(readOnly = true)
    public List<AmcContractResponse> getCustomerContracts(UUID customerId) {
        List<AmcContract> contracts = contractRepository.findByCustomerId(customerId);

        return contracts.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get full AMC contract detail (lines 844-846).
     * CUSTOMER (own) or ADMIN.
     */
    @Transactional(readOnly = true)
    public AmcContractResponse getContractById(UUID contractId, UUID requesterId, boolean isAdmin) {
        AmcContract contract = contractRepository.findById(contractId)
                .orElseThrow(() -> new NotFoundException("AmcContract", contractId.toString()));

        if (!isAdmin && !contract.getCustomer().getId().equals(requesterId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this contract",
                    HttpStatus.FORBIDDEN);
        }

        return toResponse(contract);
    }

    /**
     * Schedule an AMC visit (lines 848-850).
     */
    @Transactional
    public AmcContractResponse.AmcVisitResponse scheduleVisit(UUID visitId, UUID requesterId,
                                                               boolean isAdmin,
                                                               ScheduleVisitRequest request) {
        AmcVisit visit = visitRepository.findById(visitId)
                .orElseThrow(() -> new NotFoundException("AmcVisit", visitId.toString()));

        // Verify ownership
        if (!isAdmin && !visit.getContract().getCustomer().getId().equals(requesterId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this visit",
                    HttpStatus.FORBIDDEN);
        }

        visit.setScheduledDate(request.getScheduledDate());
        visit.setScheduledTimeSlot(request.getScheduledSlot());
        visit.setStatus("SCHEDULED");
        visitRepository.save(visit);

        log.info("AMC visit {} scheduled for {}", visitId, request.getScheduledDate());

        return toVisitResponse(visit);
    }

    /**
     * Convert contract entity to response DTO with visits.
     */
    private AmcContractResponse toResponse(AmcContract contract) {
        List<AmcVisit> visits = visitRepository
                .findByContractIdOrderByVisitNumberAsc(contract.getId());

        return AmcContractResponse.builder()
                .id(contract.getId())
                .contractNumber(contract.getContractNumber())
                .customerId(contract.getCustomer().getId())
                .propertyId(contract.getProperty().getId())
                .propertyLabel(contract.getProperty().getLabel())
                .startDate(contract.getStartDate())
                .endDate(contract.getEndDate())
                .visitsPerYear(contract.getVisitsPerYear())
                .visitsCompleted(contract.getVisitsCompleted())
                .isActive(contract.getIsActive())
                .assignedEngineerName(contract.getAssignedEngineer() != null ?
                        contract.getAssignedEngineer().getName() : null)
                .contractValue(contract.getContractValue())
                .notes(contract.getNotes())
                .createdAt(contract.getCreatedAt())
                .visits(visits.stream().map(this::toVisitResponse).collect(Collectors.toList()))
                .build();
    }

    private AmcContractResponse.AmcVisitResponse toVisitResponse(AmcVisit visit) {
        return AmcContractResponse.AmcVisitResponse.builder()
                .id(visit.getId())
                .visitNumber(visit.getVisitNumber())
                .scheduledDate(visit.getScheduledDate())
                .scheduledTimeSlot(visit.getScheduledTimeSlot())
                .actualVisitDate(visit.getActualVisitDate())
                .engineerName(visit.getEngineer() != null ? visit.getEngineer().getName() : null)
                .status(visit.getStatus())
                .notes(visit.getNotes())
                .createdAt(visit.getCreatedAt())
                .build();
    }
}
