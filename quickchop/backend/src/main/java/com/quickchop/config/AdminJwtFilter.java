package com.quickchop.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authenticates admin requests using the Spring-issued admin JWT. Runs before the
 * OAuth2 (Supabase) resource-server filter. When an admin token is present and valid,
 * it sets a ROLE_ADMIN authentication and strips the Authorization header downstream
 * so the Supabase JWT filter ignores the request (it can't validate an admin token).
 * Non-admin bearer tokens fall through untouched to the Supabase resource server.
 */
@Component
public class AdminJwtFilter extends OncePerRequestFilter {

    private final AdminJwtService adminJwtService;

    public AdminJwtFilter(AdminJwtService adminJwtService) {
        this.adminJwtService = adminJwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (adminJwtService.looksLikeAdminToken(token)) {
                try {
                    AdminPrincipal principal = adminJwtService.verify(token);
                    var auth = new UsernamePasswordAuthenticationToken(
                            principal, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                    chain.doFilter(new AuthHeaderStrippingRequest(request), response);
                    return;
                } catch (Exception ignored) {
                    // Invalid admin token — leave unauthenticated; authorization rules 401 later.
                }
            }
        }
        chain.doFilter(request, response);
    }

    /** Hides the Authorization header so downstream (Supabase) auth skips this request. */
    private static class AuthHeaderStrippingRequest extends HttpServletRequestWrapper {
        AuthHeaderStrippingRequest(HttpServletRequest request) {
            super(request);
        }

        @Override
        public String getHeader(String name) {
            if ("Authorization".equalsIgnoreCase(name)) return null;
            return super.getHeader(name);
        }
    }
}
