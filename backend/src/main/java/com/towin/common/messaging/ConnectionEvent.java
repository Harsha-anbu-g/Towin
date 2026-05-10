package com.towin.common.messaging;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConnectionEvent {

    public enum Type { REQUEST_SENT, REQUEST_ACCEPTED, REQUEST_DECLINED }

    private Type type;
    private UUID connectionId;
    private UUID senderId;
    private UUID recipientId;
}
