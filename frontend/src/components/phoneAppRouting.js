// Decides when a phone browsing the website should be handed to the app half
// of the site. Lives outside PhoneAppRedirect.jsx so the component file only
// exports a component (react-refresh rule); the CDN rule in vercel.json and
// this module stay the two layers of the same decision.

// iPhone, iPod, and Android *phones*. Tablets are deliberately excluded — that
// matches the app's own supportsTablet: false. Not viewport width: resizing a
// desktop window must not swap the whole application out.
const PHONE = /iPhone|iPod|Android.*Mobile/i;

// Search crawlers impersonate phones — Googlebot's smartphone crawler carries
// an Android phone user-agent. The app half is noindex, so handing a crawler
// the app would drop towinly.com out of search. Kept in step with the crawler
// guard in vercel.json.
const BOT =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|skypeuripreview|twitterbot|linkedinbot|pinterest|petal|lighthouse/i;

// The escape hatch. The app writes this cookie from
// Profile → "Use the full website"; once it is set the website behaves exactly
// as it does today on every device.
const OPTED_OUT = /(?:^|;\s*)towinly_web=1(?:;|$)/;

// Kept in step with the redirects in vercel.json. A path is handed to the app
// only if it matches one of these exactly.
const APP_PATHS = [
  // The front page: phones meet the app's landing story instead of the
  // website's marketing story (owner's call, 2026-08-02).
  /^\/$/,
  /^\/(login|register|dashboard|streaks|messages|trust|profile|family|family-home|game|emergency-contacts)$/,
  /^\/(messages|user)\/[^/.]+$/,
  /^\/profile\/change-password$/,
  /^\/family-home\/parent\/[^/.]+$/,
];

export const shouldSendToApp = (pathname, userAgent, cookie) => {
  if (!PHONE.test(userAgent)) return false;
  if (BOT.test(userAgent)) return false;
  if (OPTED_OUT.test(cookie)) return false;
  return APP_PATHS.some((pattern) => pattern.test(pathname));
};
