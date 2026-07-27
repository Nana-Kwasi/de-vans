package com.quickchop.repository;

import com.quickchop.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Optional<Customer> findBySupabaseAuthId(UUID supabaseAuthId);
    Optional<Customer> findByPhoneNumber(String phoneNumber);
    boolean existsBySupabaseAuthId(UUID supabaseAuthId);
}
