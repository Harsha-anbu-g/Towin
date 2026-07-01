package com.towin.connection.dto;

import com.towin.common.enums.ConnectionStatus;
import com.towin.common.enums.ConnectionType;
import com.towin.common.enums.TrustLevel;
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
    private ConnectionType type;
    private ConnectionStatus status;
    private TrustLevel currentTrustLevel;
    private boolean confirmedByMe;
    private boolean confirmedByOther;
    private boolean initiatedByMe;
    private String otherUserPhone;
    private Integer otherUserAge;
    private String requestMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String lastMessagePreview;
    private LocalDateTime lastMessageAt;
    private int unreadCount;
}
