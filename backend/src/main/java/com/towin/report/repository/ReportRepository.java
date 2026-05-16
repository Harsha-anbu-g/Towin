package com.towin.report.repository;

import com.towin.report.entity.Report;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ReportRepository extends JpaRepository<Report, UUID> {

    long countByReportedUserId(UUID reportedUserId);

    @Query("SELECT r FROM Report r JOIN FETCH r.reporter JOIN FETCH r.reportedUser")
    List<Report> findAllWithUsers();

    void deleteByReporterIdOrReportedUserId(UUID reporterId, UUID reportedUserId);
}
