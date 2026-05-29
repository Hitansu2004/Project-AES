package com.aes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Server-side draft of an in-progress service-ticket wizard.
 *
 * <p>Drafts are created the moment the customer commits to step 4 (or
 * earlier if they leave the wizard).  They give us two things:
 * <ol>
 *   <li>Resume-on-refresh: the customer can close the tab and pick
 *       up exactly where they left off — including the payment step.</li>
 *   <li>Payment integrity: a payment is always tied to a draft.  Only
 *       when the payment succeeds do we materialise a real
 *       {@link ServiceTicket} and route it to the Ops Manager inbox.</li>
 * </ol>
 * </p>
 *
 * <p>Drafts expire 24 hours after the last update.</p>
 */
@Entity
@Table(name = "ticket_drafts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User customer;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload_json", columnDefinition = "jsonb", nullable = false)
    private String payloadJson;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String step = "priority";

    @Column(name = "payment_id")
    private UUID paymentId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "expires_at", nullable = false)
    @Builder.Default
    private OffsetDateTime expiresAt = OffsetDateTime.now().plusHours(24);
}
