package com.quickchop.entity;

public enum OrderStatus {
    ORDER_RECEIVED,
    PREPARING,
    OUT_FOR_DELIVERY,  // delivery flow only
    DELIVERED,         // delivery flow only (terminal)
    READY,             // pickup flow only — ready for collection (terminal)
    CANCELLED
}
