package com.quickchop.controller;

import com.quickchop.dto.Dtos.*;
import com.quickchop.service.FileStorageService;
import com.quickchop.service.MenuService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/menu")
@Tag(name = "Menu")
public class MenuController {

    private final MenuService menuService;
    private final FileStorageService fileStorage;

    public MenuController(MenuService menuService, FileStorageService fileStorage) {
        this.menuService = menuService;
        this.fileStorage = fileStorage;
    }

    @GetMapping
    @Operation(summary = "List available menu items (public)")
    public List<MenuItemDto> list() {
        return menuService.listAvailable();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a menu item (admin)")
    public MenuItemDto create(@Valid @RequestBody MenuItemRequest req) {
        return menuService.create(req);
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Update a menu item — price, availability, etc. (admin)")
    public MenuItemDto update(@PathVariable UUID id, @RequestBody MenuItemUpdateRequest req) {
        return menuService.update(id, req);
    }

    @PostMapping("/upload")
    @Operation(summary = "Upload a meal/drink image; returns its public URL (admin)")
    public Map<String, String> upload(@RequestParam("file") MultipartFile file) {
        // store() uploads to Supabase Storage and returns the full public URL,
        // reachable from any client (phone, web) with no host rewriting needed.
        String url = fileStorage.store(file);
        return Map.of("url", url);
    }
}
