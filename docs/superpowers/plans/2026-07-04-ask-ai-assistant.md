# Ask AI — in-app help assistant ("Tortoise")

**Date:** 2026-07-04
**Status:** Implemented

## Goal

A calm, always-available help assistant branded as ToWin's tortoise, shown as a
floating **"Ask AI"** button in the bottom-right corner. It answers any question a
user has about ToWin — how to use it, what features mean — and, for logged-in
users, personal questions like *"what is my trust score?"* using their own data.

Powered by the **Groq** free API (OpenAI-compatible). The AI provider is never
shown to users; the assistant is branded entirely as ToWin's tortoise.

## Key decisions

- **Model:** `openai/gpt-oss-20b` by default (fast, free-tier friendly). Configurable
  via `GROQ_MODEL`. Avoids `llama-3.3-70b`/`llama-3.1-8b`, which Groq is deprecating
  (June 2026).
- **Auth:** endpoint is public (`/api/assistant/**` → `permitAll`), IP rate-limited
  like `/api/feedback`. If a JWT is present, the request is personalized; if not, it
  answers general questions. New/logged-out visitors are exactly who need help most.
- **Knowledge is curated, not a raw dump.** The bot is grounded in a hand-written
  product knowledge base (`resources/assistant/knowledge.md`) built from the
  authoritative `guideContent.jsx`, the real feature code/enums, and `how-to-use.txt`.
  **Security audit reports, personal interview/study docs, internal engineering
  plans, and deployment docs are deliberately excluded** — feeding those into a
  user-facing bot would leak the security posture and private material.
- **Personal data is minimal + own-only.** For logged-in users we send a small,
  non-identifying summary (first name, role, trust score + tier, verification status,
  city, current/best streak, active-connection count, open-request count). Never
  another user's data, never emails/phones/addresses/message contents.

## Backend (`com.towin.assistant`)

- `dto/ChatMessage` — `{ role, content }` (role: user|assistant).
- `dto/ChatRequest` — `{ message (required, ≤1000 chars), history (≤12) }`.
- `dto/ChatResponse` — `{ reply }`.
- `service/GroqClient` — `RestClient` (mirrors `GeocodingService`): short-ish
  timeouts, POSTs `/chat/completions`, returns `choices[0].message.content`; any
  failure → empty/fallback, logged. Never throws to the user.
- `service/AssistantService` — assembles system prompt (persona + knowledge) +
  optional personal-context block, appends capped history + the new message, calls
  `GroqClient`. Personalization pulls from `ProfileService`, `StreakService`,
  `ConnectionRepository`, `NeedRepository`, wrapped in try/catch so a missing
  profile never breaks chat.
- `controller/AssistantController` — `POST /api/assistant/chat`, public,
  `IpRateLimiter.check`, reads `Authentication` if present (nullable).
- `resources/assistant/system-prompt.txt` — tortoise persona, simple-words rule,
  short answers, never invent features, safety/emergency + no medical/legal/financial
  advice, unknown → point to Feedback button.
- `resources/assistant/knowledge.md` — curated product facts.
- Config: `groq:` block in `application.yml` (`api-key`, `base-url`, `model`,
  `enabled`); `GROQ_API_KEY=` added to `.env.example`.
- `SecurityConfig`: `.requestMatchers("/api/assistant/**").permitAll()`.
- `NeedRepository`: add `countByElderIdAndStatus`.

## Frontend

- `components/AskAiAssistant.jsx` — floating "Ask AI" FAB (turtle mascot) →
  opens a calm chat panel: header, scrolling messages, typing indicator, 3 starter
  suggestion chips, input + send. Uses `api.post('/assistant/chat', ...)`; the axios
  interceptor attaches the JWT automatically so logged-in users get personalized
  answers with no extra work. Theme colors only, ≥16px text, framer-motion for a
  gentle open. Hidden on the active chat thread (`/messages/:id`) and `/feedback`.
- `App.jsx` — mount once next to `FeedbackWidget`.
- `index.css` — stack the Feedback FAB above the Ask AI FAB (Ask AI is primary
  bottom-right).

## Cost & safety

Free Groq tier + per-IP rate limit + capped history/message length keep cost at $0.
Key lives only in `GROQ_API_KEY` (Railway env / local `.env`), never in code.
