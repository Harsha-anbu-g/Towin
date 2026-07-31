package com.towinly.passon.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/** Everything the elder has written, split the way her page is split: one list per tab. */
@Getter
@Builder
public class PassOnMineResponse {

    private List<PassOnItemResponse> stories;
    private List<PassOnItemResponse> letters;
}
