package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.enums.AcType;
import com.aes.service.PricingService;
import com.aes.service.PricingService.Quote;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Public-facing pricing calculator endpoint.
 *
 * <p>The customer's service-ticket wizard calls this once the customer
 * has picked an AC unit and a location.  Returns the full breakdown
 * (base + distance + coupon → total) so the UI never has to know
 * pricing rules.</p>
 */
@RestController
@RequestMapping("/api/v1/pricing")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class PricingController {

    private final PricingService pricingService;

    @GetMapping("/quote")
    public ApiResponse<Quote> quote(
            @RequestParam @NotNull AcType acType,
            @RequestParam double lat,
            @RequestParam double lng,
            @RequestParam(required = false) String couponCode
    ) {
        return ApiResponse.success(pricingService.quote(acType, lat, lng, couponCode));
    }
}
