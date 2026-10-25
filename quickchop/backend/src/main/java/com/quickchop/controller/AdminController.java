package com.quickchop.controller;

import com.quickchop.dto.Dtos.*;
import com.quickchop.service.AdminInsightsService;
import com.quickchop.service.AdminService;
import com.quickchop.service.CustomerService;

import java.util.List;
import java.util.UUID;
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
    private final AdminInsightsService insightsService;

    public AdminController(AdminService adminService, CustomerService customerService,
                           AdminInsightsService insightsService) {
        this.adminService = adminService;
        this.customerService = customerService;
        this.insightsService = insightsService;
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

    @PostMapping("/forgot-password")
    @Operation(summary = "Email a password-reset link to an admin",
               description = "Always succeeds, whether or not the address belongs to an admin — "
                           + "reporting otherwise would confirm which addresses exist.")
    public void forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        adminService.requestPasswordReset(req);
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Set a new password using a reset token")
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        adminService.resetPassword(req);
    }

    @PostMapping("/users")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Invite another admin",
               description = "Creates the account with a generated temporary password, emails it to them, "
                           + "and returns it once so it can be passed on if the email does not arrive. "
                           + "They must choose their own password at first sign-in.")
    public AdminInviteResponse invite(@Valid @RequestBody AdminInviteRequest req) {
        return adminService.invite(req);
    }

    @GetMapping("/users")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List admin accounts")
    public List<AdminUserDto> admins() {
        return adminService.listAdmins();
    }

    @GetMapping("/search")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Global search across orders, customers, menu and riders (admin)")
    public SearchResultsDto search(@RequestParam("q") String q) {
        return insightsService.search(q);
    }

    @GetMapping("/orders/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Everything for the order detail screen: order, payments, review, delivery, customer analytics")
    public AdminOrderDetailDto orderDetail(@PathVariable UUID id) {
        return insightsService.orderDetail(id);
    }

    @GetMapping("/customers/{id}/insights")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Order history analytics for one customer")
    public CustomerInsightsDto customerInsights(@PathVariable UUID id) {
        return insightsService.customerInsights(id);
    }

    @GetMapping("/customers")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "List all customers who have a profile (admin)")
    public List<CustomerDto> customers() {
        return customerService.listAll();
    }
}
