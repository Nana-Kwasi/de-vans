package com.quickchop.service;

import com.quickchop.config.AuthContext;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.Customer;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.repository.CustomerRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class CustomerService {

    private final CustomerRepository repo;

    public CustomerService(CustomerRepository repo) {
        this.repo = repo;
    }

    /** Create (or return existing) profile for the currently-authenticated Supabase user. */
    public CustomerDto createProfile(CustomerRequest req) {
        UUID authId = AuthContext.currentSupabaseAuthId();
        Customer customer = repo.findBySupabaseAuthId(authId).orElseGet(Customer::new);
        customer.setSupabaseAuthId(authId);
        customer.setFullName(req.fullName());
        customer.setEmail(req.email());
        customer.setPhoneNumber(req.phoneNumber());
        customer.setDefaultAddress(req.defaultAddress());
        return toDto(repo.save(customer));
    }

    public CustomerDto getMe() {
        return toDto(currentEntity());
    }

    public java.util.List<CustomerDto> listAll() {
        return repo.findAll().stream().map(CustomerService::toDto).toList();
    }

    public void updateFcmToken(String token) {
        Customer c = currentEntity();
        c.setFcmToken(token);
        repo.save(c);
    }

    /** The Customer row for the current request, resolved from the Supabase auth id. */
    public Customer currentEntity() {
        UUID authId = AuthContext.currentSupabaseAuthId();
        return repo.findBySupabaseAuthId(authId)
                .orElseThrow(() -> new NotFoundException(
                        "No customer profile yet. Call POST /api/customers first."));
    }

    public Customer getById(UUID id) {
        return repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Customer not found: " + id));
    }

    static CustomerDto toDto(Customer c) {
        return new CustomerDto(c.getId(), c.getFullName(), c.getEmail(), c.getPhoneNumber(),
                c.getDefaultAddress(), c.getCreatedAt());
    }
}
