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
    expect(vercelConfig.rewrites).toEqual([
      { source: '/(.*)', destination: '/index.html' },
    ]);
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
