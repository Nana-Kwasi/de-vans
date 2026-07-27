package com.quickchop.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/** Helpers to read the current authenticated principal from the security context. */
public final class AuthContext {

    private AuthContext() {}

    /** Supabase auth user id (the JWT 'sub' claim) for the current customer request. */
    public static UUID currentSupabaseAuthId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return UUID.fromString(jwt.getSubject());
        }
        throw new IllegalStateException("No authenticated customer in context");
    }

    /** The current admin principal, if the request was authenticated as admin. */
    public static AdminPrincipal currentAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AdminPrincipal admin) {
            return admin;
        }
        throw new IllegalStateException("No authenticated admin in context");
    }

    public static boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }
}
