package com.quickchop.controller;

import com.quickchop.dto.Dtos.*;
import com.quickchop.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@Tag(name = "Reviews")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping("/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Submit a rating + comment for an order (customer)")
    public ReviewDto create(@Valid @RequestBody ReviewRequest req) {
        return reviewService.create(req);
    }

    @GetMapping("/admin/reviews")
    @Operation(summary = "List all customer reviews (admin)")
    public List<ReviewDto> list() {
        return reviewService.listAll();
    }
}
