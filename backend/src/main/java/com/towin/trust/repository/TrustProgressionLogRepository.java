package com.towin.trust.repository;

import com.towin.trust.entity.TrustProgressionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface TrustProgressionLogRepository extends JpaRepository<TrustProgressionLog, UUID> {

    List<TrustProgressionLog> findByConnectionIdOrderByCreatedAtDesc(UUID connectionId);
}
