package com.quickchop.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** One delivery job per order, created when an admin dispatches the order to riders. */
@Entity
@Table(name = "deliveries")
public class Delivery {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false, unique = true)
    private UUID orderId;

    @Column(name = "rider_id")
    private UUID riderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DeliveryStatus status = DeliveryStatus.OPEN;

    /** What the rider is paid for this job (the order's delivery fee at dispatch). */
    @Column(name = "rider_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal riderFee = BigDecimal.ZERO;

    @Column(name = "dispatch_note", columnDefinition = "text")
    private String dispatchNote;

    @Column(name = "delivery_pin", nullable = false, length = 6)
    private String deliveryPin;

    @Column(name = "pin_attempts", nullable = false)
    private int pinAttempts = 0;

    @Column(name = "dispatched_by")
    private UUID dispatchedBy;

    @Column(name = "dispatched_at", nullable = false)
    private OffsetDateTime dispatchedAt;

    @Column(name = "accepted_at")
    private OffsetDateTime acceptedAt;

    @Column(name = "picked_up_at")
    private OffsetDateTime pickedUpAt;

    @Column(name = "arrived_at")
    private OffsetDateTime arrivedAt;

    @Column(name = "delivered_at")
    private OffsetDateTime deliveredAt;

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    @Column(name = "completed_by_admin", nullable = false)
    private boolean completedByAdmin = false;

    /** Optimistic lock: two riders (or a rider and an admin) acting at once cannot both win. */
    @Version
    @Column(nullable = false)
    private long version;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public UUID getRiderId() { return riderId; }
    public void setRiderId(UUID riderId) { this.riderId = riderId; }
    public DeliveryStatus getStatus() { return status; }
    public void setStatus(DeliveryStatus status) { this.status = status; }
    public BigDecimal getRiderFee() { return riderFee; }
    public void setRiderFee(BigDecimal riderFee) { this.riderFee = riderFee; }
    public String getDispatchNote() { return dispatchNote; }
    public void setDispatchNote(String dispatchNote) { this.dispatchNote = dispatchNote; }
    public String getDeliveryPin() { return deliveryPin; }
    public void setDeliveryPin(String deliveryPin) { this.deliveryPin = deliveryPin; }
    public int getPinAttempts() { return pinAttempts; }
    public void setPinAttempts(int pinAttempts) { this.pinAttempts = pinAttempts; }
    public UUID getDispatchedBy() { return dispatchedBy; }
    public void setDispatchedBy(UUID dispatchedBy) { this.dispatchedBy = dispatchedBy; }
    public OffsetDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(OffsetDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }
    public OffsetDateTime getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(OffsetDateTime acceptedAt) { this.acceptedAt = acceptedAt; }
    public OffsetDateTime getPickedUpAt() { return pickedUpAt; }
    public void setPickedUpAt(OffsetDateTime pickedUpAt) { this.pickedUpAt = pickedUpAt; }
    public OffsetDateTime getArrivedAt() { return arrivedAt; }
    public void setArrivedAt(OffsetDateTime arrivedAt) { this.arrivedAt = arrivedAt; }
    public OffsetDateTime getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(OffsetDateTime deliveredAt) { this.deliveredAt = deliveredAt; }
    public OffsetDateTime getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(OffsetDateTime cancelledAt) { this.cancelledAt = cancelledAt; }
    public boolean isCompletedByAdmin() { return completedByAdmin; }
    public void setCompletedByAdmin(boolean completedByAdmin) { this.completedByAdmin = completedByAdmin; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
}
