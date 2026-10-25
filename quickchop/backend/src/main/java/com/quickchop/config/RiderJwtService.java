package com.quickchop.config;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * Issues and verifies rider session JWTs — separate from the admin token, with its own
 * issuer ("quickchop-rider") and its own key, so a rider token can never pass as an admin
 * one. Each token carries the rider's token version ("tv"); RiderJwtFilter rejects any
 * token whose version no longer matches the database, which is how deactivating a rider
 * or resetting their password signs them out everywhere immediately.
 */
@Service
public class RiderJwtService {

    public static final String ISSUER = "quickchop-rider";

    private final byte[] secret;
    private final long expiryMinutes;

    public RiderJwtService(
            @Value("${rider.jwt.secret:}") String riderSecret,
            @Value("${admin.jwt.secret}") String adminSecret,
            @Value("${rider.jwt.expiry-minutes:720}") long expiryMinutes) {
        if (riderSecret != null && !riderSecret.isBlank()) {
            byte[] raw = riderSecret.getBytes(StandardCharsets.UTF_8);
            if (raw.length < 32) {
                throw new IllegalStateException("RIDER_JWT_SECRET must be at least 32 bytes for HS256 signing.");
            }
            this.secret = raw;
        } else {
            // No dedicated secret configured: derive one from the admin secret, so the two
            // keys still differ and existing deployments start without a new env var.
            this.secret = derive(adminSecret, "quickchop-rider-jwt-v1");
        }
        this.expiryMinutes = expiryMinutes;
    }

    public String issue(UUID riderId, String phone, int tokenVersion) {
        try {
            Date now = new Date();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .issuer(ISSUER)
                    .subject(riderId.toString())
                    .claim("phone", phone)
                    .claim("role", "RIDER")
                    .claim("tv", tokenVersion)
                    .issueTime(now)
                    .expirationTime(new Date(now.getTime() + expiryMinutes * 60_000))
                    .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
            jwt.sign(new MACSigner(secret));
            return jwt.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to sign rider JWT", e);
        }
    }

    public boolean looksLikeRiderToken(String token) {
        try {
            return ISSUER.equals(SignedJWT.parse(token).getJWTClaimsSet().getIssuer());
        } catch (Exception e) {
            return false;
        }
    }

    /** Verified claims of a rider token: id, phone and token version. */
    public record Verified(UUID riderId, String phone, int tokenVersion) {}

    public Verified verify(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!JWSAlgorithm.HS256.equals(jwt.getHeader().getAlgorithm()) || !jwt.verify(new MACVerifier(secret))) {
                throw new SecurityException("Bad rider token signature");
            }
            JWTClaimsSet c = jwt.getJWTClaimsSet();
            if (!ISSUER.equals(c.getIssuer())) throw new SecurityException("Wrong issuer");
            if (c.getExpirationTime() == null || c.getExpirationTime().before(new Date())) {
                throw new SecurityException("Rider token expired");
            }
            Long tv = c.getLongClaim("tv");
            return new Verified(UUID.fromString(c.getSubject()), c.getStringClaim("phone"),
                    tv == null ? -1 : tv.intValue());
        } catch (Exception e) {
            throw new SecurityException("Invalid rider token", e);
        }
    }

    private static byte[] derive(String key, String label) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(label.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot derive rider JWT key", e);
        }
    }
}
