package com.quickchop.entity;

public enum OrderStatus {
    ORDER_RECEIVED,
    PREPARING,
    AWAITING_RIDER,    // delivery flow only — food ready, offered to every rider
    RIDER_ASSIGNED,    // delivery flow only — a rider accepted, heading to the store
    OUT_FOR_DELIVERY,  // delivery flow only
    DELIVERED,         // delivery flow only (terminal)
    READY,             // pickup flow only — ready for collection (terminal)
    CANCELLED
}
