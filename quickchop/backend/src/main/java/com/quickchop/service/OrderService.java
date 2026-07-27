package com.quickchop.service;

import com.quickchop.config.AuthContext;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.*;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
    private final BigDecimal deliveryFee;   // flat fallback when no coords are sent

    public OrderService(OrderRepository orderRepo, OrderStatusHistoryRepository historyRepo,
                        MenuItemRepository menuRepo, CustomerService customerService,
                        NotificationService notificationService, SettingsService settingsService,
                        @Value("${quickchop.delivery-fee:0.00}") BigDecimal deliveryFee) {
        this.orderRepo = orderRepo;
        this.historyRepo = historyRepo;
        this.menuRepo = menuRepo;
        this.customerService = customerService;
        this.notificationService = notificationService;
        this.settingsService = settingsService;
        this.deliveryFee = deliveryFee;
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
        double km = haversineKm(s.storeLat().doubleValue(), s.storeLng().doubleValue(),
                req.deliveryLat(), req.deliveryLng());
        double fee = Math.min(s.deliveryMaxFee().doubleValue(),
                s.deliveryBaseFee().doubleValue() + s.deliveryPerKm().doubleValue() * Math.ceil(Math.max(0, km)));
        return BigDecimal.valueOf(fee).setScale(2, RoundingMode.HALF_UP);
    }

    /** Great-circle distance in kilometres. */
    private static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
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
        order.setItems(items);
        order.setSubtotal(subtotal);
        BigDecimal fee = deliveryFeeFor(req, subtotal, settings);
        order.setDeliveryFee(fee);
        order.setTotal(subtotal.add(fee));
        order.setOrderNumber(nextOrderNumber());

        Order saved = orderRepo.save(order);
        recordHistory(saved, OrderStatus.ORDER_RECEIVED);
        notificationService.sendOrderUpdate(saved, customer.getFcmToken());
        return toDto(saved);
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
        Order order = orderRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Order not found: " + id));
        // Customers may only read their own orders; admins may read any.
        if (!AuthContext.isAdmin()) {
            Customer customer = customerService.currentEntity();
            if (!order.getCustomerId().equals(customer.getId())) {
                throw new NotFoundException("Order not found: " + id);
            }
        }
        return toDto(order);
    }

    @Transactional
    public OrderDto updateStatus(UUID id, OrderStatus newStatus) {
        Order order = orderRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Order not found: " + id));
        validateTransition(order.isPickup(), newStatus);
        order.setStatus(newStatus);
        Order saved = orderRepo.save(order);
        recordHistory(saved, newStatus);

        Customer customer = customerService.getById(saved.getCustomerId());
        notificationService.sendOrderUpdate(saved, customer.getFcmToken());
        return toDto(saved);
    }

    /** Marks the order paid-and-received; used by the payment webhook. */
    @Transactional
    public void markPaid(UUID orderId) {
        Order order = orderRepo.findById(orderId)
                .orElseThrow(() -> new NotFoundException("Order not found: " + orderId));
        // Keep flow simple: a paid order stays ORDER_RECEIVED until the kitchen advances it.
        recordHistory(order, order.getStatus());
    }

    /** Pickup and delivery orders use different status flows; reject cross-flow statuses. */
    private static void validateTransition(boolean pickup, OrderStatus target) {
        if (target == OrderStatus.CANCELLED) return;
        if (pickup) {
            if (target == OrderStatus.OUT_FOR_DELIVERY || target == OrderStatus.DELIVERED) {
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

    private OrderDto toDto(Order o) {
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

        return new OrderDto(o.getId(), o.getCustomerId(), o.getOrderNumber(), o.getStatus(),
                o.isPickup(),
                o.getDeliveryAddress(), o.getDeliveryTimeNote(), o.getKitchenNote(),
                o.getSubtotal(), o.getDeliveryFee(), o.getTotal(),
                o.getCreatedAt(), items, history);
    }
}
