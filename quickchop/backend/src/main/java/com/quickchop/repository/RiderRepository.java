package com.quickchop.repository;

import com.quickchop.entity.Rider;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RiderRepository extends JpaRepository<Rider, UUID> {
    Optional<Rider> findByPhoneNumber(String phoneNumber);
    boolean existsByPhoneNumber(String phoneNumber);
    boolean existsByEmail(String email);
    List<Rider> findAllByOrderByCreatedAtDesc();

    @Query("""
           select r from Rider r
            where lower(r.fullName) like :q or (:phone <> '' and r.phoneNumber like :phone)
            order by r.fullName""")
    List<Rider> search(@Param("q") String q, @Param("phone") String phone,
                       Pageable page);

    /** Row lock so one rider's concurrent accepts are serialised (max-active check holds). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Rider r where r.id = :id")
    Optional<Rider> lockById(@Param("id") UUID id);
}
