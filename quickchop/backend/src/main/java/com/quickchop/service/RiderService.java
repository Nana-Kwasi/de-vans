package com.quickchop.service;

import com.quickchop.config.AdminPrincipal;
import com.quickchop.config.AuthContext;
import com.quickchop.config.RiderJwtService;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.Delivery;
import com.quickchop.entity.DeliveryStatus;
import com.quickchop.entity.Rider;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.LockedException;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.exception.ApiExceptions.UnauthorizedException;
import com.quickchop.repository.DeliveryRepository;
import com.quickchop.repository.RiderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Rider accounts. Admins create, edit, deactivate and reset riders; riders can only sign
 * in, change their own password and toggle whether they are online.
 */
@Service
public class RiderService {

    private static final Logger log = LoggerFactory.getLogger(RiderService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    static final int MAX_FAILED_LOGINS = 5;
    static final int LOCKOUT_MINUTES = 15;
    static final Set<DeliveryStatus> WITH_RIDER =
            EnumSet.of(DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.ARRIVED);

    private final RiderRepository repo;
    private final DeliveryRepository deliveryRepo;
    private final DeliveryService deliveryService;
    private final PasswordEncoder encoder;
    private final RiderJwtService jwtService;
    private String dummyHash;

    public RiderService(RiderRepository repo, DeliveryRepository deliveryRepo, DeliveryService deliveryService,
                        PasswordEncoder encoder, RiderJwtService jwtService) {
        this.repo = repo;
        this.deliveryRepo = deliveryRepo;
        this.deliveryService = deliveryService;
        this.encoder = encoder;
        this.jwtService = jwtService;
    }

    // ---------------------------------------------------------------- admin side

    public List<RiderAdminDto> list() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(this::toAdminDto).toList();
    }

    public RiderAdminDto get(UUID id) {
        return toAdminDto(find(id));
    }

    @Transactional
    public RiderCredentialsResponse create(RiderCreateRequest req) {
        AdminPrincipal actor = AuthContext.currentAdmin();
        String phone = normalisePhone(req.phoneNumber());
        if (repo.existsByPhoneNumber(phone)) {
            throw new BadRequestException("A rider with that phone number already exists.");
        }
        String email = blankToNull(req.email());
        if (email != null) {
            email = email.toLowerCase();
            if (repo.existsByEmail(email)) throw new BadRequestException("A rider with that email already exists.");
        }

        String temporary = temporaryPassword();
        Rider r = new Rider();
        r.setFullName(req.fullName().trim());
        r.setPhoneNumber(phone);
        r.setEmail(email);
        r.setVehicleType(req.vehicleType() == null ? "MOTORBIKE" : req.vehicleType());
        r.setVehiclePlate(blankToNull(req.vehiclePlate()));
        r.setNotes(blankToNull(req.notes()));
        r.setPasswordHash(encoder.encode(temporary));
        r.setMustChangePassword(true);
        r.setCreatedBy(actor.id());
        Rider saved = repo.save(r);
        log.info("Admin {} created rider {} ({})", actor.email(), saved.getId(), phone);
        return new RiderCredentialsResponse(toAdminDto(saved), temporary);
    }

    @Transactional
    public RiderAdminDto update(UUID id, RiderUpdateRequest req) {
        Rider r = find(id);
        if (req.fullName() != null) r.setFullName(req.fullName().trim());
        if (req.phoneNumber() != null) {
            String phone = normalisePhone(req.phoneNumber());
            if (!phone.equals(r.getPhoneNumber())) {
                if (repo.existsByPhoneNumber(phone)) throw new BadRequestException("That phone number is already in use.");
                r.setPhoneNumber(phone);
                // The phone is the login id; a token issued for the old one should not live on.
                r.setTokenVersion(r.getTokenVersion() + 1);
            }
        }
        if (req.email() != null) {
            String email = blankToNull(req.email());
            if (email != null) {
                email = email.toLowerCase();
                if (!email.equals(r.getEmail()) && repo.existsByEmail(email)) {
                    throw new BadRequestException("That email is already in use.");
                }
            }
            r.setEmail(email);
        }
        if (req.vehicleType() != null) r.setVehicleType(req.vehicleType());
        if (req.vehiclePlate() != null) r.setVehiclePlate(blankToNull(req.vehiclePlate()));
        if (req.notes() != null) r.setNotes(blankToNull(req.notes()));
        log.info("Admin {} updated rider {}", AuthContext.currentAdmin().email(), id);
        return toAdminDto(repo.save(r));
    }

    /**
     * Deactivates a rider: they are signed out at once and cannot sign back in. Jobs they
     * accepted but have not collected go back to the pool. A rider who is carrying food
     * cannot be deactivated until that job is reassigned or completed — otherwise the
     * order would be stranded with nobody able to finish it.
     */
    @Transactional
    public RiderAdminDto setActive(UUID id, boolean active) {
        Rider r = find(id);
        if (!active) {
            List<Delivery> held = deliveryRepo.findByRiderIdAndStatusInOrderByAcceptedAtAsc(id, WITH_RIDER);
            if (held.stream().anyMatch(d -> d.getStatus() != DeliveryStatus.ASSIGNED)) {
                throw new BadRequestException("This rider is carrying an order. Reassign or complete it first.");
            }
            for (Delivery d : held) deliveryService.returnToPool(d);
            r.setOnline(false);
            r.setTokenVersion(r.getTokenVersion() + 1);
        }
        r.setActive(active);
        log.info("Admin {} {} rider {}", AuthContext.currentAdmin().email(), active ? "activated" : "deactivated", id);
        return toAdminDto(repo.save(r));
    }

    /** Issues a new temporary password, signs the rider out everywhere and clears any lockout. */
    @Transactional
    public RiderCredentialsResponse resetPassword(UUID id) {
        Rider r = find(id);
        String temporary = temporaryPassword();
        r.setPasswordHash(encoder.encode(temporary));
        r.setMustChangePassword(true);
        r.setTokenVersion(r.getTokenVersion() + 1);
        r.setFailedLoginCount(0);
        r.setLockedUntil(null);
        Rider saved = repo.save(r);
        log.info("Admin {} reset the password of rider {}", AuthContext.currentAdmin().email(), id);
        return new RiderCredentialsResponse(toAdminDto(saved), temporary);
    }

    // ---------------------------------------------------------------- rider side

    @Transactional(noRollbackFor = {UnauthorizedException.class, LockedException.class})
    public RiderLoginResponse login(RiderLoginRequest req) {
        String phone;
        try {
            phone = normalisePhone(req.phoneNumber());
        } catch (BadRequestException e) {
            throw new UnauthorizedException("Invalid phone number or password");
        }
        Optional<Rider> found = repo.findByPhoneNumber(phone);
        if (found.isEmpty()) {
            // Same BCrypt cost as a real miss, so timing does not reveal registered numbers.
            if (dummyHash == null) dummyHash = encoder.encode("timing-equaliser");
            encoder.matches(req.password(), dummyHash);
            throw new UnauthorizedException("Invalid phone number or password");
        }
        Rider r = found.get();
        OffsetDateTime now = OffsetDateTime.now();
        if (r.getLockedUntil() != null && r.getLockedUntil().isAfter(now)) {
            throw new LockedException("Too many failed attempts. Try again in " + LOCKOUT_MINUTES
                    + " minutes or ask the restaurant to reset your password.");
        }
        if (!encoder.matches(req.password(), r.getPasswordHash())) {
            int failed = r.getFailedLoginCount() + 1;
            if (failed >= MAX_FAILED_LOGINS) {
                r.setLockedUntil(now.plusMinutes(LOCKOUT_MINUTES));
                r.setFailedLoginCount(0);
                log.warn("Rider {} locked after {} failed sign-ins", r.getId(), failed);
            } else {
                r.setFailedLoginCount(failed);
            }
            repo.save(r);
            throw new UnauthorizedException("Invalid phone number or password");
        }
        // Checked after the password, so a wrong guess cannot learn the account is disabled.
        if (!r.isActive()) {
            throw new UnauthorizedException("This rider account has been deactivated. Contact the restaurant.");
        }
        r.setFailedLoginCount(0);
        r.setLockedUntil(null);
        repo.save(r);
        String token = jwtService.issue(r.getId(), r.getPhoneNumber(), r.getTokenVersion());
        return new RiderLoginResponse(token, toProfile(r));
    }

    public RiderProfileDto me() {
        return toProfile(current());
    }

    /** Sets a new password; returns a fresh token because the old one is revoked. */
    @Transactional
    public RiderLoginResponse changePassword(RiderPasswordChangeRequest req) {
        Rider r = current();
        if (!encoder.matches(req.currentPassword(), r.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        if (req.currentPassword().equals(req.newPassword())) {
            throw new BadRequestException("Choose a password different from the current one.");
        }
        r.setPasswordHash(encoder.encode(req.newPassword()));
        r.setMustChangePassword(false);
        r.setTokenVersion(r.getTokenVersion() + 1);
        repo.save(r);
        return new RiderLoginResponse(jwtService.issue(r.getId(), r.getPhoneNumber(), r.getTokenVersion()), toProfile(r));
    }

    /** Signs this rider out on every device. */
    @Transactional
    public void logout() {
        Rider r = current();
        r.setOnline(false);
        r.setTokenVersion(r.getTokenVersion() + 1);
        repo.save(r);
    }

    @Transactional
    public RiderProfileDto setOnline(boolean online) {
        Rider r = current();
        if (!online && deliveryRepo.countByRiderIdAndStatusIn(r.getId(),
                EnumSet.of(DeliveryStatus.PICKED_UP, DeliveryStatus.ARRIVED)) > 0) {
            throw new BadRequestException("Finish your current delivery before going offline.");
        }
        r.setOnline(online);
        return toProfile(repo.save(r));
    }

    // ---------------------------------------------------------------- helpers

    Rider current() {
        UUID id = AuthContext.currentRider().id();
        return repo.findById(id).orElseThrow(() -> new UnauthorizedException("Rider not found"));
    }

    Rider find(UUID id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("Rider not found"));
    }

    /**
     * Normalises Ghanaian numbers to +233XXXXXXXXX so "024 123 4567", "0241234567" and
     * "+233241234567" are the same login. Other international numbers are kept as typed.
     */
    static String normalisePhone(String raw) {
        if (raw == null) throw new BadRequestException("Phone number is required");
        String p = raw.replaceAll("[\\s()-]", "");
        if (p.startsWith("00")) p = "+" + p.substring(2);
        if (p.matches("0\\d{9}")) p = "+233" + p.substring(1);
        else if (p.matches("233\\d{9}")) p = "+" + p;
        if (!p.matches("\\+\\d{9,15}")) throw new BadRequestException("Enter a valid phone number, e.g. 024 123 4567");
        return p;
    }

    private static String temporaryPassword() {
        // Ambiguous characters left out: this gets read off a screen and retyped on a phone.
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) sb.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        return sb.toString();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    static RiderProfileDto toProfile(Rider r) {
        return new RiderProfileDto(r.getId(), r.getFullName(), r.getPhoneNumber(), r.getEmail(),
                r.getVehicleType(), r.getVehiclePlate(), r.isOnline(), r.isMustChangePassword());
    }

    private RiderAdminDto toAdminDto(Rider r) {
        List<Delivery> done = deliveryRepo.findByRiderIdAndStatusOrderByDeliveredAtDesc(r.getId(), DeliveryStatus.DELIVERED);
        BigDecimal earned = done.stream().map(Delivery::getRiderFee).reduce(BigDecimal.ZERO, BigDecimal::add);
        int active = (int) deliveryRepo.countByRiderIdAndStatusIn(r.getId(), WITH_RIDER);
        GeoPointDto last = r.getLastLat() == null ? null
                : new GeoPointDto(r.getLastLat(), r.getLastLng(), r.getLastAccuracyM(), r.getLastLocationAt());
        boolean locked = r.getLockedUntil() != null && r.getLockedUntil().isAfter(OffsetDateTime.now());
        return new RiderAdminDto(r.getId(), r.getFullName(), r.getPhoneNumber(), r.getEmail(),
                r.getVehicleType(), r.getVehiclePlate(), r.getNotes(),
                r.isActive(), r.isOnline(), r.isMustChangePassword(), locked,
                last, active, done.size(), earned, r.getCreatedAt());
    }
}
