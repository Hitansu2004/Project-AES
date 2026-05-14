package com.aes.repository;

import com.aes.entity.TicketEscalationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TicketEscalationLogRepository extends JpaRepository<TicketEscalationLog, UUID> {

    List<TicketEscalationLog> findByTicketIdOrderByEscalatedAtDesc(UUID ticketId);

    List<TicketEscalationLog> findByTicketIdOrderByEscalatedAtAsc(UUID ticketId);

    List<TicketEscalationLog> findAllByOrderByEscalatedAtDesc();
}
