package com.quickchop.service;

import com.quickchop.config.AuthContext;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.*;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.ConflictException;
import com.quickchop.exception.ApiExceptions.LockedException;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.*;

/**
 * The rider dispatch flow.
 *
 * <pre>
 * Admin "Send to riders"  → Delivery OPEN       order AWAITING_RIDER   (every rider sees it)
 * Rider accepts (once)    → Delivery ASSIGNED   order RIDER_ASSIGNED   (gone from the pool)
 * Rider collects the food → Delivery PICKED_UP  order OUT_FOR_DELIVERY (customer gets the code)
 * Rider at the door       → Delivery ARRIVED    (customer told)
 * Rider enters the code   → Delivery DELIVERED  order DELIVERED
 * </pre>
 *
 * Every step is timestamped on the delivery and recorded in the order's status history,
 * and the rider's position is stored as a trail while they hold the job.
 */
@Service
public class DeliveryService {

    private static final Logger log = LoggerFactory.getLogger(DeliveryService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final ZoneId ACCRA = ZoneId.of("Africa/Accra");
    private static final Set<DeliveryStatus> ACTIVE = EnumSet.of(
            DeliveryStatus.OPEN, DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.ARRIVED);
    private static final int MAX_PIN_ATTEMPTS = 5;
    /** Trail points closer together than this are skipped; the rider's last position is still updated. */
    private static final Duration TRAIL_INTERVAL = Duration.ofSeconds(8);
    private static final double AVG_SPEED_KMH = 22; // city motorbike average, matches the app's ETA

    private final DeliveryRepository deliveryRepo;
    private final DeliveryLocationRepository locationRepo;
    private final OrderRepository orderRepo;
    private final RiderRepository riderRepo;
    private final PaymentRepository paymentRepo;
    private final CustomerService customerService;
    private final OrderService orderService;
    private final SettingsService settingsService;
    private final int maxActivePerRider;
    private final boolean requirePin;

    public DeliveryService(DeliveryRepository deliveryRepo, DeliveryLocationRepository locationRepo,
                           OrderRepository orderRepo, RiderRepository riderRepo, PaymentRepository paymentRepo,
                           CustomerService customerService, OrderService orderService,
                           SettingsService settingsService,
                           @Value("${quickchop.riders.max-active-deliveries:1}") int maxActivePerRider,
                           @Value("${quickchop.riders.require-delivery-pin:true}") boolean requirePin) {
        this.deliveryRepo = deliveryRepo;
        this.locationRepo = locationRepo;
        this.orderRepo = orderRepo;
        this.riderRepo = riderRepo;
        this.paymentRepo = paymentRepo;
        this.customerService = customerService;
        this.orderService = orderService;
        this.settingsService = settingsService;
        this.maxActivePerRider = Math.max(1, maxActivePerRider);
        this.requirePin = requirePin;
    }

    // ================================================================= admin

    /** "Food is ready — send it out": puts the order in every rider's request list. */
    @Transactional
    public DeliveryJobDto dispatch(UUID orderId, DispatchRequest req) {
        Order order = orderRepo.findById(orderId).orElseThrow(() -> new NotFoundException("Order not found"));
        if (order.isPickup()) throw new BadRequestException("Self-pickup orders do not need a rider.");
        // Riders never collect money, so only a paid order can go out.
        if (order.getPaidAt() == null) throw new BadRequestException("This order hasn't been paid yet.");
        // One row per order (unique): a recalled job is reopened rather than duplicated.
        Delivery d = deliveryRepo.findByOrderId(orderId).orElseGet(Delivery::new);
        if (d.getId() != null && !d.getStatus().isTerminal()) {
            throw new ConflictException("This order has already been sent to riders.");
        }
        if (order.getStatus() != OrderStatus.ORDER_RECEIVED && order.getStatus() != OrderStatus.PREPARING) {
            throw new BadRequestException("Only received or preparing orders can be sent to riders.");
        }
        d.setOrderId(orderId);
        d.setRiderId(null);
        d.setStatus(DeliveryStatus.OPEN);
        d.setRiderFee(order.getDeliveryFee());
        d.setDispatchNote(req == null || req.note() == null || req.note().isBlank() ? null : req.note().trim());
        d.setDeliveryPin(newPin());
        d.setPinAttempts(0);
        d.setDispatchedBy(AuthContext.currentAdmin().id());
        d.setDispatchedAt(OffsetDateTime.now());
        d.setAcceptedAt(null);
        d.setPickedUpAt(null);
        d.setArrivedAt(null);
        d.setDeliveredAt(null);
        d.setCancelledAt(null);
        d.setCompletedByAdmin(false);
        Delivery saved = deliveryRepo.save(d);

        orderService.applyStatus(order, OrderStatus.AWAITING_RIDER, false, null);
        log.info("Order {} dispatched to riders by {}", order.getOrderNumber(), AuthContext.currentAdmin().email());
        return toJob(saved, order, Audience.ADMIN);
    }

    /** Admin hands a job straight to a chosen rider (open, or taken from another rider before pickup). */
    @Transactional
    public DeliveryJobDto assign(UUID deliveryId, UUID riderId) {
        Delivery d = find(deliveryId);
        if (d.getStatus() != DeliveryStatus.OPEN && d.getStatus() != DeliveryStatus.ASSIGNED) {
            throw new BadRequestException("Only jobs that have not been picked up can be (re)assigned.");
        }
        Rider rider = riderRepo.findById(riderId).orElseThrow(() -> new NotFoundException("Rider not found"));
        if (!rider.isActive()) throw new BadRequestException("That rider is deactivated.");
        d.setRiderId(riderId);
        d.setStatus(DeliveryStatus.ASSIGNED);
        d.setAcceptedAt(OffsetDateTime.now());
        deliveryRepo.save(d);
        Order order = order(d);
        orderService.applyStatus(order, OrderStatus.RIDER_ASSIGNED, true, riderLine(rider));
        log.info("Admin {} assigned {} to rider {}", AuthContext.currentAdmin().email(), order.getOrderNumber(), riderId);
        return toJob(d, order, Audience.ADMIN);
    }

    /** Takes a job back from its rider (before pickup) and returns it to the pool. */
    @Transactional
    public DeliveryJobDto unassign(UUID deliveryId) {
        Delivery d = find(deliveryId);
        if (d.getStatus() != DeliveryStatus.ASSIGNED) {
            throw new BadRequestException("Only accepted jobs that have not been picked up can be unassigned.");
        }
        returnToPool(d);
        return toJob(d, order(d), Audience.ADMIN);
    }

    /** Withdraws the job from riders entirely; the order goes back to Preparing. */
    @Transactional
    public DeliveryJobDto recall(UUID deliveryId) {
        Delivery d = find(deliveryId);
        if (d.getStatus() != DeliveryStatus.OPEN && d.getStatus() != DeliveryStatus.ASSIGNED) {
            throw new BadRequestException("The rider already has the food — complete or cancel the order instead.");
        }
        d.setStatus(DeliveryStatus.CANCELLED);
        d.setCancelledAt(OffsetDateTime.now());
        deliveryRepo.save(d);
        Order order = order(d);
        orderService.applyStatus(order, OrderStatus.PREPARING, false, null);
        return toJob(d, order, Audience.ADMIN);
    }

    /** Admin override: marks a job delivered without the customer's code (e.g. confirmed by phone). */
    @Transactional
    public DeliveryJobDto forceComplete(UUID deliveryId) {
        Delivery d = find(deliveryId);
        if (!d.getStatus().isWithRider()) {
            throw new BadRequestException("Only a job a rider is holding can be completed.");
        }
        d.setCompletedByAdmin(true);
        finish(d);
        log.info("Admin {} force-completed delivery {}", AuthContext.currentAdmin().email(), deliveryId);
        return toJob(d, order(d), Audience.ADMIN);
    }

    public List<DeliveryJobDto> adminActive() {
        return deliveryRepo.findByStatusInOrderByDispatchedAtAsc(ACTIVE).stream()
                .map(d -> toJob(d, order(d), Audience.ADMIN)).toList();
    }

    public List<DeliveryJobDto> adminRecent(int days) {
        OffsetDateTime after = OffsetDateTime.now().minusDays(Math.max(1, Math.min(days, 90)));
        return deliveryRepo.findByStatusInAndDispatchedAtAfterOrderByDispatchedAtDesc(
                        EnumSet.of(DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED), after).stream()
                .map(d -> toJob(d, order(d), Audience.ADMIN)).toList();
    }

    public DeliveryRouteDto adminRoute(UUID deliveryId) {
        Delivery d = find(deliveryId);
        return new DeliveryRouteDto(toJob(d, order(d), Audience.ADMIN), path(d));
    }

    public List<DeliveryJobDto> riderHistoryForAdmin(UUID riderId) {
        return deliveryRepo.findByRiderIdAndStatusOrderByDeliveredAtDesc(riderId, DeliveryStatus.DELIVERED).stream()
                .limit(200).map(d -> toJob(d, order(d), Audience.ADMIN)).toList();
    }

    // ================================================================= rider

    /** The open request pool every rider sees. */
    public List<DeliveryJobDto> pool() {
        return deliveryRepo.findByStatusOrderByDispatchedAtAsc(DeliveryStatus.OPEN).stream()
                .map(d -> toJob(d, order(d), Audience.POOL)).toList();
    }

    public List<DeliveryJobDto> myActive() {
        UUID me = AuthContext.currentRider().id();
        return deliveryRepo.findByRiderIdAndStatusInOrderByAcceptedAtAsc(me, RiderService.WITH_RIDER).stream()
                .map(d -> toJob(d, order(d), Audience.RIDER)).toList();
    }

    public DeliveryJobDto riderGet(UUID deliveryId) {
        Delivery d = find(deliveryId);
        UUID me = AuthContext.currentRider().id();
        if (d.getStatus() == DeliveryStatus.OPEN) return toJob(d, order(d), Audience.POOL);
        if (!me.equals(d.getRiderId())) throw new NotFoundException("Delivery not found");
        return toJob(d, order(d), Audience.RIDER);
    }

    /**
     * Claims a job. Exactly one rider can win: the claim is a single conditional UPDATE
     * (only if still OPEN and unowned), so a second rider tapping Accept a moment later
     * gets "already taken" instead of a shared job. The rider row is locked first so one
     * rider's simultaneous accepts cannot slip past the active-job limit either.
     */
    @Transactional
    public DeliveryJobDto accept(UUID deliveryId) {
        UUID me = AuthContext.currentRider().id();
        Rider rider = riderRepo.lockById(me).orElseThrow(() -> new NotFoundException("Rider not found"));
        long holding = deliveryRepo.countByRiderIdAndStatusIn(me, RiderService.WITH_RIDER);
        if (holding >= maxActivePerRider) {
            throw new ConflictException(maxActivePerRider == 1
                    ? "Finish your current delivery before accepting another."
                    : "You already have " + holding + " active deliveries.");
        }
        int claimed = deliveryRepo.claim(deliveryId, me, OffsetDateTime.now(),
                DeliveryStatus.OPEN, DeliveryStatus.ASSIGNED);
        if (claimed == 0) {
            if (!deliveryRepo.existsById(deliveryId)) throw new NotFoundException("Delivery not found");
            throw new ConflictException("Another rider already took this delivery.");
        }
        if (!rider.isOnline()) {
            rider.setOnline(true);
            riderRepo.save(rider);
        }
        Delivery d = find(deliveryId);
        Order order = order(d);
        orderService.applyStatus(order, OrderStatus.RIDER_ASSIGNED, true, riderLine(rider));
        log.info("Rider {} accepted {}", me, order.getOrderNumber());
        return toJob(d, order, Audience.RIDER);
    }

    /** The rider gives the job back before collecting the food. */
    @Transactional
    public DeliveryJobDto release(UUID deliveryId) {
        Delivery d = mine(deliveryId);
        if (d.getStatus() != DeliveryStatus.ASSIGNED) {
            throw new BadRequestException("You can only release a delivery before picking it up.");
        }
        returnToPool(d);
        log.info("Rider {} released delivery {}", AuthContext.currentRider().id(), deliveryId);
        return toJob(d, order(d), Audience.POOL);
    }

    @Transactional
    public DeliveryJobDto pickedUp(UUID deliveryId) {
        Delivery d = mine(deliveryId);
        if (d.getStatus() != DeliveryStatus.ASSIGNED) throw new BadRequestException("This delivery is not waiting for pickup.");
        d.setStatus(DeliveryStatus.PICKED_UP);
        d.setPickedUpAt(OffsetDateTime.now());
        deliveryRepo.save(d);
        Order order = order(d);
        String codeLine = requirePin
                ? "Your delivery code is " + d.getDeliveryPin() + ". Give it to the rider only when you have your food."
                : null;
        orderService.applyStatus(order, OrderStatus.OUT_FOR_DELIVERY, true, codeLine);
        return toJob(d, order, Audience.RIDER);
    }

    @Transactional
    public DeliveryJobDto arrived(UUID deliveryId) {
        Delivery d = mine(deliveryId);
        if (d.getStatus() != DeliveryStatus.PICKED_UP) throw new BadRequestException("Pick up the order first.");
        d.setStatus(DeliveryStatus.ARRIVED);
        d.setArrivedAt(OffsetDateTime.now());
        deliveryRepo.save(d);
        Order order = order(d);
        orderService.notifyCustomer(order, "Your rider has arrived with your order!");
        return toJob(d, order, Audience.RIDER);
    }

    /**
     * Completes the hand-over. The customer's code proves the food reached them rather than
     * being marked delivered from down the road. Wrong codes are counted (and the count is
     * kept even though the request fails); after five the job locks and needs the admin.
     */
    @Transactional(noRollbackFor = BadRequestException.class)
    public DeliveryJobDto complete(UUID deliveryId, CompleteDeliveryRequest req) {
        Delivery d = mine(deliveryId);
        if (d.getStatus() != DeliveryStatus.PICKED_UP && d.getStatus() != DeliveryStatus.ARRIVED) {
            throw new BadRequestException("Pick up the order first.");
        }
        if (requirePin) {
            if (d.getPinAttempts() >= MAX_PIN_ATTEMPTS) {
                throw new LockedException("Too many wrong codes. Call the restaurant to confirm this delivery.");
            }
            String pin = req == null ? null : req.pin();
            if (pin == null || !java.security.MessageDigest.isEqual(
                    pin.getBytes(), d.getDeliveryPin().getBytes())) {
                d.setPinAttempts(d.getPinAttempts() + 1);
                deliveryRepo.save(d);
                int left = MAX_PIN_ATTEMPTS - d.getPinAttempts();
                throw new BadRequestException(left > 0
                        ? "Wrong delivery code. " + left + " attempt" + (left == 1 ? "" : "s") + " left."
                        : "Wrong delivery code. Call the restaurant to confirm this delivery.");
            }
        }
        finish(d);
        return toJob(d, order(d), Audience.RIDER);
    }

    /**
     * A position report from the rider's device. Always updates the rider's last-known
     * position (what admins see on the map); while the rider holds a job it is also added
     * to that job's trail, thinned to one point every few seconds.
     */
    @Transactional
    public void recordLocation(RiderLocationRequest req) {
        UUID me = AuthContext.currentRider().id();
        Rider rider = riderRepo.findById(me).orElseThrow(() -> new NotFoundException("Rider not found"));
        OffsetDateTime now = OffsetDateTime.now();
        rider.setLastLat(req.lat());
        rider.setLastLng(req.lng());
        rider.setLastAccuracyM(req.accuracyM());
        rider.setLastLocationAt(now);
        riderRepo.save(rider);

        for (Delivery d : deliveryRepo.findByRiderIdAndStatusInOrderByAcceptedAtAsc(me, RiderService.WITH_RIDER)) {
            boolean due = locationRepo.findFirstByDeliveryIdOrderByRecordedAtDesc(d.getId())
                    .map(last -> Duration.between(last.getRecordedAt(), now).compareTo(TRAIL_INTERVAL) >= 0)
                    .orElse(true);
            if (due) locationRepo.save(new DeliveryLocation(d.getId(), req.lat(), req.lng(), req.accuracyM()));
        }
    }

    public List<DeliveryJobDto> myHistory() {
        UUID me = AuthContext.currentRider().id();
        return deliveryRepo.findByRiderIdAndStatusOrderByDeliveredAtDesc(me, DeliveryStatus.DELIVERED).stream()
                .limit(100).map(d -> toJob(d, order(d), Audience.RIDER_HISTORY)).toList();
    }

    public RiderSummaryDto mySummary() {
        UUID me = AuthContext.currentRider().id();
        List<Delivery> done = deliveryRepo.findByRiderIdAndStatusOrderByDeliveredAtDesc(me, DeliveryStatus.DELIVERED);
        LocalDate today = LocalDate.now(ACCRA);
        LocalDate weekStart = today.minusDays(today.getDayOfWeek().getValue() - 1L);
        long tc = 0, wc = 0;
        BigDecimal te = BigDecimal.ZERO, we = BigDecimal.ZERO, all = BigDecimal.ZERO;
        for (Delivery d : done) {
            all = all.add(d.getRiderFee());
            if (d.getDeliveredAt() == null) continue;
            LocalDate day = d.getDeliveredAt().atZoneSameInstant(ACCRA).toLocalDate();
            if (!day.isBefore(weekStart)) { wc++; we = we.add(d.getRiderFee()); }
            if (day.equals(today)) { tc++; te = te.add(d.getRiderFee()); }
        }
        return new RiderSummaryDto(tc, te, wc, we, done.size(), all);
    }

    // ================================================================= customer

    /** Live tracking for an order the caller owns (or any order, for an admin). */
    public OrderTrackingDto tracking(UUID orderId) {
        Order order = orderService.findAccessible(orderId);
        SettingsDto s = settingsService.get();
        GeoPointDto store = new GeoPointDto(s.storeLat().doubleValue(), s.storeLng().doubleValue(), null, null);
        GeoPointDto dropoff = order.getDeliveryLat() == null ? null
                : new GeoPointDto(order.getDeliveryLat(), order.getDeliveryLng(), order.getDeliveryAccuracyM(), null);

        Optional<Delivery> delivery = order.isPickup() ? Optional.empty() : deliveryRepo.findByOrderId(orderId);
        if (delivery.isEmpty() || delivery.get().getStatus() == DeliveryStatus.CANCELLED) {
            return new OrderTrackingDto(order.getId(), order.getOrderNumber(), order.getStatus(),
                    null, null, dropoff, store, null, null, null);
        }
        Delivery d = delivery.get();
        GeoPointDto riderAt = null;
        Double km = null;
        Integer eta = null;
        if (d.getStatus().isWithRider() && d.getRiderId() != null) {
            Rider rider = riderRepo.findById(d.getRiderId()).orElse(null);
            if (rider != null && rider.getLastLat() != null) {
                riderAt = new GeoPointDto(rider.getLastLat(), rider.getLastLng(),
                        rider.getLastAccuracyM(), rider.getLastLocationAt());
                if (dropoff != null) {
                    km = d.getStatus() == DeliveryStatus.ASSIGNED
                            // Still has to collect the food: rider → store → customer.
                            ? orderService.drivingKm(riderAt.lat(), riderAt.lng(), store.lat(), store.lng())
                              + orderService.drivingKm(store.lat(), store.lng(), dropoff.lat(), dropoff.lng())
                            : orderService.drivingKm(riderAt.lat(), riderAt.lng(), dropoff.lat(), dropoff.lng());
                    km = Math.round(km * 10) / 10.0;
                    eta = d.getStatus() == DeliveryStatus.ARRIVED ? 0
                            : (int) Math.max(1, Math.ceil(km / AVG_SPEED_KMH * 60));
                }
            }
        }
        // The code is only useful (and only shown) until the hand-over is done.
        String pin = requirePin && !d.getStatus().isTerminal() ? d.getDeliveryPin() : null;
        return new OrderTrackingDto(order.getId(), order.getOrderNumber(), order.getStatus(),
                orderService.deliverySummary(d), riderAt, dropoff, store, pin, km, eta);
    }

    // ================================================================= internals

    private enum Audience { POOL, RIDER, RIDER_HISTORY, ADMIN }

    /** Used by RiderService when a rider is deactivated while holding unstarted jobs. */
    @Transactional
    public void returnToPool(Delivery d) {
        d.setStatus(DeliveryStatus.OPEN);
        d.setRiderId(null);
        d.setAcceptedAt(null);
        deliveryRepo.save(d);
        orderService.applyStatus(order(d), OrderStatus.AWAITING_RIDER, false, null);
    }

    private void finish(Delivery d) {
        OffsetDateTime now = OffsetDateTime.now();
        d.setStatus(DeliveryStatus.DELIVERED);
        if (d.getPickedUpAt() == null) d.setPickedUpAt(now);
        if (d.getArrivedAt() == null) d.setArrivedAt(now);
        d.setDeliveredAt(now);
        deliveryRepo.save(d);
        orderService.applyStatus(order(d), OrderStatus.DELIVERED, true, null);
    }

    private Delivery find(UUID id) {
        return deliveryRepo.findById(id).orElseThrow(() -> new NotFoundException("Delivery not found"));
    }

    /** A delivery the current rider holds. Anyone else's reads as not found. */
    private Delivery mine(UUID id) {
        Delivery d = find(id);
        if (!AuthContext.currentRider().id().equals(d.getRiderId())) throw new NotFoundException("Delivery not found");
        return d;
    }

    private Order order(Delivery d) {
        return orderRepo.findById(d.getOrderId()).orElseThrow(() -> new NotFoundException("Order not found"));
    }

    private List<GeoPointDto> path(Delivery d) {
        return locationRepo.findByDeliveryIdOrderByRecordedAtAsc(d.getId()).stream()
                .map(l -> new GeoPointDto(l.getLat(), l.getLng(), l.getAccuracyM(), l.getRecordedAt())).toList();
    }

    private static String riderLine(Rider r) {
        String plate = r.getVehiclePlate() == null ? "" : " (" + r.getVehiclePlate() + ")";
        return "Your rider is " + r.getFullName() + plate + ", " + r.getPhoneNumber() + ".";
    }

    private static String newPin() {
        return String.format("%04d", RANDOM.nextInt(10_000));
    }

    /** The customer's own note, without the tags the app embeds for the kitchen board. */
    private static String customerNote(String kitchenNote) {
        if (kitchenNote == null) return null;
        String n = kitchenNote.replaceAll("(?i)\\[(SELF-PICKUP|DELIVERY)\\]", "")
                .replaceAll("☎\\s*[+\\d][\\d\\s-]{5,18}", "")
                .replace("·", " ").replaceAll("\\s+", " ").trim();
        return n.isEmpty() ? null : n;
    }

    private DeliveryJobDto toJob(Delivery d, Order o, Audience audience) {
        SettingsDto s = settingsService.get();
        // Only the rider holding the job (and admins) get the customer's name and phone —
        // not the open pool, and not the rider's history once the job is done.
        boolean revealCustomer = audience == Audience.RIDER || audience == Audience.ADMIN;
        Customer customer = revealCustomer ? customerService.getById(o.getCustomerId()) : null;

        List<Payment> payments = paymentRepo.findByOrderId(o.getId());
        Optional<Payment> success = payments.stream().filter(p -> "SUCCESS".equalsIgnoreCase(p.getStatus())).findFirst();
        boolean paid = success.isPresent();
        String method = success.map(Payment::getMethod)
                .orElse(payments.isEmpty() ? null : payments.get(payments.size() - 1).getMethod());

        Double tripKm = o.getDeliveryLat() == null ? null
                : Math.round(orderService.drivingKm(s.storeLat().doubleValue(), s.storeLng().doubleValue(),
                        o.getDeliveryLat(), o.getDeliveryLng()) * 10) / 10.0;

        boolean admin = audience == Audience.ADMIN;
        List<OrderItemDto> items = orderService.toDto(o).items();
        if (!admin) {
            // The rider checks the bag against item names and quantities; prices are not theirs.
            items = items.stream()
                    .map(i -> new OrderItemDto(i.id(), i.menuItemId(), i.name(), i.quantity(), null, i.addOns()))
                    .toList();
        }
        int itemCount = items.stream().mapToInt(OrderItemDto::quantity).sum();

        Rider rider = (audience == Audience.ADMIN && d.getRiderId() != null)
                ? riderRepo.findById(d.getRiderId()).orElse(null) : null;
        GeoPointDto riderAt = (rider != null && rider.getLastLat() != null && d.getStatus().isWithRider())
                ? new GeoPointDto(rider.getLastLat(), rider.getLastLng(), rider.getLastAccuracyM(), rider.getLastLocationAt())
                : null;

        String phone = !revealCustomer ? null
                : (o.getContactPhone() != null ? o.getContactPhone() : customer.getPhoneNumber());

        return new DeliveryJobDto(
                d.getId(), o.getId(), o.getOrderNumber(), d.getStatus(), o.getStatus(),
                d.getRiderFee(),
                admin ? o.getSubtotal() : null, admin ? o.getDeliveryFee() : null, admin ? o.getTotal() : null,
                admin ? paid : null, admin ? method : null,
                s.businessName(), s.storeAddress(), s.storeLat().doubleValue(), s.storeLng().doubleValue(), s.contactPhone(),
                o.getDeliveryAddress(), o.getDeliveryLat(), o.getDeliveryLng(), o.getDeliveryAccuracyM(),
                tripKm,
                revealCustomer ? customer.getFullName() : null, phone,
                o.getDeliveryTimeNote(), customerNote(o.getKitchenNote()), d.getDispatchNote(),
                items, itemCount,
                audience == Audience.ADMIN ? d.getRiderId() : null,
                rider == null ? null : rider.getFullName(),
                rider == null ? null : rider.getPhoneNumber(),
                riderAt,
                d.getPinAttempts(), d.getPinAttempts() >= MAX_PIN_ATTEMPTS, d.isCompletedByAdmin(),
                d.getDispatchedAt(), d.getAcceptedAt(), d.getPickedUpAt(), d.getArrivedAt(),
                d.getDeliveredAt(), d.getCancelledAt());
    }
}
