package com.quickchop.service;

import com.quickchop.config.AdminJwtService;
import com.quickchop.config.AdminPrincipal;
import com.quickchop.config.AuthContext;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.AdminPasswordResetToken;
import com.quickchop.entity.AdminUser;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.LockedException;
import com.quickchop.exception.ApiExceptions.UnauthorizedException;
import com.quickchop.repository.AdminPasswordResetTokenRepository;
import com.quickchop.repository.AdminUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AdminUserRepository repo;
    private final PasswordEncoder encoder;
    private final AdminJwtService jwtService;
    private final AdminPasswordResetTokenRepository resetTokenRepo;
    private final EmailService emailService;
    private final String businessName;
    private final String adminUrl;
    private final int resetExpiryMinutes;

    public AdminService(AdminUserRepository repo, PasswordEncoder encoder, AdminJwtService jwtService,
                        AdminPasswordResetTokenRepository resetTokenRepo, EmailService emailService,
                        @Value("${quickchop.business-name:Qooka Qooks Restaurant}") String businessName,
                        @Value("${app.admin-url:http://localhost:5173}") String adminUrl,
                        @Value("${app.password-reset.expiry-minutes:60}") int resetExpiryMinutes) {
        this.repo = repo;
        this.encoder = encoder;
        this.jwtService = jwtService;
        this.resetTokenRepo = resetTokenRepo;
        this.emailService = emailService;
        this.businessName = businessName;
        this.adminUrl = adminUrl.replaceAll("/+$", "");
        this.resetExpiryMinutes = resetExpiryMinutes;
    }

    /** Failed sign-ins allowed before the account locks, and for how long it locks. */
    static final int MAX_FAILED_LOGINS = 5;
    static final int LOCKOUT_MINUTES = 15;

    /** Compared against when the email is unknown, so a miss costs the same BCrypt time
     *  as a wrong password and response timing does not reveal which emails exist. */
    private String dummyHash;

    @Transactional(noRollbackFor = {UnauthorizedException.class, LockedException.class})
    public AdminLoginResponse login(AdminLoginRequest req) {
        Optional<AdminUser> found = repo.findByEmail(req.email().toLowerCase())
                .or(() -> repo.findByEmail(req.email()));
        if (found.isEmpty()) {
            if (dummyHash == null) dummyHash = encoder.encode("timing-equaliser");
            encoder.matches(req.password(), dummyHash);
            throw new UnauthorizedException("Invalid email or password");
        }
        AdminUser admin = found.get();
        OffsetDateTime now = OffsetDateTime.now();
        if (admin.getLockedUntil() != null && admin.getLockedUntil().isAfter(now)) {
            throw new LockedException("Too many failed sign-in attempts. Try again in "
                    + LOCKOUT_MINUTES + " minutes, or reset your password.");
        }
        if (!encoder.matches(req.password(), admin.getPasswordHash())) {
            int failed = admin.getFailedLoginCount() + 1;
            if (failed >= MAX_FAILED_LOGINS) {
                admin.setLockedUntil(now.plusMinutes(LOCKOUT_MINUTES));
                admin.setFailedLoginCount(0);
                log.warn("Admin account {} locked after {} failed sign-ins", admin.getEmail(), failed);
            } else {
                admin.setFailedLoginCount(failed);
            }
            repo.save(admin);
            throw new UnauthorizedException("Invalid email or password");
        }
        if (admin.getFailedLoginCount() != 0 || admin.getLockedUntil() != null) {
            admin.setFailedLoginCount(0);
            admin.setLockedUntil(null);
            repo.save(admin);
        }
        String token = jwtService.issue(admin.getId(), admin.getEmail());
        return new AdminLoginResponse(token, admin.getEmail(), admin.getFullName(),
                admin.isMustChangePassword());
    }

    public void changePassword(ChangePasswordRequest req) {
        AdminPrincipal principal = AuthContext.currentAdmin();
        AdminUser admin = repo.findById(principal.id())
                .orElseThrow(() -> new UnauthorizedException("Admin not found"));
        if (!encoder.matches(req.currentPassword(), admin.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        admin.setPasswordHash(encoder.encode(req.newPassword()));
        // Choosing a password clears the invite state, whichever route got them here.
        admin.setMustChangePassword(false);
        repo.save(admin);
    }

    /**
     * Invites another admin.
     *
     * The temporary password is generated here, returned once so the inviting admin can
     * pass it on if email fails, and emailed to the new admin. Only its bcrypt hash is
     * stored, so it cannot be read back afterwards — a second invite is the way to
     * recover, which is also why mustChangePassword forces it to be replaced.
     */
    @Transactional
    public AdminInviteResponse invite(AdminInviteRequest req) {
        String email = req.email().trim().toLowerCase();
        if (repo.existsByEmail(email)) {
            throw new BadRequestException("An admin with that email already exists.");
        }
        AdminPrincipal actor = AuthContext.currentAdmin();

        // Ambiguous characters left out: this gets read off a screen and retyped.
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 12; i++) sb.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        String temporary = sb.toString();

        AdminUser admin = new AdminUser();
        admin.setEmail(email);
        admin.setFullName(req.fullName().trim());
        admin.setPasswordHash(encoder.encode(temporary));
        admin.setMustChangePassword(true);
        admin.setCreatedBy(actor.id());
        AdminUser saved = repo.save(admin);

        emailService.send(
                saved.getEmail(),
                "%s — your admin account".formatted(businessName),
                EmailTemplates.adminInviteText(businessName, saved.getFullName(), saved.getEmail(), temporary, adminUrl),
                EmailTemplates.adminInviteHtml(businessName, saved.getFullName(), saved.getEmail(), temporary, adminUrl));

        log.info("Admin {} invited {}", actor.email(), saved.getEmail());
        return new AdminInviteResponse(saved.getId(), saved.getEmail(), saved.getFullName(),
                temporary, emailService.isEnabled());
    }

    public List<AdminUserDto> listAdmins() {
        return repo.findAll().stream()
                .map(a -> new AdminUserDto(a.getId(), a.getEmail(), a.getFullName(),
                        a.isMustChangePassword(), a.getCreatedAt()))
                .toList();
    }

    /**
     * Starts a password reset. Returns normally whether or not the email matches an
     * account: telling an anonymous caller which addresses are admins would hand them
     * half of a login.
     */
    @Transactional
    public void requestPasswordReset(ForgotPasswordRequest req) {
        String email = req.email().trim();
        Optional<AdminUser> found = repo.findByEmail(email.toLowerCase()).or(() -> repo.findByEmail(email));
        if (found.isEmpty()) {
            log.info("Password reset requested for unknown address — no email sent.");
            return;
        }
        AdminUser admin = found.get();

        // Only the most recent link should work, so earlier unused ones are dropped.
        resetTokenRepo.deleteUnusedForAdmin(admin.getId());

        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        AdminPasswordResetToken entity = new AdminPasswordResetToken();
        entity.setAdminId(admin.getId());
        entity.setTokenHash(sha256(token));
        entity.setExpiresAt(OffsetDateTime.now().plusMinutes(resetExpiryMinutes));
        resetTokenRepo.save(entity);

        String link = "%s/reset-password?token=%s".formatted(adminUrl, token);
        emailService.send(
                admin.getEmail(),
                "%s — reset your admin password".formatted(businessName),
                EmailTemplates.resetText(businessName, link, token, resetExpiryMinutes),
                EmailTemplates.resetHtml(businessName, link, token, resetExpiryMinutes));
    }

    /** Completes a reset. The token is single-use and expires. */
    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        AdminPasswordResetToken entity = resetTokenRepo.findByTokenHash(sha256(req.token().trim()))
                .orElseThrow(() -> new BadRequestException("This reset link is invalid or has already been used."));

        if (entity.getUsedAt() != null) {
            throw new BadRequestException("This reset link has already been used.");
        }
        if (entity.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new BadRequestException("This reset link has expired. Request a new one.");
        }

        AdminUser admin = repo.findById(entity.getAdminId())
                .orElseThrow(() -> new BadRequestException("This reset link is no longer valid."));

        admin.setPasswordHash(encoder.encode(req.newPassword()));
        // Proving control of the mailbox is the way out of a lockout.
        admin.setFailedLoginCount(0);
        admin.setLockedUntil(null);
        repo.save(admin);

        entity.setUsedAt(OffsetDateTime.now());
        resetTokenRepo.save(entity);
        log.info("Password reset completed for admin {}", admin.getEmail());
    }

    /** Hex SHA-256. Tokens are compared by hash so the raw value need never be stored. */
    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
