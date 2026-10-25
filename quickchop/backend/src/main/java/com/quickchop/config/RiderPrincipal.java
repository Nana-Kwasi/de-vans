package com.quickchop.config;

import java.util.UUID;

/** The authenticated rider, held as the Authentication principal on rider requests. */
public record RiderPrincipal(UUID id, String phoneNumber) {}
