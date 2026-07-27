package com.quickchop.service;

import com.quickchop.exception.ApiExceptions.BadRequestException;
import com.quickchop.exception.ApiExceptions.StorageException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/**
 * Stores uploaded meal/drink images in a public Supabase Storage bucket and
 * returns the object's public URL (which is what we persist in menu_items.photo_url).
 *
 * Uploads authenticate with the Supabase service-role key — a trusted, server-only
 * secret that bypasses Storage RLS. Reads need no auth because the bucket is public.
 */
@Service
public class FileStorageService {

    private final RestClient storage;
    private final String bucket;
    private final String publicBase; // {supabaseUrl}/storage/v1/object/public/{bucket}

    public FileStorageService(
            @Value("${supabase.url}") String supabaseUrl,
            @Value("${supabase.service-key:}") String serviceKey,
            @Value("${supabase.storage.bucket:menu-images}") String bucket) {
        String base = supabaseUrl.replaceAll("/+$", "");
        this.bucket = bucket;
        this.publicBase = base + "/storage/v1/object/public/" + bucket;
        // Send the key in both headers: `apikey` is what Supabase's new-format secret
        // keys (sb_secret_*) authenticate with; `Authorization: Bearer` keeps legacy
        // JWT service-role keys working too.
        this.storage = RestClient.builder()
                .baseUrl(base + "/storage/v1")
                .defaultHeader("apikey", serviceKey)
                .defaultHeader("Authorization", "Bearer " + serviceKey)
                .build();
    }

    /** Uploads the file to Supabase Storage and returns its public URL. */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file provided.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new BadRequestException("Only image files are allowed.");
        }
        String ext = extensionFor(file.getOriginalFilename(), contentType);
        String objectPath = UUID.randomUUID().toString().replace("-", "") + ext;

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new StorageException("Failed to read uploaded file", e);
        }

        try {
            storage.post()
                    .uri("/object/{bucket}/{path}", bucket, objectPath)
                    .header("Content-Type", contentType)
                    .header("x-upsert", "true")
                    .body(bytes)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            throw new StorageException(
                    "Supabase Storage upload failed (" + e.getStatusCode() + "): "
                            + e.getResponseBodyAsString(), e);
        }

        return publicBase + "/" + objectPath;
    }

    private static String extensionFor(String originalName, String contentType) {
        if (originalName != null && originalName.contains(".")) {
            String ext = originalName.substring(originalName.lastIndexOf('.')).toLowerCase();
            if (ext.matches("\\.(jpg|jpeg|png|webp|gif)")) return ext;
        }
        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> ".jpg";
        };
    }
}
