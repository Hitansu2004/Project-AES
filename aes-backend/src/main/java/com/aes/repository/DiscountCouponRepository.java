package com.aes.repository;

import com.aes.entity.DiscountCoupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiscountCouponRepository extends JpaRepository<DiscountCoupon, UUID> {

    Optional<DiscountCoupon> findByCodeIgnoreCase(String code);

    @Query("""
        SELECT c FROM DiscountCoupon c
        WHERE UPPER(c.code) = UPPER(:code)
          AND c.isActive = true
          AND c.validFrom <= :now
          AND (c.validUntil IS NULL OR c.validUntil >= :now)
          AND (c.maxUses IS NULL OR c.timesUsed < c.maxUses)
    """)
    Optional<DiscountCoupon> findRedeemable(@Param("code") String code,
                                            @Param("now") OffsetDateTime now);

    List<DiscountCoupon> findAllByOrderByCreatedAtDesc();
}
