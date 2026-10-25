package com.quickchop.repository;

import com.quickchop.entity.Order;
import com.quickchop.entity.OrderStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);
    List<Order> findByStatusOrderByCreatedAtDesc(OrderStatus status);
    List<Order> findAllByOrderByCreatedAtDesc();
    List<Order> findByCreatedAtBetween(OffsetDateTime start, OffsetDateTime end);
    long countByOrderNumberStartingWith(String prefix);

    /** Forgets drop-off coordinates on old orders (the address text stays for records). */
    @Modifying
    @Query("""
           update Order o set o.deliveryLat = null, o.deliveryLng = null, o.deliveryAccuracyM = null
            where o.createdAt < :before and o.deliveryLat is not null""")
    int clearDeliveryCoordinatesBefore(@Param("before") OffsetDateTime before);

    /** Admin search: order number, contact phone, address, or any order by the given customers. */
    @Query("""
           select o from Order o
            where lower(o.orderNumber) like :q or lower(o.deliveryAddress) like :q
               or (:phone <> '' and o.contactPhone like :phone)
               or o.customerId in :customerIds
            order by o.createdAt desc""")
    List<Order> search(@Param("q") String q,
                       @Param("phone") String phone,
                       @Param("customerIds") Collection<UUID> customerIds,
                       Pageable page);
}
