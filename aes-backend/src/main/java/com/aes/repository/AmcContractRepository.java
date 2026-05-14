package com.aes.repository;

import com.aes.entity.AmcContract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AmcContractRepository extends JpaRepository<AmcContract, UUID> {

    List<AmcContract> findByCustomerIdAndIsActiveTrue(UUID customerId);

    List<AmcContract> findByCustomerId(UUID customerId);

    Optional<AmcContract> findByContractNumber(String contractNumber);
}
