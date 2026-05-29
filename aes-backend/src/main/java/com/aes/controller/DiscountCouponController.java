package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.entity.DiscountCoupon;
import com.aes.service.DiscountCouponService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Admin & Service-Manager surface for managing discount coupons.
 *
 * <p>Customer-side validation happens inside the {@link com.aes.service.PricingService}
 * quote endpoint — no separate "redeem" route is needed because the
 * coupon is recorded against the ticket on payment confirmation.</p>
 */
@RestController
@RequestMapping("/api/v1/admin/coupons")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SERVICE_MANAGER')")
public class DiscountCouponController {

    private final DiscountCouponService service;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list() {
        List<Map<String, Object>> out = service.listAll().stream()
                .map(DiscountCouponController::toMap)
                .toList();
        return ApiResponse.success(out);
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> create(@RequestBody CreateRequest req,
                                                   @AuthenticationPrincipal UUID me) {
        DiscountCoupon c = service.create(
                req.code,
                req.description,
                req.discountPct,
                req.maxUses,
                req.validUntil,
                req.appliesTo,
                req.minAmount,
                me
        );
        return ApiResponse.success(toMap(c), "Coupon created");
    }

    @PostMapping("/{id}/toggle")
    public ApiResponse<Map<String, Object>> toggle(@PathVariable UUID id) {
        return ApiResponse.success(toMap(service.toggleActive(id)),
                "Coupon visibility toggled");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ApiResponse.success(null, "Coupon deleted");
    }

    // ── DTOs ─────────────────────────────────────────────────────

    @Data
    public static class CreateRequest {
        public String code;
        public String description;
        public int discountPct;
        public Integer maxUses;
        public OffsetDateTime validUntil;
        public String appliesTo;
        public Integer minAmount;
    }

    private static Map<String, Object> toMap(DiscountCoupon c) {
        return Map.ofEntries(
                Map.entry("id", c.getId()),
                Map.entry("code", c.getCode()),
                Map.entry("description", c.getDescription() == null ? "" : c.getDescription()),
                Map.entry("discountPct", c.getDiscountPct()),
                Map.entry("maxUses", c.getMaxUses() == null ? -1 : c.getMaxUses()),
                Map.entry("timesUsed", c.getTimesUsed()),
                Map.entry("validFrom", c.getValidFrom()),
                Map.entry("validUntil", c.getValidUntil() == null ? "" : c.getValidUntil().toString()),
                Map.entry("appliesTo", c.getAppliesTo()),
                Map.entry("minAmount", c.getMinAmount()),
                Map.entry("isActive", c.getIsActive()),
                Map.entry("createdAt", c.getCreatedAt())
        );
    }
}
