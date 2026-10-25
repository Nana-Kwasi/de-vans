package com.quickchop.entity;

/** The documents people agree to. Customers accept the CUSTOMER_* ones, riders the RIDER_* ones. */
public enum PolicyType {
    CUSTOMER_PRIVACY("customer-privacy", Audience.CUSTOMER),
    CUSTOMER_TERMS("customer-terms", Audience.CUSTOMER),
    RIDER_PRIVACY("rider-privacy", Audience.RIDER),
    RIDER_TERMS("rider-terms", Audience.RIDER);

    public enum Audience { CUSTOMER, RIDER }

    /** URL-friendly name, also the seed file name (policies/<slug>.md). */
    public final String slug;
    public final Audience audience;

    PolicyType(String slug, Audience audience) {
        this.slug = slug;
        this.audience = audience;
    }

    public static PolicyType fromSlug(String slug) {
        for (PolicyType t : values()) if (t.slug.equalsIgnoreCase(slug) || t.name().equalsIgnoreCase(slug)) return t;
        throw new IllegalArgumentException("Unknown policy: " + slug);
    }
}
