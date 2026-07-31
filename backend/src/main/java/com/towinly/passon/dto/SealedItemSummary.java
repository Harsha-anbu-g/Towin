package com.towinly.passon.dto;

import com.towinly.common.enums.SealedKind;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One line in the owner's list of what is in her Sealed box: its name, its chip, how big it
 * is and when she put it there. On screen this is a card reading the name, the chip and the
 * word "Locked" — with no preview text at all.
 *
 * <p><b>There is no body field, and that is the design.</b> This record is what the list
 * shows and what the account export emits, and neither may ever carry the contents. Making
 * that structural rather than a rule someone has to remember is the point: you cannot leak a
 * field that does not exist. The body is decrypted on exactly one path,
 * {@code SealedBoxService#reveal}, and that path is behind the account password.
 */
public record SealedItemSummary(UUID id,
                                String label,
                                SealedKind kindHint,
                                int byteSize,
                                LocalDateTime createdAt) {
}
