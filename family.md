# The Family feature — full reference

Everything ToWin does for **family** — from the first building block to the newest fix — written so you can go through it later, piece by piece, and check each part.

Two people are usually named in the examples below:
- **Margaret** — the parent (an *elder* account).
- **Sarah** — Margaret's daughter (a *family* account).
- **Harsha** — a helper Margaret is friends with.

---

## Contents

1. [The one idea: Watching vs Act for me](#1-the-one-idea-watching-vs-act-for-me)
2. [How to see it yourself (demo logins)](#2-how-to-see-it-yourself-demo-logins)
3. [How it was built, in order](#3-how-it-was-built-in-order)
4. [Family links — the connection between a parent and their family](#4-family-links)
5. [Watching — what family can see](#5-watching--what-family-can-see)
6. [Act for me — what family can do (guardian mode)](#6-act-for-me--what-family-can-do-guardian-mode)
7. [Trust inheritance — family meeting the parent's helpers](#7-trust-inheritance)
8. [The family updates thread](#8-the-family-updates-thread)
9. ["For Margaret" — how every action shows who really did it](#9-attribution)
10. [Trust points for family](#10-trust-points-for-family)
11. [Family alerts](#11-family-alerts)
12. [The screens](#12-the-screens)
13. [The building-block components](#13-the-building-block-components)
14. [Photos (and the two bugs fixed along the way)](#14-photos)
15. [The demo story and demo data](#15-the-demo-story-and-demo-data)
16. [Database changes](#16-database-changes)
17. [The API, in one list](#17-the-api-in-one-list)
18. [Tests](#18-tests)
19. [Commit history](#19-commit-history)
20. [Open items and things to check](#20-open-items-and-things-to-check)

---

## 1. The one idea: Sharing vs Act for me

The whole feature comes down to two separate powers a parent can give their family, and the words are used identically on both sides of the app:

| | **Sharing** | **Act for me** |
|---|---|---|
| What it is | What family can **see** | What family can **do** |
| Scope | **Per friendship** — one switch on each of the parent's friendships | **Per family member** — three separate switches for each person |
| Default | Off (every friendship is private until shared) | Off (every power is off until granted) |
| Who controls it | Only the parent | Only the parent — family can **ask**, the parent answers |

*(Sharing was called "Watching" until 2026-07-26. The old word read as surveillance for the person being watched, so the elder-facing copy now centres the elder's own act of sharing.)*

**Act for me can never reach further than Sharing.** A family member can only *do* things on a friendship the parent has chosen to *share*. This is enforced on the server, not just hidden in the screen — see [section 6](#6-act-for-me--what-family-can-do-guardian-mode).

The three "Act for me" powers:
- **Manage help requests** — post and close the parent's requests for help.
- **Advance trust** — move a friendship one step forward on the parent's behalf.
- **Leave reviews** — review a helper in the parent's name.

**Messaging is deliberately not a power** (removed in `7f7099c`): a family member talks to the parent in a private parent↔family chat as *themselves*, and reaches the parent's helpers via trust inheritance and the updates thread — never by writing inside the parent's own chat in the parent's name.

**The consent flow (2026-07-26):** the parent's switches remain, but the natural direction is now family → parent. A family member *asks* for a power ("What I can do for Margaret" on their side); the parent answers a plain yes/no card on the My family tab, worded exactly like the matching switch. One open ask per power, a 7-day cooldown after any answer (decline *or* approve-then-revoke), asking never grants anything, and unlinking clears every grant and open ask — so a revoked-then-re-linked family member starts from zero consent.

---

## 2. How to see it yourself (demo logins)

Sign in at the login screen. The login field is **identifier** (accepts email, username, or phone).

| Who | Login | Password |
|---|---|---|
| Margaret (parent) | `elder@gmail.com` | `12345678` |
| Sarah (daughter, family) | `demo.sarah@towin.app` | `DemoSarah!2026` |
| Harsha (helper) | `helper@gmail.com` | `123456789` |

Things to try:
- **As Margaret** → the **My Family** page → the **Controls** section → the **Watching** and **Act for me** tabs.
- **As Sarah** → her dashboard (**My Parents**) → open **Margaret** → the **Watching** and **Act for me** tabs.

In the demo, only Margaret's friendship with **Harsha** is shared (Watching on). Her friendships with Tom, Claire and Priya are private. Sarah holds three of the four powers (review is left off on purpose).

> Demo data resets a short while after a visitor's last change, so anything you switch on a demo account won't stick — that's expected.

---

## 3. How it was built, in order

The family feature grew in stages. This is the rough order, oldest first:

1. **Family-in-trust, Step 1–3** — a parent can link family members; family can see the parent's trust bar, helper profiles and open help requests (read-only); a shared **family updates** thread appears on each shared friendship.
2. **Family-in-trust, Step 4 — trust inheritance** — a family member can meet and chat with the parent's helpers directly, riding on the trust the parent already earned. A dedicated **FAMILY** connection type carries these, earns no points and never counts toward limits.
3. **Guardian mode** — the parent can delegate the four "Act for me" powers to one family member, each action clearly done *for* the parent.
4. **The Watching / Act for me rename + screen split** — the two ideas were named consistently and given their own tabs on both sides.
5. **A batch of fixes:**
   - **Watching now gates doing, not only seeing** — closed a real hole where a granted power reached even private friendships.
   - **S3 URL fix** — stop mangling photo paths that were never in S3.
   - **Family members can have a photo** — Sarah gets a face.
   - **The parent's page split** into Watching / Act for me on the family side.
6. **Family messaging overhaul** (`7f7099c`) — the old "message helpers" power was **removed**; in its place a private parent↔family chat (`POST /family/chat/{otherUserId}`) where family speak as themselves, plus a grouped inbox. A family member can never write inside the parent's own chat.
7. **One combined family dashboard** (`9d76b27`) — reversed the step-5 split: the family member's per-parent page is a single view again, and the elder's My Family page gained three top tabs (Controls · My family · How it works, landing on My family).
8. **The consent flow, the reassurance band, and the Sharing rename (2026-07-26)** — family asks → parent approves (new `family_power_requests` table, V49); the family dashboard now leads with an "is Mum okay" band; "Watching" became "Sharing" everywhere on screen; and a real bug was fixed along the way: unlinking now clears every grant and open ask, so revoke → re-link can no longer silently resurrect old consent.

Full commit list is in [section 19](#19-commit-history).

---

## 4. Family links

A **family link** is one row joining a parent (**elder** seat) and a **family member**. Everything else hangs off it.

**Files:** `backend/.../family/entity/FamilyLink.java`, `family/service/FamilyService.java`, `family/controller/FamilyController.java`

### Lifecycle
`PENDING` → `ACTIVE` → (`REVOKED` | `DECLINED`)

- **Invite** (`POST /family/requests`): either the parent adds a family member (`side='family'`, caller must have an elder seat) or a family member adds their parent (`side='elder'`, the target must have an elder seat). The other person is found by username / email / phone. A missing or ineligible target returns one **generic** "we couldn't find that person" message — no way to probe who has an account.
- **Respond** (`POST /family/requests/{id}/respond`): only the person who did **not** send the invite may accept or decline, and only while it's still pending. Accepting recalculates the parent's trust (+1, see [section 10](#10-trust-points-for-family)).
- **Revoke / unlink** (`DELETE /family/links/{id}`): once active, **either** side can end it. While pending, only the parent or the original sender may cancel (the recipient declines instead).
- **Main contact** (`POST /family/links/{id}/primary`): only the parent, only on an active link, at most one at a time.

### Rules
- Max **5** family members per parent (pending + active counted together).
- Max **10** family requests per day per person.
- Only an **ELDER** (or **BOTH**) account can hold the parent seat. A plain helper never can — this structurally closes the "fake family" door.
- **FAMILY** is a dedicated role for people who only take part as family.
- One row per (parent, family member) pair, enforced in the database. A declined/revoked pair is revived, not duplicated.

---

## 5. Watching — what family can see

**One switch per friendship**, owned by the parent. Turning it on lets family watch how that friendship is going; it changes nothing else.

**Backend:** the flag is `Connection.sharedWithFamily` (defaults to **false** — private until shared). The endpoint is `POST /connections/{id}/family-visibility`. Only the **elder seat** of that friendship may flip it; a helper gets a 403.
*(Files: `connection/entity/Connection.java`, `connection/service/ConnectionService.java`)*

This one flag is the pivot the whole feature reads:
- family visibility of the friendship,
- the family updates thread on it,
- **and** all three per-friendship "Act for me" powers.

Turning it off severs all of them on the very next read or action.

**Frontend:** the `FamilyShareToggle` component — "Share with family — let them see this friendship." Optimistic flip, rolled back with a toast if the save fails. (The switch, the Controls tab and all surrounding copy say **Sharing** since 2026-07-26; the flag and endpoint names keep the original `familyVisibility` / `sharedWithFamily` wording.)

---

## 6. Act for me — what family can do (guardian mode)

The parent grants up to three powers to **one** trusted family member. Each granted power is a stored row; the client never asserts a power, the server reads the rows.

**The consent flow (2026-07-26)** wraps the same grant record: a family member may **ask** for a power (`POST /family/links/{id}/power-requests`, family seat of an ACTIVE link only, one PENDING ask per power, 7-day cooldown from the `respondedAt` of *any* answered ask). The parent answers (`POST /family/power-requests/{id}/respond`, elder only; the link is re-checked ACTIVE inside the transaction). A yes writes the grant row; a no just closes the card, and the family side never sees the word "declined" — the ask simply returns to askable, with the cooldown enforced server-side. Flipping a Controls switch on directly auto-answers a matching open ask. **Unlinking calls `revokeAll`**, deleting every grant and open ask for the pair — before this, grants survived revocation and a re-link silently resurrected them. Rows live in `family_power_requests` (V49); asks ride the `/family/links` payload as `pendingPowerRequests`.

**Grant model** *(Files: `family/entity/FamilyDelegatedPower.java`, `family/service/FamilyDelegationService.java`)*
- Stored in `family_delegated_powers`, one row per granted power. Row present = granted.
- Granted/revoked only by `setPowers` (`PUT /family/links/{id}/powers`) — **whole-set replace**: the request carries the full set to keep, so anything left out is revoked, and there is never a half-applied state.
- Only the **parent** seat of an **active** link may grant. A family member can never grant themselves anything. Caller identity always comes from the login token, never the request body.

**How a power is checked at the moment of action** — this is the important part, and where the recent security fix lives:

- `hasPower(caller, elder, power)` = there's an **active family link** *and* the **grant row** exists.
- `hasPowerOn(caller, elder, power, connection)` = `hasPower(...)` **and** that friendship is **shared with family** (`isWatched`).

Nothing is cached — the link, the grant and the share flag are re-read on **every** action, so revoking any of them stops the very next attempt.

### The fix: Watching gates *doing*, not only *seeing* (`59dd4d2`)

Before the fix, `assertDelegated` checked only the active link and the grant. So once a power was granted, a family member could act on **any** of that parent's friendships — including ones the parent deliberately kept private. The screen hid those friendships, but the server would accept a direct request for them. (Reproduced against the live site: Sarah posted into Margaret's private chat with Tom, in Margaret's name.)

Now the three **per-friendship** powers go through the connection-aware gate `hasPowerOn` / `assertDelegatedOn`, which refuses unless the friendship is shared:

| Power | Enforced in | Gate used |
|---|---|---|
| Advance trust | `TrustService.delegatedSeatOn` | `hasPowerOn` (grant **+ Sharing**) |
| Leave reviews | `ReviewService.submitReview` | grant first, then `assertDelegatedOn` once the friendship is known |
| Manage help requests | `NeedService` | `hasPower` (grant only — see below) |

*(The old "message helpers" row is gone with the power itself — `7f7099c`. `MessageOnBehalfTest` now locks the opposite: a family member can never write inside the parent's private chat.)*

**Why "manage help requests" is the exception:** a help request belongs to the parent, not to any one friendship, so there is no connection for Watching to gate. It intentionally stays on the plain `hasPower` check.

**How each power behaves when acting on the parent's behalf:**
- **Advance trust** — the family member can take only the **first** of the two confirm presses of a step. Every rule (whose turn, "already confirmed") is judged on the parent's seat, so they can never take a step the parent couldn't.
- **Leave reviews** — the review is saved as the parent's, and the pair must be fully **TRUSTED**. A safety-concern review never names the family member who wrote it (that would point straight back at the person it protects).
- **Manage help requests** — the request is the parent's (their address, their listing). Conflict guards: a family member who manages a request can't also apply to it, and can't pick themselves as the helper.

---

## 7. Trust inheritance

Separate from guardian mode, but built on the same active link + share switch: a family member can meet and talk to the parent's helpers directly, without their own request/accept, because the parent's earned trust is the bridge. This is **Step 4** of family-in-trust.

**Files:** `family/service/FamilyStandingService.java`, `family/entity/FamilyStandingControl.java`, `common/enums/ConnectionType.java` (`FAMILY`)

- A **standing** is *derived on the fly* (active family link + the parent's active, shared friendship at **Messaging** or beyond + no revoked control row) — it is never stored.
- The only thing stored is the family member's own opt-out (pause / remove) in `family_standing_controls`.
- The family member↔helper chat is a **FAMILY**-type connection: created active with no request step, **earns no trust points**, and **never counts** toward connection limits.
- If the parent stops sharing the friendship, the whole inherited chat closes.

**Frontend:** `FamilyHelperConnect` (message / pause / remove your own side).

---

## 8. The family updates thread

Each shared friendship carries a small group thread the parent, the helper and the family all read — a light "how it's going" feed, not the private chat.

**Backend:** a `channel` column on messages splits `MAIN` (the private elder↔helper chat) from `FAMILY_UPDATES`. Family access needs a **double gate**: an active family link **and** a friendship that is active, shared, and at **Ready to Meet** (FIRST_MEET) or beyond. The thread never leaks phone or email — name, photo and relationship words only. Its activity is kept out of chat previews, unread badges and seen-stamping.

**Frontend:** the thread rides the normal Messages page (`?channel=family`). It renders as a three-person group chat — **one face per sender** (`m.senderPhotoUrl`), and a group people-mark for the header and empty state instead of any single face. (Fixing the repeated-single-face bug was part of `172b75d`.)

---

## 9. Attribution

Nothing a family member does is a silent impersonation — every action is recorded as the parent's, with the family member named as who acted.

- Messages, help requests, reviews and trust steps all keep the **parent** as the owner and stamp an **acted-by** field for who really did it. Only stamped when the writer and the owner differ.
- In the parent's own chat, a family member sees a gold "**Writing for Margaret**" line, and each message they send shows "*Sarah, writing for Margaret*". This rides on the message from the server, so it survives a refresh.
- A trust step's history row records "*confirmed by Margaret, acted by Sarah*", shown on every screen that shows the history. The stand-in is cleared at the end of each step so it can never leak onto a later one.
- Exception: a **safety report** is kept anonymous — the family member is not named.

---

## 10. Trust points for family

Having family connected earns the **parent** exactly **one flat point**, regardless of how many family members (up to 5). *(File: `trust/service/TrustScoreService.java`)*

- Only **active** links count; pending earns nothing.
- Only the **elder** earns it — a family member, a helper holding the family side, and a BOTH-role holding the family side all earn zero.
- A FAMILY-type connection (trust inheritance) earns nothing even when fully trusted.
- The point recalculates when a link is accepted, and drops when an active link is revoked.

---

## 11. Family alerts

Linked family get an **in-app-only** feed (never text or email):
- **SOS** — "Urgent help"
- **Inactivity** — "Quiet lately"
- **First meeting** — "First meeting"

*(Files: `family/entity/FamilyAlert.java`, `emergency/service/SosService...`)* Shown on the family dashboard's **News** tab.

---

## 12. The screens

### Elder side — `MyFamily.jsx` (route `/family`, ELDER/BOTH only)
Three top tabs (`9d76b27`): **Controls · My family · How it works**, landing on My family.
- **My family** — link family members (max 5), accept/decline incoming, cancel outgoing, remove, set a main contact — **and the consent cards** (2026-07-26): every open power ask renders as "Sarah asks: leave a review for you", explained in the switch's own words, with equal Yes / Not now buttons. The tab's badge counts link requests + power asks together.
- **Controls** — two inner tabs via `SegmentedTabs`: **Sharing** (every active friendship with its own share switch) and **Act for me** (per family member, the three power switches; gated with "Share a friendship first" while nothing is shared).
- **How it works** — four plain-word promises + the +1 trust note.

### Family side — `FamilyHome.jsx` (route `/family-home`)
- The FAMILY role's dashboard. Tabs: **My Parents**, **Add Parent**, **News**.
- **My Parents** — one card per linked parent, now led by the **reassurance band** (2026-07-26), the one-line answer to "is Mum okay": a fresh SOS (48 h) shows urgent; no check-in for 5+ days shows "It's been quiet"; otherwise "All looks well — Margaret checked in today." Quiet is computed from the journey's `lastCheckinDate`, never from the lingering INACTIVITY alert. Below the band: check-in chip, open-requests count, and the button into that parent's page.
- **Add Parent** — invite the parent (`side='elder'`).
- **News** — the in-app alert feed.

### Family side — `FamilyParent.jsx` (route `/family-home/parent/:elderId`)
One combined view (`9d76b27` reversed the earlier two-tab split): the header with the private "Message Margaret" chat button, then **"What I can do for Margaret"** (2026-07-26) — the three powers each shown as **On**, **Waiting** ("waiting for Margaret to decide — she answers on her My Family page"; never "declined", never a countdown) or an **Ask Margaret** button — then "How Margaret is today" (check-in, help requests, manageable with the grant), and the shared friendships with read-only ladders, the updates thread, and the trust-advance / review surfaces where granted.

---

## 13. The building-block components

All under `frontend/src/components/` unless noted.

| Component | What it does | Endpoint |
|---|---|---|
| `FamilyShareToggle` | The per-friendship **Watching** switch (elder only) | `POST /connections/{id}/family-visibility` |
| `DelegatedPowerToggle` | The four **Act for me** switches (whole-set replace; server answer wins) | `PUT /family/links/{id}/powers` |
| `FamilyNeedsForParent` | See the parent's requests; add/close when allowed | `POST /needs`, `DELETE /needs/{id}` |
| `FamilyTrustAdvance` | "Move the next step forward for Margaret" | `POST /trust/{id}/confirm` |
| `FamilyReviewForParent` | Star + comment review as the parent (only when TRUSTED) | `POST /reviews` |
| `FamilyHelperConnect` | The family member's own inherited-standing controls | `POST /family/standings/{id}/{chat\|pause\|resume\|revoke}` |
| `FamilyHelperUpdates` / `FamilyThreadLink` | Doorway into the family updates thread | navigation only |
| `SegmentedTabs` | The shared underline tab strip both family screens use | — |
| `Messages.jsx` | Renders the family group thread (one face per sender) and the "Writing for Margaret" attribution | — |

Every acting component confirms destructive actions, shows "for Margaret" wording, and relies on the server to re-check the grant.

---

## 14. Photos

Two related fixes made family photos work.

### The account can now hold a photo (`629b7c8`)
Photos used to live only on **elder** and **helper** profiles. A **family** account has neither, so a family member's photo had nowhere to go and always fell back to an initial — in a thread with three people, the daughter was the one grey circle.

- New column: `users.photo_url` (migration **V47**).
- New `ProfilePhotoResolver` decides which face wins, in fixed order: **elder profile → helper profile → account photo → none**. It mirrors the existing `DisplayNameResolver` for names.
- Sarah's photo is `/demo/sarah.jpg`, shipped in the frontend's `public/demo/` and stored on her account, so the demo reset can't wash it away.

### The S3 URL fix (`c6199e1`)
`presignedUrl` and `deleteFile` searched a URL for `".amazonaws.com/"` and then added the marker's length to whatever `indexOf` returned — **including −1**. A path with no marker (like `/demo/sarah.jpg`) yielded a key carved out of the middle of its own path.
- Signing that produced a dead URL; deleting it aimed an S3 delete at a key nobody asked for. Neither threw, so both failed silently.
- Both now resolve the key through one helper that returns nothing for a non-S3 URL, and such URLs pass through **untouched**. Verified live: Sarah's `/demo/sarah.jpg` comes back as-is while the S3 photos beside it still sign normally.

---

## 15. The demo story and demo data

Seeded by `DemoDataSeeder.java` around a fixed story so the feature is never empty:

- **Margaret** (elder, `elder@gmail.com`) is linked to her daughter **Sarah** (family, `demo.sarah@towin.app`) — an active "Daughter" link.
- Sarah holds **two of three** powers: manage help requests and advance trust. **Leave reviews is a live, pending ask** — Sarah has asked and Margaret hasn't decided, so a visitor signing in as Margaret finds a real approval card waiting on her My family tab. (Reviews would be unusable below Fully Trusted anyway — the card itself is the payoff.)
- One **FIRST_MEET alert** is seeded ("Planned a first in-person meeting with Harsha.") so the family News tab is never empty.
- Only **Margaret↔Harsha** is shared (Watching on), at **Ready to Meet**. Her friendships with Tom, Claire and Priya stay private.
- The shared friendship has a seeded **family updates** thread (Harsha, Sarah, Margaret).
- A help request — "A lift to Mum's hearing test" — is seeded as written **by Sarah, for Margaret**, so Browse Requests shows the attribution immediately.
- A Sarah↔Harsha **FAMILY** connection exists so Sarah's screen is never empty.

The reset is **event-driven** (a short debounce after a demo account actually changes), not a fixed timer; with few visitors nothing runs. It purges family rows before rebuilding, but keeps accounts and profiles so personas stay stable.

Full persona roster and passwords live in `DemoDataSeeder.java` (`DEMO_EMAILS`).

---

## 16. Database changes

| Migration | What it adds |
|---|---|
| `V37` | `FAMILY` user role |
| `V38` | `family_links` table (one primary per elder, no self-link, unique pair) |
| `V39` | `family_alerts` table **+ `connections.shared_with_family`** (default false) |
| `V40` | `messages.channel` (MAIN / FAMILY_UPDATES) |
| `V41` | `FAMILY` connection type |
| `V42` | `family_standing_controls` (family opt-outs only; standing itself is derived) |
| `V43` | `family_delegated_powers` (one row per granted power) |
| `V44` | `messages.acted_by_user_id` (who wrote it) |
| `V45` | `acted_by_user_id` on needs, reviews, trust log |
| `V46` | `connections.confirm_acted_by_a` / `_b` (who pressed each confirm seat) |
| `V47` | `users.photo_url` (the account-level photo) |
| `V48` | removes the MESSAGE_HELPERS power (messaging stopped being a delegated power) |
| `V49` | `family_power_requests` — the consent flow's asks; at most one PENDING per (pair, power) — **newest** |

---

## 17. The API, in one list

Under `/api`:

**Family** — `POST /family/requests`, `POST /family/requests/{id}/respond`, `DELETE /family/links/{id}`, `POST /family/links/{id}/primary`, `PUT /family/links/{id}/powers`, `POST /family/links/{id}/power-requests` *(ask for a power)*, `POST /family/power-requests/{id}/respond` *(the elder answers)*, `POST /family/chat/{otherUserId}` *(the private parent↔family chat)*, `GET /family/links` *(now carries `pendingPowerRequests` per link)*, `GET /family/journey` *(now carries `lastCheckinDate`)*, `GET /family/alerts`, `GET /family/transparency`, `GET /family/standings`, `POST /family/standings/{id}/{chat|pause|resume|revoke}`

**Sharing** — `POST /connections/{id}/family-visibility`

**Acting on behalf** (each re-checks the grant server-side):
- `POST /needs` with `onBehalfOfElderId`, `DELETE /needs/{id}`
- `POST /trust/{id}/confirm` (the connection names both seats — no elder id needed)
- `POST /reviews` with `onBehalfOfElderId`

Every handler takes the caller from the login token, never the request body.

---

## 18. Tests

### Backend
| File | Locks |
|---|---|
| `FamilyDelegationServiceTest` | grant/revoke reconcile; only the elder grants; a **private friendship is refused even with the power**; a shared one still needs the grant |
| `MessageOnBehalfTest` | write-as-parent + named author; no grant = shut out; rechecked each message; doesn't reach the updates thread |
| `TrustOnBehalfTest` | steps from the parent's seat; history credits parent + names actor; only the first press; can't reach the pause button |
| `ReviewOnBehalfTest` | review as parent; can't self-review in the parent's name; can't reach an untrusted helper; safety report stays anonymous |
| `FamilyUpdatesChannelTest` | the double gate on the shared thread; per-channel history |
| `ConnectionServiceFamilyVisibilityTest` | only the elder may share; helper forbidden; default not-shared |
| `S3ServicePassThroughTest` | app paths handed back untouched; deleting one asks S3 for nothing |
| `ProfilePhotoResolverTest` | elder → helper → account order; blank falls through |
| `DemoDataSeederFamilyTest` | the whole demo family state, idempotent on re-seed |
| `FamilyServiceTest` / `...RespondRevokePrimaryTest` | link creation, limits, rate limit, respond/revoke/primary lifecycle |
| `FamilyServiceAlertsTest`, `FamilyServiceTrustRecalcTest`, `FamilyJourneyServiceTest`, `FamilyStandingServiceTest` | alerts feed, trust recalcs, journey, standings |
| `FamilyEntityTest`, `FamilySchemaConstraintDbTest` | JPA mapping + real-Postgres constraints |
| `AuthServiceFamilyRegistrationTest`, `AccountServiceFamilyDataTest`, `SosServiceFamilyAlertsTest`, `TrustScoreServiceFamilyPointsTest` | FAMILY registration, GDPR purge/export, SOS/first-meet/inactivity alerts, the flat elder-only point |

### Frontend
`MyFamily.test.jsx`, `FamilyParent.test.jsx`, `FamilyHome.test.jsx`, `FamilyShareToggle.test.jsx`, `FamilyHelperConnect.test.jsx`, `FamilyHelperUpdates.test.jsx`, `HelperFamilyUpdates.test.jsx`, `ElderFamilyUpdates.test.jsx`, `Trust.family-line.test.jsx`, `Register.family-role.test.jsx`.

As of 2026-07-26: the backend suite reports **961 passing test methods** and the frontend **143**; lint clean. New with the consent flow: the full ask/answer/cooldown/revokeAll lifecycle in `FamilyDelegationServiceTest`, the approval cards in `MyFamily.test.jsx`, the what-I-can-do states in `FamilyParent.test.jsx`, and the reassurance band's four states in `FamilyHome.test.jsx`.

---

## 19. Commit history

Newest first (family-related only):

```
(uncommitted, 2026-07-26)  the consent flow, the reassurance band, the Sharing
                           rename, and the revoke-clears-consent fix — local,
                           awaiting review
9d76b27  one combined family dashboard; tab the elder's My Family page
7f7099c  family messaging — private parent↔family chat; remove write-in-parent's-chat
4dde0c6  split the parent's page into Watching and Act for me
629b7c8  give family members a face, and Sarah hers
c6199e1  stop mangling photo URLs that were never in S3
59dd4d2  Watching now gates doing, not only seeing
a338c54  Merge: family screen fixes (chat avatars, controls, parent detail)
172b75d  one face per speaker, and family controls that show both halves
1190066  never show someone's email as their name, and seed guardian mode
92e52e3  guardian mode: the remaining three powers, and the holes they opened
8087b24  name the chat a family member opens on their parent's behalf
804af03  guardian mode: a trusted family member can write to a parent's helpers
db801ce  guardian mode foundation: the record of what a parent lets family do
8a020d8  family sees the trust bar, helper profiles, and open requests
a980dab  derive connection type server-side so FAMILY can't be spoofed
c2be061  trust inheritance: family inherits the elder's earned trust
2c5d98d  family updates become a Messages group thread; My Family tab
        + the Step-4 (US-001…005) and updates-thread (US-001…006) commits
        + the earlier family-in-trust journey/flat-point commits
```

---

## 20. Open items and things to check

Nothing here is broken — these are judgement calls and things worth an eye:

1. **Sarah's photo may crop badly.** It's a three-quarter-body shot with her face small and off-centre, so a round avatar will likely frame shoulder and wall rather than face. The image wasn't altered (it's a supplied asset). A square face-crop would fix it.
2. **The 2026-07-26 work (consent flow, reassurance band, Sharing rename, revoke-clears-consent fix) is implemented and fully tested but uncommitted** — it's waiting on your localhost review before anything is committed or pushed.
3. **`FamilyHelperConnect` (connecting with the parent's helper yourself) sits with the shared-friendship cards** on the combined page. It's Sarah's *own* relationship, not something done in Margaret's name, so that's arguably right — easy to move if you'd rather.

Everything in sections 1–19 up to commit `9d76b27` is **live on `main`**; the consent-flow batch is local only.
