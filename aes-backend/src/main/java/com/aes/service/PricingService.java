package com.aes.service;

import com.aes.entity.DiscountCoupon;
import com.aes.enums.AcType;
import com.aes.repository.DiscountCouponRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * The single source of truth for service-ticket pricing.
 *
 * <pre>
 *   total = base(AC type) + distanceSurcharge(km)
 *   if (coupon valid)
 *       discountAmount = total × pct / 100
 *       total -= discountAmount
 * </pre>
 *
 * <p>All amounts are integers (rupees, no paise).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PricingService {

    private final DistanceService distanceService;
    private final DiscountCouponRepository couponRepo;

    @Value("${app.pricing.base.split:750}")
    private int baseSplit;
    @Value("${app.pricing.base.cassette:1500}")
    private int baseCassette;
    @Value("${app.pricing.base.ductable:2500}")
    private int baseDuctable;
    @Value("${app.pricing.base.vrf:5000}")
    private int baseVrf;
    @Value("${app.pricing.base.vrv:5000}")
    private int baseVrv;
    @Value("${app.pricing.base.ahu:5000}")
    private int baseAhu;
    @Value("${app.pricing.base.window:750}")
    private int baseWindow;
    @Value("${app.pricing.base.default:750}")
    private int baseDefault;

    @Value("${app.pricing.distance.threshold1:10}")
    private int distT1;
    @Value("${app.pricing.distance.threshold2:15}")
    private int distT2;
    @Value("${app.pricing.distance.threshold3:25}")
    private int distT3;

    @Value("${app.pricing.distance.charge1:0}")
    private int distC1;
    @Value("${app.pricing.distance.charge2:250}")
    private int distC2;
    @Value("${app.pricing.distance.charge3:750}")
    private int distC3;
    @Value("${app.pricing.distance.charge4:1250}")
    private int distC4;

    /** Quote for an AC unit type at a given location (no coupon). */
    public Quote quote(AcType type, double lat, double lng) {
        return quote(type, lat, lng, null);
    }

    /** Quote with an optional discount coupon code (case-insensitive). */
    public Quote quote(AcType type, double lat, double lng, String couponCode) {
        BigDecimal km = distanceService.kmFromOffice(lat, lng);
        int base = baseFor(type);
        int distanceCharge = distanceChargeFor(km.doubleValue());
        int subtotal = base + distanceCharge;

        Quote q = new Quote();
        q.type = type;
        q.distanceKm = km;
        q.baseCharge = base;
        q.distanceCharge = distanceCharge;
        q.subtotal = subtotal;
        q.discountAmount = 0;
        q.total = subtotal;

        if (couponCode != null && !couponCode.isBlank()) {
            Optional<DiscountCoupon> opt = couponRepo.findRedeemable(
                    couponCode.trim().toUpperCase(), OffsetDateTime.now());
            if (opt.isPresent()) {
                DiscountCoupon c = opt.get();
                if (subtotal >= c.getMinAmount()) {
                    int discount = (int) Math.round(subtotal * (c.getDiscountPct() / 100.0));
                    q.couponCode = c.getCode();
                    q.discountPct = c.getDiscountPct();
                    q.discountAmount = discount;
                    q.total = subtotal - discount;
                    q.couponMessage = "Coupon applied — you save ₹" + discount;
                } else {
                    q.couponMessage = "Coupon needs a minimum order of ₹" + c.getMinAmount();
                }
            } else {
                q.couponMessage = "Coupon code is invalid or expired";
            }
        }
        return q;
    }

    /** Charge based on the AC type — falls back to the catch-all default. */
    public int baseFor(AcType type) {
        if (type == null) return baseDefault;
        return switch (type) {
            case SPLIT    -> baseSplit;
            case CASSETTE -> baseCassette;
            case CENTRAL  -> baseDuctable;   // central duct system
            case VRF_VRV  -> baseVrf;
            case WINDOW   -> baseWindow;
            case PORTABLE -> baseDefault;
        };
    }

    /** Distance-band surcharge (rupees). */
    public int distanceChargeFor(double km) {
        if (km <= distT1) return distC1;
        if (km <= distT2) return distC2;
        if (km <= distT3) return distC3;
        return distC4;
    }

    /** Plain old data object returned to controllers. */
    @lombok.Data
    public static class Quote {
        public AcType type;
        public BigDecimal distanceKm;
        public int baseCharge;
        public int distanceCharge;
        public int subtotal;
        public String couponCode;
        public Integer discountPct;
        public int discountAmount;
        public String couponMessage;
        public int total;
    }
}
