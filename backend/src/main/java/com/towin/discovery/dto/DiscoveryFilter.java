package com.towin.discovery.dto;

import lombok.Data;

@Data
public class DiscoveryFilter {
    private Double lat;
    private Double lng;
    private Double radiusKm = 10.0;
    private String language;
    private String interest;
    private int page = 0;
    private int size = 20;
}
