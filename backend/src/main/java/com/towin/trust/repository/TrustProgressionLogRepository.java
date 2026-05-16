package com.towin.trust.repository;

import com.towin.trust.entity.TrustProgressionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface TrustProgressionLogRepository extends JpaRepository<TrustProgressionLog, UUID> {

    List<TrustProgressionLog> findByConnectionIdOrderByCreatedAtDesc(UUID connectionId);

    @Modifying
    @Query("DELETE FROM TrustProgressionLog t WHERE t.connection.id = :connectionId")
    void deleteByConnectionId(@Param("connectionId") UUID connectionId);

    @Modifying
    @Query("DELETE FROM TrustProgressionLog t WHERE t.confirmedBy.id = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
}
