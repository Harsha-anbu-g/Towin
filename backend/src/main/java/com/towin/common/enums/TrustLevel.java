package com.towin.common.enums;

public enum TrustLevel {
    DISCOVERED(0), MESSAGING(1), PHONE_CALL(2), VIDEO_CALL(3),
    VERIFIED(4), FIRST_MEET(5), TRUSTED(6);

    private final int value;

    TrustLevel(int value) { this.value = value; }

    public int getValue() { return value; }

    public static TrustLevel fromValue(int value) {
        for (TrustLevel level : values()) {
            if (level.value == value) return level;
        }
        throw new IllegalArgumentException("Invalid trust level: " + value);
    }

    public TrustLevel next() {
        int next = this.value + 1;
        return next <= 6 ? fromValue(next) : this;
    }
}
