package com.towin.need.repository;

import com.towin.common.enums.NeedStatus;
import com.towin.need.entity.Need;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface NeedRepository extends JpaRepository<Need, UUID> {

    Page<Need> findByElderIdOrderByCreatedAtDesc(UUID elderId, Pageable pageable);

    @Query("SELECT n FROM Need n WHERE n.status = :status AND n.locationLat IS NOT NULL ORDER BY n.createdAt DESC")
    List<Need> findOpenNeedsWithLocation(@Param("status") NeedStatus status);

    List<Need> findByStatusOrderByCreatedAtDesc(NeedStatus status);
}
