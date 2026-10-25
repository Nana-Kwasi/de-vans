package com.quickchop.repository;

import com.quickchop.entity.Customer;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Optional<Customer> findBySupabaseAuthId(UUID supabaseAuthId);
    Optional<Customer> findByPhoneNumber(String phoneNumber);
    boolean existsBySupabaseAuthId(UUID supabaseAuthId);

    @Query("""
           select c from Customer c
            where lower(c.fullName) like :q or lower(c.email) like :q
               or (:phone <> '' and c.phoneNumber like :phone)
            order by c.createdAt desc""")
    List<Customer> search(@Param("q") String q,
                                    @Param("phone") String phone,
                                    Pageable page);
}
