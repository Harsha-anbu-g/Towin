import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import LanguageRoot from './components/LanguageRoot.jsx'
import { posthogOptions } from './lib/analytics'
import { loadStartLanguage } from './i18n'

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY

// When no key is configured (e.g. local dev without analytics) we render the
// app without the provider so nothing is sent and the app still works.
const tree = posthogKey
  ? (
      <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
        <LanguageRoot />
      </PostHogProvider>
    )
  : <LanguageRoot />

// A French or Tamil reader's dictionary arrives before the first paint, so the
// site never flashes English at them. If it cannot be fetched, English it is.
loadStartLanguage().then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {tree}
    </StrictMode>,
  )
})
