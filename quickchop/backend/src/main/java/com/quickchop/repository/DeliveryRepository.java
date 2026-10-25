package com.quickchop.repository;

import com.quickchop.entity.Delivery;
import com.quickchop.entity.DeliveryStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryRepository extends JpaRepository<Delivery, UUID> {
    Optional<Delivery> findByOrderId(UUID orderId);
    List<Delivery> findByOrderIdIn(Collection<UUID> orderIds);
    List<Delivery> findByStatusOrderByDispatchedAtAsc(DeliveryStatus status);
    List<Delivery> findByStatusInOrderByDispatchedAtAsc(Collection<DeliveryStatus> statuses);
    List<Delivery> findByRiderIdAndStatusInOrderByAcceptedAtAsc(UUID riderId, Collection<DeliveryStatus> statuses);
    List<Delivery> findByRiderIdAndStatusOrderByDeliveredAtDesc(UUID riderId, DeliveryStatus status);
    List<Delivery> findByStatusInAndDispatchedAtAfterOrderByDispatchedAtDesc(
            Collection<DeliveryStatus> statuses, OffsetDateTime after);
    long countByRiderIdAndStatusIn(UUID riderId, Collection<DeliveryStatus> statuses);

    /**
     * Atomically claims an OPEN job for a rider. The WHERE clause is the guarantee that a
     * job goes to exactly one rider: when two riders tap Accept together, the database
     * applies one update and the other matches zero rows.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
           update Delivery d
              set d.riderId = :riderId, d.status = :assigned, d.acceptedAt = :now,
                  d.version = d.version + 1
            where d.id = :id and d.status = :open and d.riderId is null
           """)
    int claim(@Param("id") UUID id, @Param("riderId") UUID riderId, @Param("now") OffsetDateTime now,
              @Param("open") DeliveryStatus open, @Param("assigned") DeliveryStatus assigned);
}
