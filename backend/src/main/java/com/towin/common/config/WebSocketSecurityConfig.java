package com.towin.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.annotation.web.socket.EnableWebSocketSecurity;
import org.springframework.security.messaging.access.intercept.MessageMatcherDelegatingAuthorizationManager;

@Configuration
@EnableWebSocketSecurity
public class WebSocketSecurityConfig {

    @Bean
    AuthorizationManager<Message<?>> messageAuthorizationManager(
            MessageMatcherDelegatingAuthorizationManager.Builder messages) {
        messages
            .simpTypeMatchers(SimpMessageType.CONNECT,
                              SimpMessageType.HEARTBEAT,
                              SimpMessageType.UNSUBSCRIBE,
                              SimpMessageType.DISCONNECT).permitAll()
            .simpSubscribeDestMatchers("/user/**", "/topic/**", "/queue/**").authenticated()
            .anyMessage().authenticated();
        return messages.build();
    }
}
