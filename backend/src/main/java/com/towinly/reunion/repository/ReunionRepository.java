package com.towinly.reunion.repository;

import com.towinly.reunion.entity.Reunion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

public interface ReunionRepository extends JpaRepository<Reunion, UUID> {

    /** Every reunion the person is part of, as the elder or as the organiser, newest first. */
    @Query("SELECT r FROM Reunion r WHERE r.elder.id = :userId OR r.organiser.id = :userId ORDER BY r.createdAt DESC")
    List<Reunion> findMine(@Param("userId") UUID userId);

    /** Demo reset: the demo elder's reunions go with their other content. */
    @Modifying
    @Transactional
    void deleteByElderId(UUID elderId);
}
