package com.quickchop.config;

import com.quickchop.entity.AdminUser;
import com.quickchop.entity.AppSettings;
import com.quickchop.entity.MenuItem;
import com.quickchop.repository.AdminUserRepository;
import com.quickchop.repository.AppSettingsRepository;
import com.quickchop.repository.MenuItemRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * Seeds the admin account and the 3 meals when running the 'local' (H2) profile,
 * where Flyway is disabled. In Postgres/Supabase this data comes from the Flyway
 * seed migrations (V2, V3) instead.
 */
@Component
@Profile("local")
public class LocalDataSeeder implements CommandLineRunner {

    private final AdminUserRepository adminRepo;
    private final MenuItemRepository menuRepo;
    private final AppSettingsRepository settingsRepo;
    private final PasswordEncoder encoder;

    public LocalDataSeeder(AdminUserRepository adminRepo, MenuItemRepository menuRepo,
                           AppSettingsRepository settingsRepo, PasswordEncoder encoder) {
        this.adminRepo = adminRepo;
        this.menuRepo = menuRepo;
        this.settingsRepo = settingsRepo;
        this.encoder = encoder;
    }

    @Override
    public void run(String... args) {
        if (!adminRepo.existsByEmail("franciskontoh4@gmail.com")) {
            AdminUser admin = new AdminUser();
            admin.setEmail("franciskontoh4@gmail.com");
            admin.setFullName("Francis Kontoh");
            // Default password: 0000000000  (change after first login)
            admin.setPasswordHash(encoder.encode("0000000000"));
            adminRepo.save(admin);
        }

        if (menuRepo.count() == 0) {
            menuRepo.save(meal("Plain Rice with Stew",
                    "Steamed rice served with rich tomato stew.", "35.00", "rice"));
            menuRepo.save(meal("Jollof Rice with Chicken",
                    "Smoky party jollof rice with grilled chicken.", "55.00", "rice"));
            menuRepo.save(meal("Fried Rice",
                    "Vegetable fried rice with mixed greens and eggs.", "50.00", "rice"));
            // Two shelves of drinks, so the app's Soft / Local drink tabs have something to show.
            menuRepo.save(drink("Coca-Cola (350ml)", "Chilled can.", "10.00", "soft"));
            menuRepo.save(drink("Malta Guinness", "Chilled bottle.", "12.00", "soft"));
            menuRepo.save(drink("Sobolo", "Hibiscus drink with ginger and cloves.", "10.00", "local"));
            menuRepo.save(drink("Ginger Drink", "Fresh pressed ginger, lightly sweetened.", "10.00", "local"));
            menuRepo.save(drink("Watermelon Juice", "Fresh blended watermelon.", "15.00", "local"));
        }

        // Single settings row (mirrors migration V9/V10 defaults) so /api/config works locally.
        if (settingsRepo.count() == 0) {
            AppSettings s = new AppSettings();
            s.setId((short) 1);
            s.setBusinessName("Qooka Qooks Restaurant");
            s.setClosedMessage("We are currently closed. Please check back soon.");
            s.setStoreAddress("Anyaa Last Stop, Accra");
            s.setPromoEnabled(true);
            s.setPromoTitle("Gonna Be a Good Day!");
            s.setPromoText("Free delivery & 10% cashback on your first order.");
            s.setPromoCta("Order Now");
            s.setDeliveryBaseFee(new BigDecimal("10.00"));
            s.setDeliveryPerKm(new BigDecimal("4.00"));
            s.setDeliveryMaxFee(new BigDecimal("120.00"));
            // Base covers the first 3km; per-km starts beyond that. Required (NOT NULL),
            // so the local H2 profile fails to seed without it.
            s.setDeliveryIncludedKm(new BigDecimal("3"));
            s.setFreeDeliveryThreshold(BigDecimal.ZERO);
            s.setMinOrderAmount(BigDecimal.ZERO);
            s.setMaxDeliveryKm(new BigDecimal("25"));
            s.setStoreLat(new BigDecimal("5.6072"));
            s.setStoreLng(new BigDecimal("-0.2838"));
            settingsRepo.save(s);
        }
    }

    private MenuItem drink(String name, String description, String price, String drinkType) {
        MenuItem m = meal(name, description, price, "drinks");
        m.setDrinkType(drinkType);
        return m;
    }

    private MenuItem meal(String name, String description, String price, String category) {
        MenuItem m = new MenuItem();
        m.setName(name);
        m.setDescription(description);
        m.setPrice(new BigDecimal(price));
        m.setCategory(category);
        m.setAvailable(true);
        return m;
    }
}
