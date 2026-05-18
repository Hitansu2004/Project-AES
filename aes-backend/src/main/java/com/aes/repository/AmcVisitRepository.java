package com.aes.repository;

import com.aes.entity.AmcVisit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface AmcVisitRepository extends JpaRepository<AmcVisit, UUID> {

    List<AmcVisit> findByContractIdOrderByVisitNumberAsc(UUID contractId);

    List<AmcVisit> findByContractIdAndStatusOrderByScheduledDateAsc(UUID contractId, String status);

    /** AMC visits scheduled within the next N days (drives the Ops Mgr calendar tile). */
    @Query("SELECT v FROM AmcVisit v WHERE v.scheduledDate BETWEEN :from AND :to " +
           "AND v.status IN ('SCHEDULED','PENDING') ORDER BY v.scheduledDate ASC")
    List<AmcVisit> findUpcomingScheduled(@Param("from") LocalDate from,
                                          @Param("to") LocalDate to);

    /** Visits whose scheduled date is past + still not completed (auto-mark MISSED). */
    @Query("SELECT v FROM AmcVisit v WHERE v.scheduledDate < :today AND v.status = 'SCHEDULED'")
    List<AmcVisit> findOverdueScheduled(@Param("today") LocalDate today);

    /** AMC visits assigned to a given engineer that are still due. */
    @Query("SELECT v FROM AmcVisit v WHERE v.engineer.id = :engineerId " +
           "AND v.status IN ('SCHEDULED','PENDING') ORDER BY v.scheduledDate ASC")
    List<AmcVisit> findUpcomingForEngineer(@Param("engineerId") UUID engineerId);
}
