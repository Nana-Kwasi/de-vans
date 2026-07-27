package com.quickchop.service;

import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.Customer;
import com.quickchop.entity.Review;
import com.quickchop.repository.OrderRepository;
import com.quickchop.repository.ReviewRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ReviewService {

    private final ReviewRepository repo;
    private final OrderRepository orderRepo;
    private final CustomerService customerService;

    public ReviewService(ReviewRepository repo, OrderRepository orderRepo, CustomerService customerService) {
        this.repo = repo;
        this.orderRepo = orderRepo;
        this.customerService = customerService;
    }

    public ReviewDto create(ReviewRequest req) {
        Customer c = customerService.currentEntity();
        Review r = new Review();
        r.setOrderId(req.orderId());
        r.setCustomerId(c.getId());
        r.setName(c.getFullName());
        orderRepo.findById(req.orderId()).ifPresent(o -> r.setOrderNumber(o.getOrderNumber()));
        r.setRating(Math.max(1, Math.min(5, req.rating())));
        r.setComment(req.comment());
        return toDto(repo.save(r));
    }

    public List<ReviewDto> listAll() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(ReviewService::toDto).toList();
    }

    static ReviewDto toDto(Review r) {
        return new ReviewDto(r.getId(), r.getOrderId(), r.getCustomerId(), r.getOrderNumber(),
                r.getName(), r.getRating(), r.getComment(), r.getCreatedAt());
    }
}
