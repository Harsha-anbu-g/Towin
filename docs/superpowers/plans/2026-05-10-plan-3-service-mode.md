# Plan 3 — Service Mode + Infrastructure

**Date:** 2026-05-10
**Status:** In Progress

## Goal
Implement the Service Mode (elders post needs, helpers apply) and add three infrastructure features that close resume gaps: S3 file upload, Redis caching, and Kafka async messaging.

## Tasks

- [ ] Task 1: DB migrations V6 (needs) + V7 (need_applications)
- [ ] Task 2: Enums + Need entity + NeedApplication entity + repositories
- [ ] Task 3: NeedService + NeedController + tests
- [ ] Task 4: S3 photo upload — PUT /api/profile/photo
- [ ] Task 5: Redis cache — discovery endpoints cached by userId + filter hash
- [ ] Task 6: Kafka — produce event on connection request, consume + log
- [ ] Task 7: Docker Compose — app + Postgres + Redis + Kafka
- [ ] Task 8: Run tests, commit, push, update Notion

## New Dependencies (pom.xml)
- spring-boot-starter-data-redis
- spring-kafka
- software.amazon.awssdk:s3
- spring-boot-starter-cache

## New Endpoints
- POST /api/needs — post a need (ELDER only)
- GET /api/needs/nearby — browse nearby needs (HELPER only), paginated
- POST /api/needs/{id}/apply — apply to help
- POST /api/needs/{id}/accept/{helperId} — elder accepts a helper
- POST /api/needs/{id}/complete — mark done
- PUT /api/profile/photo — upload profile photo to S3

## New Tables
- needs: id, elder_id, title, category, description, schedule, urgency, status, lat, lng, created_at
- need_applications: id, need_id, helper_id, message, status, created_at
