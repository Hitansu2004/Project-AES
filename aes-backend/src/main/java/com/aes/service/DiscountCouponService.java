package com.aes.service;

import com.aes.entity.DiscountCoupon;
import com.aes.entity.User;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.DiscountCouponRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Admin coupon CRUD + customer-side validation.
 *
 * <p>Discount % is hard-capped at 1–100.  Codes are stored upper-case
 * to avoid the classic "FESTIVE12 vs festive12" customer-support
 * embarrassment.</p>
 */
@Service
@RequiredArgsConstructor
public class DiscountCouponService {

    private final DiscountCouponRepository repo;
    private final UserRepository userRepo;

    public List<DiscountCoupon> listAll() {
        return repo.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public DiscountCoupon create(String code,
                                 String description,
                                 int discountPct,
                                 Integer maxUses,
                                 OffsetDateTime validUntil,
                                 String appliesTo,
                                 Integer minAmount,
                                 UUID createdById) {
        if (code == null || code.isBlank())
            throw new BusinessException("INVALID_CODE", "Coupon code is required");
        if (discountPct < 1 || discountPct > 100)
            throw new BusinessException("INVALID_PCT", "Discount must be between 1 and 100");

        String normalized = code.trim().toUpperCase();
        repo.findByCodeIgnoreCase(normalized).ifPresent(c -> {
            throw new BusinessException("CODE_EXISTS",
                    "Coupon code '" + normalized + "' already exists");
        });

        User creator = createdById == null ? null :
                userRepo.findById(createdById).orElse(null);

        DiscountCoupon c = DiscountCoupon.builder()
                .code(normalized)
                .description(description)
                .discountPct(discountPct)
                .maxUses(maxUses)
                .validUntil(validUntil)
                .appliesTo(appliesTo == null ? "TICKET" : appliesTo.toUpperCase())
                .minAmount(minAmount == null ? 0 : minAmount)
                .createdBy(creator)
                .build();
        return repo.save(c);
    }

    @Transactional
    public DiscountCoupon toggleActive(UUID id) {
        DiscountCoupon c = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Coupon", id.toString()));
        c.setIsActive(!Boolean.TRUE.equals(c.getIsActive()));
        return repo.save(c);
    }

    @Transactional
    public void delete(UUID id) {
        if (!repo.existsById(id))
            throw new NotFoundException("Coupon", id.toString());
        repo.deleteById(id);
    }

    /**
     * Bumps {@code timesUsed} once a payment has been confirmed.
     */
    @Transactional
    public void recordUsage(String code) {
        if (code == null || code.isBlank()) return;
        repo.findByCodeIgnoreCase(code.trim()).ifPresent(c -> {
            c.setTimesUsed(c.getTimesUsed() + 1);
            repo.save(c);
        });
    }
}
