package com.aes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Audit log + state machine for every payment attempt.
 *
 * <p>Lifecycle:
 * <pre>
 *   INITIATED  → PROCESSING → SUCCESS
 *                        ↘  FAILED
 *   SUCCESS    → REFUNDED   (only after a manual / API refund)
 * </pre>
 * </p>
 *
 * <p>{@code gateway = "MOCK"} for the in-app demo gateway; flip to
 * {@code RAZORPAY} / {@code CASHFREE} once the real integration ships.</p>
 */
@Entity
@Table(name = "payment_transactions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User customer;

    /** Optional draft (this payment was initiated from a wizard draft). */
    @Column(name = "draft_id")
    private UUID draftId;

    /** Optional ticket (filled after the ticket is created from the draft). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private ServiceTicket ticket;

    @Column(nullable = false)
    private Integer amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "INR";

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "INITIATED";

    @Column(length = 20)
    private String method;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String gateway = "MOCK";

    @Column(name = "gateway_order_id", length = 100)
    private String gatewayOrderId;

    @Column(name = "gateway_payment_id", length = 100)
    private String gatewayPaymentId;

    @Column(name = "failure_reason", length = 200)
    private String failureReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
