package com.aes.repository;

import com.aes.entity.AmcUpgradeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AmcUpgradeRequestRepository extends JpaRepository<AmcUpgradeRequest, UUID> {

    Optional<AmcUpgradeRequest> findByRequestNumber(String requestNumber);

    /**
     * Eager-fetched lookups — every read endpoint flattens the entity to a Map in
     * the controller, so we need {@code customer / property / acUnit / assignedCrm}
     * loaded up front to avoid {@code LazyInitializationException} once the
     * Hibernate session closes.
     */
    @Query("""
        SELECT DISTINCT r FROM AmcUpgradeRequest r
        LEFT JOIN FETCH r.customer
        LEFT JOIN FETCH r.property
        LEFT JOIN FETCH r.acUnit
        LEFT JOIN FETCH r.assignedCrm
        WHERE r.status IN :statuses
        ORDER BY r.createdAt DESC
    """)
    List<AmcUpgradeRequest> findByStatusInOrderByCreatedAtDesc(@Param("statuses") List<String> statuses);

    @Query("""
        SELECT DISTINCT r FROM AmcUpgradeRequest r
        LEFT JOIN FETCH r.customer
        LEFT JOIN FETCH r.property
        LEFT JOIN FETCH r.acUnit
        LEFT JOIN FETCH r.assignedCrm
        WHERE r.customer.id = :customerId
        ORDER BY r.createdAt DESC
    """)
    List<AmcUpgradeRequest> findByCustomerIdOrderByCreatedAtDesc(@Param("customerId") UUID customerId);

    @Query("""
        SELECT DISTINCT r FROM AmcUpgradeRequest r
        LEFT JOIN FETCH r.customer
        LEFT JOIN FETCH r.property
        LEFT JOIN FETCH r.acUnit
        LEFT JOIN FETCH r.assignedCrm
        WHERE r.assignedCrm.id = :crmId
        ORDER BY r.createdAt DESC
    """)
    List<AmcUpgradeRequest> findByAssignedCrmIdOrderByCreatedAtDesc(@Param("crmId") UUID crmId);

    @Query(value = "SELECT nextval('amc_upgrade_seq')", nativeQuery = true)
    Long getNextSequenceValue();
}
