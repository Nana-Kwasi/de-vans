package com.quickchop.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/** One point on a delivery's route, reported by the rider's device. */
@Entity
@Table(name = "delivery_locations")
public class DeliveryLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "delivery_id", nullable = false)
    private UUID deliveryId;

    @Column(nullable = false)
    private double lat;

    @Column(nullable = false)
    private double lng;

    @Column(name = "accuracy_m")
    private Double accuracyM;

    @CreationTimestamp
    @Column(name = "recorded_at", nullable = false, updatable = false)
    private OffsetDateTime recordedAt;

    public DeliveryLocation() {}

    public DeliveryLocation(UUID deliveryId, double lat, double lng, Double accuracyM) {
        this.deliveryId = deliveryId;
        this.lat = lat;
        this.lng = lng;
        this.accuracyM = accuracyM;
    }

    public UUID getId() { return id; }
    public UUID getDeliveryId() { return deliveryId; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public Double getAccuracyM() { return accuracyM; }
    public OffsetDateTime getRecordedAt() { return recordedAt; }
}
