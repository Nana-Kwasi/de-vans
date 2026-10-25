package com.quickchop.config;

import com.quickchop.entity.PolicyType;
import com.quickchop.entity.Rider;
import com.quickchop.service.PolicyService;
import com.quickchop.repository.RiderRepository;
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
import java.util.Optional;
import java.util.Set;

/**
 * Authenticates rider requests (the "quickchop-rider" JWT). Unlike the admin token, every
 * rider request is checked against the database: the rider must still be active and the
 * token's version must be current, so deactivation and password resets take effect on the
 * next request rather than when the token happens to expire.
 *
 * A rider still on the temporary password an admin gave them may only change it (or read
 * their profile / sign out) — enforced here, server side, not just by the dashboard.
 */
@Component
public class RiderJwtFilter extends OncePerRequestFilter {

    private static final Set<String> ALLOWED_BEFORE_PASSWORD_CHANGE = Set.of(
            "/api/rider/me", "/api/rider/change-password", "/api/rider/logout");

    /** Reachable before accepting the current rider policies (everything else is refused). */
    private static final Set<String> ALLOWED_BEFORE_POLICIES = Set.of(
            "/api/rider/me", "/api/rider/change-password", "/api/rider/logout",
            "/api/rider/policies", "/api/rider/policies/accept");

    private final RiderJwtService jwtService;
    private final RiderRepository riderRepo;
    private final PolicyService policyService;

    public RiderJwtFilter(RiderJwtService jwtService, RiderRepository riderRepo, PolicyService policyService) {
        this.jwtService = jwtService;
        this.riderRepo = riderRepo;
        this.policyService = policyService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }
        String token = header.substring(7);
        if (!jwtService.looksLikeRiderToken(token)) {
            chain.doFilter(request, response);
            return;
        }

        Optional<Rider> rider;
        try {
            RiderJwtService.Verified v = jwtService.verify(token);
            rider = riderRepo.findById(v.riderId())
                    .filter(Rider::isActive)
                    .filter(r -> r.getTokenVersion() == v.tokenVersion());
        } catch (Exception e) {
            rider = Optional.empty();
        }
        if (rider.isEmpty()) {
            // Never fall through to the Supabase filter with a rider token: it would fail
            // there anyway, with a less useful error.
            reject(response, HttpServletResponse.SC_UNAUTHORIZED, "Session expired. Please sign in again.");
            return;
        }

        Rider r = rider.get();
        if (r.isMustChangePassword() && !ALLOWED_BEFORE_PASSWORD_CHANGE.contains(request.getRequestURI())) {
            reject(response, HttpServletResponse.SC_FORBIDDEN, "Change your temporary password first.");
            return;
        }
        if (!ALLOWED_BEFORE_POLICIES.contains(request.getRequestURI())
                && !policyService.hasAcceptedAll(PolicyType.Audience.RIDER, r.getId())) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":403,\"code\":\"POLICIES_NOT_ACCEPTED\","
                    + "\"message\":\"Accept the Rider Agreement and Privacy Notice to continue.\"}");
            return;
        }

        var auth = new UsernamePasswordAuthenticationToken(
                new RiderPrincipal(r.getId(), r.getPhoneNumber()), null,
                List.of(new SimpleGrantedAuthority("ROLE_RIDER")));
        SecurityContextHolder.getContext().setAuthentication(auth);
        chain.doFilter(new AuthHeaderStrippingRequest(request), response);
    }

    private static void reject(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"status\":" + status + ",\"message\":\"" + message + "\"}");
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
