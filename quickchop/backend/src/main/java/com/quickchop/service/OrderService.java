package com.quickchop.service;

import com.quickchop.config.AuthContext;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.*;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.exception.ApiExceptions.PoliciesNotAcceptedException;
import com.quickchop.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class OrderService {

    private final OrderRepository orderRepo;
    private final OrderStatusHistoryRepository historyRepo;
    private final MenuItemRepository menuRepo;
    private final CustomerService customerService;
    private final NotificationService notificationService;
    private final SettingsService settingsService;   // delivery rates, limits, store location (admin-controlled)
    private final EmailService emailService;
    private final DeliveryRepository deliveryRepo;
    private final RiderRepository riderRepo;
    private final PolicyService policyService;
    private final BigDecimal deliveryFee;   // flat fallback when no coords are sent
    private final String businessName;
    /** Scales straight-line distance up to an approximate driving distance. */
    private final double roadFactor;

    public OrderService(OrderRepository orderRepo, OrderStatusHistoryRepository historyRepo,
                        MenuItemRepository menuRepo, CustomerService customerService,
                        NotificationService notificationService, SettingsService settingsService,
                        EmailService emailService,
                        DeliveryRepository deliveryRepo, RiderRepository riderRepo, PolicyService policyService,
                        @Value("${quickchop.delivery-fee:0.00}") BigDecimal deliveryFee,
                        @Value("${quickchop.business-name:Qooka Qooks Restaurant}") String businessName,
                        @Value("${quickchop.delivery.road-factor:1.35}") double roadFactor) {
        this.orderRepo = orderRepo;
        this.historyRepo = historyRepo;
        this.menuRepo = menuRepo;
        this.customerService = customerService;
        this.notificationService = notificationService;
        this.settingsService = settingsService;
        this.emailService = emailService;
        this.deliveryRepo = deliveryRepo;
        this.riderRepo = riderRepo;
        this.policyService = policyService;
        this.deliveryFee = deliveryFee;
        this.businessName = businessName;
        this.roadFactor = roadFactor;
    }

    /** Delivery fee for an order: 0 for pickup or when the subtotal clears the
     *  free-delivery threshold; distance-based (using admin rates) when the
     *  destination coords are known; else the flat fallback fee. */
    private BigDecimal deliveryFeeFor(PlaceOrderRequest req, BigDecimal subtotal, SettingsDto s) {
        if (Boolean.TRUE.equals(req.pickup())) return BigDecimal.ZERO;
        if (s.freeDeliveryThreshold().signum() > 0 && subtotal.compareTo(s.freeDeliveryThreshold()) >= 0) {
            return BigDecimal.ZERO;
        }
        if (req.deliveryLat() == null || req.deliveryLng() == null) return deliveryFee;
        double km = drivingKm(s.storeLat().doubleValue(), s.storeLng().doubleValue(),
                req.deliveryLat(), req.deliveryLng());
        // The base fee covers the first `includedKm`; per-km only applies beyond them,
        // so a short hop costs the base rather than base + a full per-km charge.
        double includedKm = s.deliveryIncludedKm() == null ? 0 : s.deliveryIncludedKm().doubleValue();
        double chargeableKm = Math.max(0, Math.ceil(Math.max(0, km)) - includedKm);
        double fee = Math.min(s.deliveryMaxFee().doubleValue(),
                s.deliveryBaseFee().doubleValue() + s.deliveryPerKm().doubleValue() * chargeableKm);
        return BigDecimal.valueOf(fee).setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Approximate driving distance in kilometres.
     *
     * Haversine measures a straight line, which is not what a rider travels: Accra's
     * road network runs roughly a third longer than the crow flies, more on routes out
     * past Pokuase. Charging the straight line undercharged every delivery — Anyaa Last
     * Stop to Sapeiman is 13.3 km straight but about 18 km driven.
     *
     * A single multiplier is deliberate. A routing API (Google Directions, OSRM) would
     * be exact, but it adds a paid dependency and a network call on the checkout path,
     * and it can fail — at which point the order either blocks or silently falls back to
     * this anyway. Tune with DELIVERY_ROAD_FACTOR if real trips disagree.
     */
    public double drivingKm(double lat1, double lon1, double lat2, double lon2) {
        return haversineKm(lat1, lon1, lat2, lon2) * roadFactor;
    }

    /** Great-circle distance in kilometres. */
    public static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    @Transactional
    public OrderDto placeOrder(PlaceOrderRequest req) {
        Customer customer = customerService.currentEntity();
        // Consent before data use: no order (which shares data with riders and Paystack)
        // until the customer has accepted the current privacy policy and terms.
        if (!policyService.hasAcceptedAll(PolicyType.Audience.CUSTOMER, customer.getId())) {
            throw new PoliciesNotAcceptedException("Please accept the updated Privacy Policy and Terms to continue.");
        }

        Order order = new Order();
        order.setCustomerId(customer.getId());
        order.setDeliveryAddress(req.deliveryAddress());
        order.setDeliveryTimeNote(req.deliveryTimeNote());
        order.setKitchenNote(req.kitchenNote());
        order.setStatus(OrderStatus.ORDER_RECEIVED);

        BigDecimal subtotal = BigDecimal.ZERO;
        List<OrderItem> items = new ArrayList<>();
        for (OrderItemRequest line : req.items()) {
            MenuItem menuItem = menuRepo.findById(line.menuItemId())
                    .orElseThrow(() -> new NotFoundException("Menu item not found: " + line.menuItemId()));
            if (!menuItem.isAvailable()) {
                throw new BadRequestException("Item not available: " + menuItem.getName());
            }
            OrderItem item = new OrderItem();
            item.setOrder(order); // set FK so order_items inserts with order_id
            item.setMenuItemId(menuItem.getId());
            item.setQuantity(line.quantity());
            item.setUnitPrice(menuItem.getPrice());
            item.setAddOns(line.addOns());
            items.add(item);
            subtotal = subtotal.add(menuItem.getPrice().multiply(BigDecimal.valueOf(line.quantity())));
        }
        SettingsDto settings = settingsService.get();
        boolean pickup = Boolean.TRUE.equals(req.pickup());

        // Minimum order (0 = no minimum).
        if (settings.minOrderAmount().signum() > 0 && subtotal.compareTo(settings.minOrderAmount()) < 0) {
            throw new BadRequestException("Minimum order is GHS " + settings.minOrderAmount() + ".");
        }
        // Accra-only: reject delivery beyond the max radius when the destination is known.
        if (!pickup && req.deliveryLat() != null && req.deliveryLng() != null) {
            double km = haversineKm(settings.storeLat().doubleValue(), settings.storeLng().doubleValue(),
                    req.deliveryLat(), req.deliveryLng());
            if (km > settings.maxDeliveryKm().doubleValue()) {
                throw new BadRequestException("Delivery is only available within "
                        + settings.maxDeliveryKm() + " km (Accra). Please choose self-pickup.");
            }
        }
        order.setPickup(pickup);
        if (!pickup) {
            // Kept for the rider: the fee used these coords and then dropped them.
            order.setDeliveryLat(req.deliveryLat());
            order.setDeliveryLng(req.deliveryLng());
            order.setDeliveryAccuracyM(req.deliveryLat() == null ? null : req.deliveryAccuracyM());
        }
        order.setContactPhone(contactPhoneFor(req, customer));
        order.setItems(items);
        order.setSubtotal(subtotal);
        BigDecimal fee = deliveryFeeFor(req, subtotal, settings);
        order.setDeliveryFee(fee);
        order.setTotal(subtotal.add(fee));
        order.setOrderNumber(nextOrderNumber());

        Order saved = orderRepo.save(order);
        recordHistory(saved, OrderStatus.ORDER_RECEIVED);
        // Nothing is announced yet: the order exists from "Continue to payment", before the
        // customer has paid. Confirmation and the kitchen alert go out from markPaid().
        return toDto(saved);
    }

    /** The phone the rider should call: what the customer typed at checkout, else the
     *  "☎ …" older app builds embed in the kitchen note, else the profile phone. */
    private static String contactPhoneFor(PlaceOrderRequest req, Customer customer) {
        if (req.contactPhone() != null && !req.contactPhone().isBlank()) return req.contactPhone().trim();
        if (req.kitchenNote() != null) {
            var m = java.util.regex.Pattern.compile("☎\\s*([+\\d][\\d\\s-]{5,18})").matcher(req.kitchenNote());
            if (m.find()) return m.group(1).trim();
        }
        return customer.getPhoneNumber();
    }

    public List<OrderDto> myOrders() {
        Customer customer = customerService.currentEntity();
        return orderRepo.findByCustomerIdOrderByCreatedAtDesc(customer.getId())
                .stream().map(this::toDto).toList();
    }

    public List<OrderDto> allOrders(OrderStatus statusFilter) {
        List<Order> orders = (statusFilter == null)
                ? orderRepo.findAllByOrderByCreatedAtDesc()
                : orderRepo.findByStatusOrderByCreatedAtDesc(statusFilter);
        return orders.stream().map(this::toDto).toList();
    }

    public OrderDto getOne(UUID id) {
        return toDto(findAccessible(id));
    }

    /** The order, if the caller may read it: customers only their own, admins any.
     *  Someone else's order reads as not found, so ids cannot be probed. */
    public Order findAccessible(UUID id) {
        Order order = orderRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Order not found: " + id));
        if (!AuthContext.isAdmin()) {
            Customer customer = customerService.currentEntity();
            if (!order.getCustomerId().equals(customer.getId())) {
                throw new NotFoundException("Order not found: " + id);
            }
        }
        return order;
    }

    /** The customer moves their drop-off pin, any time before the food is handed over. */
    @Transactional
    public OrderDto updateDropoff(UUID id, UpdateDropoffRequest req) {
        Order order = findAccessible(id);
        if (order.isPickup()) throw new BadRequestException("Self-pickup orders have no delivery location.");
        if (order.getStatus() == OrderStatus.DELIVERED || order.getStatus() == OrderStatus.CANCELLED) {
            throw new BadRequestException("This order is already closed.");
        }
        SettingsDto settings = settingsService.get();
        double km = haversineKm(settings.storeLat().doubleValue(), settings.storeLng().doubleValue(),
                req.lat(), req.lng());
        if (km > settings.maxDeliveryKm().doubleValue()) {
            throw new BadRequestException("That location is outside our delivery area.");
        }
        // The fee was agreed at checkout; moving the pin re-routes the rider, it does not re-price.
        order.setDeliveryLat(req.lat());
        order.setDeliveryLng(req.lng());
        order.setDeliveryAccuracyM(req.accuracyM());
        return toDto(orderRepo.save(order));
    }

    /** Admin status change from the Live Orders board. */
    @Transactional
    public OrderDto updateStatus(UUID id, OrderStatus newStatus) {
        Order order = orderRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Order not found: " + id));
        validateTransition(order.isPickup(), newStatus);

        Optional<Delivery> delivery = deliveryRepo.findByOrderId(order.getId())
                .filter(d -> !d.getStatus().isTerminal());
        if (newStatus == OrderStatus.AWAITING_RIDER || newStatus == OrderStatus.RIDER_ASSIGNED) {
            throw new BadRequestException("Use \"Send to riders\" to dispatch an order.");
        }
        if (delivery.isPresent()) {
            // Once riders are involved the rider app drives the status; the board can only
            // cancel here (recall / complete live on the delivery endpoints).
            if (newStatus != OrderStatus.CANCELLED) {
                throw new BadRequestException("This order is with the riders. Manage it from Deliveries.");
            }
            Delivery d = delivery.get();
            d.setStatus(DeliveryStatus.CANCELLED);
            d.setCancelledAt(OffsetDateTime.now());
            deliveryRepo.save(d);
        }
        return toDto(applyStatus(order, newStatus, true, null));
    }

    /**
     * Sets a status and tells the customer: history row, push, and (optionally) email.
     * Shared by the admin board and the rider flow so both notify the same way.
     *
     * @param extraNote an additional paragraph for the email only (e.g. the delivery code)
     */
    @Transactional
    public Order applyStatus(Order order, OrderStatus newStatus, boolean email, String extraNote) {
        order.setStatus(newStatus);
        Order saved = orderRepo.save(order);
        recordHistory(saved, newStatus);

        Customer customer = customerService.getById(saved.getCustomerId());
        notificationService.sendOrderUpdate(saved, customer.getFcmToken());

        // Email alongside push: push only reaches a device that installed the app and
        // granted permission, and FCM is disabled on Cloud Run for now, so email is
        // currently the only status update a customer actually receives.
        if (email) {
            String message = statusMessage(saved);
            emailService.send(
                    customer.getEmail(),
                    EmailTemplates.orderSubject(businessName, saved, message),
                    EmailTemplates.orderText(businessName, customer.getFullName(), saved, message, extraNote),
                    EmailTemplates.orderHtml(businessName, customer.getFullName(), saved, message, extraNote));
        }
        return saved;
    }

    /** Tells the customer something that is not a status change (e.g. "your rider has
     *  arrived"), by push and email. */
    public void notifyCustomer(Order order, String message) {
        Customer customer = customerService.getById(order.getCustomerId());
        notificationService.sendMessage(order, customer.getFcmToken(), message);
        emailService.send(
                customer.getEmail(),
                EmailTemplates.orderSubject(businessName, order, message),
                EmailTemplates.orderText(businessName, customer.getFullName(), order, message),
                EmailTemplates.orderHtml(businessName, customer.getFullName(), order, message));
    }

    /**
     * Payment confirmed (Paystack webhook or verify). This — not placing the order — is
     * when the customer gets "order confirmed" and the kitchen hears about it. Idempotent:
     * the webhook and the app's verify call can both arrive.
     */
    @Transactional
    public void markPaid(UUID orderId) {
        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found: " + orderId));
        if (order.getPaidAt() != null) return;
        order.setPaidAt(OffsetDateTime.now());
        Order saved = orderRepo.save(order);

        Customer customer = customerService.getById(saved.getCustomerId());
        notificationService.sendOrderUpdate(saved, customer.getFcmToken());
        OrderDto dto = toDto(saved);
        emailService.send(
                customer.getEmail(),
                EmailTemplates.placedSubject(businessName, dto),
                EmailTemplates.placedText(businessName, customer.getFullName(), dto),
                EmailTemplates.placedHtml(businessName, customer.getFullName(), dto));
        emailService.sendToSupport(
                EmailTemplates.newOrderSubject(dto),
                EmailTemplates.newOrderText(dto, customer.getFullName(), customer.getPhoneNumber()),
                EmailTemplates.newOrderHtml(businessName, dto, customer.getFullName(), customer.getPhoneNumber()));
    }

    /** Customer-facing sentence for a status. Mirrors NotificationService so the email
     *  and the push notification for the same event never say different things. */
    private static String statusMessage(Order order) {
        return switch (order.getStatus()) {
            case ORDER_RECEIVED -> "We've received your order!";
            case PREPARING -> order.isPickup() ? "Your order is being processed." : "Your food is being prepared.";
            case AWAITING_RIDER -> "Your food is ready — we're assigning a rider.";
            case RIDER_ASSIGNED -> "A rider has accepted your order and is heading to the kitchen.";
            case OUT_FOR_DELIVERY -> "Your order is out for delivery.";
            case DELIVERED -> "Your order has been delivered. Enjoy!";
            case READY -> "Your order is ready for pickup!";
            case CANCELLED -> "Your order was cancelled.";
        };
    }

    /** Pickup and delivery orders use different status flows; reject cross-flow statuses. */
    private static void validateTransition(boolean pickup, OrderStatus target) {
        if (target == OrderStatus.CANCELLED) return;
        if (pickup) {
            if (target == OrderStatus.OUT_FOR_DELIVERY || target == OrderStatus.DELIVERED
                    || target == OrderStatus.AWAITING_RIDER || target == OrderStatus.RIDER_ASSIGNED) {
                throw new BadRequestException("Self-pickup orders use: Order received → Processing → Ready.");
            }
        } else if (target == OrderStatus.READY) {
            throw new BadRequestException("Delivery orders use: Order received → Preparing → Out for delivery → Delivered.");
        }
    }

    private void recordHistory(Order order, OrderStatus status) {
        historyRepo.save(new OrderStatusHistory(order.getId(), status));
    }

    private String nextOrderNumber() {
        long count = orderRepo.countByOrderNumberStartingWith("QC-");
        return String.format("QC-%06d", 1001 + count); // 6-digit, e.g. QC-001001
    }

    public OrderDto toDto(Order o) {
        List<OrderItemDto> items = o.getItems().stream().map(i -> {
            String name = menuRepo.findById(i.getMenuItemId())
                    .map(MenuItem::getName).orElse("(removed item)");
            return new OrderItemDto(i.getId(), i.getMenuItemId(), name,
                    i.getQuantity(), i.getUnitPrice(), i.getAddOns());
        }).toList();

        List<OrderStatusEventDto> history = historyRepo
                .findByOrderIdOrderByChangedAtAsc(o.getId())
                .stream().map(h -> new OrderStatusEventDto(h.getStatus(), h.getChangedAt()))
                .toList();

        OrderDeliveryDto delivery = o.isPickup() ? null
                : deliveryRepo.findByOrderId(o.getId()).map(this::deliverySummary).orElse(null);

        return new OrderDto(o.getId(), o.getCustomerId(), o.getOrderNumber(), o.getStatus(),
                o.isPickup(),
                o.getDeliveryAddress(), o.getDeliveryTimeNote(), o.getKitchenNote(),
                o.getSubtotal(), o.getDeliveryFee(), o.getTotal(),
                o.getCreatedAt(), items, history,
                o.getDeliveryLat(), o.getDeliveryLng(), o.getDeliveryAccuracyM(), o.getContactPhone(),
                delivery, customerName(o.getCustomerId()), o.getPaidAt());
    }

    private String customerName(UUID customerId) {
        try {
            return customerService.getById(customerId).getFullName();
        } catch (NotFoundException e) {
            return null;
        }
    }

    /** Rider + timeline for an order. Shared with DeliveryService's tracking view. */
    public OrderDeliveryDto deliverySummary(Delivery d) {
        Rider rider = d.getRiderId() == null ? null : riderRepo.findById(d.getRiderId()).orElse(null);
        return new OrderDeliveryDto(d.getId(), d.getStatus(),
                rider == null ? null : rider.getId(),
                rider == null ? null : rider.getFullName(),
                rider == null ? null : rider.getPhoneNumber(),
                rider == null ? null : rider.getVehicleType(),
                rider == null ? null : rider.getVehiclePlate(),
                d.getDispatchedAt(), d.getAcceptedAt(), d.getPickedUpAt(), d.getArrivedAt(), d.getDeliveredAt());
    }
}
