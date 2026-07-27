package com.quickchop.controller;

import com.quickchop.dto.Dtos.SettingsDto;
import com.quickchop.dto.Dtos.SettingsUpdateRequest;
import com.quickchop.service.SettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@Tag(name = "Settings")
public class SettingsController {

    private final SettingsService service;

    public SettingsController(SettingsService service) {
        this.service = service;
    }

    @GetMapping("/api/config")
    @Operation(summary = "Restaurant settings the mobile app reads at launch (public)")
    public SettingsDto config() {
        return service.get();
    }

    @PatchMapping("/api/admin/settings")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Update restaurant settings (admin)")
    public SettingsDto update(@Valid @RequestBody SettingsUpdateRequest req) {
        return service.update(req);
    }
}
