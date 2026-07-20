package com.towin.common.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Not every photo lives in S3. A path we ship with the app ("/demo/sarah.jpg")
 * is served by the frontend and needs no signing at all.
 *
 * The old code assumed every URL was an S3 one: it searched for ".amazonaws.com/",
 * got -1 when it was absent, and substring'd from index 14 anyway — carving a
 * meaningless key out of the middle of the path and signing THAT into a URL that
 * 404s. Nothing threw, so the catch never fired and the breakage was silent.
 */
@ExtendWith(MockitoExtension.class)
class S3ServicePassThroughTest {

    @Mock S3Client s3Client;
    @Mock S3Presigner s3Presigner;
    @InjectMocks S3Service s3Service;

    private void withBucket() {
        ReflectionTestUtils.setField(s3Service, "bucket", "towin-photos");
        ReflectionTestUtils.setField(s3Service, "region", "us-east-1");
    }

    @Test
    void anAppServedPathIsHandedBackExactlyAsItCame() {
        withBucket();

        assertThat(s3Service.presignedUrl("/demo/sarah.jpg")).isEqualTo("/demo/sarah.jpg");
        verifyNoInteractions(s3Presigner);
    }

    /** Anything that is not an S3 object — including a fully-formed outside URL. */
    @Test
    void anOutsideUrlIsAlsoLeftAlone() {
        withBucket();

        assertThat(s3Service.presignedUrl("https://images.example.com/a/photo.jpg"))
                .isEqualTo("https://images.example.com/a/photo.jpg");
        verifyNoInteractions(s3Presigner);
    }

    @Test
    void nullAndBlankStayNull() {
        withBucket();

        assertThat(s3Service.presignedUrl(null)).isNull();
        assertThat(s3Service.presignedUrl("   ")).isNull();
    }

    /**
     * The same -1 sat in deleteFile, where it is worse than a broken link: it
     * would carve a key out of a path that was never ours and ask S3 to delete
     * it. A file we do not own in a bucket is not ours to touch.
     */
    @Test
    void deletingAnAppServedPathAsksS3ForNothing() {
        withBucket();

        s3Service.deleteFile("/demo/sarah.jpg");

        verifyNoInteractions(s3Client);
    }
}
