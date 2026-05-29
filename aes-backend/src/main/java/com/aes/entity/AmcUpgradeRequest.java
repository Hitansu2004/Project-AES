package com.aes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Customer-initiated "Upgrade to AMC" request.
 *
 * <p>Generated when a customer whose warranty has lapsed taps the
 * upgrade CTA on their account / installation detail screen.  The
 * request lands in the Ops Manager triage inbox; the Ops Manager
 * assigns a CRM agent who contacts the customer, drafts an AMC
 * quote and eventually converts the lead into a real
 * {@link AmcContract}.</p>
 */
@Entity
@Table(name = "amc_upgrade_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AmcUpgradeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "request_number", nullable = false, unique = true, length = 20)
    private String requestNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ac_unit_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private AcUnit acUnit;

    /** NEW · CONTACTED · QUOTED · CONVERTED · CANCELLED */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "NEW";

    @Column(name = "preferred_plan", length = 20)
    private String preferredPlan;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_crm_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User assignedCrm;

    @Column(name = "assigned_at")
    private OffsetDateTime assignedAt;

    @Column(name = "contacted_at")
    private OffsetDateTime contactedAt;

    @Column(name = "converted_amc_id")
    private UUID convertedAmcId;

    @Column(name = "converted_at")
    private OffsetDateTime convertedAt;

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    @Column(name = "cancellation_reason", length = 200)
    private String cancellationReason;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
