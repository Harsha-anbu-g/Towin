# Feedback & Beta System Design
**Date:** 2026-05-20  
**Status:** Approved

## Overview

Add a structured feedback collection system to ToWin during its beta phase. Friends and testers submit feedback via a dedicated page. All submissions are stored in Supabase and viewable by the admin inside the app. A beta banner and floating feedback button appear on every page to encourage participation.

---

## 1. Supabase Table: `feedback`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | auto-generated |
| `name` | text | nullable |
| `email` | text | nullable |
| `phone` | text | nullable |
| `message` | text | required |
| `rating_idea` | int2 | nullable, 1–5 |
| `rating_ui` | int2 | nullable, 1–5 |
| `rating_theme` | int2 | nullable, 1–5 |
| `rating_security` | int2 | nullable, 1–5 |
| `rating_ease_of_use` | int2 | nullable, 1–5 |
| `rating_performance` | int2 | nullable, 1–5 |
| `rating_overall` | int2 | nullable, 1–5 |
| `created_at` | timestamptz | default now() |

**Row-Level Security:**
- Anonymous `INSERT` allowed (anon key used from frontend)
- `SELECT` denied for anon role — only service role key can read (used in admin panel)

---

## 2. Frontend: Supabase Client

- Install `@supabase/supabase-js`
- Create `src/lib/supabase.js` with the anon public key (safe — write-only access)
- Create `src/lib/supabaseAdmin.js` with the service role key (loaded from `VITE_SUPABASE_SERVICE_KEY`) — used only in admin feedback tab

---

## 3. Feedback Page (`/feedback`)

**Route:** `/feedback` — public, no auth required  
**File:** `src/pages/Feedback.jsx`

**Form fields:**
- Name — optional text input
- Email — optional email input
- Phone — optional tel input
- Star ratings (1–5, all optional):
  - Idea (concept)
  - UI
  - Theme
  - Security
  - Ease of Use
  - Performance
  - Overall
- Message — required textarea ("Tell us anything else...")
- Submit button

**Star rating UI:** 5 clickable stars per category, sky-blue (`#4FA3CE`) when selected, grey when unselected. Hoverable.

**Visual style:** Matches Login.jsx — white card, `#fafafc` background, sky-blue accent, SF Pro font stack.

**On submit:** Insert row into Supabase `feedback` table → replace form with "Thank you!" confirmation message.

**Link from Login:** Small `"Share feedback"` link added below the "Create one" link in [Login.jsx](../../frontend/src/pages/Login.jsx).

---

## 4. Beta Banner (all pages)

**Component:** `src/components/BetaBanner.jsx`  
**Placement:** Rendered once at the top of the layout in `App.jsx`, above all page content.

**Content:**
> "ToWin is in beta — your feedback helps us improve. [Give Feedback →]"

- Sky-blue background, white text, full-width
- "×" dismiss button on the right
- Dismissed state stored in `localStorage` key `towin_beta_banner_dismissed` — does not reappear after dismiss
- "Give Feedback →" link navigates to `/feedback`

---

## 5. Floating Feedback Button (all pages)

**Component:** `src/components/FeedbackWidget.jsx`  
**Placement:** Fixed position, bottom-right corner, z-index above page content, rendered in `App.jsx`.

**Appearance:** Sky-blue pill button, "Give Feedback" label with a pencil icon (lucide-react `Pencil` icon). Navigates to `/feedback` on click.

**Excluded on:** `/feedback` page itself (no point showing it there).

---

## 6. Admin Feedback Tab

**File:** `src/pages/Admin.jsx` (existing file, add new tab)

**Tab label:** "Feedback"

**Content — summary row at top:**
Average star rating per category displayed as: `Idea: 4.2 ⭐  UI: 3.8 ⭐  ...`  
Only averages for submissions that include each rating (nulls excluded).

**Content — submissions table:**
Columns: Date | Name | Email | Phone | Idea | UI | Theme | Security | Ease | Perf | Overall | Message  
Sorted by newest first.  
Empty cells shown as `—` for null ratings/contact fields.

**Data fetching:** Uses `supabaseAdmin.js` (service role key) to `SELECT * FROM feedback ORDER BY created_at DESC`. Only rendered when admin is authenticated.

---

## 7. Creator Contact Card (top of `/feedback` page)

A "Meet the Creator" card displayed **above the feedback form** to give context on who built the app and how to reach them directly.

**Content:**
- Name: Harshavardhan Anbuchezhian Gowri (Harsha)
- Title: Full-Stack Engineer
- Education: Master's in Applied Computer Science, Concordia University, Montreal
- Tagline (two lines):
  - Line 1 (bold note): "This isn't a university project — ToWin is my future startup. I'm building something real, and your feedback is what shapes it."
  - Line 2: "Fill in the form below, or drop your feedback directly on any of my socials. Love the idea? Want to connect or collaborate? Let's connect!"
- Email: agharsha.anbu@gmail.com
- Phone/WhatsApp: +1 438-535-5782 (shown with a WhatsApp link: `https://wa.me/14385355782`)
- Location: Montreal, Quebec, Canada
- LinkedIn: https://www.linkedin.com/in/harsha-anbu-gowri/
- GitHub: https://github.com/Harsha-anbu-g
- Instagram: https://www.instagram.com/harsha._.ag
- Portfolio: https://portfolioharsha.vercel.app/

**UI:** Compact card in the same white-card style as the form. Social links shown as icon + text rows (lucide-react icons: `Mail`, `Phone`, `MapPin`, `Linkedin`, `Github`, `Instagram`, `Globe`). All links open in a new tab.

---

## 8. Routing

Add `/feedback` to `App.jsx` router. No auth guard — publicly accessible.

---

## 9. Environment Variables

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SUPABASE_SERVICE_KEY=...   # service role, only used in admin panel
```

---

## What is NOT in scope

- Email notifications (admin checks feedback in-app instead)
- Backend Spring Boot changes (frontend-only Supabase integration)
- Pagination on admin feedback table (can add later if volume grows)
