package com.aes.repository;

import com.aes.entity.Quote;
import com.aes.enums.QuoteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface QuoteRepository extends JpaRepository<Quote, UUID> {

    Optional<Quote> findByQuoteNumber(String quoteNumber);

    /** All quote versions for an installation, latest version first. */
    List<Quote> findByInstallIdOrderByVersionDesc(UUID installId);

    /** All quote versions for a service ticket (typically just one). */
    List<Quote> findByTicketIdOrderByVersionDesc(UUID ticketId);

    /** Approval queue (PENDING_APPROVAL) — what SM / Admin see in their queue. */
    List<Quote> findByStatusOrderByCreatedAtAsc(QuoteStatus status);

    /** Count of quotes currently sitting in a particular status. */
    long countByStatus(QuoteStatus status);

    /** Latest version number for the given install (NULL → no quote yet). */
    @Query("SELECT MAX(q.version) FROM Quote q WHERE q.install.id = :installId")
    Integer findMaxVersionByInstallId(@org.springframework.data.repository.query.Param("installId") UUID installId);

    /** Latest version number for the given ticket (NULL → no estimate yet). */
    @Query("SELECT MAX(q.version) FROM Quote q WHERE q.ticket.id = :ticketId")
    Integer findMaxVersionByTicketId(@org.springframework.data.repository.query.Param("ticketId") UUID ticketId);

    /** All quotes for the customer's view of a property (active + history). */
    @Query("SELECT q FROM Quote q WHERE q.install.customer.id = :customerId " +
           "OR q.ticket.customer.id = :customerId ORDER BY q.createdAt DESC")
    List<Quote> findAllForCustomer(@org.springframework.data.repository.query.Param("customerId") UUID customerId);

    /** Quote sequence — yearly counter for quote_number generation. */
    @Query(value = "SELECT nextval('quote_seq')", nativeQuery = true)
    Long getNextQuoteSequence();
}
