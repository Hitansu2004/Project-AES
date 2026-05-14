package com.aes.repository;

import com.aes.entity.InstallationRequest;
import com.aes.enums.InstallationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface InstallationRequestRepository extends JpaRepository<InstallationRequest, UUID> {

    Page<InstallationRequest> findByCustomerIdOrderByCreatedAtDesc(UUID customerId, Pageable pageable);

    Page<InstallationRequest> findByStatusOrderByCreatedAtDesc(InstallationStatus status, Pageable pageable);

    Page<InstallationRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Optional<InstallationRequest> findByRequestNumber(String requestNumber);

    @Query(value = "SELECT nextval('installation_req_seq')", nativeQuery = true)
    Long getNextSequenceValue();
}
