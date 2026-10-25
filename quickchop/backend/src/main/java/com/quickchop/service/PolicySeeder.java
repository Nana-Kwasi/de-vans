package com.quickchop.service;

import com.quickchop.entity.PolicyType;
import com.quickchop.repository.PolicyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Publishes version 1 of any policy that has never been published, from
 * classpath:policies/<slug>.md (first "# " line = title). Runs on every start but only
 * ever fills gaps, so an admin's later versions are never overwritten.
 */
@Component
public class PolicySeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PolicySeeder.class);

    private final PolicyRepository repo;
    private final PolicyService policyService;

    public PolicySeeder(PolicyRepository repo, PolicyService policyService) {
        this.repo = repo;
        this.policyService = policyService;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        for (PolicyType type : PolicyType.values()) {
            if (repo.existsByType(type)) continue;
            String md = new ClassPathResource("policies/" + type.slug + ".md")
                    .getContentAsString(StandardCharsets.UTF_8).replace("\r\n", "\n");
            String title = md.lines().filter(l -> l.startsWith("# ")).findFirst()
                    .map(l -> l.substring(2).trim()).orElse(type.name());
            String body = md.replaceFirst("(?m)^# .*\\n+", "").strip() + "\n";
            try {
                policyService.create(type, title, body, "Initial version", null);
                log.info("Published initial {} policy", type);
            } catch (DataIntegrityViolationException e) {
                // Another instance starting at the same moment seeded it first.
                log.info("Initial {} policy already published by another instance", type);
            }
        }
    }
}
