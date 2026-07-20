package com.towin.common.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class S3Service {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${aws.s3.bucket:towin-photos}")
    private String bucket;

    @Value("${aws.region:us-east-1}")
    private String region;

    // Allowed image extensions → canonical MIME types (server-controlled, not client-supplied)
    private static final Map<String, String> ALLOWED_IMAGE_TYPES = Map.of(
            ".jpg",  "image/jpeg",
            ".jpeg", "image/jpeg",
            ".png",  "image/png",
            ".gif",  "image/gif",
            ".webp", "image/webp"
    );

    // Allowed document extensions → canonical MIME types
    private static final Map<String, String> ALLOWED_DOC_TYPES = Map.of(
            ".pdf",  "application/pdf",
            ".jpg",  "image/jpeg",
            ".jpeg", "image/jpeg",
            ".png",  "image/png"
    );

    public String uploadDocument(UUID userId, MultipartFile file) {
        String extension = validateExtension(file.getOriginalFilename(), ALLOWED_DOC_TYPES);
        String mimeType = ALLOWED_DOC_TYPES.get(extension);
        String key = "documents/" + userId + "/" + UUID.randomUUID() + extension;
        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket).key(key)
                    .contentType(mimeType)
                    .contentLength(file.getSize())
                    .build();
            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to upload document", e);
        }
        return "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
    }

    public String uploadPhoto(UUID userId, MultipartFile file) {
        String extension = validateExtension(file.getOriginalFilename(), ALLOWED_IMAGE_TYPES);
        String mimeType = ALLOWED_IMAGE_TYPES.get(extension);
        String key = "photos/" + userId + "/" + UUID.randomUUID() + extension;
        try {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(mimeType)
                    .contentLength(file.getSize())
                    .build();
            s3Client.putObject(request, RequestBody.fromBytes(file.getBytes()));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to upload photo", e);
        }
        return "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
    }

    // Always call this before returning any S3 URL in an API response.
    // Raw S3 URLs are private (403) — this generates a 7-day signed URL the browser can load.
    public String presignedUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) return null;
        String key = objectKeyOf(rawUrl);
        if (key == null) return rawUrl;   // not ours to sign — hand it back untouched
        try {
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofDays(7))
                    .getObjectRequest(r -> r.bucket(bucket).key(key))
                    .build();
            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            return rawUrl;
        }
    }

    public void deleteFile(String url) {
        if (url == null || url.isBlank()) return;
        String key = objectKeyOf(url);
        if (key == null) return;   // never ours — nothing of ours to delete
        try {
            s3Client.deleteObject(b -> b.bucket(bucket).key(key));
        } catch (Exception e) {
            // Log but don't throw — file may already be deleted
        }
    }

    /**
     * The S3 object key inside one of our own URLs, or null when the URL is not
     * an S3 one at all — a path we ship with the app ("/demo/sarah.jpg"), or
     * anything hosted elsewhere.
     *
     * Worth being explicit about: indexOf returns -1 when the marker is absent,
     * and the old callers added the marker's length to it regardless, so a
     * non-S3 path silently yielded a key carved out of its own middle. Signing
     * that produced a dead URL, and deleting it aimed a delete at a key nobody
     * asked for. Neither threw, so neither was ever noticed.
     */
    private String objectKeyOf(String url) {
        final String marker = ".amazonaws.com/";
        int at = url.indexOf(marker);
        if (at < 0) return null;
        String key = url.substring(at + marker.length());
        return key.isBlank() ? null : key;
    }

    private String validateExtension(String filename, Map<String, String> allowed) {
        if (filename == null || !filename.contains("."))
            throw new IllegalArgumentException("File must have an extension");
        String ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
        if (!allowed.containsKey(ext))
            throw new IllegalArgumentException("File type not allowed: " + ext);
        return ext;
    }
}
