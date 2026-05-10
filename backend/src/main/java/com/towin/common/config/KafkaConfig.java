package com.towin.common.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
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
