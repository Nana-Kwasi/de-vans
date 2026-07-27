package com.quickchop.controller;

import com.quickchop.dto.Dtos.*;
import com.quickchop.service.AdminService;
import com.quickchop.service.CustomerService;

import java.util.List;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@Tag(name = "Admin")
public class AdminController {

    private final AdminService adminService;
    private final CustomerService customerService;

    public AdminController(AdminService adminService, CustomerService customerService) {
        this.adminService = adminService;
        this.customerService = customerService;
    }

    @PostMapping("/login")
    @Operation(summary = "Admin email/password login — returns a Spring-issued JWT")
    public AdminLoginResponse login(@Valid @RequestBody AdminLoginRequest req) {
        return adminService.login(req);
    }

    @PatchMapping("/change-password")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Change the logged-in admin's password")
    public void changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        adminService.changePassword(req);
    }

    @GetMapping("/customers")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List all customers who have a profile (admin)")
    public List<CustomerDto> customers() {
        return customerService.listAll();
    }
}
