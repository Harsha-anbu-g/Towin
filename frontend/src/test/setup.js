import '@testing-library/jest-dom/vitest'
import { __setLanguageForTests, loadLanguage } from '../i18n'

// Tests read English copy, whatever language the machine running them speaks.
// Both dictionaries are loaded up front so a test can switch synchronously.
__setLanguageForTests('en')
await Promise.all([loadLanguage('fr'), loadLanguage('ta')])

// jsdom has no ResizeObserver; SmoothInput needs one to mount.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom implements neither scrollTo nor scrollIntoView on elements.
if (typeof window !== 'undefined') {
  if (!window.HTMLElement.prototype.scrollTo) {
    window.HTMLElement.prototype.scrollTo = () => {}
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {}
  }
}
