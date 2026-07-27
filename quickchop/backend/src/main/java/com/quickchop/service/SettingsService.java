package com.quickchop.service;

import com.quickchop.dto.Dtos.SettingsDto;
import com.quickchop.dto.Dtos.SettingsUpdateRequest;
import com.quickchop.entity.AppSettings;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.repository.AppSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettingsService {

    private final AppSettingsRepository repo;

    public SettingsService(AppSettingsRepository repo) {
        this.repo = repo;
    }

    /** The single settings row (seeded by migration V9). */
    private AppSettings entity() {
        return repo.findById((short) 1)
                .orElseThrow(() -> new BadRequestException("Settings have not been initialised."));
    }

    @Transactional(readOnly = true)
    public SettingsDto get() {
        return toDto(entity());
    }

    @Transactional
    public SettingsDto update(SettingsUpdateRequest req) {
        AppSettings s = entity();
        if (req.businessName() != null) {
            String name = req.businessName().trim();
            if (name.isEmpty()) throw new BadRequestException("Business name cannot be empty.");
            s.setBusinessName(name);
        }
        if (req.acceptingOrders() != null) s.setAcceptingOrders(req.acceptingOrders());
        if (req.closedMessage() != null) s.setClosedMessage(req.closedMessage().trim());
        if (req.contactPhone() != null) s.setContactPhone(req.contactPhone().trim());
        if (req.storeAddress() != null) s.setStoreAddress(req.storeAddress().trim());
        if (req.announcementEnabled() != null) s.setAnnouncementEnabled(req.announcementEnabled());
        if (req.announcementText() != null) s.setAnnouncementText(req.announcementText().trim());
        if (req.deliveryBaseFee() != null) s.setDeliveryBaseFee(req.deliveryBaseFee());
        if (req.deliveryPerKm() != null) s.setDeliveryPerKm(req.deliveryPerKm());
        if (req.deliveryMaxFee() != null) s.setDeliveryMaxFee(req.deliveryMaxFee());
        if (req.freeDeliveryThreshold() != null) s.setFreeDeliveryThreshold(req.freeDeliveryThreshold());
        if (req.minOrderAmount() != null) s.setMinOrderAmount(req.minOrderAmount());
        if (req.maxDeliveryKm() != null) s.setMaxDeliveryKm(req.maxDeliveryKm());
        if (req.storeLat() != null) s.setStoreLat(req.storeLat());
        if (req.storeLng() != null) s.setStoreLng(req.storeLng());
        return toDto(repo.save(s));
    }

    private static SettingsDto toDto(AppSettings s) {
        return new SettingsDto(
                s.getBusinessName(), s.isAcceptingOrders(), s.getClosedMessage(),
                s.getContactPhone(), s.getStoreAddress(),
                s.isAnnouncementEnabled(), s.getAnnouncementText(),
                s.getDeliveryBaseFee(), s.getDeliveryPerKm(), s.getDeliveryMaxFee(),
                s.getFreeDeliveryThreshold(), s.getMinOrderAmount(), s.getMaxDeliveryKm(),
                s.getStoreLat(), s.getStoreLng());
    }
}
