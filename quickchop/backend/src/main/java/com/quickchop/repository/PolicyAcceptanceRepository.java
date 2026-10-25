package com.quickchop.repository;

import com.quickchop.entity.PolicyAcceptance;
import com.quickchop.entity.PolicyType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PolicyAcceptanceRepository extends JpaRepository<PolicyAcceptance, UUID> {
    List<PolicyAcceptance> findBySubjectTypeAndSubjectIdOrderByAcceptedAtDesc(PolicyType.Audience type, UUID subjectId);
    List<PolicyAcceptance> findBySubjectTypeAndPolicyIdIn(PolicyType.Audience type, Collection<UUID> policyIds);
    boolean existsByPolicyIdAndSubjectTypeAndSubjectId(UUID policyId, PolicyType.Audience type, UUID subjectId);
    long countBySubjectTypeAndSubjectIdAndPolicyIdIn(PolicyType.Audience type, UUID subjectId, Collection<UUID> policyIds);
}
