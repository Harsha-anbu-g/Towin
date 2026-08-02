import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';

// The Spring filter chain's security headers only decorate backend API responses
// on the Railway origin. The HTML document — the only place clickjacking and CSP
// actually bite — is served by Vercel, so the same policy has to be declared in
// vercel.json. These tests pin that policy, and pin it against the things the SPA
// genuinely loads: a CSP that is too strict ships a white screen.
const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readFrontendFile = (name) => readFileSync(path.join(frontendDir, name), 'utf8');

const vercelConfig = JSON.parse(readFrontendFile('vercel.json'));

const allRoutesHeaders = () =>
  (vercelConfig.headers ?? []).find((entry) => entry.source === '/(.*)');

const headerValue = (key) =>
  (allRoutesHeaders()?.headers ?? []).find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

/** Pull one directive out of a CSP string, e.g. "img-src" -> ["'self'", "data:"]. */
const cspDirective = (name) => {
  const csp = headerValue('Content-Security-Policy') ?? '';
  const directive = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  return directive ? directive.split(/\s+/).slice(1) : [];
};

describe('vercel.json security headers', () => {
  it('applies a headers block to every route', () => {
    // Arrange / Act
    const entry = allRoutesHeaders();

    // Assert
    expect(entry, 'vercel.json must declare a headers block for /(.*)').toBeDefined();
  });

  it('keeps the SPA rewrite so deep links still resolve to index.html', () => {
    // It must be LAST: Vercel stops at the first matching rewrite, so a
    // catch-all above the /app proxy would swallow every app request.
    expect(vercelConfig.rewrites.at(-1)).toEqual({
      source: '/(.*)',
      destination: '/index.html',
    });
  });

  it.each([
    ['X-Frame-Options', 'DENY'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ])('mirrors the backend %s header', (key, expected) => {
    expect(headerValue(key)).toBe(expected);
  });

  it('mirrors the backend HSTS policy (1 year, includeSubDomains)', () => {
    const hsts = headerValue('Strict-Transport-Security') ?? '';
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('sends a Permissions-Policy that denies camera and microphone', () => {
    const policy = headerValue('Permissions-Policy') ?? '';
    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=()');
  });

  it('blocks framing via CSP frame-ancestors, matching the backend', () => {
    expect(cspDirective('frame-ancestors')).toEqual(["'none'"]);
    expect(cspDirective('default-src')).toEqual(["'self'"]);
  });
});

describe('vercel.json /app proxy', () => {
  it('proxies /app into the Expo app project, prefix stripped', () => {
    // A rewrite is a server-side proxy, so the address bar keeps saying
    // towinly.com. The app project serves its files at its own root, which is
    // why :path* is passed through without the /app prefix.
    const proxied = vercelConfig.rewrites.filter((r) => r.source.startsWith('/app'));
    expect(proxied).toHaveLength(2);
    for (const rule of proxied) {
      expect(rule.destination).toMatch(/^https:\/\//);
      expect(rule.destination).not.toContain('/app/');
    }
  });

  it('keeps the app half out of Google, so only towinly.com is indexed', () => {
    const appHeaders = (vercelConfig.headers ?? []).find((h) => h.source === '/app/:path*');
    expect(appHeaders?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex' });
  });
});

// The phone redirect is the piece that can take the marketing site down, so it
// gets its own suite. Every rule is checked, not just the first.
describe('vercel.json phone redirect', () => {
  const redirects = vercelConfig.redirects ?? [];

  it('sends phones from the signed-in pages into the app', () => {
    expect(redirects.length).toBeGreaterThan(0);
    for (const rule of redirects) {
      expect(rule.destination.startsWith('/app')).toBe(true);
    }
  });

  it('is a 307, never a 308 — a 308 is cached forever and blocks rollback', () => {
    for (const rule of redirects) {
      expect(rule.permanent).toBe(false);
    }
  });

  it('never redirects a path that could be a file', () => {
    // THE trap: redirecting /assets/index-abc123.js would white-screen the
    // marketing site on every phone — the page loads and its own JavaScript is
    // answered with an HTML redirect. Each rule must either name its routes
    // explicitly or restrict the dynamic segment to [^/.]+, which excludes dots.
    for (const rule of redirects) {
      const dynamic = rule.source.match(/:[A-Za-z]+(\([^)]*\))?/g) ?? [];
      for (const segment of dynamic) {
        expect(segment, `${rule.source} must constrain ${segment}`).toMatch(/\(.+\)/);
        if (!segment.includes('|')) expect(segment).toContain('[^/.]+');
      }
    }
  });

  it('only fires for phones — tablets and laptops are untouched', () => {
    for (const rule of redirects) {
      const ua = rule.has?.find((h) => h.type === 'header' && h.key === 'user-agent');
      expect(ua, `${rule.source} must test the user agent`).toBeDefined();
      expect(ua.value).toContain('iphone');
      expect(ua.value).toContain('android.*mobile'); // Android tablets omit "Mobile"
      expect(ua.value).not.toContain('ipad');
    }
  });

  it('honours the "Use the full website" cookie', () => {
    // Without this, someone who asked for the website would be redirected
    // straight back out of it on the next tap.
    for (const rule of redirects) {
      expect(rule.missing).toContainEqual({ type: 'cookie', key: 'towinly_web' });
    }
  });

  it('sends phones on the front page into the app, but never a crawler', () => {
    // Googlebot's smartphone crawler wears an Android phone user-agent, and
    // /app/* is noindex — without the crawler guard, adding this rule would
    // drop towinly.com out of Google.
    const landing = redirects.find((r) => r.source === '/');
    expect(landing, 'the landing redirect must exist').toBeDefined();
    expect(landing.destination).toBe('/app');

    const botGuard = (landing.missing ?? []).find(
      (m) => m.type === 'header' && m.key === 'user-agent',
    );
    expect(botGuard, 'the landing redirect must exclude crawlers').toBeDefined();
    const GOOGLEBOT_PHONE =
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    const IPHONE =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    // Vercel compiles `(?i)` inline flags; JS RegExp does not — strip it and
    // pass the flag explicitly instead.
    const guard = new RegExp(botGuard.value.replace(/^\(\?i\)/, ''), 'i');
    expect(guard.test(GOOGLEBOT_PHONE)).toBe(true); // crawler matches the guard → rule skipped
    expect(guard.test(IPHONE)).toBe(false); // a real phone sails through
  });

  it('every phone redirect carries the crawler guard, keeping both layers in step', () => {
    for (const rule of redirects) {
      const botGuard = (rule.missing ?? []).find(
        (m) => m.type === 'header' && m.key === 'user-agent',
      );
      expect(botGuard, `${rule.source} must exclude crawlers`).toBeDefined();
    }
  });

  it('leaves the marketing pages on the website for everyone', () => {
    // These are the pages Google indexes and the ones a new visitor meets.
    const stays = [
      '/how-it-works', '/privacy', '/terms', '/feedback',
      '/verify-email', '/reset-password', '/admin',
    ];
    const named = redirects.map((r) => r.source);
    for (const page of stays) {
      expect(named).not.toContain(page);
      const route = page.replace(/^\//, '');
      if (!route) continue;
      // ...and no rule names it inside an alternation either
      for (const source of named) {
        expect(source).not.toMatch(new RegExp(`[(|]${route}[)|]`));
      }
    }
  });
});

// A CSP that forgets an origin the app really uses breaks the live site, which is
// worse than having no CSP at all. Every origin below was traced from the source
// and from the built bundle.
describe('vercel.json CSP allows every origin the SPA actually uses', () => {
  it('allows the Railway API origin baked into the production build', () => {
    const apiBaseUrl = readFrontendFile('.env.production')
      .match(/^VITE_API_BASE_URL=(.+)$/m)[1]
      .trim();
    const apiOrigin = new URL(apiBaseUrl).origin;

    expect(cspDirective('connect-src')).toContain(apiOrigin);
  });

  it('allows PostHog for analytics XHR and its lazily loaded recorder script', () => {
    // posthog-js fetches remote config from the api host and, because session
    // replay is on, injects /static/recorder.js from the PostHog assets host.
    expect(cspDirective('connect-src')).toContain('https://*.posthog.com');
    expect(cspDirective('script-src')).toContain('https://*.posthog.com');
  });

  it('allows S3 profile photos to render', () => {
    // S3Service emits https://<bucket>.s3.<region>.amazonaws.com/<key>
    expect(cspDirective('img-src')).toContain('https://*.amazonaws.com');
  });

  it('allows data: and blob: images', () => {
    expect(cspDirective('img-src')).toEqual(expect.arrayContaining(['data:', 'blob:']));
  });

  it('allows the Google Fonts stylesheet and font files used by index.html', () => {
    expect(cspDirective('style-src')).toContain('https://fonts.googleapis.com');
    expect(cspDirective('font-src')).toContain('https://fonts.gstatic.com');
  });

  it("allows Vite's and framer-motion's inline styles", () => {
    expect(cspDirective('style-src')).toContain("'unsafe-inline'");
  });

  it('allows Google OAuth', () => {
    expect(cspDirective('connect-src')).toContain('https://accounts.google.com');
  });

  it('allows blob: workers, which posthog session replay creates', () => {
    expect(cspDirective('worker-src')).toContain('blob:');
  });

  it('does not weaken script-src with unsafe-inline or unsafe-eval', () => {
    expect(cspDirective('script-src')).not.toContain("'unsafe-inline'");
    expect(cspDirective('script-src')).not.toContain("'unsafe-eval'");
  });
});

describe('vercel.json CSP hash for the theme bootstrap script', () => {
  it("whitelists index.html's inline no-flash script by its exact sha256 hash", () => {
    // index.html runs one inline script before first paint so dark-mode users
    // never see a white flash. script-src has no 'unsafe-inline', so it is
    // allowed by hash instead. If someone edits that script and forgets to update
    // vercel.json, the browser silently blocks it — this test fails first.
    const inlineScript = readFrontendFile('index.html').match(/<script>([\s\S]*?)<\/script>/)[1];
    const hash = createHash('sha256').update(inlineScript, 'utf8').digest('base64');

    expect(cspDirective('script-src')).toContain(`'sha256-${hash}'`);
  });
});
