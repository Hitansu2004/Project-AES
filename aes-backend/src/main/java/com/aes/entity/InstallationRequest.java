package com.aes.entity;

import com.aes.enums.AcType;
import com.aes.enums.InstallationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "installation_requests")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstallationRequest {

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

    @Column(name = "property_address", columnDefinition = "TEXT")
    private String propertyAddress;

    @Enumerated(EnumType.STRING)
    @Column(name = "ac_type", nullable = false, length = 20)
    private AcType acType;

    @Column(length = 50)
    private String brand;

    @Column(name = "model_number", length = 100)
    private String modelNumber;

    @Column(precision = 3, scale = 1)
    private BigDecimal tonnage;

    @Column(name = "energy_rating")
    private Integer energyRating;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rooms_json", columnDefinition = "jsonb")
    private String roomsJson;

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(name = "scheduled_slot", length = 20)
    private String scheduledSlot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private InstallationStatus status = InstallationStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_engineer_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User assignedEngineer;

    @Column(name = "estimated_cost", precision = 10, scale = 2)
    private BigDecimal estimatedCost;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
