package com.quickchop.entity;

/**
 * Lifecycle of a delivery job:
 * OPEN (in the pool, visible to every rider) → ASSIGNED (one rider claimed it) →
 * PICKED_UP (food collected from the store) → ARRIVED (rider at the drop-off) → DELIVERED.
 * ASSIGNED can return to OPEN if the rider releases it or an admin unassigns.
 */
public enum DeliveryStatus {
    OPEN,
    ASSIGNED,
    PICKED_UP,
    ARRIVED,
    DELIVERED,
    CANCELLED;

    /** A rider holds the job and its location is being shared with the customer. */
    public boolean isWithRider() {
        return this == ASSIGNED || this == PICKED_UP || this == ARRIVED;
    }

    public boolean isTerminal() {
        return this == DELIVERED || this == CANCELLED;
    }
}
