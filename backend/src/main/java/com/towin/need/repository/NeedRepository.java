package com.towin.need.repository;

import com.towin.common.enums.NeedStatus;
import com.towin.need.entity.Need;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface NeedRepository extends JpaRepository<Need, UUID> {

    Page<Need> findByElderIdOrderByCreatedAtDesc(UUID elderId, Pageable pageable);

    long countByElderIdAndStatus(UUID elderId, NeedStatus status);

    // JOIN FETCH on both list queries: the elder is read for every row when
    // building responses, so load it in the same query (avoids N+1 selects).
    @Query("SELECT n FROM Need n JOIN FETCH n.elder WHERE n.status = :status AND n.locationLat IS NOT NULL ORDER BY n.createdAt DESC")
    List<Need> findOpenNeedsWithLocation(@Param("status") NeedStatus status);

    @Query("SELECT n FROM Need n JOIN FETCH n.elder WHERE n.status = :status ORDER BY n.createdAt DESC")
    List<Need> findByStatusOrderByCreatedAtDesc(@Param("status") NeedStatus status);

    @Modifying
    @Query("DELETE FROM Need n WHERE n.elder.id = :elderId")
    void deleteByElderId(@Param("elderId") UUID elderId);
}
