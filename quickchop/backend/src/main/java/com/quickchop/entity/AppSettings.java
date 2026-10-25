package com.quickchop.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Single-row (id = 1) restaurant-wide settings. See migration V9. */
@Entity
@Table(name = "app_settings")
public class AppSettings {

    @Id
    private Short id = 1;

    @Column(name = "business_name", nullable = false)
    private String businessName;

    @Column(name = "accepting_orders", nullable = false)
    private boolean acceptingOrders = true;

    @Column(name = "closed_message", nullable = false)
    private String closedMessage;

    @Column(name = "contact_phone", nullable = false)
    private String contactPhone = "";

    @Column(name = "store_address", nullable = false)
    private String storeAddress;

    @Column(name = "announcement_enabled", nullable = false)
    private boolean announcementEnabled = false;

    @Column(name = "announcement_text", nullable = false)
    private String announcementText = "";

    @Column(name = "delivery_base_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal deliveryBaseFee;

    @Column(name = "delivery_per_km", nullable = false, precision = 10, scale = 2)
    private BigDecimal deliveryPerKm;

    @Column(name = "delivery_max_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal deliveryMaxFee;

    @Column(name = "promo_enabled", nullable = false)
    private boolean promoEnabled = true;

    @Column(name = "promo_title", nullable = false, length = 120)
    private String promoTitle;

    @Column(name = "promo_text", nullable = false, length = 240)
    private String promoText;

    @Column(name = "promo_cta", nullable = false, length = 40)
    private String promoCta;

    /** Null falls back to the featured dish's own photo. */
    @Column(name = "promo_image_url", columnDefinition = "text")
    private String promoImageUrl;

    /** Kilometres covered by the base fee before per-km charging starts. */
    @Column(name = "delivery_included_km", nullable = false, precision = 10, scale = 2)
    private BigDecimal deliveryIncludedKm;

    @Column(name = "free_delivery_threshold", nullable = false, precision = 10, scale = 2)
    private BigDecimal freeDeliveryThreshold;

    @Column(name = "min_order_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal minOrderAmount;

    @Column(name = "max_delivery_km", nullable = false, precision = 10, scale = 2)
    private BigDecimal maxDeliveryKm;

    @Column(name = "store_lat", nullable = false, precision = 9, scale = 6)
    private BigDecimal storeLat;

    @Column(name = "store_lng", nullable = false, precision = 9, scale = 6)
    private BigDecimal storeLng;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public Short getId() { return id; }
    public void setId(Short id) { this.id = id; }
    public String getBusinessName() { return businessName; }
    public void setBusinessName(String businessName) { this.businessName = businessName; }
    public boolean isAcceptingOrders() { return acceptingOrders; }
    public void setAcceptingOrders(boolean acceptingOrders) { this.acceptingOrders = acceptingOrders; }
    public String getClosedMessage() { return closedMessage; }
    public void setClosedMessage(String closedMessage) { this.closedMessage = closedMessage; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public String getStoreAddress() { return storeAddress; }
    public void setStoreAddress(String storeAddress) { this.storeAddress = storeAddress; }
    public boolean isAnnouncementEnabled() { return announcementEnabled; }
    public void setAnnouncementEnabled(boolean announcementEnabled) { this.announcementEnabled = announcementEnabled; }
    public String getAnnouncementText() { return announcementText; }
    public void setAnnouncementText(String announcementText) { this.announcementText = announcementText; }
    public BigDecimal getDeliveryBaseFee() { return deliveryBaseFee; }
    public void setDeliveryBaseFee(BigDecimal deliveryBaseFee) { this.deliveryBaseFee = deliveryBaseFee; }
    public BigDecimal getDeliveryPerKm() { return deliveryPerKm; }
    public void setDeliveryPerKm(BigDecimal deliveryPerKm) { this.deliveryPerKm = deliveryPerKm; }
    public BigDecimal getDeliveryMaxFee() { return deliveryMaxFee; }
    public void setDeliveryMaxFee(BigDecimal deliveryMaxFee) { this.deliveryMaxFee = deliveryMaxFee; }
    public BigDecimal getFreeDeliveryThreshold() { return freeDeliveryThreshold; }
    public void setFreeDeliveryThreshold(BigDecimal freeDeliveryThreshold) { this.freeDeliveryThreshold = freeDeliveryThreshold; }
    public BigDecimal getMinOrderAmount() { return minOrderAmount; }
    public void setMinOrderAmount(BigDecimal minOrderAmount) { this.minOrderAmount = minOrderAmount; }
    public boolean isPromoEnabled() { return promoEnabled; }
    public void setPromoEnabled(boolean promoEnabled) { this.promoEnabled = promoEnabled; }
    public String getPromoTitle() { return promoTitle; }
    public void setPromoTitle(String promoTitle) { this.promoTitle = promoTitle; }
    public String getPromoText() { return promoText; }
    public void setPromoText(String promoText) { this.promoText = promoText; }
    public String getPromoCta() { return promoCta; }
    public void setPromoCta(String promoCta) { this.promoCta = promoCta; }
    public String getPromoImageUrl() { return promoImageUrl; }
    public void setPromoImageUrl(String promoImageUrl) { this.promoImageUrl = promoImageUrl; }

    public BigDecimal getDeliveryIncludedKm() { return deliveryIncludedKm; }
    public void setDeliveryIncludedKm(BigDecimal deliveryIncludedKm) { this.deliveryIncludedKm = deliveryIncludedKm; }
    public BigDecimal getMaxDeliveryKm() { return maxDeliveryKm; }
    public void setMaxDeliveryKm(BigDecimal maxDeliveryKm) { this.maxDeliveryKm = maxDeliveryKm; }
    public BigDecimal getStoreLat() { return storeLat; }
    public void setStoreLat(BigDecimal storeLat) { this.storeLat = storeLat; }
    public BigDecimal getStoreLng() { return storeLng; }
    public void setStoreLng(BigDecimal storeLng) { this.storeLng = storeLng; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
