package com.towin.connection.dto;

import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.TrustLevel;
import com.towin.common.enums.UserRole;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ConnectionResponse {

    private UUID id;
    private UUID otherUserId;
    private String otherUserName;
    // The other person's role — lets the inbox group a chat by who it's with
    // (an elder friend, a helper, or a family member) without guessing.
    private UserRole otherUserRole;
    // Set only when a helper is looking at a family member's chat: "Margaret's
    // family", so the helper reads "Sarah (Margaret's family)" and knows who she is.
    private String otherUserContext;
    private ConnectionType type;
    private ConnectionStatus status;
    private TrustLevel currentTrustLevel;
    private boolean confirmedByMe;
    private boolean confirmedByOther;
    private boolean initiatedByMe;
    private boolean sharedWithFamily;
    private String otherUserPhone;
    private Integer otherUserAge;
    private String otherUserPhotoUrl;
    private String requestMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String lastMessagePreview;
    private LocalDateTime lastMessageAt;
    private int unreadCount;
}
