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

    /**
     * Active (non-terminal) tickets currently held by a given assignee.
     * Used by the admin team-workload view so each staff card shows
     * exactly the tickets sitting in their inbox right now.
     *
     * Note: the assignee is mapped as a {@code @ManyToOne User currentAssignee}
     * on the entity, so the HQL path is {@code t.currentAssignee.id}.
     */
    @Query("SELECT t FROM ServiceTicket t WHERE t.currentAssignee.id = :assigneeId " +
           "AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED') " +
           "ORDER BY t.createdAt DESC")
    List<ServiceTicket> findActiveByAssignee(@Param("assigneeId") UUID assigneeId);

    /** Active ticket count regardless of level — used for KPI rollups. */
    @Query("SELECT COUNT(t) FROM ServiceTicket t WHERE t.status NOT IN ('RESOLVED','CLOSED','CANCELLED')")
    long countActive();

    /** Active P1 ticket count — used for KPI rollups. */
    @Query("SELECT COUNT(t) FROM ServiceTicket t WHERE t.priority = com.aes.enums.Priority.P1 " +
           "AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED')")
    long countActiveCritical();

    /** Active ticket count for a specific level. */
    @Query("SELECT COUNT(t) FROM ServiceTicket t WHERE t.currentLevel = :level " +
           "AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED')")
    long countActiveAtLevel(@Param("level") int level);

    // Escalation engine queries — CRITICAL
    @Query("SELECT t FROM ServiceTicket t WHERE t.currentLevel = 1 " +
           "AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED') " +
           "AND t.slaDeadlineL1 IS NOT NULL AND t.slaDeadlineL1 < :now " +
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

    /**
     * Average minutes between {@code created_at} and {@code acknowledged_at}
     * for tickets acknowledged on or after the supplied timestamp. Returns
     * {@code null} when no tickets have been acknowledged in the window.
     */
    @Query(value = "SELECT AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60.0) " +
                   "FROM service_tickets " +
                   "WHERE acknowledged_at IS NOT NULL AND acknowledged_at >= :since",
           nativeQuery = true)
    Double avgAcknowledgmentMinutesSince(@Param("since") OffsetDateTime since);

    @Query("SELECT COUNT(t) FROM ServiceTicket t " +
           "WHERE t.slaDeadlineFinal IS NOT NULL " +
           "AND t.slaDeadlineFinal < :now " +
           "AND t.status NOT IN ('RESOLVED','CLOSED','CANCELLED')")
    long countFinalSlaBreached(@Param("now") OffsetDateTime now);

    // Ticket sequence
    @Query(value = "SELECT nextval('ticket_seq')", nativeQuery = true)
    Long getNextTicketSequence();
}
