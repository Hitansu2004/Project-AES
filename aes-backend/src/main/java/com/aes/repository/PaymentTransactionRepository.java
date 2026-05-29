package com.aes.repository;

import com.aes.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, UUID> {

    Optional<PaymentTransaction> findByDraftIdAndStatus(UUID draftId, String status);

    List<PaymentTransaction> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);
}
