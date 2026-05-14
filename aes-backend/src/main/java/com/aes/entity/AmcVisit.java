package com.aes.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "amc_visits")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AmcVisit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private AmcContract contract;

    @Column(name = "visit_number", nullable = false)
    private Integer visitNumber;

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(name = "scheduled_time_slot", length = 20)
    private String scheduledTimeSlot;

    @Column(name = "actual_visit_date")
    private OffsetDateTime actualVisitDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "engineer_id")
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private User engineer;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "SCHEDULED";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
