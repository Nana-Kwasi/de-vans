package com.quickchop.service;

import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.MenuItem;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.repository.MenuItemRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class MenuService {

    static final Set<String> CATEGORIES = Set.of("rice", "chicken", "salad", "drinks");

    private final MenuItemRepository repo;

    public MenuService(MenuItemRepository repo) {
        this.repo = repo;
    }

    /** Normalises + validates a category against the allowed set. */
    private static String requireCategory(String category) {
        String c = category == null ? "" : category.trim().toLowerCase();
        if (!CATEGORIES.contains(c)) {
            throw new BadRequestException("Category must be one of: rice, chicken, salad, drinks.");
        }
        return c;
    }

    /** Drinks must be "soft" or "local" (defaulting to soft); anything else has no drink type. */
    private static String drinkTypeFor(String category, String requested) {
        if (!"drinks".equals(category)) return null;
        String t = requested == null || requested.isBlank() ? "soft" : requested.trim().toLowerCase();
        if (!t.equals("soft") && !t.equals("local")) {
            throw new BadRequestException("Drink type must be soft or local.");
        }
        return t;
    }

    public List<MenuItemDto> listAvailable() {
        return repo.findByAvailableTrue().stream().map(MenuService::toDto).toList();
    }

    public List<MenuItemDto> listAll() {
        return repo.findAll().stream().map(MenuService::toDto).toList();
    }

    public MenuItemDto create(MenuItemRequest req) {
        MenuItem item = new MenuItem();
        item.setName(req.name());
        item.setDescription(req.description());
        item.setPrice(req.price());
        item.setPhotoUrl(req.photoUrl());
        item.setCategory(requireCategory(req.category()));
        item.setDrinkType(drinkTypeFor(item.getCategory(), req.drinkType()));
        item.setAvailable(req.available() == null || req.available());
        item.setFeatured(Boolean.TRUE.equals(req.featured()));
        return toDto(repo.save(item));
    }

    public MenuItemDto update(UUID id, MenuItemUpdateRequest req) {
        MenuItem item = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Menu item not found: " + id));
        if (req.name() != null) item.setName(req.name());
        if (req.description() != null) item.setDescription(req.description());
        if (req.price() != null) item.setPrice(req.price());
        if (req.photoUrl() != null) item.setPhotoUrl(req.photoUrl());
        if (req.category() != null) item.setCategory(requireCategory(req.category()));
        if (req.category() != null || req.drinkType() != null) {
            // Keep the existing type when only the category is re-sent; re-validate either way.
            String requested = req.drinkType() != null ? req.drinkType() : item.getDrinkType();
            item.setDrinkType(drinkTypeFor(item.getCategory(), requested));
        }
        if (req.available() != null) item.setAvailable(req.available());
        if (req.featured() != null) item.setFeatured(req.featured());
        return toDto(repo.save(item));
    }

    public MenuItem getEntity(UUID id) {
        return repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Menu item not found: " + id));
    }

    static MenuItemDto toDto(MenuItem m) {
        return new MenuItemDto(m.getId(), m.getName(), m.getDescription(),
                m.getPrice(), m.getPhotoUrl(), m.getCategory(), m.isAvailable(), m.isFeatured(),
                m.getDrinkType());
    }
}
