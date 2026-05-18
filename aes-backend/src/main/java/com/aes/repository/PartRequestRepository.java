package com.aes.repository;

import com.aes.entity.PartRequest;
import com.aes.enums.PartRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PartRequestRepository extends JpaRepository<PartRequest, UUID> {

    List<PartRequest> findByTicketIdOrderByCreatedAtDesc(UUID ticketId);

    List<PartRequest> findByStatus(PartRequestStatus status);

    List<PartRequest> findByStatusOrderByCreatedAtAsc(PartRequestStatus status);

    long countByStatus(PartRequestStatus status);

    /** Open part requests where the given user is the requesting engineer. */
    @Query("SELECT p FROM PartRequest p WHERE p.requestedBy = :engineerId " +
           "AND p.status IN ('PENDING_APPROVAL','APPROVED','ORDERED','DELIVERED') " +
           "ORDER BY p.createdAt DESC")
    List<PartRequest> findOpenByEngineer(@Param("engineerId") UUID engineerId);
}
