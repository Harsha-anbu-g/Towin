package com.towinly.common.enums;

/**
 * When something becomes readable. AFTER is legal in the schema so a later release needs no
 * migration, but no service accepts it yet — nothing may be written that cannot be delivered.
 */
public enum PassOnRelease {
    NOW, AFTER
}
