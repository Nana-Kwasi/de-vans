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

/** Rider accounts and delivery dispatch, for admins (all under /api/admin → ROLE_ADMIN). */
@RestController
@RequestMapping("/api/admin")
@Tag(name = "Admin · Riders & deliveries")
@SecurityRequirement(name = "bearerAuth")
public class AdminRiderController {

    private final RiderService riderService;
    private final DeliveryService deliveryService;

    public AdminRiderController(RiderService riderService, DeliveryService deliveryService) {
        this.riderService = riderService;
        this.deliveryService = deliveryService;
    }

    // ---------- Riders ----------

    @GetMapping("/riders")
    @Operation(summary = "List riders with status, last location and totals")
    public List<RiderAdminDto> riders() {
        return riderService.list();
    }

    @PostMapping("/riders")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a rider", description = "Returns a temporary password once; the rider must change it at first sign-in.")
    public RiderCredentialsResponse create(@Valid @RequestBody RiderCreateRequest req) {
        return riderService.create(req);
    }

    @GetMapping("/riders/{id}")
    public RiderAdminDto rider(@PathVariable UUID id) {
        return riderService.get(id);
    }

    @PatchMapping("/riders/{id}")
    @Operation(summary = "Edit a rider's details")
    public RiderAdminDto update(@PathVariable UUID id, @Valid @RequestBody RiderUpdateRequest req) {
        return riderService.update(id, req);
    }

    @PostMapping("/riders/{id}/deactivate")
    @Operation(summary = "Deactivate a rider (signs them out immediately)")
    public RiderAdminDto deactivate(@PathVariable UUID id) {
        return riderService.setActive(id, false);
    }

    @PostMapping("/riders/{id}/activate")
    public RiderAdminDto activate(@PathVariable UUID id) {
        return riderService.setActive(id, true);
    }

    @PostMapping("/riders/{id}/reset-password")
    @Operation(summary = "Issue a new temporary password (also unlocks and signs out)")
    public RiderCredentialsResponse resetPassword(@PathVariable UUID id) {
        return riderService.resetPassword(id);
    }

    @GetMapping("/riders/{id}/deliveries")
    @Operation(summary = "A rider's completed deliveries")
    public List<DeliveryJobDto> riderDeliveries(@PathVariable UUID id) {
        return deliveryService.riderHistoryForAdmin(id);
    }

    // ---------- Deliveries ----------

    @PostMapping("/orders/{orderId}/dispatch")
    @Operation(summary = "Send a ready order to all riders")
    public DeliveryJobDto dispatch(@PathVariable UUID orderId, @Valid @RequestBody(required = false) DispatchRequest req) {
        return deliveryService.dispatch(orderId, req);
    }

    @GetMapping("/deliveries")
    @Operation(summary = "Active deliveries (default) or recent finished ones (?history=true)")
    public List<DeliveryJobDto> deliveries(@RequestParam(defaultValue = "false") boolean history,
                                           @RequestParam(defaultValue = "7") int days) {
        return history ? deliveryService.adminRecent(days) : deliveryService.adminActive();
    }

    @GetMapping("/deliveries/{id}")
    @Operation(summary = "One delivery with its full location trail")
    public DeliveryRouteDto delivery(@PathVariable UUID id) {
        return deliveryService.adminRoute(id);
    }

    @PostMapping("/deliveries/{id}/assign")
    @Operation(summary = "Assign (or reassign, before pickup) to a specific rider")
    public DeliveryJobDto assign(@PathVariable UUID id, @Valid @RequestBody AssignRiderRequest req) {
        return deliveryService.assign(id, req.riderId());
    }

    @PostMapping("/deliveries/{id}/unassign")
    @Operation(summary = "Take a job back from its rider and return it to the pool")
    public DeliveryJobDto unassign(@PathVariable UUID id) {
        return deliveryService.unassign(id);
    }

    @PostMapping("/deliveries/{id}/recall")
    @Operation(summary = "Withdraw from riders; the order goes back to Preparing")
    public DeliveryJobDto recall(@PathVariable UUID id) {
        return deliveryService.recall(id);
    }

    @PostMapping("/deliveries/{id}/complete")
    @Operation(summary = "Mark delivered without the customer's code (admin override)")
    public DeliveryJobDto complete(@PathVariable UUID id) {
        return deliveryService.forceComplete(id);
    }
}
