import { describe, it, expect } from 'vitest';
import { shouldSendToApp } from './PhoneAppRedirect';

// Real user-agent strings, not fabricated ones — the whole feature is a
// user-agent decision, so the tests must use the strings that actually arrive.
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
// Googlebot's smartphone crawler deliberately impersonates an Android phone.
// If it is ever handed the app (which is noindex), towinly.com falls out of
// Google — this is the single most expensive mistake this file could make.
const GOOGLEBOT_PHONE =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BINGBOT_PHONE =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';

describe('shouldSendToApp — the landing page', () => {
  it('sends a phone on the front page into the app landing story', () => {
    expect(shouldSendToApp('/', IPHONE, '')).toBe(true);
    expect(shouldSendToApp('/', ANDROID_PHONE, '')).toBe(true);
  });

  it('never sends a search crawler, even one wearing a phone user-agent', () => {
    expect(shouldSendToApp('/', GOOGLEBOT_PHONE, '')).toBe(false);
    expect(shouldSendToApp('/', BINGBOT_PHONE, '')).toBe(false);
  });

  it('leaves laptops and tablets on the website', () => {
    expect(shouldSendToApp('/', DESKTOP, '')).toBe(false);
    expect(shouldSendToApp('/', ANDROID_TABLET, '')).toBe(false);
  });

  it('honours the "Use the full website" cookie on the front page too', () => {
    expect(shouldSendToApp('/', IPHONE, 'towinly_web=1')).toBe(false);
  });
});

describe('shouldSendToApp — everything already decided stays decided', () => {
  it('still sends phones from the signed-in pages', () => {
    expect(shouldSendToApp('/login', IPHONE, '')).toBe(true);
    expect(shouldSendToApp('/messages/42', ANDROID_PHONE, '')).toBe(true);
  });

  it('crawlers are also kept off the signed-in pages, keeping /login indexable', () => {
    expect(shouldSendToApp('/login', GOOGLEBOT_PHONE, '')).toBe(false);
  });

  it('keeps the content pages on the website for phones', () => {
    for (const page of ['/how-it-works', '/privacy', '/terms', '/feedback', '/admin']) {
      expect(shouldSendToApp(page, IPHONE, '')).toBe(false);
    }
  });
});
