package com.towinly.passon.service;

import com.towinly.common.entity.User;
import com.towinly.common.enums.FamilyAlertType;
import com.towinly.common.enums.FamilyLinkStatus;
import com.towinly.common.service.DisplayNameResolver;
import com.towinly.family.entity.FamilyAlert;
import com.towinly.family.repository.FamilyAlertRepository;
import com.towinly.family.repository.FamilyLinkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * The one place that decides which of an elder's Sealed box decisions her family are told
 * about, and which they are not.
 *
 * <h2>Why the family, and not the elder</h2>
 * There is no elder inbox in this app, no bell and no unread state anywhere, and building
 * one for a feature with no users was cut from this version. What already exists is
 * {@code family_alerts} — rows keyed to an elder and read by every family member linked to
 * her. So the elder learns things on her own page and in her own record; her family learn
 * them here.
 *
 * <h2>What this is for</h2>
 * Not convenience. Nothing in this app can stop a relative sitting beside an elder and
 * tapping through the whole setup for her. What these alerts do is make sure that if it
 * happens, the rest of the family see it happen — they raise the cost and create witnesses.
 * That is the entire argument, and it is why the copy names the person who was asked.
 *
 * <h2>The silence is the design</h2>
 * There is deliberately no method here for taking a key back. An elder who has worked out
 * that one relative is leaning on her has to be able to remove that person quietly. A method
 * called {@code keyholderRemoved} would be written by somebody tidying up the asymmetry, and
 * would put her in danger. See {@code KeyholderService.remove}.
 *
 * <p>Nothing is written when the elder has no family list — a row nobody can ever read is
 * personal data kept for no reason. This mirrors {@code SosService.recordFamilyAlert}.
 */
@Service
@RequiredArgsConstructor
public class PassOnAlertService {

    /** family_alerts.body is VARCHAR(500); every sentence below is far inside that. */
    private static final int BODY_MAX = 500;

    private final FamilyAlertRepository familyAlerts;
    private final FamilyLinkRepository familyLinks;

    /**
     * "Margaret has asked Sarah to hold a key to her Sealed box."
     *
     * Names both people on purpose. An alert saying only "someone" would let exactly the
     * relative this is meant to expose stay anonymous.
     */
    @Transactional
    public void keyholderAsked(User owner, String keyholderName) {
        write(owner, FamilyAlertType.KEYHOLDER_ASKED,
                name(owner) + " has asked " + keyholderName + " to hold a key to their Sealed box. "
                        + "That means one day, after they are gone, " + keyholderName + " would be one of "
                        + "the people who can ask to open it. Nobody can see what is inside it now.");
    }

    /** The box was set up, or the number of Keyholders who must agree was changed. */
    @Transactional
    public void settingsChanged(User owner) {
        write(owner, FamilyAlertType.SEALED_BOX_SET,
                name(owner) + " has set up a Sealed box, and chosen how many of their Keyholders "
                        + "would have to agree to open it one day. Nobody can see what is inside it "
                        + "but them.");
    }

    /**
     * A reveal that followed a password change closely. The seven-day freeze covers the
     * first week; this covers the rest of the month behind it, because whoever holds an
     * elder's mailbox can reset her password and then simply wait.
     */
    @Transactional
    public void openedSoonAfterPasswordChange(User owner) {
        write(owner, FamilyAlertType.SEALED_BOX_OPENED,
                name(owner) + " opened their Sealed box shortly after the password on their account "
                        + "was changed. If they did not change it themselves, please ask them about it.");
    }

    private void write(User owner, FamilyAlertType type, String body) {
        long linked = familyLinks.countByElderIdAndStatusIn(
                owner.getId(), List.of(FamilyLinkStatus.ACTIVE));
        if (linked == 0) return;

        familyAlerts.save(FamilyAlert.builder()
                .elder(owner)
                .type(type.name())
                .body(body.length() <= BODY_MAX ? body : body.substring(0, BODY_MAX))
                .build());
    }

    private static String name(User user) {
        return DisplayNameResolver.fromUser(user);
    }
}
