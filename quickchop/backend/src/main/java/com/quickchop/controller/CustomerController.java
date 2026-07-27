package com.quickchop.controller;

import com.quickchop.dto.Dtos.*;
import com.quickchop.service.CustomerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
@Tag(name = "Customers")
@SecurityRequirement(name = "bearerAuth")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create the current customer's profile after Supabase sign-up")
    public CustomerDto create(@Valid @RequestBody CustomerRequest req) {
        return customerService.createProfile(req);
    }

    @GetMapping("/me")
    @Operation(summary = "Get the current customer's profile")
    public CustomerDto me() {
        return customerService.getMe();
    }

    @PutMapping("/me/fcm-token")
    @Operation(summary = "Register/update this device's FCM push token")
    public void updateFcmToken(@Valid @RequestBody FcmTokenRequest req) {
        customerService.updateFcmToken(req.fcmToken());
    }
}
