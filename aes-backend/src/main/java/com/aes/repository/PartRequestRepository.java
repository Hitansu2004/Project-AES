package com.aes.repository;

import com.aes.entity.PartRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PartRequestRepository extends JpaRepository<PartRequest, UUID> {

    List<PartRequest> findByTicketIdOrderByCreatedAtDesc(UUID ticketId);

    List<PartRequest> findByStatus(String status);
}
