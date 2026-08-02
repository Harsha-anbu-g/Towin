// Sends phones from the signed-in pages into the app half of the site.
//
// The CDN rule in vercel.json cannot do this on its own. This is a react-router
// SPA: tapping "Log in" is a pushState, so NO HTTP REQUEST REACHES VERCEL and no
// server rule can fire. The CDN covers cold loads, bookmarks and emailed links;
// this covers every navigation inside the site. Both layers use the same
// user-agent test and the same escape-hatch cookie, so they can never disagree.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// iPhone, iPod, and Android *phones*. Tablets are deliberately excluded — that
// matches the app's own supportsTablet: false. Not viewport width: resizing a
// desktop window must not swap the whole application out.
const PHONE = /iPhone|iPod|Android.*Mobile/i;

// The escape hatch. The app writes this cookie from
// Profile → "Use the full website"; once it is set the website behaves exactly
// as it does today on every device.
const OPTED_OUT = /(?:^|;\s*)towinly_web=1(?:;|$)/;

// Kept in step with the redirects in vercel.json. A path is handed to the app
// only if it matches one of these exactly.
const APP_PATHS = [
  /^\/(login|register|dashboard|streaks|messages|trust|profile|family|family-home|game|emergency-contacts)$/,
  /^\/(messages|user)\/[^/.]+$/,
  /^\/profile\/change-password$/,
  /^\/family-home\/parent\/[^/.]+$/,
];

export const shouldSendToApp = (pathname, userAgent, cookie) => {
  if (!PHONE.test(userAgent)) return false;
  if (OPTED_OUT.test(cookie)) return false;
  return APP_PATHS.some((pattern) => pattern.test(pathname));
};

export default function PhoneAppRedirect() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!shouldSendToApp(pathname, navigator.userAgent, document.cookie)) return;
    // replace(), not assign(): the page being left is one the phone should
    // never see, so it must not sit in the history stack for Back to land on.
    window.location.replace(`/app${pathname}${search}`);
  }, [pathname, search]);

  return null;
}
