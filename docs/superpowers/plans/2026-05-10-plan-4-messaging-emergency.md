# Plan 4 — Messaging + Emergency Contacts

**Date:** 2026-05-10
**Branch:** plan-4/messaging-emergency
**Status:** In Progress

## Tasks

- [ ] Task 1: V8 (messages) + V9 (emergency_contacts) migrations
- [ ] Task 2: Message entity + repository, EmergencyContact entity + repository
- [ ] Task 3: WebSocket config (STOMP)
- [ ] Task 4: MessageService + MessageController + tests
- [ ] Task 5: EmergencyContactService + EmergencyController + tests
- [ ] Task 6: Twilio — wire into TrustService FIRST_MEET + SOS endpoint
- [ ] Task 7: SecurityConfig — open /ws/**, update pom.xml + application.yml
- [ ] Task 8: Run tests, commit, push, PR to main, update Notion

## New Endpoints
- GET  /api/messages/{connectionId}        — chat history (paginated)
- POST /api/messages/{connectionId}/send   — send message
- POST /api/messages/{connectionId}/seen   — mark seen
- GET  /api/emergency/contacts             — list contacts
- POST /api/emergency/contacts             — add contact
- DELETE /api/emergency/contacts/{id}      — remove contact
- POST /api/emergency/sos                  — trigger SOS (Twilio SMS to all contacts)

## Graph findings
- TrustService.confirmTrustLevel() already has FIRST_MEET placeholder — just swap log for Twilio call
- SecurityConfig.filterChain() needs /ws/** and /api/emergency/** added
- KafkaConfig at common/config/ is reusable for emergency-events topic
