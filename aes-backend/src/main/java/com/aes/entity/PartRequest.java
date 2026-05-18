package com.aes.entity;

import com.aes.enums.PartRequestStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A spare part requisition raised by an engineer on site (PLAN.md §7.5,
 * FLOW.md C13).
 *
 * <p>Lifecycle: {@code PENDING_APPROVAL → APPROVED → ORDERED → DELIVERED →
 * INSTALLED}, with {@code REJECTED} as a terminal off-ramp. Approval band
 * depends on {@code totalCost} (CRM ≤ ₹5k, SM ≤ ₹50k, Admin &gt; ₹50k).</p>
 */
@Entity
@Table(name = "part_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PartRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private ServiceTicket ticket;

    @Column(name = "requested_by", nullable = false)
    private UUID requestedBy;

    @Column(name = "part_name", nullable = false, length = 200)
    private String partName;

    @Column(nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String urgency = "NORMAL";

    @Column(name = "unit_cost", precision = 12, scale = 2)
    private BigDecimal unitCost;

    @Column(name = "total_cost", precision = 12, scale = 2)
    private BigDecimal totalCost;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    @Builder.Default
    private PartRequestStatus status = PartRequestStatus.PENDING_APPROVAL;

    @Column(name = "approved_by")
    private UUID approvedBy;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @Column(name = "rejected_reason", columnDefinition = "TEXT")
    private String rejectedReason;

    @Column(name = "ordered_by")
    private UUID orderedBy;

    @Column(name = "ordered_at")
    private OffsetDateTime orderedAt;

    @Column(name = "expected_delivery")
    private LocalDate expectedDelivery;

    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    @Column(name = "installed_at")
    private OffsetDateTime installedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
