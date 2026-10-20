package com.towinly.assistant.guide;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/**
 * One passage of the user guide, as exported by docs/user-guide/tools/export_chunks.py.
 * The hash is the change detector: same text, same hash, no new embedding.
 */
public record GuideChunk(String part, String chapter, String heading, List<String> roles, String text, String hash) {

    public static String sha256(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
