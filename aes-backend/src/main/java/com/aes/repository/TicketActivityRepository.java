package com.aes.repository;

import com.aes.entity.TicketActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TicketActivityRepository extends JpaRepository<TicketActivity, UUID> {

    List<TicketActivity> findByTicketIdOrderByCreatedAtDesc(UUID ticketId);

    List<TicketActivity> findByTicketIdOrderByCreatedAtAsc(UUID ticketId);
}
