package com.quickchop.service;

import com.quickchop.config.AuthContext;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.*;
import com.quickchop.entity.PolicyType.Audience;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.NotFoundException;
import com.quickchop.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Versioned policies and proof of acceptance.
 *
 * A published version is never edited — changing a policy publishes the next version —
 * so an acceptance always points at the exact text that was agreed to. Each acceptance
 * also stores the SHA-256 of that text, so it can later be shown that the text was not
 * changed after the fact.
 */
@Service
public class PolicyService {

    private static final Logger log = LoggerFactory.getLogger(PolicyService.class);

    private final PolicyRepository policyRepo;
    private final PolicyAcceptanceRepository acceptanceRepo;
    private final CustomerRepository customerRepo;
    private final RiderRepository riderRepo;

    public PolicyService(PolicyRepository policyRepo, PolicyAcceptanceRepository acceptanceRepo,
                         CustomerRepository customerRepo, RiderRepository riderRepo) {
        this.policyRepo = policyRepo;
        this.acceptanceRepo = acceptanceRepo;
        this.customerRepo = customerRepo;
        this.riderRepo = riderRepo;
    }

    // ------------------------------------------------------------------ reading

    public List<Policy> currentFor(Audience audience) {
        return Arrays.stream(PolicyType.values())
                .filter(t -> t.audience == audience)
                .map(t -> policyRepo.findFirstByTypeOrderByVersionDesc(t).orElse(null))
                .filter(Objects::nonNull)
                .toList();
    }

    public List<PolicyDto> currentDtos(Audience audience) {
        return currentFor(audience).stream().map(PolicyService::toDto).toList();
    }

    public PolicyDto current(PolicyType type) {
        return policyRepo.findFirstByTypeOrderByVersionDesc(type).map(PolicyService::toDto)
                .orElseThrow(() -> new NotFoundException("Policy not published yet"));
    }

    public PolicyDto version(UUID policyId) {
        return policyRepo.findById(policyId).map(PolicyService::toDto)
                .orElseThrow(() -> new NotFoundException("Policy version not found"));
    }

    // ------------------------------------------------------------------ acceptance

    public List<PolicyStatusDto> status(Audience audience, UUID subjectId) {
        Map<UUID, PolicyAcceptance> mine = acceptanceRepo
                .findBySubjectTypeAndSubjectIdOrderByAcceptedAtDesc(audience, subjectId).stream()
                .collect(Collectors.toMap(PolicyAcceptance::getPolicyId, a -> a, (a, b) -> a));
        return currentFor(audience).stream().map(p -> {
            PolicyAcceptance a = mine.get(p.getId());
            return new PolicyStatusDto(toDto(p), a != null, a == null ? null : a.getAcceptedAt());
        }).toList();
    }

    /** True when the subject has accepted the current version of every policy for their audience. */
    public boolean hasAcceptedAll(Audience audience, UUID subjectId) {
        List<UUID> current = currentFor(audience).stream().map(Policy::getId).toList();
        if (current.isEmpty()) return true; // nothing published yet: nothing to accept
        return acceptanceRepo.countBySubjectTypeAndSubjectIdAndPolicyIdIn(audience, subjectId, current) == current.size();
    }

    /**
     * Records acceptance of the given policy versions. Only current versions for the
     * subject's audience can be accepted — an old version or another audience's policy is
     * refused, so a record can never claim agreement to text the person was not shown.
     */
    @Transactional
    public List<PolicyStatusDto> accept(Audience audience, UUID subjectId, List<UUID> policyIds,
                                        String ip, String userAgent) {
        Map<UUID, Policy> current = currentFor(audience).stream()
                .collect(Collectors.toMap(Policy::getId, p -> p));
        for (UUID id : new LinkedHashSet<>(policyIds)) {
            Policy p = current.get(id);
            if (p == null) throw new BadRequestException("That policy version is not current. Refresh and try again.");
            if (acceptanceRepo.existsByPolicyIdAndSubjectTypeAndSubjectId(id, audience, subjectId)) continue;
            PolicyAcceptance a = new PolicyAcceptance();
            a.setPolicyId(id);
            a.setSubjectType(audience);
            a.setSubjectId(subjectId);
            a.setAcceptedAt(OffsetDateTime.now());
            a.setIpAddress(truncate(ip, 64));
            a.setUserAgent(truncate(userAgent, 300));
            a.setContentSha256(p.getContentSha256());
            acceptanceRepo.save(a);
            log.info("{} {} accepted {} v{}", audience, subjectId, p.getType(), p.getVersion());
        }
        return status(audience, subjectId);
    }

    // ------------------------------------------------------------------ admin

    @Transactional
    public PolicyDto publish(PolicyType type, PublishPolicyRequest req) {
        UUID adminId = AuthContext.currentAdmin().id();
        Policy saved = create(type, req.title().trim(), normalise(req.content()),
                req.changeSummary() == null || req.changeSummary().isBlank() ? null : req.changeSummary().trim(), adminId);
        log.info("Admin {} published {} v{}", AuthContext.currentAdmin().email(), type, saved.getVersion());
        return toDto(saved);
    }

    public List<AdminPolicyDto> adminOverview() {
        long customers = customerRepo.count();
        long riders = riderRepo.count();
        List<AdminPolicyDto> out = new ArrayList<>();
        for (PolicyType t : PolicyType.values()) {
            List<Policy> versions = policyRepo.findByTypeOrderByVersionDesc(t);
            Policy current = versions.isEmpty() ? null : versions.get(0);
            long accepted = current == null ? 0
                    : acceptanceRepo.findBySubjectTypeAndPolicyIdIn(t.audience, List.of(current.getId())).size();
            out.add(new AdminPolicyDto(t.name(), t.slug, t.audience.name(),
                    current == null ? null : toDto(current),
                    versions.stream().map(PolicyService::toVersionDto).toList(),
                    accepted, t.audience == Audience.CUSTOMER ? customers : riders));
        }
        return out;
    }

    /** Every customer (or rider) and where they stand on each current policy. */
    public ConsentTableDto consentTable(Audience audience) {
        List<Policy> current = currentFor(audience);
        // All of this audience's acceptances of any version of its policy types, to show
        // "accepted v1, current is v2" rather than just "not accepted".
        Map<UUID, Policy> allVersions = new HashMap<>();
        for (PolicyType t : PolicyType.values()) {
            if (t.audience == audience) policyRepo.findByTypeOrderByVersionDesc(t).forEach(p -> allVersions.put(p.getId(), p));
        }
        Map<UUID, List<PolicyAcceptance>> bySubject = acceptanceRepo
                .findBySubjectTypeAndPolicyIdIn(audience, allVersions.keySet()).stream()
                .collect(Collectors.groupingBy(PolicyAcceptance::getSubjectId));

        record Subject(UUID id, String name, String phone, String email, OffsetDateTime joined) {}
        List<Subject> subjects = audience == Audience.CUSTOMER
                ? customerRepo.findAll().stream()
                    .map(c -> new Subject(c.getId(), c.getFullName(), c.getPhoneNumber(), c.getEmail(), c.getCreatedAt())).toList()
                : riderRepo.findAllByOrderByCreatedAtDesc().stream()
                    .map(r -> new Subject(r.getId(), r.getFullName(), r.getPhoneNumber(), r.getEmail(), r.getCreatedAt())).toList();

        List<ConsentRowDto> rows = new ArrayList<>();
        long fully = 0;
        for (Subject s : subjects) {
            List<PolicyAcceptance> mine = bySubject.getOrDefault(s.id(), List.of());
            List<ConsentCellDto> cells = new ArrayList<>();
            boolean all = !current.isEmpty();
            for (Policy p : current) {
                // Latest acceptance of any version of this policy type.
                Optional<PolicyAcceptance> latest = mine.stream()
                        .filter(a -> allVersions.get(a.getPolicyId()).getType() == p.getType())
                        .max(Comparator.comparingInt(a -> allVersions.get(a.getPolicyId()).getVersion()));
                Integer acceptedVersion = latest.map(a -> allVersions.get(a.getPolicyId()).getVersion()).orElse(null);
                boolean upToDate = acceptedVersion != null && acceptedVersion == p.getVersion();
                all &= upToDate;
                cells.add(new ConsentCellDto(p.getType().name(), p.getVersion(), acceptedVersion,
                        latest.map(PolicyAcceptance::getAcceptedAt).orElse(null), upToDate));
            }
            if (all) fully++;
            rows.add(new ConsentRowDto(s.id(), s.name(), s.phone(), s.email(), s.joined(), all, cells));
        }
        rows.sort(Comparator.comparing(ConsentRowDto::allAccepted).thenComparing(r -> r.name() == null ? "" : r.name()));
        return new ConsentTableDto(audience.name(), current.stream().map(PolicyService::toVersionDto).toList(),
                subjects.size(), fully, rows);
    }

    /** Full acceptance history for one person, with the integrity check on each record. */
    public ConsentProofDto proof(Audience audience, UUID subjectId) {
        String name, phone, email;
        if (audience == Audience.CUSTOMER) {
            Customer c = customerRepo.findById(subjectId).orElseThrow(() -> new NotFoundException("Customer not found"));
            name = c.getFullName(); phone = c.getPhoneNumber(); email = c.getEmail();
        } else {
            Rider r = riderRepo.findById(subjectId).orElseThrow(() -> new NotFoundException("Rider not found"));
            name = r.getFullName(); phone = r.getPhoneNumber(); email = r.getEmail();
        }
        Set<UUID> currentIds = currentFor(audience).stream().map(Policy::getId).collect(Collectors.toSet());
        List<AcceptanceProofDto> records = acceptanceRepo
                .findBySubjectTypeAndSubjectIdOrderByAcceptedAtDesc(audience, subjectId).stream()
                .map(a -> {
                    Policy p = policyRepo.findById(a.getPolicyId()).orElseThrow();
                    return new AcceptanceProofDto(a.getId(), p.getType().name(), p.getTitle(), p.getVersion(),
                            currentIds.contains(p.getId()), a.getAcceptedAt(), a.getIpAddress(), a.getUserAgent(),
                            a.getContentSha256(), p.getContentSha256(),
                            a.getContentSha256().equals(p.getContentSha256()) && p.getContentSha256().equals(sha256(p.getContent())),
                            p.getId());
                }).toList();
        return new ConsentProofDto(audience.name(), subjectId, name, phone, email, records);
    }

    // ------------------------------------------------------------------ internals

    /** Creates the next version of a policy type. Used by publish and by the initial seed. */
    @Transactional
    public Policy create(PolicyType type, String title, String content, String changeSummary, UUID adminId) {
        int next = policyRepo.findFirstByTypeOrderByVersionDesc(type).map(p -> p.getVersion() + 1).orElse(1);
        Policy p = new Policy();
        p.setType(type);
        p.setVersion(next);
        p.setTitle(title);
        p.setContent(content);
        p.setContentSha256(sha256(content));
        p.setChangeSummary(changeSummary);
        p.setPublishedAt(OffsetDateTime.now());
        p.setPublishedBy(adminId);
        return policyRepo.save(p);
    }

    /** Line endings normalised so the same text always hashes the same. */
    private static String normalise(String content) {
        return content.replace("\r\n", "\n").strip() + "\n";
    }

    static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String truncate(String s, int max) {
        return s == null ? null : s.length() <= max ? s : s.substring(0, max);
    }

    static PolicyDto toDto(Policy p) {
        return new PolicyDto(p.getId(), p.getType().name(), p.getType().slug, p.getType().audience.name(),
                p.getVersion(), p.getTitle(), p.getContent(), p.getContentSha256(), p.getChangeSummary(), p.getPublishedAt());
    }

    static PolicyVersionDto toVersionDto(Policy p) {
        return new PolicyVersionDto(p.getId(), p.getVersion(), p.getTitle(), p.getContentSha256(),
                p.getChangeSummary(), p.getPublishedAt());
    }
}
