package com.aes.repository;

import com.aes.entity.AcUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AcUnitRepository extends JpaRepository<AcUnit, UUID> {

    List<AcUnit> findByPropertyIdAndIsActiveTrue(UUID propertyId);

    List<AcUnit> findByCustomerIdAndIsActiveTrue(UUID customerId);

    long countByCustomerId(UUID customerId);

    long countByPropertyId(UUID propertyId);
}
