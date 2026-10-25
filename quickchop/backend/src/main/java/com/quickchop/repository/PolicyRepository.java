package com.quickchop.repository;

import com.quickchop.entity.Policy;
import com.quickchop.entity.PolicyType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PolicyRepository extends JpaRepository<Policy, UUID> {
    Optional<Policy> findFirstByTypeOrderByVersionDesc(PolicyType type);
    List<Policy> findByTypeOrderByVersionDesc(PolicyType type);
    boolean existsByType(PolicyType type);
}
