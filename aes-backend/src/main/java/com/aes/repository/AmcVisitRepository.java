package com.aes.repository;

import com.aes.entity.AmcVisit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AmcVisitRepository extends JpaRepository<AmcVisit, UUID> {

    List<AmcVisit> findByContractIdOrderByVisitNumberAsc(UUID contractId);

    List<AmcVisit> findByContractIdAndStatusOrderByScheduledDateAsc(UUID contractId, String status);
}
