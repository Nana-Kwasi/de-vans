package com.quickchop.service;

import com.quickchop.repository.DeliveryLocationRepository;
import com.quickchop.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Enforces the retention promised in the privacy policies: rider location trails and
 * customer drop-off coordinates are deleted 12 months after the delivery. Runs nightly;
 * safe to run on several instances at once (it only deletes what is already too old).
 */
@Component
public class DataRetentionJob {

    private static final Logger log = LoggerFactory.getLogger(DataRetentionJob.class);
    static final int LOCATION_RETENTION_DAYS = 365;

    private final DeliveryLocationRepository locationRepo;
    private final OrderRepository orderRepo;

    public DataRetentionJob(DeliveryLocationRepository locationRepo, OrderRepository orderRepo) {
        this.locationRepo = locationRepo;
        this.orderRepo = orderRepo;
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "Africa/Accra")
    @Transactional
    public void purgeOldLocations() {
        OffsetDateTime before = OffsetDateTime.now().minusDays(LOCATION_RETENTION_DAYS);
        int trail = locationRepo.deleteRecordedBefore(before);
        int pins = orderRepo.clearDeliveryCoordinatesBefore(before);
        if (trail + pins > 0) log.info("Retention: deleted {} location points, cleared {} order pins", trail, pins);
    }
}
