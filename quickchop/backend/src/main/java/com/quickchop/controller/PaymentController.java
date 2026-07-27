package com.quickchop.controller;

import com.quickchop.dto.Dtos.*;
import com.quickchop.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments/paystack")
@Tag(name = "Payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/initialize")
    @Operation(summary = "Start a Paystack transaction for an order (customer)")
    public PaymentInitResponse initialize(@Valid @RequestBody PaymentInitRequest req) {
        return paymentService.initialize(req);
    }

    @PostMapping("/webhook")
    @Operation(summary = "Paystack payment confirmation webhook (Paystack only)")
    public ResponseEntity<String> webhook(
            @RequestBody String rawBody,
            @RequestHeader(value = "x-paystack-signature", required = false) String signature) {
        paymentService.handleWebhook(rawBody, signature);
        return ResponseEntity.ok("ok");
    }

    @GetMapping("/verify/{reference}")
    @Operation(summary = "Manually verify a Paystack transaction reference (customer/admin)")
    public PaymentDto verify(@PathVariable String reference) {
        return paymentService.verify(reference);
    }
}
