package com.aes.repository;

import com.aes.entity.AssignmentOffer;
import com.aes.enums.OfferStatus;
import com.aes.enums.OfferType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository for {@link AssignmentOffer}.
 *
 * <p>Drives:
 * <ul>
 *   <li>The "My pending offers" inbox shown to CRM agents and engineers.</li>
 *   <li>The scheduled job that flips OFFERED → EXPIRED at the offer deadline.</li>
 *   <li>The Ops Manager view of "this ticket has X open offer(s)".</li>
 * </ul>
 */
@Repository
public interface AssignmentOfferRepository extends JpaRepository<AssignmentOffer, UUID> {

    /** Offers awaiting a response from a specific recipient (their inbox). */
    List<AssignmentOffer> findByOfferedToIdAndStatusOrderByCreatedAtDesc(
            UUID offeredToId, OfferStatus status);

    /** All offers for a given ticket (latest first) — drives the ticket detail page audit trail. */
    List<AssignmentOffer> findByTicketIdOrderByCreatedAtDesc(UUID ticketId);

    /** All offers for a given installation. */
    List<AssignmentOffer> findByInstallIdOrderByCreatedAtDesc(UUID installId);

    /** Most recent OFFERED offer on a ticket (used to "withdraw" or to detect duplicate offers). */
    Optional<AssignmentOffer> findFirstByTicketIdAndStatusOrderByCreatedAtDesc(
            UUID ticketId, OfferStatus status);

    Optional<AssignmentOffer> findFirstByInstallIdAndStatusOrderByCreatedAtDesc(
            UUID installId, OfferStatus status);

    /**
     * All offers still OFFERED whose expiry deadline has passed.
     * Used by the scheduled expiry job in Phase 2.
     */
    @Query("SELECT o FROM AssignmentOffer o WHERE o.status = 'OFFERED' AND o.expiresAt < :now")
    List<AssignmentOffer> findExpired(@Param("now") OffsetDateTime now);

    /** How many offers of a given type are still pending for a recipient. */
    long countByOfferedToIdAndOfferTypeAndStatus(
            UUID offeredToId, OfferType offerType, OfferStatus status);

    /** Global count of offers of a given type still in OFFERED state — KPI tiles. */
    long countByOfferTypeAndStatus(OfferType offerType, OfferStatus status);

    /** Outstanding offers raised BY a given user (used by shift-end handoff). */
    List<AssignmentOffer> findByOfferedByIdAndStatus(UUID offeredById, OfferStatus status);

    /** Outstanding offers raised TO a given user (used by shift-end auto-decline). */
    List<AssignmentOffer> findByOfferedToIdAndStatus(UUID offeredToId, OfferStatus status);
}
