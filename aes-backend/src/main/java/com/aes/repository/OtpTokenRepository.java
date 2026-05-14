package com.aes.repository;

import com.aes.entity.OtpToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OtpTokenRepository extends JpaRepository<OtpToken, UUID> {

    Optional<OtpToken> findFirstByPhoneNumberAndIsUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(
            String phoneNumber, OffsetDateTime now);

    long countByPhoneNumberAndCreatedAtAfter(String phoneNumber, OffsetDateTime since);

    List<OtpToken> findByPhoneNumberAndIsUsedFalse(String phoneNumber);
}
