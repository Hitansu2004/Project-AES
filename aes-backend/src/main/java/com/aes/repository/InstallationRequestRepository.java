package com.aes.repository;

import com.aes.entity.InstallationRequest;
import com.aes.enums.InstallationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InstallationRequestRepository extends JpaRepository<InstallationRequest, UUID> {

    Page<InstallationRequest> findByCustomerIdOrderByCreatedAtDesc(UUID customerId, Pageable pageable);

    Page<InstallationRequest> findByStatusOrderByCreatedAtDesc(InstallationStatus status, Pageable pageable);

    Page<InstallationRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Optional<InstallationRequest> findByRequestNumber(String requestNumber);

    /**
     * Ops Manager triage inbox for installations: anything still owner-less
     * that has not already been completed or cancelled. Oldest first so the
     * service layer can re-sort (P1 first, then created_at) without losing
     * the deterministic tiebreak.
     */
    @Query("SELECT i FROM InstallationRequest i WHERE i.ownerCrm IS NULL " +
           "AND i.status IN ('PENDING','NEW','OFFERED_CRM') " +
           "ORDER BY i.createdAt ASC")
    List<InstallationRequest> findOpsInbox();

    /** Count for the OPS dashboard "Untriaged Installs" KPI tile. */
    @Query("SELECT COUNT(i) FROM InstallationRequest i WHERE i.ownerCrm IS NULL " +
           "AND i.status IN ('PENDING','NEW','OFFERED_CRM')")
    long countOpsInbox();

    /** Active (non-terminal) installations a CRM agent owns — used by workload board. */
    @Query("SELECT COUNT(i) FROM InstallationRequest i WHERE i.ownerCrm.id = :crmId " +
           "AND i.status NOT IN ('COMPLETED','CANCELLED')")
    long countActiveByOwner(UUID crmId);

    /** Count of a customer's in-flight installation projects (used by customer dashboard). */
    @Query("SELECT COUNT(i) FROM InstallationRequest i WHERE i.customer.id = :customerId " +
           "AND i.status NOT IN ('COMPLETED','CANCELLED','QUOTE_REJECTED_INTERNAL')")
    long countActiveByCustomer(UUID customerId);

    /** Full list (not just count) of active installs owned by a CRM — used by shift handoff. */
    @Query("SELECT i FROM InstallationRequest i WHERE i.ownerCrm.id = :crmId " +
           "AND i.status NOT IN ('COMPLETED','CANCELLED') ORDER BY i.createdAt DESC")
    List<InstallationRequest> findActiveByOwner(UUID crmId);

    @Query(value = "SELECT nextval('installation_req_seq')", nativeQuery = true)
    Long getNextSequenceValue();
}
