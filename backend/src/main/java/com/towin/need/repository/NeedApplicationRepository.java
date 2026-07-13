package com.towin.need.repository;

import com.towin.common.enums.ApplicationStatus;
import com.towin.common.enums.NeedStatus;
import com.towin.need.entity.NeedApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NeedApplicationRepository extends JpaRepository<NeedApplication, UUID> {

    // JOIN FETCH: responses read the helper (resp. need + its elder) for every
    // row, so load them in the same query (avoids N+1 selects).
    @Query("SELECT a FROM NeedApplication a JOIN FETCH a.helper WHERE a.need.id = :needId")
    List<NeedApplication> findByNeedId(@Param("needId") UUID needId);

    @Query("SELECT a FROM NeedApplication a JOIN FETCH a.need n JOIN FETCH n.elder WHERE a.helper.id = :helperId")
    List<NeedApplication> findByHelperId(@Param("helperId") UUID helperId);

    Optional<NeedApplication> findByNeedIdAndHelperId(UUID needId, UUID helperId);

    boolean existsByNeedIdAndHelperId(UUID needId, UUID helperId);

    @Query("SELECT COUNT(a) FROM NeedApplication a WHERE a.helper.id = :helperId AND a.status = :appStatus AND a.need.status = :needStatus")
    long countCompletedByHelper(@Param("helperId") UUID helperId, @Param("appStatus") ApplicationStatus appStatus, @Param("needStatus") NeedStatus needStatus);

    @Modifying
    @Query("DELETE FROM NeedApplication a WHERE a.helper.id = :helperId")
    void deleteByHelperId(@Param("helperId") UUID helperId);

    @Modifying
    @Query("DELETE FROM NeedApplication a WHERE a.need.id = :needId")
    void deleteByNeedId(@Param("needId") UUID needId);
}
