package com.quickchop.config;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * Issues and verifies the admin session JWT. This is Spring Boot's OWN token,
 * HMAC-signed with the admin secret (separate from Supabase). Admin tokens are
 * identified by the issuer claim "quickchop-admin".
 */
@Service
public class AdminJwtService {

    public static final String ISSUER = "quickchop-admin";

    private final byte[] secret;
    private final long expiryMinutes;

    public AdminJwtService(
            @Value("${admin.jwt.secret}") String secret,
            @Value("${admin.jwt.expiry-minutes:720}") long expiryMinutes) {
        byte[] raw = secret.getBytes(StandardCharsets.UTF_8);
        if (raw.length < 32) {
            throw new IllegalStateException(
                "ADMIN_JWT_SECRET must be at least 32 bytes for HS256 signing.");
        }
        this.secret = raw;
        this.expiryMinutes = expiryMinutes;
    }

    public String issue(UUID adminId, String email) {
        try {
            Date now = new Date();
            Date exp = new Date(now.getTime() + expiryMinutes * 60_000);
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .issuer(ISSUER)
                    .subject(adminId.toString())
                    .claim("email", email)
                    .claim("role", "ADMIN")
                    .issueTime(now)
                    .expirationTime(exp)
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(new MACSigner(secret));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to sign admin JWT", e);
        }
    }

    /** Cheap, unverified check of whether a token claims to be an admin token. */
    public boolean looksLikeAdminToken(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            return ISSUER.equals(jwt.getJWTClaimsSet().getIssuer());
        } catch (Exception e) {
            return false;
        }
    }

    /** Verifies signature + expiry and returns the admin principal, or throws. */
    public AdminPrincipal verify(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!jwt.verify(new MACVerifier(secret))) {
                throw new SecurityException("Bad admin token signature");
            }
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            if (!ISSUER.equals(claims.getIssuer())) {
                throw new SecurityException("Wrong issuer");
            }
            if (claims.getExpirationTime() == null || claims.getExpirationTime().before(new Date())) {
                throw new SecurityException("Admin token expired");
            }
            return new AdminPrincipal(
                    UUID.fromString(claims.getSubject()),
                    (String) claims.getClaim("email"));
        } catch (Exception e) {
            throw new SecurityException("Invalid admin token", e);
        }
    }
}
