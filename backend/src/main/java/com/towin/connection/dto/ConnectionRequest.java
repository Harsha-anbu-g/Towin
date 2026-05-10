package com.towin.connection.dto;

import com.towin.common.enums.ConnectionType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.UUID;

@Data
public class ConnectionRequest {

    @NotNull
    private UUID targetUserId;

    private ConnectionType type = ConnectionType.SOCIAL;

    private String requestMessage;
}
