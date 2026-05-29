package com.aes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Admin-created discount coupon — applied by customers at checkout.
 *
 * <p>The admin tab on {@code /admin} lets a manager mint a code with a
 * percent off, an optional cap on uses, an optional validity window
 * and an "applies to" scope (TICKET / INSTALL / BOTH).  Customers
 * enter the code on the service-ticket wizard payment step and the
 * pricing engine deducts the percentage from the total.</p>
 */
@Entity
@Table(name = "discount_coupons")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiscountCoupon {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(length = 200)
    private String description;

    @Column(name = "discount_pct", nullable = false)
    private Integer discountPct;

    /** {@code null} = unlimited uses. */
    @Column(name = "max_uses")
    private Integer maxUses;

    @Column(name = "times_used", nullable = false)
    @Builder.Default
    private Integer timesUsed = 0;

    @Column(name = "valid_from", nullable = false)
    @Builder.Default
    private OffsetDateTime validFrom = OffsetDateTime.now();

    @Column(name = "valid_until")
    private OffsetDateTime validUntil;

    /** TICKET, INSTALL, or BOTH — what the coupon can be redeemed on. */
    @Column(name = "applies_to", nullable = false, length = 15)
    @Builder.Default
    private String appliesTo = "TICKET";

    @Column(name = "min_amount", nullable = false)
    @Builder.Default
    private Integer minAmount = 0;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
