package com.aes.controller;

import com.aes.dto.response.ApiResponse;
import com.aes.entity.PaymentTransaction;
import com.aes.service.MockPaymentService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Customer-facing payment endpoints.
 *
 * <p>Today these are backed by the {@link MockPaymentService} (Razorpay-
 * style demo gateway).  Swap the bean for a real gateway later — the
 * controller stays the same.</p>
 */
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@PreAuthorize("hasRole('CUSTOMER')")
public class PaymentController {

    private final MockPaymentService payments;

    /** Step 1 — create a payment intent and return the order id + UI hints. */
    @PostMapping("/intent")
    public ApiResponse<Map<String, Object>> createIntent(
            @AuthenticationPrincipal UUID userId,
            @RequestBody IntentRequest req) {

        PaymentTransaction tx = payments.createIntent(userId, req.draftId, req.amount);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("paymentId", tx.getId());
        body.put("orderId", tx.getGatewayOrderId());
        body.put("amount", tx.getAmount());
        body.put("currency", tx.getCurrency());
        body.put("gateway", tx.getGateway());
        body.put("status", tx.getStatus());
        body.put("mockMode", payments.isMockMode());
        if (payments.isMockMode()) {
            body.put("demoSuccessOtp", payments.getSuccessOtpForDemo());
        }
        return ApiResponse.success(body);
    }

    /** Step 2 — confirm with OTP (demo) or signature (real gateway). */
    @PostMapping("/{paymentId}/confirm")
    public ApiResponse<Map<String, Object>> confirm(
            @PathVariable UUID paymentId,
            @RequestBody ConfirmRequest req) {

        PaymentTransaction tx = payments.confirm(paymentId, req.otp, req.method);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("paymentId", tx.getId());
        body.put("status", tx.getStatus());
        body.put("gatewayPaymentId", tx.getGatewayPaymentId());
        body.put("failureReason", tx.getFailureReason());
        return ApiResponse.success(body);
    }

    /** Optional — poll a payment by id. */
    @GetMapping("/{paymentId}")
    public ApiResponse<Map<String, Object>> get(@PathVariable UUID paymentId) {
        PaymentTransaction tx = payments.findById(paymentId);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("paymentId", tx.getId());
        body.put("status", tx.getStatus());
        body.put("amount", tx.getAmount());
        body.put("gateway", tx.getGateway());
        body.put("method", tx.getMethod());
        body.put("createdAt", tx.getCreatedAt());
        return ApiResponse.success(body);
    }

    // ── DTOs ─────────────────────────────────────────────────────

    @Data
    public static class IntentRequest {
        public UUID draftId;
        public int  amount;
    }

    @Data
    public static class ConfirmRequest {
        public String otp;
        public String method;
    }
}
