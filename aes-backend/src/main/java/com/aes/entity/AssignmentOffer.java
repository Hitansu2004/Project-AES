package com.aes.entity;

import com.aes.enums.OfferMode;
import com.aes.enums.OfferStatus;
import com.aes.enums.OfferType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A single "Hey, will you take this work?" offer.
 *
 * <p>Used in two scenarios (PLAN.md §7.3, FLOW.md C7/C10/C12):</p>
 * <ul>
 *   <li>{@link OfferType#CRM_OWNER} — Ops Manager offers a ticket / install
 *       to a CRM agent. Agent must accept inside the offer window
 *       (default 15 min; see {@code app.offer.crm-expiry-minutes}).</li>
 *   <li>{@link OfferType#ENGINEER_DISPATCH} — CRM (or SM) offers a job to
 *       a Site Engineer. Engineer must accept inside the dispatch window
 *       (default 10 min; see {@code app.offer.engineer-expiry-minutes}).</li>
 * </ul>
 *
 * <p>Exactly one of {@code ticket} / {@code install} is non-null; enforced
 * by a DB check constraint in V7.</p>
 */
@Entity
@Table(name = "assignment_offers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private ServiceTicket ticket;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "install_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private InstallationRequest install;

    /** Recipient of the offer (CRM agent or Site Engineer). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offered_to", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User offeredTo;

    /** Sender of the offer (Ops Manager, CRM agent, or supervisor). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "offered_by", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User offeredBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "offer_type", nullable = false, length = 30)
    private OfferType offerType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OfferMode mode = OfferMode.DIRECT;

    /** Optional freeform note from sender (e.g. "Aarav is a VIP, please squeeze in"). */
    @Column(columnDefinition = "TEXT")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OfferStatus status = OfferStatus.OFFERED;

    @Column(name = "decline_reason", columnDefinition = "TEXT")
    private String declineReason;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "responded_at")
    private OffsetDateTime respondedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
