package com.towin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class ToWinApplication {
    public static void main(String[] args) {
        // Pin the JVM to UTC so every LocalDateTime.now() (needs, applications,
        // messages…) is stored and served as UTC wall-clock time regardless of
        // the host machine's zone. Clients parse these naive (zone-less)
        // timestamps as UTC, so local dev and Railway must agree on the zone or
        // "posted X ago" drifts by the machine's offset.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(ToWinApplication.class, args);
    }
}
