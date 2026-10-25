package com.quickchop.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** The caller's IP and device string, as recorded with consent (same IP logic as rate limiting). */
@Component
public class ClientInfo {

    private final int proxyHops;

    public ClientInfo(@Value("${quickchop.rate-limit.proxy-hops:1}") int proxyHops) {
        this.proxyHops = proxyHops;
    }

    public String ip(HttpServletRequest request) {
        return RateLimitFilter.clientIp(request, proxyHops);
    }

    public String userAgent(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");
        return ua == null || ua.isBlank() ? null : ua;
    }
}
