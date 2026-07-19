package com.towin.family.service;

import com.towin.common.entity.User;
import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.FamilyLinkStatus;
import com.towin.common.enums.TrustLevel;
import com.towin.connection.dto.ConnectionRequest;
import com.towin.connection.dto.ConnectionResponse;
import com.towin.connection.entity.Connection;
import com.towin.connection.repository.ConnectionRepository;
import com.towin.connection.service.ConnectionService;
import com.towin.family.repository.FamilyLinkRepository;
import com.towin.profile.entity.ElderProfile;
import com.towin.profile.repository.ElderProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Step 4: a family member asks to connect directly with a helper their parent
 * shared. Same unlock as the updates thread — the elder↔helper connection must
 * be ACTIVE, shared with family, and at FIRST_MEET or beyond. The request then
 * flows through the normal connection lifecycle (respond/decline/end), typed
 * FAMILY so it never earns points and never counts toward capacity limits.
 */
@Service
@RequiredArgsConstructor
public class FamilyHelperConnectionService {

    private final ConnectionRepository connectionRepository;
    private final FamilyLinkRepository familyLinkRepository;
    private final ElderProfileRepository elderProfileRepository;
    private final com.towin.profile.repository.HelperProfileRepository helperProfileRepository;
    private final ConnectionService connectionService;

    @Transactional
    public ConnectionResponse requestHelperConnection(UUID callerId, UUID sharedConnectionId) {
        Connection shared = connectionRepository.findById(sharedConnectionId)
                .orElseThrow(() -> new IllegalArgumentException("Connection not found"));

        // Which participant is the caller's parent? (the one holding an ACTIVE
        // family link with the caller — REVOKED/PENDING links grant nothing)
        User elder = null;
        for (User participant : List.of(shared.getUserA(), shared.getUserB())) {
            boolean linked = familyLinkRepository
                    .findByElderIdAndFamilyUserId(participant.getId(), callerId)
                    .filter(l -> l.getStatus() == FamilyLinkStatus.ACTIVE)
                    .isPresent();
            if (linked) { elder = participant; break; }
        }
        if (elder == null) {
            throw new IllegalStateException("You can only connect with helpers of a parent you're linked to");
        }

        // The same double gate as the updates thread (locked rule 2).
        if (shared.getStatus() != ConnectionStatus.ACTIVE
                || !Boolean.TRUE.equals(shared.getSharedWithFamily())
                || shared.getCurrentTrustLevel().getValue() < TrustLevel.FIRST_MEET.getValue()) {
            throw new IllegalStateException("This friendship isn't open to family connections yet");
        }

        User helper = shared.getOtherUser(elder.getId());

        ConnectionRequest request = new ConnectionRequest();
        request.setTargetUserId(helper.getId());
        request.setType(ConnectionType.FAMILY);
        // The helper sees who is asking and why: "Family of Margaret".
        request.setRequestMessage("Family of " + elderDisplayName(elder));
        return connectionService.sendRequest(callerId, request);
    }

    /** Step 4 transparency (locked rule 7): which of the elder's family members
     *  hold an ACTIVE direct connection with which helpers. */
    @Transactional(readOnly = true)
    public com.towin.family.dto.ElderTransparencyResponse transparency(UUID elderId) {
        java.util.List<com.towin.family.dto.ElderTransparencyResponse.Row> rows = new java.util.ArrayList<>();
        for (com.towin.family.entity.FamilyLink link
                : familyLinkRepository.findByElderIdAndStatus(elderId, FamilyLinkStatus.ACTIVE)) {
            User familyMember = link.getFamilyUser();
            for (Connection c : connectionRepository.findByUserAndStatus(familyMember.getId(), ConnectionStatus.ACTIVE)) {
                if (c.getType() != ConnectionType.FAMILY) continue;
                User other = c.getOtherUser(familyMember.getId());
                rows.add(com.towin.family.dto.ElderTransparencyResponse.Row.builder()
                        .familyMemberName(plainName(familyMember))
                        .relationship(link.getRelationship())
                        .helperUserId(other.getId())
                        .helperName(helperDisplayName(other))
                        .build());
            }
        }
        return com.towin.family.dto.ElderTransparencyResponse.builder().connections(rows).build();
    }

    private String plainName(User user) {
        return user.getFullName() != null && !user.getFullName().isBlank()
                ? user.getFullName() : user.getUsername();
    }

    private String helperDisplayName(User helper) {
        return helperProfileRepository.findByUserId(helper.getId())
                .map(com.towin.profile.entity.HelperProfile::getName)
                .filter(n -> n != null && !n.isBlank())
                .orElseGet(() -> plainName(helper));
    }

    private String elderDisplayName(User elder) {
        return elderProfileRepository.findByUserId(elder.getId())
                .map(ElderProfile::getName)
                .filter(n -> n != null && !n.isBlank())
                .orElseGet(() -> elder.getFullName() != null && !elder.getFullName().isBlank()
                        ? elder.getFullName() : elder.getUsername());
    }
}
