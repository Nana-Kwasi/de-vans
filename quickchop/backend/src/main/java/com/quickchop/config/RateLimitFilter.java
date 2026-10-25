package com.quickchop.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

/**
 * Per-client-IP rate limiting, applied before authentication so it also covers anonymous
 * endpoints (logins, password reset) — the ones brute force actually targets.
 *
 * Fixed windows held in memory. That is per instance: with N Cloud Run instances an
 * attacker gets up to N x the limit, which is still enough to make password guessing
 * impractical when combined with the per-account lockout in AdminService / RiderService
 * (that one lives in the database, so it holds across instances). A shared store (Redis)
 * is the upgrade if exact global limits ever matter.
 *
 * Limits are deliberately generous for normal traffic: Ghanaian mobile networks put many
 * customers behind one carrier-grade NAT address, so a tight general limit would lock
 * out real people who merely share an IP.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    /** A limit on requests matching `pattern` (and method, if set). First match wins. */
    record Rule(String name, String method, Pattern pattern, int limit, long windowMs) {}

    private final List<Rule> rules;
    private final int trustedProxyHops;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong requests = new AtomicLong();

    private static final class Window {
        final long start;
        final AtomicLong count = new AtomicLong();
        Window(long start) { this.start = start; }
    }

    public RateLimitFilter(int trustedProxyHops, int generalPerMinute, int loginPerMinute) {
        this.trustedProxyHops = Math.max(0, trustedProxyHops);
        long min = 60_000;
        this.rules = List.of(
                new Rule("login", "POST", Pattern.compile("^/api/(admin|rider)/login$"), loginPerMinute, min),
                new Rule("password", "POST",
                        Pattern.compile("^/api/admin/(forgot|reset)-password$"), 5, 15 * min),
                new Rule("password-change", "PATCH", Pattern.compile("^/api/(admin|rider)/change-password$"), 5, 15 * min),
                new Rule("delivery-pin", "POST", Pattern.compile("^/api/rider/deliveries/[^/]+/complete$"), 10, min),
                new Rule("accept", "POST", Pattern.compile("^/api/rider/deliveries/[^/]+/accept$"), 30, min),
                new Rule("rider-location", "POST", Pattern.compile("^/api/rider/location$"), 40, min),
                new Rule("api", null, Pattern.compile("^/api/.*"), generalPerMinute, min));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response); // CORS preflight carries no credentials
            return;
        }
        String path = request.getRequestURI();
        Rule rule = match(request.getMethod(), path);
        if (rule == null) {
            chain.doFilter(request, response);
            return;
        }

        long now = System.currentTimeMillis();
        String key = rule.name() + "|" + clientIp(request);
        Window w = windows.compute(key, (k, cur) ->
                (cur == null || now - cur.start >= rule.windowMs()) ? new Window(now) : cur);
        long count = w.count.incrementAndGet();

        if ((requests.incrementAndGet() & 0x3FF) == 0) evictExpired(now);

        response.setHeader("X-RateLimit-Limit", String.valueOf(rule.limit()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, rule.limit() - count)));
        if (count > rule.limit()) {
            long retryAfter = Math.max(1, (w.start + rule.windowMs() - now) / 1000);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType("application/json");
            response.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\",\"message\":"
                    + "\"Too many requests. Please wait " + retryAfter + " seconds and try again.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    private Rule match(String method, String path) {
        for (Rule r : rules) {
            if (r.method() != null && !r.method().equalsIgnoreCase(method)) continue;
            if (r.pattern().matcher(path).matches()) return r;
        }
        return null;
    }

    /**
     * The client address. Behind a proxy the TCP peer is the proxy, so the address comes
     * from X-Forwarded-For — but only the entries the trusted proxies appended. The left
     * end of that header is whatever the client chose to send, so reading it (as many
     * examples do) lets an attacker pick a fresh "IP" per request and walk straight past
     * the limit. With one trusted hop (Cloud Run) the right-most entry is the real client.
     */
    String clientIp(HttpServletRequest request) {
        return clientIp(request, trustedProxyHops);
    }

    /** Shared with consent recording, which stores the same address as proof. */
    public static String clientIp(HttpServletRequest request, int trustedProxyHops) {
        String xff = request.getHeader("X-Forwarded-For");
        if (trustedProxyHops > 0 && xff != null && !xff.isBlank()) {
            String[] parts = xff.split(",");
            int idx = parts.length - trustedProxyHops;
            if (idx >= 0) return parts[idx].trim();
            return parts[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void evictExpired(long now) {
        windows.entrySet().removeIf(e -> now - e.getValue().start > 15 * 60_000);
    }
}
