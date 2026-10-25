package com.quickchop.repository;

import com.quickchop.entity.AdminPasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface AdminPasswordResetTokenRepository extends JpaRepository<AdminPasswordResetToken, UUID> {

    Optional<AdminPasswordResetToken> findByTokenHash(String tokenHash);

    /** Invalidates any outstanding tokens for an admin, so only the newest link works. */
    @Modifying
    @Query("delete from AdminPasswordResetToken t where t.adminId = :adminId and t.usedAt is null")
    void deleteUnusedForAdmin(@Param("adminId") UUID adminId);
}
