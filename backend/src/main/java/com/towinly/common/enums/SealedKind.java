package com.towinly.common.enums;

/**
 * The one readable thing about a sealed item, so the owner's list can show a chip without a
 * decrypt. It carries no name, no address and no amount.
 */
public enum SealedKind {
    MONEY, PASSWORDS, PAPERS, OTHER
}
