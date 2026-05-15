package com.aes.service;

import com.aes.dto.request.CreateAcUnitRequest;
import com.aes.dto.request.UpdateAcUnitRequest;
import com.aes.dto.response.AcUnitResponse;
import com.aes.entity.AcUnit;
import com.aes.entity.Property;
import com.aes.entity.User;
import com.aes.enums.ServiceStatus;
import com.aes.enums.WarrantyStatus;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.AcUnitRepository;
import com.aes.repository.PropertyRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * AC Unit Service — CRUD operations for AC units.
 *
 * Per Section 4.4 (lines 570-584):
 *   GET /api/v1/properties/{propertyId}/ac-units   → list AC units with warranty/service status
 *   POST /api/v1/properties/{propertyId}/ac-units  → add AC unit to property
 *   PUT /api/v1/ac-units/{acUnitId}                → update AC unit
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AcUnitService {

    private final AcUnitRepository acUnitRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;

    /**
     * List AC units for a property (line 574-576).
     */
    public List<AcUnitResponse> getAcUnitsByProperty(UUID propertyId, UUID customerId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Property", propertyId.toString()));

        // Verify ownership
        if (!property.getCustomer().getId().equals(customerId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this property",
                    HttpStatus.FORBIDDEN);
        }

        return acUnitRepository.findByPropertyIdAndIsActiveTrue(propertyId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Create an AC unit for a property (lines 578-581).
     */
    @Transactional
    public AcUnitResponse createAcUnit(UUID propertyId, UUID customerId, CreateAcUnitRequest request) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Property", propertyId.toString()));

        if (!property.getCustomer().getId().equals(customerId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this property",
                    HttpStatus.FORBIDDEN);
        }

        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("User", customerId.toString()));

        AcUnit acUnit = AcUnit.builder()
                .property(property)
                .customer(customer)
                .roomLabel(request.getRoomLabel())
                .acType(request.getAcType())
                .brand(request.getBrand())
                .modelNumber(request.getModelNumber())
                .tonnage(request.getTonnage())
                .energyStarRating(request.getEnergyStarRating())
                .installationDate(request.getInstallationDate())
                .warrantyExpiry(request.getWarrantyExpiry())
                .warrantyStatus(WarrantyStatus.UNKNOWN)
                .serviceStatus(ServiceStatus.P3_PAID)
                .isActive(true)
                .build();

        // Auto-derive warranty + service status from expiry date when provided.
        if (request.getWarrantyExpiry() != null) {
            if (request.getWarrantyExpiry().isAfter(LocalDate.now())) {
                acUnit.setWarrantyStatus(WarrantyStatus.IN_WARRANTY);
                acUnit.setServiceStatus(ServiceStatus.P2_WARRANTY);
            } else {
                acUnit.setWarrantyStatus(WarrantyStatus.EXPIRED);
            }
        }

        acUnit = acUnitRepository.save(acUnit);
        log.info("AC unit created: {} in property {} room {}", acUnit.getId(), propertyId, request.getRoomLabel());

        return toResponse(acUnit);
    }

    /**
     * Update an AC unit (line 583-584).
     * CUSTOMER (own) or ADMIN can update.
     */
    @Transactional
    public AcUnitResponse updateAcUnit(UUID acUnitId, UUID requesterId, boolean isAdmin, UpdateAcUnitRequest request) {
        AcUnit acUnit = acUnitRepository.findById(acUnitId)
                .orElseThrow(() -> new NotFoundException("AcUnit", acUnitId.toString()));

        // Authorization check
        if (!isAdmin && !acUnit.getCustomer().getId().equals(requesterId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this AC unit",
                    HttpStatus.FORBIDDEN);
        }

        if (request.getRoomLabel() != null) acUnit.setRoomLabel(request.getRoomLabel());
        if (request.getAcType() != null) acUnit.setAcType(request.getAcType());
        if (request.getBrand() != null) acUnit.setBrand(request.getBrand());
        if (request.getModelNumber() != null) acUnit.setModelNumber(request.getModelNumber());
        if (request.getTonnage() != null) acUnit.setTonnage(request.getTonnage());
        if (request.getEnergyStarRating() != null) acUnit.setEnergyStarRating(request.getEnergyStarRating());
        if (request.getInstallationDate() != null) acUnit.setInstallationDate(request.getInstallationDate());
        if (request.getWarrantyExpiry() != null) acUnit.setWarrantyExpiry(request.getWarrantyExpiry());
        if (request.getWarrantyStatus() != null) acUnit.setWarrantyStatus(request.getWarrantyStatus());
        if (request.getServiceStatus() != null) acUnit.setServiceStatus(request.getServiceStatus());

        acUnitRepository.save(acUnit);
        return toResponse(acUnit);
    }

    /**
     * Convert entity to response DTO.
     */
    private AcUnitResponse toResponse(AcUnit unit) {
        return AcUnitResponse.builder()
                .id(unit.getId())
                .propertyId(unit.getProperty().getId())
                .roomLabel(unit.getRoomLabel())
                .acType(unit.getAcType().name())
                .brand(unit.getBrand())
                .modelNumber(unit.getModelNumber())
                .tonnage(unit.getTonnage())
                .energyStarRating(unit.getEnergyStarRating())
                .installationDate(unit.getInstallationDate())
                .warrantyExpiry(unit.getWarrantyExpiry())
                .warrantyStatus(unit.getWarrantyStatus().name())
                .serviceStatus(unit.getServiceStatus().name())
                .createdAt(unit.getCreatedAt())
                .build();
    }
}
