package com.quickchop.dto;

import com.quickchop.entity.OrderStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Request/response DTOs for the QuickChop API, grouped here for readability.
 * Records are immutable and map cleanly to JSON.
 */
public final class Dtos {

    private Dtos() {}

    // ---------- Menu ----------
    public record MenuItemDto(UUID id, String name, String description, BigDecimal price,
                              String photoUrl, String category, boolean available, boolean featured) {}

    public record MenuItemRequest(
            @NotBlank String name,
            String description,
            @NotNull @DecimalMin("0.0") BigDecimal price,
            String photoUrl,
            @NotBlank String category,
            Boolean available,
            Boolean featured) {}

    public record MenuItemUpdateRequest(String name, String description, BigDecimal price,
                                        String photoUrl, String category,
                                        Boolean available, Boolean featured) {}

    // ---------- App settings (restaurant-wide, admin-controlled) ----------
    public record SettingsDto(
            String businessName,
            boolean acceptingOrders,
            String closedMessage,
            String contactPhone,
            String storeAddress,
            boolean announcementEnabled,
            String announcementText,
            BigDecimal deliveryBaseFee,
            BigDecimal deliveryPerKm,
            BigDecimal deliveryMaxFee,
            BigDecimal freeDeliveryThreshold,
            BigDecimal minOrderAmount,
            BigDecimal maxDeliveryKm,
            BigDecimal storeLat,
            BigDecimal storeLng) {}

    // All fields optional — only the ones sent are updated.
    public record SettingsUpdateRequest(
            String businessName,
            Boolean acceptingOrders,
            String closedMessage,
            String contactPhone,
            String storeAddress,
            Boolean announcementEnabled,
            String announcementText,
            @DecimalMin("0.0") BigDecimal deliveryBaseFee,
            @DecimalMin("0.0") BigDecimal deliveryPerKm,
            @DecimalMin("0.0") BigDecimal deliveryMaxFee,
            @DecimalMin("0.0") BigDecimal freeDeliveryThreshold,
            @DecimalMin("0.0") BigDecimal minOrderAmount,
            @DecimalMin("0.0") BigDecimal maxDeliveryKm,
            BigDecimal storeLat,
            BigDecimal storeLng) {}

    // ---------- Customer ----------
    public record CustomerRequest(
            @NotBlank String fullName,
            @Email @NotBlank String email,
            String phoneNumber,        // optional — for delivery contact
            String defaultAddress) {}

    public record CustomerDto(UUID id, String fullName, String email, String phoneNumber,
                              String defaultAddress, OffsetDateTime createdAt) {}

    public record FcmTokenRequest(@NotBlank String fcmToken) {}

    // ---------- Orders ----------
    public record OrderItemRequest(
            @NotNull UUID menuItemId,
            @Min(1) int quantity,
            String addOns) {}

    public record PlaceOrderRequest(
            @NotEmpty @Valid List<OrderItemRequest> items,
            @NotBlank String deliveryAddress,
            String deliveryTimeNote,
            String kitchenNote,
            Double deliveryLat,   // delivery destination (for distance-based fee)
            Double deliveryLng,
            Boolean pickup) {}    // true = self-pickup (no delivery fee)

    public record OrderItemDto(UUID id, UUID menuItemId, String name, int quantity,
                               BigDecimal unitPrice, String addOns) {}

    public record OrderStatusEventDto(OrderStatus status, OffsetDateTime changedAt) {}

    public record OrderDto(UUID id, UUID customerId, String orderNumber, OrderStatus status,
                           boolean pickup,
                           String deliveryAddress, String deliveryTimeNote, String kitchenNote,
                           BigDecimal subtotal, BigDecimal deliveryFee, BigDecimal total,
                           OffsetDateTime createdAt, List<OrderItemDto> items,
                           List<OrderStatusEventDto> history) {}

    public record UpdateStatusRequest(@NotNull OrderStatus status) {}

    // ---------- Payments ----------
    public record PaymentInitRequest(
            @NotNull UUID orderId,
            @NotBlank String method,          // CARD, BANK_TRANSFER, MOBILE_MONEY
            @Email @NotBlank String email) {} // Paystack requires a customer email

    public record PaymentInitResponse(String authorizationUrl, String reference, String accessCode) {}

    public record PaymentDto(UUID id, UUID orderId, String method, BigDecimal amount,
                             String status, String provider, String providerReference) {}

    // ---------- Admin ----------
    public record AdminLoginRequest(@Email @NotBlank String email, @NotBlank String password) {}

    public record AdminLoginResponse(String token, String email, String fullName) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, message = "New password must be at least 8 characters") String newPassword) {}

    // ---------- Dashboard ----------
    public record DashboardSummaryDto(
            long ordersToday, BigDecimal revenueToday,
            long ordersThisWeek, BigDecimal revenueThisWeek,
            long ordersInRange, BigDecimal revenueInRange) {}

    // ---------- Support ----------
    public record SupportTicketRequest(
            @NotBlank String category,
            String orderNumber,
            @NotBlank String message) {}

    public record SupportStatusRequest(@NotBlank String status) {}

    public record SupportTicketDto(
            UUID id, UUID customerId, String name, String email, String phone,
            String category, String orderNumber, String message, String status,
            OffsetDateTime createdAt) {}

    // ---------- Reviews ----------
    public record ReviewRequest(@NotNull UUID orderId, @Min(1) @Max(5) int rating, String comment) {}

    public record ReviewDto(UUID id, UUID orderId, UUID customerId, String orderNumber,
                            String name, int rating, String comment, OffsetDateTime createdAt) {}
}
