# ToWin — Platform Design Spec

## Vision

A platform connecting elderly people with each other and with young helpers to fight loneliness and provide practical assistance. Website first, mobile app later.

**Target audience:** Elderly people (primary), young helpers (secondary), family members (future)

**Core thesis:** In 2026 elderly people use smartphones. By 2030 they'll spend heavily. By 2040 nearly all will. First mover advantage on this demographic is massive.

**Problem:** Loneliness among elderly people — no safe, trusted way to connect with others or get daily help.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React |
| Backend | Spring Boot (Java) |
| Database | PostgreSQL + PostGIS |
| Security | Spring Security + JWT |
| Real-time | WebSocket (STOMP) |
| SMS | Twilio |
| File Storage | AWS S3 or Cloudinary |
| Mobile (future) | React Native |

---

## User Types

### Elder
- Old person looking for friends or help
- Profile: name, age, photo, city/location, interests, languages, looking_for (friendship/help/both), bio
- Lighter verification: phone + ID

### Helper
- Young person offering services
- Profile: everything elder has + skills_offered, availability_schedule
- Heavier verification: phone + ID + background check (criminal check in future)

### Both
- One person can be Elder AND Helper simultaneously (e.g., healthy 65-year-old helps 80-year-old while also seeking friends)

### Family (Future)
- Son/daughter of an elder
- Read-only dashboard of parent's activity, connections, helper ratings

---

## Core Modules

### MVP Modules
1. Auth & Verification
2. User Profiles (elder + helper)
3. Matching & Discovery
4. Trust Progression Engine
5. Messaging
6. Reviews & Trust Score
7. Service Posting & Applications
8. Emergency Contact Circle

### Future Modules
9. Family Dashboard
10. Neighborhood Groups
11. Skill Exchange (elders share their expertise)
12. Scheduled Companionship (recurring visits)
13. In-app voice/video calls
14. Auto-translation between languages
15. Phone-call onboarding for tech-challenged elders

---

## Trust Progression Engine

The core differentiator. Every connection between two people goes through these levels:

| Level | Name | What's Unlocked | Minimum Time |
|-------|------|----------------|-------------|
| 0 | Discovered | Can see profile, trust score, interests | — |
| 1 | Messaging | Text chat only | Day 1 |
| 2 | Phone Call | App shows "exchange numbers now" prompt | Day 2 |
| 3 | Video Call | App shows "schedule a video call" prompt | Day 3 |
| 4 | Verified | Both users have passed ID verification | After Day 3 |
| 5 | First Meet | In-person, platform suggests public place, emergency contacts notified | After Level 4 |
| 6 | Trusted | Free meetings, no restrictions | After 1 successful meet + mutual positive review |

### Rules
- Each level requires both people to confirm completion
- Either person can pause or end progression at any time
- Negative review at any level freezes progression, platform reviews
- Emergency contacts notified before Level 5
- Timer is a minimum — can take longer, never shorter

### Graduated Progression (Trust Score Based)
Users with higher trust scores can skip early levels with new connections:

| Trust Score | Start Level with New Person |
|------------|----------------------------|
| 0-30 (New Member) | Level 1 — full progression |
| 31-50 (Getting Started) | Level 1 — full progression |
| 51-70 (Reliable) | Level 2 — skip messaging |
| 71-90 (Highly Trusted) | Level 4 — skip to verified |
| 91-100 (Community Champion) | Level 4 — never skip the meet step |

First in-person meet always requires ID verification. Emergency contacts always notified. Either person can always slow it down.

---

## Service Mode (Post a Need → Get Help)

### Need Structure
- Title
- Category: Transportation / Cleaning / Companionship / Errands / Other
- Description
- Schedule: One-time / Recurring (weekly/monthly)
- Location: Auto-detected from profile
- Urgency: Normal / Urgent

### Flow
1. Elder posts need → visible to verified helpers within X km
2. Helpers see need, tap "I can help"
3. Elder sees applicants sorted by trust score, distance, reviews
4. Elder picks a helper
5. Trust progression starts (or skips if helper already Trusted)
6. Task coordinated and completed
7. Both leave a review

### Recurring Needs
- Helper auto-assigned for future occurrences
- Elder can remove and pick someone else
- This is where Scheduled Companionship fits naturally

---

## Matching & Discovery (Social Mode)

### Discovery Feed
Nearby elders filtered and sorted by:
- Distance (closest first, configurable radius, default 10km)
- Shared interests
- Shared language
- Active in last 7 days (no ghost profiles)

### Connection Flow
1. Elder A sees Elder B in discovery feed (list view, not swipe)
2. Elder A sends connection request with short message
3. Elder B gets notification, sees profile
4. Elder B accepts or declines
5. If accepted → Trust Progression starts at Level 1

### Anti-Spam
- Max 5 connection requests per day
- 3 consecutive declines → 24-hour cooldown
- Reported users can't send requests until reviewed

---

## Reviews & Trust Score

### Review Structure
- Rating: 1-5 stars
- Tags: Friendly / Punctual / Respectful / Helpful / Patient
- Safety concern: Yes/No (triggers platform review)
- Written comment: Optional

### Trust Score Calculation (0-100)

| Factor | Points |
|--------|--------|
| Phone verified | +10 |
| ID verified | +20 |
| Background check passed (future) | +20 |
| Each completed connection (Level 6) | +5 (max +25) |
| Each completed service | +3 (max +15) |
| Average review rating (mapped 0-10) | +10 |
| Active > 30 days | +5 |
| Each report received | -15 |
| Declined at Level 5 | -5 |

### Score Tiers

| Score | Label | Color |
|-------|-------|-------|
| 0-30 | New Member | Grey |
| 31-50 | Getting Started | Blue |
| 51-70 | Reliable | Green |
| 71-90 | Highly Trusted | Gold |
| 91-100 | Community Champion | Purple |

### Safety Triggers
- Score drops below 20 → account suspended, manual review
- 3 safety concern reports → immediate suspension
- Score resets if banned user creates new account (ID-linked)

---

## Messaging

### MVP Features
- Text messages
- Send photos
- Read receipts (seen/delivered)
- Typing indicator
- Block/Report button

### Future Features
- Voice messages
- In-app voice/video calls
- Auto-translation between languages

### Trust-Linked Banners
- At Level 2: "Ready for a phone call? Share your number when comfortable."
- At Level 3: "Time for a video call. Exchange details when ready."
- Both must confirm each step

### Safety
- Phone number/address shared before right trust level → flagged
- Reported messages go to moderation queue
- Auto-detection of suspicious patterns (asking for money, sharing links)

### Elderly UX
- Large text by default
- Simple UI — no stickers, no reactions
- Clear, loud notification sound (configurable)

---

## Emergency Contact Circle

### Setup
- Elder adds 1-3 emergency contacts during onboarding
- Contacts don't need a platform account
- They receive SMS notifications only (account access in future)

### Notification Triggers

| Trigger | SMS Content |
|---------|-------------|
| SOS button pressed | "[name] pressed emergency help. Last location: [link]" |
| Inactive for N days | "[name] hasn't been active for N days. Check on them." |
| First in-person meet | "[name] is meeting someone today. Location: [place]. Contact trust score: [score]" |

### SOS Button
- Visible on every screen — big red button in corner
- One tap activates — no confirmation popup
- Sends location to all emergency contacts
- Alerts platform moderators

### Inactivity Detection
- Configurable: 3 / 5 / 7 days / off
- Max 1 alert per week per contact (no spam)

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| users | All users — id, email, phone, password_hash, role, location, trust_score, verification status |
| elder_profiles | Elder-specific — interests, languages, looking_for, bio |
| helper_profiles | Helper-specific — skills_offered, availability, background_check_status |
| connections | Every relationship — user_a, user_b, type (SOCIAL/SERVICE), current_trust_level |
| trust_progression_log | Level change history — from_level, to_level, confirmations, timestamp |
| needs | Service requests — title, category, description, schedule, urgency, status |
| need_applications | Helper applications — need_id, helper_id, message, status |
| messages | Chat — connection_id, sender, content, type, flagged status, timestamps |
| reviews | Ratings — connection_id, reviewer, reviewee, rating, tags, safety_concern |
| emergency_contacts | Elder's emergency people — name, phone, relationship, inactivity_days |
| reports | Safety reports — reporter, reported, reason, status |

---

## API Structure

### Spring Boot Package Layout
```
com.towin
├── auth/          — AuthController, AuthService
├── profile/       — ProfileController, ProfileService
├── matching/      — MatchingController, MatchingService
├── trust/         — TrustController, TrustService
├── messaging/     — MessageController, MessageService
├── review/        — ReviewController, ReviewService
├── need/          — NeedController, NeedService
├── emergency/     — EmergencyController, EmergencyService
├── report/        — ReportController, ReportService
└── common/        — shared utils, exceptions, security config
```

### Core Endpoints

**Auth**
- POST /api/auth/register — signup (elder/helper/both)
- POST /api/auth/login — login, returns JWT
- POST /api/auth/verify-id — upload ID document

**Profile**
- GET /api/profile/me — get my profile
- PUT /api/profile/me — update profile
- GET /api/profile/{id} — view public profile

**Matching**
- GET /api/discover/elders — nearby elders (filtered)
- GET /api/discover/helpers — nearby helpers (filtered)
- POST /api/connections/request — send connection request
- POST /api/connections/respond — accept/decline
- GET /api/connections — my active connections

**Trust**
- POST /api/trust/{connectionId}/confirm — confirm trust level
- GET /api/trust/{connectionId}/status — current level + history
- POST /api/trust/{connectionId}/pause — pause progression

**Needs**
- POST /api/needs — post a need
- GET /api/needs/nearby — browse nearby needs (helpers)
- POST /api/needs/{id}/apply — apply to help
- POST /api/needs/{id}/accept/{helperId} — accept a helper
- POST /api/needs/{id}/complete — mark done

**Messaging**
- GET /api/messages/{connectionId} — chat history
- POST /api/messages/{connectionId}/send — send message
- POST /api/messages/{connectionId}/seen — mark seen

**Reviews**
- POST /api/reviews — leave a review
- GET /api/reviews/user/{id} — user's reviews

**Emergency**
- GET/POST/DELETE /api/emergency/contacts — manage contacts
- POST /api/emergency/sos — trigger SOS

**Reports**
- POST /api/reports — report a user/message

---

## Future Features (Post-MVP)

### Phase 2
- Family Dashboard — read-only account for elder's family members
- In-app voice/video calls — built into the platform
- Criminal background checks via third-party service (Checkr or similar)
- Payment system — platform takes % cut from service transactions

### Phase 3
- Neighborhood Groups — local community groups (Morning Walkers, Chess Club)
- Skill Exchange — elders share expertise (tax help, tutoring, mentoring)
- Scheduled Companionship — recurring visit schedules
- Auto-translation — real-time message translation between languages
- Phone-call onboarding — elder calls a number, agent sets up their profile

### Phase 4
- Mobile app (React Native, reuses same backend API)
- Advanced matching algorithm (ML-based compatibility)
- Continuous background monitoring (like Uber)
- Family can book helpers on behalf of elder

---

## Monetization Strategy (Future)

Free for now. Potential revenue models to explore later:
- Commission on service transactions (platform takes 10-15%)
- Premium subscription for elders (priority matching, unlimited connections)
- Helper subscription (appear higher in search, get more visibility)
- Family dashboard subscription
- Corporate partnerships (elder care companies, insurance providers)

---

## Key Design Principles

1. **Safety first** — every feature starts with "how could this be abused?"
2. **Simplicity for elderly** — large text, minimal steps, no tech jargon
3. **Trust is earned** — graduated progression, never skip safety
4. **Both sides have value** — elders aren't charity cases, they have skills and wisdom
5. **Family peace of mind** — if the family trusts the platform, elders will use it
