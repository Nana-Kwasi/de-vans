package com.quickchop.service;

import com.quickchop.config.AdminJwtService;
import com.quickchop.config.AdminPrincipal;
import com.quickchop.config.AuthContext;
import com.quickchop.dto.Dtos.*;
import com.quickchop.entity.AdminUser;
import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.UnauthorizedException;
import com.quickchop.repository.AdminUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AdminService {

    private final AdminUserRepository repo;
    private final PasswordEncoder encoder;
    private final AdminJwtService jwtService;

    public AdminService(AdminUserRepository repo, PasswordEncoder encoder, AdminJwtService jwtService) {
        this.repo = repo;
        this.encoder = encoder;
        this.jwtService = jwtService;
    }

    public AdminLoginResponse login(AdminLoginRequest req) {
        AdminUser admin = repo.findByEmail(req.email().toLowerCase())
                .or(() -> repo.findByEmail(req.email()))
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));
        if (!encoder.matches(req.password(), admin.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email or password");
        }
        String token = jwtService.issue(admin.getId(), admin.getEmail());
        return new AdminLoginResponse(token, admin.getEmail(), admin.getFullName());
    }

    public void changePassword(ChangePasswordRequest req) {
        AdminPrincipal principal = AuthContext.currentAdmin();
        AdminUser admin = repo.findById(principal.id())
                .orElseThrow(() -> new UnauthorizedException("Admin not found"));
        if (!encoder.matches(req.currentPassword(), admin.getPasswordHash())) {
            throw new BadRequestException("Current password is incorrect");
        }
        admin.setPasswordHash(encoder.encode(req.newPassword()));
        repo.save(admin);
    }
}
