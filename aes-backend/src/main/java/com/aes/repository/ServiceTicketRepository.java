package com.aes.repository;

import com.aes.entity.ServiceTicket;
import com.aes.enums.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ServiceTicketRepository extends JpaRepository<ServiceTicket, UUID> {

    Optional<ServiceTicket> findByTicketNumber(String ticketNumber);

    // Customer queries
    Page<ServiceTicket> findByCustomerIdOrderByCreatedAtDesc(UUID customerId, Pageable pageable);

    Page<ServiceTicket> findByCustomerIdAndStatusOrderByCreatedAtDesc(UUID customerId, TicketStatus status, Pageable pageable);

    long countByCustomerIdAndStatusIn(UUID customerId, List<TicketStatus> statuses);

    List<ServiceTicket> findTop2ByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    // CRM agent queries (Level 1)
    Page<ServiceTicket> findByCurrentLevelAndCurrentAssigneeIdOrderByCreatedAtDesc(
            int level, UUID assigneeId, Pageable pageable);

    // Level-based queries
    Page<ServiceTicket> findByCurrentLevelOrderByCreatedAtDesc(int level, Pageable pageable);

    // All tickets (admin)
    Page<ServiceTicket> findAllByOrderByCreatedAtDesc(Pageable pageable);

    // Escalation engine queries — CRITICAL
    @Query("SELECT t FROM ServiceTicket t WHERE t.currentLevel = 1 " +
           "AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED') " +
           "AND t.slaDeadlineL1 < :now " +
           "AND t.acknowledgedAt IS NULL")
    List<ServiceTicket> findL1OverdueTickets(@Param("now") OffsetDateTime now);

    @Query("SELECT t FROM ServiceTicket t WHERE t.currentLevel = 2 " +
           "AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED') " +
           "AND t.slaDeadlineL2 IS NOT NULL AND t.slaDeadlineL2 < :now")
    List<ServiceTicket> findL2OverdueTickets(@Param("now") OffsetDateTime now);

    // Dashboard analytics
    long countByCurrentLevel(int level);

    long countByStatusAndCurrentLevel(TicketStatus status, int level);

    @Query("SELECT COUNT(t) FROM ServiceTicket t WHERE t.resolvedAt >= :since")
    long countResolvedSince(@Param("since") OffsetDateTime since);

    @Query("SELECT COUNT(t) FROM ServiceTicket t WHERE t.currentLevel > 1 " +
           "AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED')")
    long countCurrentlyEscalated();

    // Ticket sequence
    @Query(value = "SELECT nextval('ticket_seq')", nativeQuery = true)
    Long getNextTicketSequence();
}
