package com.aes.repository;

import com.aes.entity.TicketNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TicketNoteRepository extends JpaRepository<TicketNote, UUID> {

    /** Notes on a ticket, newest first. */
    List<TicketNote> findByTicketIdOrderByCreatedAtDesc(UUID ticketId);
}
