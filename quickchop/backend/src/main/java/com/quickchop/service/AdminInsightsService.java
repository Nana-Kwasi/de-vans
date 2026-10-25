package com.quickchop.service;

import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.*;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.repository.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;

/** Admin global search, and the order detail screen's customer analytics. */
@Service
public class AdminInsightsService {

    private static final int HITS = 8;
    private static final Set<OrderStatus> DONE = EnumSet.of(OrderStatus.DELIVERED, OrderStatus.READY);
    /** Sentinel so "customer_id in (:ids)" is never an empty list (invalid SQL on some databases). */
    private static final List<UUID> NO_IDS = List.of(new UUID(0, 0));

    private final OrderRepository orderRepo;
    private final CustomerRepository customerRepo;
    private final MenuItemRepository menuRepo;
    private final RiderRepository riderRepo;
    private final ReviewRepository reviewRepo;
    private final SupportTicketRepository ticketRepo;
    private final PaymentRepository paymentRepo;
    private final DeliveryRepository deliveryRepo;
    private final OrderService orderService;
    private final DeliveryService deliveryService;

    public AdminInsightsService(OrderRepository orderRepo, CustomerRepository customerRepo,
                                MenuItemRepository menuRepo, RiderRepository riderRepo,
                                ReviewRepository reviewRepo, SupportTicketRepository ticketRepo,
                                PaymentRepository paymentRepo, DeliveryRepository deliveryRepo,
                                OrderService orderService, DeliveryService deliveryService) {
        this.orderRepo = orderRepo;
        this.customerRepo = customerRepo;
        this.menuRepo = menuRepo;
        this.riderRepo = riderRepo;
        this.reviewRepo = reviewRepo;
        this.ticketRepo = ticketRepo;
        this.paymentRepo = paymentRepo;
        this.deliveryRepo = deliveryRepo;
        this.orderService = orderService;
        this.deliveryService = deliveryService;
    }

    // ------------------------------------------------------------------ search

    /**
     * Searches orders (number, full id, phone, address, customer), customers (name, email,
     * phone), menu items and riders at once. Phone matching uses the last 9 digits so
     * "024 111 2222", "0241112222" and "+233241112222" all find the same person.
     */
    public SearchResultsDto search(String raw) {
        String q = raw == null ? "" : raw.trim();
        if (q.length() < 2) return new SearchResultsDto(List.of(), List.of(), List.of(), List.of());
        if (q.length() > 100) q = q.substring(0, 100);

        String like = "%" + q.toLowerCase().replace("%", "").replace("_", "") + "%";
        String digits = q.replaceAll("\\D", "");
        String phone = digits.length() >= 6 ? "%" + digits.substring(Math.max(0, digits.length() - 9)) + "%" : "";
        var page = PageRequest.of(0, HITS);

        List<Customer> customers = customerRepo.search(like, phone, page);
        List<UUID> customerIds = customers.isEmpty() ? NO_IDS : customers.stream().map(Customer::getId).toList();

        LinkedHashMap<UUID, Order> orders = new LinkedHashMap<>();
        parseUuid(q).flatMap(orderRepo::findById).ifPresent(o -> orders.put(o.getId(), o));
        orderRepo.search(like, phone, customerIds, page).forEach(o -> orders.putIfAbsent(o.getId(), o));

        return new SearchResultsDto(
                orders.values().stream().limit(HITS).map(this::orderHit).toList(),
                customers.stream().map(c -> new SearchCustomerHit(c.getId(), c.getFullName(), c.getEmail(),
                        c.getPhoneNumber(), orderRepo.findByCustomerIdOrderByCreatedAtDesc(c.getId()).size())).toList(),
                menuRepo.findByNameContainingIgnoreCaseOrderByName(q, page).stream().map(MenuService::toDto).toList(),
                riderRepo.search(like, phone, page).stream()
                        .map(r -> new SearchRiderHit(r.getId(), r.getFullName(), r.getPhoneNumber(), r.isActive(), r.isOnline()))
                        .toList());
    }

    // ------------------------------------------------------------------ order detail

    public AdminOrderDetailDto orderDetail(UUID orderId) {
        Order order = orderRepo.findById(orderId).orElseThrow(() -> new NotFoundException("Order not found"));
        List<PaymentDto> payments = paymentRepo.findByOrderId(orderId).stream()
                .map(p -> new PaymentDto(p.getId(), p.getOrderId(), p.getMethod(), p.getAmount(),
                        p.getStatus(), p.getProvider(), p.getProviderReference()))
                .toList();
        boolean paid = payments.stream().anyMatch(p -> "SUCCESS".equalsIgnoreCase(p.status()));
        ReviewDto review = reviewRepo.findFirstByOrderId(orderId).map(ReviewService::toDto).orElse(null);
        DeliveryJobDto delivery = deliveryRepo.findByOrderId(orderId)
                .map(d -> deliveryService.adminRoute(d.getId()).job()).orElse(null);
        return new AdminOrderDetailDto(orderService.toDto(order), customerInsights(order.getCustomerId()),
                payments, paid, review, delivery);
    }

    public CustomerInsightsDto customerInsights(UUID customerId) {
        Customer c = customerRepo.findById(customerId).orElseThrow(() -> new NotFoundException("Customer not found"));
        List<Order> all = orderRepo.findByCustomerIdOrderByCreatedAtDesc(customerId);
        List<Order> counted = all.stream().filter(o -> o.getStatus() != OrderStatus.CANCELLED).toList();

        BigDecimal spent = counted.stream().map(Order::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal avg = counted.isEmpty() ? BigDecimal.ZERO
                : spent.divide(BigDecimal.valueOf(counted.size()), 2, RoundingMode.HALF_UP);
        OffsetDateTime first = all.isEmpty() ? null : all.get(all.size() - 1).getCreatedAt();
        OffsetDateTime last = all.isEmpty() ? null : all.get(0).getCreatedAt();

        // Favourite dishes by quantity across non-cancelled orders.
        Map<UUID, Long> qty = new HashMap<>();
        counted.forEach(o -> o.getItems().forEach(i -> qty.merge(i.getMenuItemId(), (long) i.getQuantity(), Long::sum)));
        List<FavouriteItemDto> favourites = qty.entrySet().stream()
                .sorted(Map.Entry.<UUID, Long>comparingByValue().reversed())
                .limit(3)
                .map(e -> new FavouriteItemDto(menuRepo.findById(e.getKey()).map(MenuItem::getName).orElse("(removed item)"), e.getValue()))
                .toList();

        List<Review> reviews = reviewRepo.findByCustomerId(customerId);
        Double avgRating = reviews.isEmpty() ? null
                : Math.round(reviews.stream().mapToInt(Review::getRating).average().orElse(0) * 10) / 10.0;

        int n = counted.size();
        String segment = n >= 5 ? "LOYAL" : n >= 2 ? "RETURNING" : "NEW";

        return new CustomerInsightsDto(
                CustomerService.toDto(c), segment,
                all.size(),
                all.stream().filter(o -> DONE.contains(o.getStatus())).count(),
                all.size() - counted.size(),
                counted.stream().filter(o -> !DONE.contains(o.getStatus())).count(),
                spent, avg, first, last,
                last == null ? null : Duration.between(last, OffsetDateTime.now()).toDays(),
                counted.stream().filter(o -> !o.isPickup()).count(),
                counted.stream().filter(Order::isPickup).count(),
                favourites, avgRating, reviews.size(),
                ticketRepo.countByCustomerIdAndStatus(customerId, "OPEN"),
                all.stream().limit(6).map(this::orderHit).toList());
    }

    private SearchOrderHit orderHit(Order o) {
        String name = customerRepo.findById(o.getCustomerId()).map(Customer::getFullName).orElse(null);
        return new SearchOrderHit(o.getId(), o.getOrderNumber(), o.getStatus(), name, o.getTotal(), o.isPickup(), o.getCreatedAt());
    }

    private static Optional<UUID> parseUuid(String s) {
        try {
            return Optional.of(UUID.fromString(s));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
