package com.towin.need.repository;

import com.towin.need.entity.NeedApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NeedApplicationRepository extends JpaRepository<NeedApplication, UUID> {

    List<NeedApplication> findByNeedId(UUID needId);

    Optional<NeedApplication> findByNeedIdAndHelperId(UUID needId, UUID helperId);

    boolean existsByNeedIdAndHelperId(UUID needId, UUID helperId);
}
