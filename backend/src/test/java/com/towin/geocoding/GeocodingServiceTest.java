package com.towin.geocoding;

import com.towin.geocoding.dto.GeoResult;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class GeocodingServiceTest {

    // Builds a GeocodingService whose RestClient returns `body` (or throws if null) for any GET.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private GeocodingService serviceReturning(Object body) {
        RestClient client = mock(RestClient.class);
        RestClient.RequestHeadersUriSpec uriSpec = mock(RestClient.RequestHeadersUriSpec.class);
        RestClient.RequestHeadersSpec headersSpec = mock(RestClient.RequestHeadersSpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(client.get()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString(), any(Object[].class))).thenReturn(headersSpec);
        when(uriSpec.uri(anyString())).thenReturn(headersSpec);
        when(headersSpec.header(anyString(), anyString())).thenReturn(headersSpec);
        when(headersSpec.retrieve()).thenReturn(responseSpec);
        if (body == null) {
            when(responseSpec.body(any(org.springframework.core.ParameterizedTypeReference.class)))
                    .thenThrow(new RuntimeException("timeout"));
        } else {
            when(responseSpec.body(any(org.springframework.core.ParameterizedTypeReference.class)))
                    .thenReturn(body);
        }
        return new GeocodingService(client, "ToWin-Test/1.0");
    }

    @Test
    void reverseGeocodeReturnsCityFromAddress() {
        Map<String, Object> body = Map.of(
                "address", Map.of("city", "Toronto", "country", "Canada"),
                "display_name", "Toronto, Ontario, Canada");
        GeocodingService svc = serviceReturning(body);

        String city = svc.reverseGeocode(43.65, -79.38);

        assertThat(city).isEqualTo("Toronto");
    }

    @Test
    void reverseGeocodeFallsBackThroughTownVillageSuburb() {
        Map<String, Object> body = Map.of(
                "address", Map.of("suburb", "Scarborough"),
                "display_name", "Scarborough, Toronto, Canada");
        GeocodingService svc = serviceReturning(body);

        assertThat(svc.reverseGeocode(43.77, -79.25)).isEqualTo("Scarborough");
    }

    @Test
    void reverseGeocodeReturnsNullOnError() {
        GeocodingService svc = serviceReturning(null); // RestClient throws

        assertThat(svc.reverseGeocode(43.65, -79.38)).isNull();
    }

    @Test
    void forwardGeocodeReturnsTopHit() {
        List<Map<String, Object>> body = List.of(Map.of(
                "lat", "43.7731", "lon", "-79.2578",
                "display_name", "Scarborough, Toronto, Canada"));
        GeocodingService svc = serviceReturning(body);

        Optional<GeoResult> result = svc.forwardGeocode("Scarborough");

        assertThat(result).isPresent();
        assertThat(result.get().getLat()).isEqualTo(43.7731);
        assertThat(result.get().getLng()).isEqualTo(-79.2578);
        assertThat(result.get().getCity()).isEqualTo("Scarborough");
    }

    @Test
    void forwardGeocodeEmptyWhenNoMatch() {
        GeocodingService svc = serviceReturning(List.of());

        assertThat(svc.forwardGeocode("asdfghjkl")).isEmpty();
    }

    @Test
    void forwardGeocodeEmptyOnError() {
        GeocodingService svc = serviceReturning(null);

        assertThat(svc.forwardGeocode("Scarborough")).isEmpty();
    }

    @Test
    void forwardGeocodeBlankQueryReturnsEmpty() {
        GeocodingService svc = serviceReturning(List.of());

        assertThat(svc.forwardGeocode("   ")).isEmpty();
    }
}
