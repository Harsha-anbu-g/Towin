package com.towin.report.repository;

import com.towin.report.entity.Report;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ReportRepository extends JpaRepository<Report, UUID> {

    long countByReportedUserId(UUID reportedUserId);
}
