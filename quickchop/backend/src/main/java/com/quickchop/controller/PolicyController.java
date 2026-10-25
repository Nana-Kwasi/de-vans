package com.quickchop.controller;

import com.quickchop.config.AuthContext;
import com.quickchop.config.ClientInfo;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.PolicyType;
import com.quickchop.entity.PolicyType.Audience;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.service.CustomerService;
import com.quickchop.service.PolicyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Policies: public reading, customer/rider acceptance, and admin publishing + consent records. */
@RestController
@Tag(name = "Policies")
public class PolicyController {

    private final PolicyService policyService;
    private final CustomerService customerService;
    private final ClientInfo clientInfo;

    public PolicyController(PolicyService policyService, CustomerService customerService, ClientInfo clientInfo) {
        this.policyService = policyService;
        this.customerService = customerService;
        this.clientInfo = clientInfo;
    }

    // ---------- Public (website, app stores) ----------

    @GetMapping("/api/policies")
    @Operation(summary = "Current policies for an audience (customer | rider) — public")
    public List<PolicyDto> current(@RequestParam(defaultValue = "customer") String audience) {
        return policyService.currentDtos(audience(audience));
    }

    @GetMapping("/api/policies/{slug}")
    @Operation(summary = "Current version of one policy, e.g. customer-privacy — public")
    public PolicyDto one(@PathVariable String slug) {
        return policyService.current(type(slug));
    }

    // ---------- Customer ----------

    @GetMapping("/api/customers/me/policies")
    public List<PolicyStatusDto> customerStatus() {
        return policyService.status(Audience.CUSTOMER, customerService.currentEntity().getId());
    }

    @PostMapping("/api/customers/me/policies/accept")
    public List<PolicyStatusDto> customerAccept(@Valid @RequestBody AcceptPoliciesRequest req, HttpServletRequest http) {
        return policyService.accept(Audience.CUSTOMER, customerService.currentEntity().getId(), req.policyIds(),
                clientInfo.ip(http), clientInfo.userAgent(http));
    }

    // ---------- Rider ----------

    @GetMapping("/api/rider/policies")
    public List<PolicyStatusDto> riderStatus() {
        return policyService.status(Audience.RIDER, AuthContext.currentRider().id());
    }

    @PostMapping("/api/rider/policies/accept")
    public List<PolicyStatusDto> riderAccept(@Valid @RequestBody AcceptPoliciesRequest req, HttpServletRequest http) {
        return policyService.accept(Audience.RIDER, AuthContext.currentRider().id(), req.policyIds(),
                clientInfo.ip(http), clientInfo.userAgent(http));
    }

    // ---------- Admin ----------

    @GetMapping("/api/admin/policies")
    @Operation(summary = "All policies with current text, version history and acceptance counts")
    public List<AdminPolicyDto> adminOverview() {
        return policyService.adminOverview();
    }

    @GetMapping("/api/admin/policies/versions/{id}")
    @Operation(summary = "The exact text of any published version")
    public PolicyDto adminVersion(@PathVariable UUID id) {
        return policyService.version(id);
    }

    @PostMapping("/api/admin/policies/{slug}")
    @Operation(summary = "Publish a new version (users must accept it again)")
    public PolicyDto publish(@PathVariable String slug, @Valid @RequestBody PublishPolicyRequest req) {
        return policyService.publish(type(slug), req);
    }

    @GetMapping("/api/admin/consents")
    @Operation(summary = "Every customer or rider and their acceptance of each current policy")
    public ConsentTableDto consents(@RequestParam(defaultValue = "customer") String audience) {
        return policyService.consentTable(audience(audience));
    }

    @GetMapping("/api/admin/consents/{audience}/{subjectId}")
    @Operation(summary = "Proof of acceptance for one person: versions, times, IPs, devices, text fingerprints")
    public ConsentProofDto proof(@PathVariable String audience, @PathVariable UUID subjectId) {
        return policyService.proof(audience(audience), subjectId);
    }

    private static Audience audience(String s) {
        try {
            return Audience.valueOf(s.trim().toUpperCase());
        } catch (Exception e) {
            throw new NotFoundException("Unknown audience: " + s);
        }
    }

    private static PolicyType type(String slug) {
        try {
            return PolicyType.fromSlug(slug);
        } catch (IllegalArgumentException e) {
            throw new NotFoundException("Unknown policy: " + slug);
        }
    }
}
