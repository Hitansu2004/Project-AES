package com.aes.repository;

import com.aes.entity.TicketDraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TicketDraftRepository extends JpaRepository<TicketDraft, UUID> {

    /**
     * Active drafts belonging to the customer (not expired).  We never
     * keep more than one per customer in practice — the wizard always
     * upserts — but the query is defensive in case parallel tabs race.
     */
    @Query("""
        SELECT d FROM TicketDraft d
        WHERE d.customer.id = :customerId
          AND d.expiresAt > :now
        ORDER BY d.updatedAt DESC
    """)
    List<TicketDraft> findActiveByCustomer(@Param("customerId") UUID customerId,
                                           @Param("now") OffsetDateTime now);

    Optional<TicketDraft> findFirstByCustomerIdOrderByUpdatedAtDesc(UUID customerId);

    @Modifying
    @Query("DELETE FROM TicketDraft d WHERE d.expiresAt < :now")
    int deleteExpired(@Param("now") OffsetDateTime now);
}
