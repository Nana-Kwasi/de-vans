package com.quickchop.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.quickchop.entity.Order;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;

/**
 * Sends push notifications to customers on order status changes, via Firebase
 * Cloud Messaging (FCM).
 *
 * FCM is enabled only when FCM_CREDENTIALS_PATH points at a valid Firebase
 * service-account JSON. Otherwise (local dev, or before Firebase is set up) each
 * notification is simply logged, and nothing else in the app changes.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final String credentialsPath;
    private FirebaseMessaging messaging; // null when FCM is disabled

    public NotificationService(@Value("${fcm.credentials-path:}") String credentialsPath) {
        this.credentialsPath = credentialsPath;
    }

    @PostConstruct
    void init() {
        if (credentialsPath == null || credentialsPath.isBlank()) {
            log.info("FCM disabled (no fcm.credentials-path set) — order pushes will be logged only.");
            return;
        }
        try (FileInputStream in = new FileInputStream(credentialsPath)) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(in))
                    .build();
            FirebaseApp app = FirebaseApp.getApps().isEmpty()
                    ? FirebaseApp.initializeApp(options)
                    : FirebaseApp.getInstance();
            this.messaging = FirebaseMessaging.getInstance(app);
            log.info("FCM initialized from {}", credentialsPath);
        } catch (Exception e) {
            // Never fail startup because of push config — degrade to logging.
            log.error("Failed to initialize FCM from {} — pushes will be logged only.",
                    credentialsPath, e);
        }
    }

    public void sendOrderUpdate(Order order, String fcmToken) {
        sendMessage(order, fcmToken, statusMessage(order));
    }

    /** Pushes an arbitrary order message (used for rider events that are not a status change). */
    public void sendMessage(Order order, String fcmToken, String body) {
        String title = "Qooka Qooks Restaurant — Order " + order.getOrderNumber();

        if (messaging == null || fcmToken == null || fcmToken.isBlank()) {
            log.info("[push:disabled] would notify token={} -> {}: {}", mask(fcmToken), title, body);
            return;
        }

        Message message = Message.builder()
                .setToken(fcmToken)
                .setNotification(Notification.builder().setTitle(title).setBody(body).build())
                .putData("orderId", order.getId().toString())
                .putData("orderNumber", order.getOrderNumber())
                .putData("status", order.getStatus().name())
                .build();
        try {
            String id = messaging.send(message);
            log.info("[push] sent {} to {} -> {}", id, mask(fcmToken), body);
        } catch (Exception e) {
            // A bad/expired token shouldn't break the order flow.
            log.warn("[push] failed for token {}: {}", mask(fcmToken), e.getMessage());
        }
    }

    private String statusMessage(Order order) {
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

    private String mask(String token) {
        if (token == null || token.length() < 6) return "<none>";
        return token.substring(0, 6) + "…";
    }
}
