// Sends phones from the signed-in pages into the app half of the site.
//
// The CDN rule in vercel.json cannot do this on its own. This is a react-router
// SPA: tapping "Log in" is a pushState, so NO HTTP REQUEST REACHES VERCEL and no
// server rule can fire. The CDN covers cold loads, bookmarks and emailed links;
// this covers every navigation inside the site. Both layers use the same
// user-agent test and the same escape-hatch cookie, so they can never disagree.
// The decision itself lives in phoneAppRouting.js.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { shouldSendToApp } from './phoneAppRouting';

export default function PhoneAppRedirect() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!shouldSendToApp(pathname, navigator.userAgent, document.cookie)) return;
    // replace(), not assign(): the page being left is one the phone should
    // never see, so it must not sit in the history stack for Back to land on.
    // The front page maps to /app itself, not /app/ — the vercel.json proxy
    // names /app and /app/:path* as its two sources.
    const target = pathname === '/' ? '/app' : `/app${pathname}`;
    window.location.replace(`${target}${search}`);
  }, [pathname, search]);

  return null;
}
