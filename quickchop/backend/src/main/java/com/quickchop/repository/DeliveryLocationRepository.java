package com.quickchop.repository;

import com.quickchop.entity.DeliveryLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryLocationRepository extends JpaRepository<DeliveryLocation, UUID> {
    List<DeliveryLocation> findByDeliveryIdOrderByRecordedAtAsc(UUID deliveryId);
    Optional<DeliveryLocation> findFirstByDeliveryIdOrderByRecordedAtDesc(UUID deliveryId);

    @Modifying
    @Query("delete from DeliveryLocation l where l.recordedAt < :before")
    int deleteRecordedBefore(@Param("before") OffsetDateTime before);
}
