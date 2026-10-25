package com.quickchop.controller;

import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.OrderStatus;
import com.quickchop.service.DeliveryService;
import com.quickchop.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders")
@SecurityRequirement(name = "bearerAuth")
public class OrderController {

    private final OrderService orderService;
    private final DeliveryService deliveryService;

    public OrderController(OrderService orderService, DeliveryService deliveryService) {
        this.orderService = orderService;
        this.deliveryService = deliveryService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Place a new order (customer)")
    public OrderDto place(@Valid @RequestBody PlaceOrderRequest req) {
        return orderService.placeOrder(req);
    }

    @GetMapping("/me")
    @Operation(summary = "List the current customer's orders")
    public List<OrderDto> myOrders() {
        return orderService.myOrders();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a single order + status history (customer owns it, or admin)")
    public OrderDto getOne(@PathVariable UUID id) {
        return orderService.getOne(id);
    }

    @GetMapping("/{id}/tracking")
    @Operation(summary = "Live delivery tracking: rider, rider location, ETA and delivery code (customer owns it, or admin)")
    public OrderTrackingDto tracking(@PathVariable UUID id) {
        return deliveryService.tracking(id);
    }

    @PatchMapping("/{id}/dropoff")
    @Operation(summary = "Move the delivery pin (customer), until the order is delivered")
    public OrderDto updateDropoff(@PathVariable UUID id, @Valid @RequestBody UpdateDropoffRequest req) {
        return orderService.updateDropoff(id, req);
    }

    @GetMapping
    @Operation(summary = "List all orders, optionally filtered by status (admin)")
    public List<OrderDto> all(@RequestParam(required = false) OrderStatus status) {
        return orderService.allOrders(status);
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update an order's status (admin)")
    public OrderDto updateStatus(@PathVariable UUID id, @Valid @RequestBody UpdateStatusRequest req) {
        return orderService.updateStatus(id, req.status());
    }
}
