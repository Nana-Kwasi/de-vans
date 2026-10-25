package com.quickchop.controller;

import com.quickchop.dto.Dtos.*;
import com.quickchop.service.DeliveryService;
import com.quickchop.service.RiderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** The rider dashboard's API. Everything except login requires ROLE_RIDER (rider JWT). */
@RestController
@RequestMapping("/api/rider")
@Tag(name = "Rider")
public class RiderController {

    private final RiderService riderService;
    private final DeliveryService deliveryService;

    public RiderController(RiderService riderService, DeliveryService deliveryService) {
        this.riderService = riderService;
        this.deliveryService = deliveryService;
    }

    @PostMapping("/login")
    @Operation(summary = "Rider sign-in with phone number + password (accounts are created by an admin)")
    public RiderLoginResponse login(@Valid @RequestBody RiderLoginRequest req) {
        return riderService.login(req);
    }

    @GetMapping("/me")
    @SecurityRequirement(name = "bearerAuth")
    public RiderProfileDto me() {
        return riderService.me();
    }

    @PatchMapping("/change-password")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Change password; returns a new token (the old one is revoked)")
    public RiderLoginResponse changePassword(@Valid @RequestBody RiderPasswordChangeRequest req) {
        return riderService.changePassword(req);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Sign out on every device")
    public void logout() {
        riderService.logout();
    }

    @PostMapping("/status")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Go online / offline")
    public RiderProfileDto status(@Valid @RequestBody RiderStatusRequest req) {
        return riderService.setOnline(req.online());
    }

    @PostMapping("/location")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Report the device's current position")
    public void location(@Valid @RequestBody RiderLocationRequest req) {
        deliveryService.recordLocation(req);
    }

    @GetMapping("/summary")
    @SecurityRequirement(name = "bearerAuth")
    public RiderSummaryDto summary() {
        return deliveryService.mySummary();
    }

    @GetMapping("/deliveries/available")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Open delivery requests (visible to every rider until one accepts)")
    public List<DeliveryJobDto> available() {
        return deliveryService.pool();
    }

    @GetMapping("/deliveries/active")
    @SecurityRequirement(name = "bearerAuth")
    public List<DeliveryJobDto> active() {
        return deliveryService.myActive();
    }

    @GetMapping("/deliveries/history")
    @SecurityRequirement(name = "bearerAuth")
    public List<DeliveryJobDto> history() {
        return deliveryService.myHistory();
    }

    @GetMapping("/deliveries/{id}")
    @SecurityRequirement(name = "bearerAuth")
    public DeliveryJobDto get(@PathVariable UUID id) {
        return deliveryService.riderGet(id);
    }

    @PostMapping("/deliveries/{id}/accept")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Accept a request — only the first rider succeeds (409 for everyone else)")
    public DeliveryJobDto accept(@PathVariable UUID id) {
        return deliveryService.accept(id);
    }

    @PostMapping("/deliveries/{id}/release")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Give an accepted job back before pickup")
    public DeliveryJobDto release(@PathVariable UUID id) {
        return deliveryService.release(id);
    }

    @PostMapping("/deliveries/{id}/picked-up")
    @SecurityRequirement(name = "bearerAuth")
    public DeliveryJobDto pickedUp(@PathVariable UUID id) {
        return deliveryService.pickedUp(id);
    }

    @PostMapping("/deliveries/{id}/arrived")
    @SecurityRequirement(name = "bearerAuth")
    public DeliveryJobDto arrived(@PathVariable UUID id) {
        return deliveryService.arrived(id);
    }

    @PostMapping("/deliveries/{id}/complete")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Complete the hand-over with the customer's delivery code")
    public DeliveryJobDto complete(@PathVariable UUID id, @Valid @RequestBody CompleteDeliveryRequest req) {
        return deliveryService.complete(id, req);
    }
}
