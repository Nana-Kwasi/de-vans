package com.quickchop.repository;

import com.quickchop.entity.SupportTicket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, UUID> {
    List<SupportTicket> findAllByOrderByCreatedAtDesc();
    List<SupportTicket> findByStatusOrderByCreatedAtDesc(String status);
    long countByCustomerIdAndStatus(UUID customerId, String status);
}
