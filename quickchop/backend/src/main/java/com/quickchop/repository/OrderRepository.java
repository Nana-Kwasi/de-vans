package com.quickchop.repository;

import com.quickchop.entity.Order;
import com.quickchop.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);
    List<Order> findByStatusOrderByCreatedAtDesc(OrderStatus status);
    List<Order> findAllByOrderByCreatedAtDesc();
    List<Order> findByCreatedAtBetween(OffsetDateTime start, OffsetDateTime end);
    long countByOrderNumberStartingWith(String prefix);
}
