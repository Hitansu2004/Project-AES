package com.aes.entity;

import com.aes.enums.AcType;
import com.aes.enums.ServiceStatus;
import com.aes.enums.WarrantyStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ac_units")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AcUnit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User customer;

    @Column(name = "room_label", nullable = false, length = 100)
    private String roomLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "ac_type", nullable = false, length = 20)
    private AcType acType;

    @Column(nullable = false, length = 50)
    private String brand;

    @Column(name = "model_number", length = 100)
    private String modelNumber;

    @Column(nullable = false, precision = 3, scale = 1)
    private BigDecimal tonnage;

    @Column(name = "energy_star_rating")
    private Integer energyStarRating;

    @Column(name = "installation_date")
    private LocalDate installationDate;

    @Column(name = "warranty_expiry")
    private LocalDate warrantyExpiry;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "amc_contract_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private AmcContract amcContract;

    @Enumerated(EnumType.STRING)
    @Column(name = "warranty_status", nullable = false, length = 20)
    @Builder.Default
    private WarrantyStatus warrantyStatus = WarrantyStatus.UNKNOWN;

    @Enumerated(EnumType.STRING)
    @Column(name = "service_status", nullable = false, length = 20)
    @Builder.Default
    private ServiceStatus serviceStatus = ServiceStatus.P3_PAID;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
