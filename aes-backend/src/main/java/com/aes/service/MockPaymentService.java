package com.aes.service;

import com.aes.entity.PaymentTransaction;
import com.aes.entity.User;
import com.aes.exception.BusinessException;
import com.aes.exception.NotFoundException;
import com.aes.repository.PaymentTransactionRepository;
import com.aes.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Mock payment gateway — UI looks like Razorpay; backend just flips a
 * status field after the customer types the demo OTP.
 *
 * <p>Lifecycle:
 * <pre>
 *   createIntent()  →  INITIATED (returns mock orderId to UI)
 *   confirm(otp)    →  validates OTP === {@code app.payment.mock-success-otp}
 *                   →  PROCESSING → SUCCESS (or FAILED if OTP wrong)
 * </pre>
 * </p>
 *
 * <p>When we wire a real gateway (Razorpay/Cashfree), we keep this
 * class as the fallback (toggled by {@code app.payment.mock-mode})
 * and add a {@code RazorpayPaymentService} alongside it.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MockPaymentService {

    private final PaymentTransactionRepository paymentRepo;
    private final UserRepository userRepo;

    @Value("${app.payment.mock-mode:true}")
    private boolean mockMode;

    @Value("${app.payment.mock-success-otp:0000}")
    private String successOtp;

    /** Step 1 — customer clicks "Pay Now" in the UI. */
    @Transactional
    public PaymentTransaction createIntent(UUID customerId, UUID draftId, int amountRupees) {
        if (amountRupees <= 0) {
            throw new BusinessException("INVALID_AMOUNT", "amount must be greater than zero");
        }
        User customer = userRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer", customerId.toString()));

        PaymentTransaction tx = PaymentTransaction.builder()
                .customer(customer)
                .draftId(draftId)
                .amount(amountRupees)
                .currency("INR")
                .status("INITIATED")
                .gateway(mockMode ? "MOCK" : "RAZORPAY")
                .gatewayOrderId("order_mock_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                .build();
        return paymentRepo.save(tx);
    }

    /** Step 2 — customer enters the demo OTP and hits "Confirm". */
    @Transactional
    public PaymentTransaction confirm(UUID paymentId, String otp, String method) {
        PaymentTransaction tx = paymentRepo.findById(paymentId)
                .orElseThrow(() -> new NotFoundException("Payment", paymentId.toString()));

        if (!"INITIATED".equals(tx.getStatus()) && !"PROCESSING".equals(tx.getStatus())) {
            throw new BusinessException("PAYMENT_TERMINAL",
                    "Payment is already in a terminal state: " + tx.getStatus());
        }
        tx.setStatus("PROCESSING");
        tx.setMethod(method != null ? method : "MOCK_UPI");
        paymentRepo.save(tx);

        if (otp == null || !otp.trim().equals(successOtp)) {
            tx.setStatus("FAILED");
            tx.setFailureReason("Invalid OTP — payment cancelled");
            return paymentRepo.save(tx);
        }
        tx.setStatus("SUCCESS");
        tx.setGatewayPaymentId("pay_mock_" + UUID.randomUUID().toString().replace("-", "").substring(0, 18));
        return paymentRepo.save(tx);
    }

    public PaymentTransaction findById(UUID id) {
        return paymentRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Payment", id.toString()));
    }

    public boolean isMockMode() { return mockMode; }
    public String getSuccessOtpForDemo() { return successOtp; }
}
