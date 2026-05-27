package com.towin.common.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
@ConditionalOnProperty(prefix = "app.kafka", name = "enabled", havingValue = "true", matchIfMissing = false)
public class KafkaConfig {

    public static final String TOPIC_CONNECTION_EVENTS = "connection-events";

    @Bean
    public NewTopic connectionEventsTopic() {
        return TopicBuilder.name(TOPIC_CONNECTION_EVENTS)
                .partitions(1)
                .replicas(1)
                .build();
    }
}
