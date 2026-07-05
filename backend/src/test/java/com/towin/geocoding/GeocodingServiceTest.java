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

    // A Canadian postcode — even lowercase with no space — must resolve via the
    // Zippopotam FSA lookup (/ca/H3H), since Nominatim can't geocode them at all.
    @Test
    void forwardGeocodeResolvesCompactCanadianPostcodeViaZippopotam() {
        Map<String, Object> body = Map.of(
                "post code", "H3H",
                "places", List.of(Map.of(
                        "place name", "Downtown Montreal South & West",
                        "latitude", "45.5123", "longitude", "-73.5967")));
        UriCapturingService svc = UriCapturingService.returning(body);

        Optional<GeoResult> result = svc.service.forwardGeocode("h3h1h4");

        assertThat(result).isPresent();
        assertThat(result.get().getLat()).isEqualTo(45.5123);
        assertThat(result.get().getLng()).isEqualTo(-73.5967);
        assertThat(result.get().getCity()).isEqualTo("Downtown Montreal South & West");
        verify(svc.uriSpec).uri("/ca/H3H");
    }

    // A bare US zip must use the Zippopotam lookup instead of the free-form
    // search, which matches numeric postcodes anywhere in the world.
    @Test
    void forwardGeocodeResolvesUsZipViaZippopotam() {
        Map<String, Object> body = Map.of(
                "post code", "10001",
                "places", List.of(Map.of(
                        "place name", "New York City",
                        "latitude", "40.7484", "longitude", "-73.9967")));
        UriCapturingService svc = UriCapturingService.returning(body);

        Optional<GeoResult> result = svc.service.forwardGeocode("10001");

        assertThat(result).isPresent();
        assertThat(result.get().getCity()).isEqualTo("New York City");
        verify(svc.uriSpec).uri("/us/10001");
    }

    // When the postcode lookup finds nothing (e.g. Zippopotam 404s), fall back
    // to the free-form Nominatim search so town-like queries still resolve.
    @Test
    @SuppressWarnings("unchecked")
    void forwardGeocodeFallsBackToFreeFormWhenPostcodeLookupFails() {
        UriCapturingService svc = UriCapturingService.returning(null); // postcode call throws
        when(svc.responseSpec.body(any(org.springframework.core.ParameterizedTypeReference.class)))
                .thenThrow(new RuntimeException("404"))
                .thenReturn(List.of(Map.of(
                        "lat", "40.7484", "lon", "-73.9967",
                        "display_name", "Manhattan, New York, United States")));

        Optional<GeoResult> result = svc.service.forwardGeocode("10001");

        assertThat(result).isPresent();
        assertThat(result.get().getCity()).isEqualTo("Manhattan");
        verify(svc.uriSpec).uri(contains("q={q}"), any(Object[].class));
    }

    // Town names must skip the postcode lookup and go straight to free-form search.
    @Test
    void forwardGeocodeTownNameStaysFreeForm() {
        List<Map<String, Object>> body = List.of(Map.of(
                "lat", "43.7731", "lon", "-79.2578",
                "display_name", "Scarborough, Toronto, Canada"));
        UriCapturingService svc = UriCapturingService.returning(body);

        assertThat(svc.service.forwardGeocode("Scarborough")).isPresent();
        verify(svc.uriSpec, never()).uri(anyString());
    }

    // Mock harness that keeps the uriSpec/responseSpec visible for verification.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static class UriCapturingService {
        final GeocodingService service;
        final RestClient.RequestHeadersUriSpec uriSpec;
        final RestClient.ResponseSpec responseSpec;

        private UriCapturingService(GeocodingService service,
                                    RestClient.RequestHeadersUriSpec uriSpec,
                                    RestClient.ResponseSpec responseSpec) {
            this.service = service;
            this.uriSpec = uriSpec;
            this.responseSpec = responseSpec;
        }

        static UriCapturingService returning(Object body) {
            RestClient client = mock(RestClient.class);
            RestClient.RequestHeadersUriSpec uriSpec = mock(RestClient.RequestHeadersUriSpec.class);
            RestClient.RequestHeadersSpec headersSpec = mock(RestClient.RequestHeadersSpec.class);
            RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);
            when(client.get()).thenReturn(uriSpec);
            when(uriSpec.uri(anyString(), any(Object[].class))).thenReturn(headersSpec);
            when(uriSpec.uri(anyString())).thenReturn(headersSpec);
            when(headersSpec.header(anyString(), anyString())).thenReturn(headersSpec);
            when(headersSpec.retrieve()).thenReturn(responseSpec);
            if (body != null) {
                when(responseSpec.body(any(org.springframework.core.ParameterizedTypeReference.class)))
                        .thenReturn(body);
            }
            return new UriCapturingService(new GeocodingService(client, "ToWin-Test/1.0"), uriSpec, responseSpec);
        }
    }
}
