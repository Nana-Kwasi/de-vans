package com.quickchop.config;

import java.util.UUID;

/** The authenticated admin, held as the Authentication principal on admin requests. */
public record AdminPrincipal(UUID id, String email) {}
