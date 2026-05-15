package com.towin.need.repository;

import com.towin.need.entity.NeedApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NeedApplicationRepository extends JpaRepository<NeedApplication, UUID> {

    List<NeedApplication> findByNeedId(UUID needId);

    Optional<NeedApplication> findByNeedIdAndHelperId(UUID needId, UUID helperId);

    boolean existsByNeedIdAndHelperId(UUID needId, UUID helperId);

    @Query("SELECT COUNT(a) FROM NeedApplication a WHERE a.helper.id = :helperId AND a.status = com.towin.common.enums.ApplicationStatus.ACCEPTED AND a.need.status = com.towin.common.enums.NeedStatus.COMPLETED")
    long countCompletedByHelper(@Param("helperId") UUID helperId);
}
