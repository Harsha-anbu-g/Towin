package com.towin.common.messaging;

import com.towin.common.config.KafkaConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class ConnectionEventConsumer {

    @KafkaListener(topics = KafkaConfig.TOPIC_CONNECTION_EVENTS, groupId = "towin-notifications")
    public void handle(ConnectionEvent event) {
        switch (event.getType()) {
            case REQUEST_SENT ->
                log.info("Notify user {} — new connection request (connection={})", event.getRecipientId(), event.getConnectionId());
            case REQUEST_ACCEPTED ->
                log.info("Notify user {} — request accepted (connection={})", event.getRecipientId(), event.getConnectionId());
            case REQUEST_DECLINED ->
                log.info("Notify user {} — request declined (connection={})", event.getRecipientId(), event.getConnectionId());
        }
    }
}
