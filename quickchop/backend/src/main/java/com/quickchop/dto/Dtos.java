package com.quickchop.dto;

import com.quickchop.entity.DeliveryStatus;
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
                              String photoUrl, String category, boolean available, boolean featured,
                              String drinkType) {}   // "soft" | "local" for drinks, else null

    public record MenuItemRequest(
            @NotBlank String name,
            String description,
            @NotNull @DecimalMin("0.0") BigDecimal price,
            String photoUrl,
            @NotBlank String category,
            Boolean available,
            Boolean featured,
            String drinkType) {}

    public record MenuItemUpdateRequest(String name, String description, BigDecimal price,
                                        String photoUrl, String category,
                                        Boolean available, Boolean featured, String drinkType) {}

    // ---------- App settings (restaurant-wide, admin-controlled) ----------
    public record SettingsDto(
            String businessName,
            boolean acceptingOrders,
            String closedMessage,
            String contactPhone,
            String storeAddress,
            boolean announcementEnabled,
            String announcementText,
            boolean promoEnabled,
            String promoTitle,
            String promoText,
            String promoCta,
            String promoImageUrl,
            BigDecimal deliveryBaseFee,
            BigDecimal deliveryPerKm,
            BigDecimal deliveryMaxFee,
            BigDecimal deliveryIncludedKm,
            BigDecimal freeDeliveryThreshold,
            BigDecimal minOrderAmount,
            BigDecimal maxDeliveryKm,
            BigDecimal storeLat,
            BigDecimal storeLng,
            // Straight-line km × this = billed road km. Sent so the app quotes the same fee
            // the server charges. Server config, not an admin setting.
            BigDecimal deliveryRoadFactor) {}

    // All fields optional — only the ones sent are updated.
    public record SettingsUpdateRequest(
            String businessName,
            Boolean acceptingOrders,
            String closedMessage,
            String contactPhone,
            String storeAddress,
            Boolean announcementEnabled,
            String announcementText,
            Boolean promoEnabled,
            String promoTitle,
            String promoText,
            String promoCta,
            String promoImageUrl,
            @DecimalMin("0.0") BigDecimal deliveryBaseFee,
            @DecimalMin("0.0") BigDecimal deliveryPerKm,
            @DecimalMin("0.0") BigDecimal deliveryMaxFee,
            @DecimalMin("0.0") BigDecimal deliveryIncludedKm,
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
            @DecimalMin("-90") @DecimalMax("90") Double deliveryLat,     // drop-off point: prices the
            @DecimalMin("-180") @DecimalMax("180") Double deliveryLng,   // delivery and guides the rider
            Boolean pickup,       // true = self-pickup (no delivery fee)
            @DecimalMin("0") Double deliveryAccuracyM,  // GPS accuracy of the drop-off point
            @Size(max = 20) String contactPhone) {}

    public record OrderItemDto(UUID id, UUID menuItemId, String name, int quantity,
                               BigDecimal unitPrice, String addOns) {}

    public record OrderStatusEventDto(OrderStatus status, OffsetDateTime changedAt) {}

    public record OrderDto(UUID id, UUID customerId, String orderNumber, OrderStatus status,
                           boolean pickup,
                           String deliveryAddress, String deliveryTimeNote, String kitchenNote,
                           BigDecimal subtotal, BigDecimal deliveryFee, BigDecimal total,
                           OffsetDateTime createdAt, List<OrderItemDto> items,
                           List<OrderStatusEventDto> history,
                           Double deliveryLat, Double deliveryLng, Double deliveryAccuracyM,
                           String contactPhone,
                           OrderDeliveryDto delivery,       // null until dispatched to riders
                           String customerName,
                           OffsetDateTime paidAt) {}        // null = not paid yet

    /** The rider side of an order, as the customer and the admin see it. */
    public record OrderDeliveryDto(UUID id, DeliveryStatus status,
                                   UUID riderId, String riderName, String riderPhone,
                                   String vehicleType, String vehiclePlate,
                                   OffsetDateTime dispatchedAt, OffsetDateTime acceptedAt,
                                   OffsetDateTime pickedUpAt, OffsetDateTime arrivedAt,
                                   OffsetDateTime deliveredAt) {}

    public record GeoPointDto(double lat, double lng, Double accuracyM, OffsetDateTime at) {}

    /**
     * Live tracking for one order (customer who owns it, or admin). riderLocation is only
     * present while a rider actually holds the job — never before acceptance or after
     * hand-over, so a rider's whereabouts are not exposed beyond the delivery.
     */
    public record OrderTrackingDto(UUID orderId, String orderNumber, OrderStatus orderStatus,
                                   OrderDeliveryDto delivery,
                                   GeoPointDto riderLocation, GeoPointDto dropoff, GeoPointDto store,
                                   String deliveryPin,
                                   Double riderDistanceKm, Integer etaMinutes) {}

    /** The customer moves their drop-off pin (e.g. walks out to the gate). */
    public record UpdateDropoffRequest(
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
            @DecimalMin("0") Double accuracyM) {}

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

    /** mustChangePassword true means the account is still on its invite password and
     *  the dashboard should send the admin straight to the change-password screen. */
    public record AdminLoginResponse(String token, String email, String fullName,
                                     boolean mustChangePassword) {}

    public record AdminInviteRequest(
            @NotBlank @Email(message = "A valid email is required") String email,
            @NotBlank String fullName) {}

    /** The temporary password is returned once, at creation, and never again. */
    public record AdminInviteResponse(
            UUID id, String email, String fullName, String temporaryPassword, boolean emailed) {}

    public record AdminUserDto(
            UUID id, String email, String fullName, boolean mustChangePassword, OffsetDateTime createdAt) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, message = "New password must be at least 8 characters") String newPassword) {}

    public record ForgotPasswordRequest(
            @NotBlank @Email(message = "A valid email is required") String email) {}

    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank @Size(min = 8, message = "New password must be at least 8 characters") String newPassword) {}

    // ---------- Riders (admin management) ----------
    public record RiderCreateRequest(
            @NotBlank @Size(max = 120) String fullName,
            @NotBlank @Size(max = 20) String phoneNumber,
            @Email @Size(max = 160) String email,
            @Pattern(regexp = "MOTORBIKE|BICYCLE|CAR|ON_FOOT", message = "Vehicle must be MOTORBIKE, BICYCLE, CAR or ON_FOOT")
            String vehicleType,
            @Size(max = 20) String vehiclePlate,
            @Size(max = 1000) String notes) {}

    /** All optional — only the fields sent are changed. */
    public record RiderUpdateRequest(
            @Size(min = 1, max = 120) String fullName,
            @Size(min = 1, max = 20) String phoneNumber,
            @Email @Size(max = 160) String email,
            @Pattern(regexp = "MOTORBIKE|BICYCLE|CAR|ON_FOOT", message = "Vehicle must be MOTORBIKE, BICYCLE, CAR or ON_FOOT")
            String vehicleType,
            @Size(max = 20) String vehiclePlate,
            @Size(max = 1000) String notes) {}

    public record RiderAdminDto(UUID id, String fullName, String phoneNumber, String email,
                                String vehicleType, String vehiclePlate, String notes,
                                boolean active, boolean online, boolean mustChangePassword, boolean locked,
                                GeoPointDto lastLocation, int activeDeliveries, long deliveredCount,
                                BigDecimal totalEarned, OffsetDateTime createdAt) {}

    /** Returned once, when an admin creates a rider or resets their password. */
    public record RiderCredentialsResponse(RiderAdminDto rider, String temporaryPassword) {}

    // ---------- Riders (self) ----------
    public record RiderLoginRequest(@NotBlank @Size(max = 20) String phoneNumber,
                                    @NotBlank @Size(max = 200) String password) {}

    public record RiderProfileDto(UUID id, String fullName, String phoneNumber, String email,
                                  String vehicleType, String vehiclePlate,
                                  boolean online, boolean mustChangePassword) {}

    public record RiderLoginResponse(String token, RiderProfileDto rider) {}

    public record RiderStatusRequest(@NotNull Boolean online) {}

    public record RiderLocationRequest(
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng,
            @DecimalMin("0") Double accuracyM) {}

    public record RiderPasswordChangeRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, max = 200, message = "New password must be at least 8 characters") String newPassword) {}

    public record CompleteDeliveryRequest(
            @Pattern(regexp = "\\d{4,6}", message = "Enter the customer's delivery code") String pin) {}

    public record RiderSummaryDto(long todayCount, BigDecimal todayEarnings,
                                  long weekCount, BigDecimal weekEarnings,
                                  long totalCount, BigDecimal totalEarnings) {}

    // ---------- Delivery jobs (rider + admin views) ----------
    /**
     * Everything about one delivery job. Riders see the full job once it is theirs; while it
     * is still in the open pool the customer's name and phone are withheld (every rider can
     * see the pool, but only the one who takes the job needs to contact the customer).
     *
     * Riders never handle order money — customers pay the restaurant in the app — so the
     * order's prices and payment state are admin-only (null for riders). A rider sees one
     * amount: riderFee, what they earn for the trip.
     */
    public record DeliveryJobDto(
            UUID id, UUID orderId, String orderNumber, DeliveryStatus status, OrderStatus orderStatus,
            BigDecimal riderFee, BigDecimal orderSubtotal, BigDecimal orderDeliveryFee, BigDecimal orderTotal,
            Boolean paid, String paymentMethod,
            String pickupName, String pickupAddress, Double pickupLat, Double pickupLng, String storePhone,
            String dropoffAddress, Double dropoffLat, Double dropoffLng, Double dropoffAccuracyM,
            Double tripKm,
            String customerName, String customerPhone,
            String deliveryTimeNote, String customerNote, String dispatchNote,
            List<OrderItemDto> items, int itemCount,
            UUID riderId, String riderName, String riderPhone, GeoPointDto riderLocation,
            int pinAttempts, boolean pinLocked, boolean completedByAdmin,
            OffsetDateTime dispatchedAt, OffsetDateTime acceptedAt, OffsetDateTime pickedUpAt,
            OffsetDateTime arrivedAt, OffsetDateTime deliveredAt, OffsetDateTime cancelledAt) {}

    public record DeliveryRouteDto(DeliveryJobDto job, List<GeoPointDto> path) {}

    public record DispatchRequest(@Size(max = 500) String note) {}

    public record AssignRiderRequest(@NotNull UUID riderId) {}

    // ---------- Admin search + order detail ----------
    public record SearchOrderHit(UUID id, String orderNumber, OrderStatus status, String customerName,
                                 BigDecimal total, boolean pickup, OffsetDateTime createdAt) {}

    public record SearchCustomerHit(UUID id, String fullName, String email, String phoneNumber, long orderCount) {}

    public record SearchRiderHit(UUID id, String fullName, String phoneNumber, boolean active, boolean online) {}

    public record SearchResultsDto(List<SearchOrderHit> orders, List<SearchCustomerHit> customers,
                                   List<MenuItemDto> menu, List<SearchRiderHit> riders) {}

    public record FavouriteItemDto(String name, long quantity) {}

    /**
     * What the business knows about a customer, for the order detail screen.
     * segment: NEW (1 order), RETURNING (2–4), LOYAL (5+), based on non-cancelled orders.
     */
    public record CustomerInsightsDto(
            CustomerDto customer, String segment,
            long orderCount, long completedCount, long cancelledCount, long activeCount,
            BigDecimal totalSpent, BigDecimal avgOrderValue,
            OffsetDateTime firstOrderAt, OffsetDateTime lastOrderAt, Long daysSinceLastOrder,
            long deliveryCount, long pickupCount,
            List<FavouriteItemDto> favouriteItems,
            Double avgRating, long reviewCount, long openTickets,
            List<SearchOrderHit> recentOrders) {}

    public record AdminOrderDetailDto(OrderDto order, CustomerInsightsDto customer,
                                      List<PaymentDto> payments, boolean paid,
                                      ReviewDto review, DeliveryJobDto delivery) {}

    // ---------- Policies & consent ----------
    public record PolicyDto(UUID id, String type, String slug, String audience, int version, String title,
                            String content, String contentSha256, String changeSummary, OffsetDateTime publishedAt) {}

    /** A version without its text, for history lists. */
    public record PolicyVersionDto(UUID id, int version, String title, String contentSha256,
                                   String changeSummary, OffsetDateTime publishedAt) {}

    /** One current policy and whether the signed-in customer/rider has accepted this version. */
    public record PolicyStatusDto(PolicyDto policy, boolean accepted, OffsetDateTime acceptedAt) {}

    public record AcceptPoliciesRequest(@NotEmpty @Size(max = 10) List<UUID> policyIds) {}

    public record PublishPolicyRequest(
            @NotBlank @Size(max = 160) String title,
            @NotBlank @Size(max = 100_000) String content,
            @Size(max = 500) String changeSummary) {}

    public record AdminPolicyDto(String type, String slug, String audience, PolicyDto current,
                                 List<PolicyVersionDto> versions, long acceptedCurrent, long totalUsers) {}

    /** One user's standing on one current policy: accepted this version, an older one, or none. */
    public record ConsentCellDto(String type, int currentVersion, Integer acceptedVersion,
                                 OffsetDateTime acceptedAt, boolean upToDate) {}

    public record ConsentRowDto(UUID subjectId, String name, String phone, String email,
                                OffsetDateTime joinedAt, boolean allAccepted, List<ConsentCellDto> policies) {}

    public record ConsentTableDto(String audience, List<PolicyVersionDto> currentPolicies,
                                  long totalUsers, long fullyAccepted, List<ConsentRowDto> rows) {}

    /**
     * Proof of one acceptance. hashMatches compares the fingerprint recorded at acceptance
     * with the fingerprint of the published version — true means the person agreed to
     * exactly that text, which has not been altered since.
     */
    public record AcceptanceProofDto(UUID id, String policyType, String policyTitle, int version,
                                     boolean currentVersion, OffsetDateTime acceptedAt,
                                     String ipAddress, String userAgent,
                                     String acceptedSha256, String policySha256, boolean hashMatches,
                                     UUID policyId) {}

    public record ConsentProofDto(String audience, UUID subjectId, String name, String phone, String email,
                                  List<AcceptanceProofDto> acceptances) {}

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
