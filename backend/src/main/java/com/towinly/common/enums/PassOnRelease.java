package com.towinly.common.enums;

/**
 * When something becomes readable. NOW is everything a story ever is, and most letters. AFTER is
 * a letter the writer means to be read after she is gone: it stays shut to the person it names
 * until a human sets {@code passon_settings.released_at} by hand. Nothing automatic ever opens
 * it — see {@code ReleaseGate} and {@code PassOnVisibilityService}.
 */
public enum PassOnRelease {
    NOW, AFTER
}
