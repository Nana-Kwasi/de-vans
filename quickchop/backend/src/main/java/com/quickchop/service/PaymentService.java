package com.quickchop.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.Order;
import com.quickchop.entity.Payment;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.repository.OrderRepository;
import com.quickchop.repository.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/**
 * Paystack integration. Never trusts the client that a payment succeeded — the
 * source of truth is the signed webhook (or an explicit verify call).
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepo;
    private final OrderRepository orderRepo;
    private final OrderService orderService;
    private final ObjectMapper mapper = new ObjectMapper();
    private final RestClient paystack;
    private final String secretKey;

    public PaymentService(PaymentRepository paymentRepo, OrderRepository orderRepo,
                          OrderService orderService,
                          @Value("${paystack.secret-key}") String secretKey,
                          @Value("${paystack.base-url:https://api.paystack.co}") String baseUrl) {
        this.paymentRepo = paymentRepo;
        this.orderRepo = orderRepo;
        this.orderService = orderService;
        this.secretKey = secretKey;
        this.paystack = RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + secretKey)
                .defaultHeader("Content-Type", "application/json")
                .build();
    }

    /** Starts a Paystack transaction for an order and returns the checkout URL. */
    public PaymentInitResponse initialize(PaymentInitRequest req) {
        Order order = orderRepo.findById(req.orderId())
                .orElseThrow(() -> new NotFoundException("Order not found: " + req.orderId()));

        String reference = "QC_" + order.getOrderNumber().replace("-", "") + "_"
                + UUID.randomUUID().toString().substring(0, 8);

        // Paystack amounts are in the minor unit (pesewas for GHS).
        long amountMinor = order.getTotal().multiply(BigDecimal.valueOf(100)).longValueExact();

        // Record the attempt as PENDING before calling out.
        Payment payment = new Payment();
        payment.setOrderId(order.getId());
        payment.setMethod(req.method());
        payment.setAmount(order.getTotal());
        payment.setStatus("PENDING");
        payment.setProvider("PAYSTACK");
        payment.setProviderReference(reference);
        paymentRepo.save(payment);

        try {
            JsonNode resp = paystack.post()
                    .uri("/transaction/initialize")
                    .body(Map.of(
                            "email", req.email(),
                            "amount", amountMinor,
                            "currency", "GHS",
                            "reference", reference))
                    .retrieve()
                    .body(JsonNode.class);

            JsonNode data = resp == null ? null : resp.get("data");
            if (data == null || !resp.path("status").asBoolean(false)) {
                throw new BadRequestException("Paystack initialize failed: "
                        + (resp == null ? "no response" : resp.path("message").asText()));
            }
            return new PaymentInitResponse(
                    data.path("authorization_url").asText(),
                    data.path("reference").asText(reference),
                    data.path("access_code").asText());
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.error("Paystack initialize error", e);
            throw new BadRequestException("Could not reach Paystack. Check PAYSTACK_SECRET_KEY.");
        }
    }

    /** Handles the Paystack webhook. Validates the signature, then applies the result. */
    public void handleWebhook(String rawBody, String signature) {
        if (!signatureValid(rawBody, signature)) {
            throw new BadRequestException("Invalid Paystack signature");
        }
        try {
            JsonNode event = mapper.readTree(rawBody);
            String type = event.path("event").asText();
            String reference = event.path("data").path("reference").asText();
            if ("charge.success".equals(type)) {
                applyResult(reference, "SUCCESS");
            } else if ("charge.failed".equals(type)) {
                applyResult(reference, "FAILED");
            } else {
                log.info("Ignoring Paystack event: {}", type);
            }
        } catch (Exception e) {
            log.error("Failed to process Paystack webhook", e);
            throw new BadRequestException("Malformed webhook payload");
        }
    }

    /** Manual verify against Paystack's verify endpoint. */
    public PaymentDto verify(String reference) {
        Payment payment = paymentRepo.findByProviderReference(reference)
                .orElseThrow(() -> new NotFoundException("Payment not found: " + reference));
        try {
            JsonNode resp = paystack.get()
                    .uri("/transaction/verify/{ref}", reference)
                    .retrieve()
                    .body(JsonNode.class);
            String status = resp == null ? "" : resp.path("data").path("status").asText();
            if ("success".equalsIgnoreCase(status)) {
                applyResult(reference, "SUCCESS");
            } else if ("failed".equalsIgnoreCase(status)) {
                applyResult(reference, "FAILED");
            }
        } catch (Exception e) {
            log.error("Paystack verify error", e);
        }
        Payment updated = paymentRepo.findByProviderReference(reference).orElse(payment);
        return toDto(updated);
    }

    private void applyResult(String reference, String status) {
        paymentRepo.findByProviderReference(reference).ifPresent(payment -> {
            if ("SUCCESS".equals(payment.getStatus())) return; // idempotent
            payment.setStatus(status);
            paymentRepo.save(payment);
            if ("SUCCESS".equals(status)) {
                orderService.markPaid(payment.getOrderId());
            }
        });
    }

    private boolean signatureValid(String rawBody, String signature) {
        if (signature == null) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            byte[] hash = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            String computed = HexFormat.of().formatHex(hash);
            return computed.equalsIgnoreCase(signature);
        } catch (Exception e) {
            return false;
        }
    }

    private PaymentDto toDto(Payment p) {
        return new PaymentDto(p.getId(), p.getOrderId(), p.getMethod(), p.getAmount(),
                p.getStatus(), p.getProvider(), p.getProviderReference());
    }
}
