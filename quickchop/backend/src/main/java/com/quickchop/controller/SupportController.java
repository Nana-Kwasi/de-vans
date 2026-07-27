package com.quickchop.controller;

import com.quickchop.dto.Dtos.*;
import com.quickchop.service.SupportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@Tag(name = "Support")
public class SupportController {

    private final SupportService supportService;

    public SupportController(SupportService supportService) {
        this.supportService = supportService;
    }

    @PostMapping("/support")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Submit a support/help ticket (customer)")
    public SupportTicketDto create(@Valid @RequestBody SupportTicketRequest req) {
        return supportService.create(req);
    }

    @GetMapping("/admin/support")
    @Operation(summary = "List support tickets, optionally by status (admin)")
    public List<SupportTicketDto> list(@RequestParam(required = false) String status) {
        return supportService.listAll(status);
    }

    @PatchMapping("/admin/support/{id}/status")
    @Operation(summary = "Update a ticket's status, e.g. OPEN → RESOLVED (admin)")
    public SupportTicketDto updateStatus(@PathVariable UUID id, @Valid @RequestBody SupportStatusRequest req) {
        return supportService.updateStatus(id, req.status());
    }
}
