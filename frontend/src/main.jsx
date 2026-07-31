import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import App from './App.jsx'
import { posthogOptions } from './lib/analytics'

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY

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
