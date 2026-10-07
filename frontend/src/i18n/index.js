// English, French and Tamil for the website, without a library. Same design as
// the iPhone app (ToWin-App src/i18n), so one sentence reads the same on both.
//
// The English sentence IS the key: pages call tr('Log out') and the French or
// Tamil dictionary maps that exact sentence to its translation. A sentence the
// dictionary does not know comes back in English, never a blank or a raw key.
//
// Placeholders are named and written the same in every language:
//   tr('Message {firstName}', { firstName }) → 'Écrire à {firstName}'
//
// The chosen language lives in one module-level variable, so tr() works in
// pages, hooks and plain helper files alike. LanguageRoot keys the app on it, so
// a switch repaints every page at once; the URL and the session survive.
//
// The French and Tamil dictionaries are separate chunks, fetched only when that
// language is chosen, so an English reader never downloads them. main.jsx waits
// for the saved language's dictionary before the first paint.
import { useSyncExternalStore } from 'react';

/** The languages the site offers, each named in its own language. */
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ta', label: 'தமிழ்' },
];

// Its own key, not the app's: the app at /app shares this origin's storage and
// keeps its own choice under 'towinly-app-language'.
export const STORAGE_KEY = 'towinly-language';

const LOADERS = {
  fr: () => import('./fr'),
  ta: () => import('./ta'),
};
const DICTIONARIES = {};
const SUPPORTED = new Set(LANGUAGES.map((l) => l.code));

/** The browser's own language when the site speaks it, English otherwise. */
export function browserLanguage() {
  try {
    const locale = (globalThis.navigator?.language || '').toLowerCase();
    if (locale.startsWith('fr')) return 'fr';
    if (locale.startsWith('ta')) return 'ta';
  } catch {
    // no navigator (tests, server)
  }
  return 'en';
}

function savedLanguage() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    return SUPPORTED.has(saved) ? saved : null;
  } catch {
    return null; // private mode / storage blocked
  }
}

let current = savedLanguage() ?? browserLanguage();
const listeners = new Set();

function applyToDocument(lang) {
  try {
    if (globalThis.document) document.documentElement.lang = lang;
  } catch {
    // no document
  }
}
applyToDocument(current);

/**
 * The sentence in the given language, placeholders filled.
 * @param {string} text the English sentence
 * @param {Record<string, string|number>} [vars]
 * @param {string} [lang]
 */
export function translate(text, vars, lang = current) {
  if (typeof text !== 'string') return text;
  const dict = DICTIONARIES[lang];
  // hasOwnProperty, not ||: a translation can be empty on purpose.
  let out = dict && Object.prototype.hasOwnProperty.call(dict, text) ? dict[text] : text;
  if (vars) {
    out = out.replace(/\{(\w+)\}/g, (whole, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
    );
  }
  return out;
}

/** The sentence in the current language. */
export const tr = (text, vars) => translate(text, vars);

/** The locale for dates and numbers: the browser's for English, the chosen one otherwise. */
export function dateLocale(englishLocale) {
  if (current === 'fr') return 'fr-CA';
  if (current === 'ta') return 'ta-IN';
  return englishLocale;
}

/** 'en', 'fr' or 'ta'. */
export function currentLanguage() {
  return current;
}

/** Fetches a language's dictionary once; English has none to fetch. */
export async function loadLanguage(lang = current) {
  if (!LOADERS[lang] || DICTIONARIES[lang]) return;
  DICTIONARIES[lang] = (await LOADERS[lang]()).default;
}

/** Before the first paint: the saved language's dictionary, or English if it cannot be fetched. */
export async function loadStartLanguage() {
  try {
    await loadLanguage(current);
  } catch {
    current = 'en';
    applyToDocument('en');
  }
}

/**
 * Switches the whole site and remembers the choice in this browser. The switch
 * happens once the dictionary has arrived, so nobody sees a half-translated page.
 * If it cannot be fetched (offline), the site stays as it was.
 */
export async function setLanguage(lang) {
  if (!SUPPORTED.has(lang) || lang === current) return;
  try {
    await loadLanguage(lang);
  } catch {
    return;
  }
  current = lang;
  applyToDocument(lang);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    // storage blocked: the choice holds for this visit only
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current language, re-rendering the caller when it changes. */
export function useLanguage() {
  return useSyncExternalStore(subscribe, currentLanguage, currentLanguage);
}

/** Test seam: force a language without touching storage (load its dictionary first). */
export function __setLanguageForTests(lang) {
  current = SUPPORTED.has(lang) ? lang : 'en';
  listeners.forEach((listener) => listener());
}
