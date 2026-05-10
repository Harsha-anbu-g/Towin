package com.towin.common.messaging;

import com.towin.common.config.KafkaConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ConnectionEventProducer {

    private final KafkaTemplate<String, ConnectionEvent> kafkaTemplate;

    public void send(ConnectionEvent event) {
        kafkaTemplate.send(KafkaConfig.TOPIC_CONNECTION_EVENTS, event.getConnectionId().toString(), event);
        log.info("Kafka → [{}] connection={} recipient={}", event.getType(), event.getConnectionId(), event.getRecipientId());
    }
}
