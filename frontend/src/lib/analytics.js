/**
 * How PostHog is set up, and the one part of Towinly it is not allowed to see.
 *
 * <b>Why this is a module and not four lines in main.jsx.</b> The masking rules below are a
 * privacy control on what elderly people write down about their own deaths. A control nobody
 * can write a test against is a comment, so the options live here where `analytics.test.js`
 * can read them, and `main.jsx` does nothing but hand them to the provider.
 *
 * <b>`maskAllInputs` was never enough.</b> It masks what a person types into a field. It does
 * nothing whatever to text already rendered on the page — and a story, a letter and the names
 * of the things in a sealed box are all rendered text. Left as it was, session replay would
 * have produced a video of a woman reading her own last words, held on a third-party service
 * and watchable by anyone with a login to it.
 */

/**
 * The class posthog-js itself looks for. It is not a name of our choosing: session replay
 * blocks any element carrying it (`blockClass`), and autocapture walks up from the clicked
 * element and drops the whole event when it finds it. Renaming it disarms both at once, which
 * is why `analytics.test.js` pins the literal string.
 */
export const NO_CAPTURE = 'ph-no-capture'

/**
 * Where it goes today: the title and body on `PassOnItemCard` and `PassOnReadCard`, and the whole
 * document on `PassOnSheet`. The chips, the buttons and the save row around them are deliberately
 * left unmarked — whether an elder can find [Change] is exactly what replay is for, and none of
 * her words are in the word "Change".
 *
 * Where it must also go, and cannot yet: the screen that shows a revealed sealed item. No such
 * screen exists — there is no HTTP route for a sealed item at all — so the one surface in this
 * feature that displays a decrypted secret is the one surface this marker is not yet on. Whoever
 * builds it puts `className={NO_CAPTURE}` on the revealed text and adds a case to
 * `passOnNoCapture.test.jsx`.
 */

/**
 * Every route this feature lives on. Autocapture is switched off across all of them — not
 * only on the elements holding her words, because an autocaptured click carries the text of
 * whatever was clicked and there is no way to be sure a future control on these pages will
 * not carry a name, a title or a line she wrote.
 *
 * Matched against the full URL, so a query string (`?tab=sealed`) makes no difference.
 */
export const PASS_ON_ROUTES = [
  /\/what-i-pass-on/,
  /\/passed-on\//,
]

export const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  // Auto-captures SPA pageviews on React Router navigation + clicks/forms.
  defaults: '2026-05-30',
  // Only create a person profile once a user logs in (cheaper); anonymous
  // browsing is still captured as events.
  person_profiles: 'identified_only',
  // End the session after 3 min of no activity (default is 30 min). So if a
  // user walks away with the tab open, the recording closes instead of running
  // for an hour — and when they come back it starts a fresh, separate replay
  // rather than one long video with a giant blank gap in the middle.
  session_idle_timeout_seconds: 60 * 3,
  // Clicks and form interactions everywhere except the pages above.
  autocapture: {
    url_ignorelist: PASS_ON_ROUTES,
  },
  // Session replay on, but never record what users type (messages, emails,
  // passwords) — we still see clicks, scrolls and navigation.
  session_recording: {
    maskAllInputs: true,
    // Both halves of the marker, spelled out rather than left to the library's defaults:
    // blockClass drops the element from the recording, maskTextSelector replaces its words.
    // Either alone would do; a control over somebody's last words should not rest on one
    // option being right.
    blockClass: NO_CAPTURE,
    maskTextSelector: `.${NO_CAPTURE}`,
    // Stop capturing frames after 2 min of no interaction (default is 5 min),
    // so we don't fill the database with a frozen, blank screen. Must stay
    // lower than session_idle_timeout_seconds * 1000.
    session_idle_threshold_ms: 1000 * 60 * 2,
  },
}
