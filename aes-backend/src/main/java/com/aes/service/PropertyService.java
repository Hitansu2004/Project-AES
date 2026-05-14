package com.aes.service;

import com.aes.dto.request.CreatePropertyRequest;
import com.aes.dto.request.UpdatePropertyRequest;
import com.aes.dto.response.AcUnitResponse;
import com.aes.dto.response.PropertyResponse;
import com.aes.entity.AcUnit;
import com.aes.entity.Property;
import com.aes.entity.User;
import com.aes.enums.PropertyType;
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

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Property Service — CRUD operations for customer properties.
 *
 * Per Section 4.3 (lines 551-568):
 *   GET /api/v1/properties              → list own properties with AC count
 *   POST /api/v1/properties             → create new property
 *   GET /api/v1/properties/{id}         → property with full AC units list
 *   PUT /api/v1/properties/{id}         → update property
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class PropertyService {

    private final PropertyRepository propertyRepository;
    private final AcUnitRepository acUnitRepository;
    private final UserRepository userRepository;

    /**
     * List all properties for a customer with AC unit count (line 555-557).
     */
    public List<PropertyResponse> getCustomerProperties(UUID customerId) {
        List<Property> properties = propertyRepository
                .findByCustomerIdOrderByIsPrimaryDescCreatedAtDesc(customerId);

        return properties.stream()
                .map(p -> toResponse(p, false))
                .collect(Collectors.toList());
    }

    /**
     * Create a new property for a customer (line 559-561).
     */
    @Transactional
    public PropertyResponse createProperty(UUID customerId, CreatePropertyRequest request) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new NotFoundException("User", customerId.toString()));

        // If this is set as primary, unset other primaries
        if (Boolean.TRUE.equals(request.getIsPrimary())) {
            unsetOtherPrimaries(customerId);
        }

        Property property = Property.builder()
                .customer(customer)
                .label(request.getLabel())
                .addressLine1(request.getAddressLine1())
                .addressLine2(request.getAddressLine2())
                .city(request.getCity() != null ? request.getCity() : "Hyderabad")
                .pincode(request.getPincode())
                .propertyType(PropertyType.valueOf(request.getPropertyType()))
                .isPrimary(request.getIsPrimary() != null ? request.getIsPrimary() : false)
                .build();

        property = propertyRepository.save(property);
        log.info("Property created: {} for customer {}", property.getId(), customerId);

        return toResponse(property, false);
    }

    /**
     * Get a single property with full AC units list (line 563-565).
     * CUSTOMER can access own properties, ADMIN can access any.
     */
    public PropertyResponse getPropertyById(UUID propertyId, UUID requesterId, boolean isAdmin) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Property", propertyId.toString()));

        // Authorization: CUSTOMER can only access own properties
        if (!isAdmin && !property.getCustomer().getId().equals(requesterId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this property",
                    HttpStatus.FORBIDDEN);
        }

        return toResponse(property, true);
    }

    /**
     * Update a property (line 567-568).
     */
    @Transactional
    public PropertyResponse updateProperty(UUID propertyId, UUID customerId, UpdatePropertyRequest request) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NotFoundException("Property", propertyId.toString()));

        if (!property.getCustomer().getId().equals(customerId)) {
            throw new BusinessException("FORBIDDEN", "You do not have access to this property",
                    HttpStatus.FORBIDDEN);
        }

        if (request.getLabel() != null) property.setLabel(request.getLabel());
        if (request.getAddressLine1() != null) property.setAddressLine1(request.getAddressLine1());
        if (request.getAddressLine2() != null) property.setAddressLine2(request.getAddressLine2());
        if (request.getCity() != null) property.setCity(request.getCity());
        if (request.getPincode() != null) property.setPincode(request.getPincode());
        if (request.getPropertyType() != null) property.setPropertyType(PropertyType.valueOf(request.getPropertyType()));
        if (request.getIsPrimary() != null) {
            if (Boolean.TRUE.equals(request.getIsPrimary())) {
                unsetOtherPrimaries(customerId);
            }
            property.setIsPrimary(request.getIsPrimary());
        }

        propertyRepository.save(property);
        return toResponse(property, false);
    }

    /**
     * Unset all other primary properties for this customer.
     */
    private void unsetOtherPrimaries(UUID customerId) {
        List<Property> primaries = propertyRepository
                .findByCustomerIdOrderByIsPrimaryDescCreatedAtDesc(customerId);
        primaries.stream()
                .filter(Property::getIsPrimary)
                .forEach(p -> {
                    p.setIsPrimary(false);
                    propertyRepository.save(p);
                });
    }

    /**
     * Convert entity to response DTO.
     */
    private PropertyResponse toResponse(Property property, boolean includeAcUnits) {
        PropertyResponse.PropertyResponseBuilder builder = PropertyResponse.builder()
                .id(property.getId())
                .label(property.getLabel())
                .addressLine1(property.getAddressLine1())
                .addressLine2(property.getAddressLine2())
                .city(property.getCity())
                .pincode(property.getPincode())
                .propertyType(property.getPropertyType().name())
                .isPrimary(property.getIsPrimary())
                .acUnitsCount(acUnitRepository.countByPropertyId(property.getId()))
                .createdAt(property.getCreatedAt());

        if (includeAcUnits) {
            List<AcUnit> units = acUnitRepository.findByPropertyIdAndIsActiveTrue(property.getId());
            builder.acUnits(units.stream().map(this::toAcUnitResponse).collect(Collectors.toList()));
        }

        return builder.build();
    }

    private AcUnitResponse toAcUnitResponse(AcUnit unit) {
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
