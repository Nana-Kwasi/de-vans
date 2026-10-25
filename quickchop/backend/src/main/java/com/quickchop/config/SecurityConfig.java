package com.quickchop.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.core.Ordered;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.expression.WebExpressionAuthorizationManager;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.util.matcher.AnyRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class SecurityConfig {

    private final AdminJwtFilter adminJwtFilter;
    private final RiderJwtFilter riderJwtFilter;

    public SecurityConfig(AdminJwtFilter adminJwtFilter, RiderJwtFilter riderJwtFilter) {
        this.adminJwtFilter = adminJwtFilter;
        this.riderJwtFilter = riderJwtFilter;
    }

    /** Customer endpoints: any authenticated caller except a rider (who has no customer
     *  profile and must not reach customer or order data through those routes). */
    private static final WebExpressionAuthorizationManager NOT_RIDER =
            new WebExpressionAuthorizationManager("isAuthenticated() and !hasRole('RIDER')");

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(h -> h
                // SAMEORIGIN rather than off: the local H2 console frames itself, nothing
                // else should be able to frame any response.
                .frameOptions(f -> f.sameOrigin())
                // HSTS on every response. Spring only adds it to requests it sees as HTTPS,
                // and behind Cloud Run's TLS termination it sees plain HTTP. Browsers
                // ignore the header on genuine http://localhost, so dev is unaffected.
                .httpStrictTransportSecurity(hsts -> hsts
                        .requestMatcher(AnyRequestMatcher.INSTANCE)
                        .includeSubDomains(true)
                        .maxAgeInSeconds(31536000))
                .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                .permissionsPolicy(pp -> pp.policy("camera=(), microphone=(), geolocation=()")))
            .authorizeHttpRequests(auth -> auth
                // --- Public ---
                .requestMatchers("/api/admin/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/rider/login").permitAll()
                // Password reset is necessarily anonymous — someone locked out has no
                // token. Must be listed before the /api/admin/** ADMIN rule below.
                .requestMatchers(HttpMethod.POST, "/api/admin/forgot-password").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/admin/reset-password").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/menu").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/config").permitAll()
                // Policies are public: the website and app-store listings link to them.
                .requestMatchers(HttpMethod.GET, "/api/policies", "/api/policies/*").permitAll()
                .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()
                .requestMatchers("/api/payments/paystack/webhook").permitAll()
                .requestMatchers(
                        "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**",
                        "/h2-console/**", "/actuator/health").permitAll()
                // --- Admin only ---
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/dashboard/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/menu/upload").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/menu").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/menu/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/orders").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/orders/*/status").hasRole("ADMIN")
                // --- Riders (admin-created accounts; see RiderJwtFilter) ---
                .requestMatchers("/api/rider/**").hasRole("RIDER")
                // --- Everything else needs a valid customer or admin token ---
                .anyRequest().access(NOT_RIDER)
            )
            // Supabase JWT validation for customer endpoints
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()))
            // Admin and rider JWT filters run first; each only claims its own issuer's tokens.
            .addFilterBefore(adminJwtFilter, BearerTokenAuthenticationFilter.class)
            .addFilterBefore(riderJwtFilter, BearerTokenAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Rate limiting runs as a plain servlet filter ahead of Spring Security, so rejected
     * floods never reach JWT parsing, BCrypt or the database.
     *
     * RATE_LIMIT_PROXY_HOPS is how many trusted proxies append to X-Forwarded-For: 1 on
     * Cloud Run (the default), 0 when the API is reached directly.
     */
    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilter(
            @Value("${quickchop.rate-limit.proxy-hops:1}") int proxyHops,
            @Value("${quickchop.rate-limit.general-per-minute:300}") int generalPerMinute,
            @Value("${quickchop.rate-limit.login-per-minute:10}") int loginPerMinute) {
        FilterRegistrationBean<RateLimitFilter> reg =
                new FilterRegistrationBean<>(new RateLimitFilter(proxyHops, generalPerMinute, loginPerMinute));
        reg.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        reg.addUrlPatterns("/api/*");
        return reg;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Browser origins allowed to call the API, comma separated, from
     * CORS_ALLOWED_ORIGINS. Blank (the default) keeps the permissive
     * any-origin behaviour that local development relies on.
     *
     * Only browsers are affected: the mobile app sends no Origin header, so
     * tightening this cannot break it. Set it once the admin dashboard has a
     * real URL — a deployed API that reflects any origin is worth closing.
     */
    @Value("${quickchop.cors.allowed-origins:}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toList();

        if (origins.isEmpty()) {
            config.setAllowedOriginPatterns(List.of("*"));
        } else {
            // Exact origins, not patterns: an explicit list is the point of setting it.
            config.setAllowedOrigins(origins);
        }

        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
