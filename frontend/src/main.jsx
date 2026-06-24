import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import App from './App.jsx'

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY

const posthogOptions = {
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
  // Session replay on, but never record what users type (messages, emails,
  // passwords) — we still see clicks, scrolls and navigation.
  session_recording: {
    maskAllInputs: true,
    // Stop capturing frames after 2 min of no interaction (default is 5 min),
    // so we don't fill the database with a frozen, blank screen. Must stay
    // lower than session_idle_timeout_seconds * 1000.
    session_idle_threshold_ms: 1000 * 60 * 2,
  },
}

// When no key is configured (e.g. local dev without analytics) we render the
// app without the provider so nothing is sent and the app still works.
const tree = posthogKey
  ? (
      <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
        <App />
      </PostHogProvider>
    )
  : <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {tree}
  </StrictMode>,
)
