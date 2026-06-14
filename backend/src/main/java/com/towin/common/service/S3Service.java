package com.towin.common.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class S3Service {

    private final S3Client s3Client;

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

    public void deleteFile(String url) {
        if (url == null || url.isBlank()) return;
        try {
            String key = url.substring(url.indexOf(".amazonaws.com/") + ".amazonaws.com/".length());
            s3Client.deleteObject(b -> b.bucket(bucket).key(key));
        } catch (Exception e) {
            // Log but don't throw — file may already be deleted
        }
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
