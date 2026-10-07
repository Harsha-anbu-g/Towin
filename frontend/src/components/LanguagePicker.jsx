// Choosing the site's language: English, Français or தமிழ். Each language is
// written in its own words, so somebody who cannot read the current one can
// still find theirs. Same picker as the iPhone app's.
//
// It sits at the top of the log-in and sign-up pages, where a person may need
// their language before anything else, and in the account menu once signed in.
// The choice applies at once (main.jsx repaints the whole site) and is
// remembered in this browser.
import { Globe } from 'lucide-react';
import { LANGUAGES, setLanguage, tr, useLanguage } from '../i18n';

const SF = '-apple-system, "SF Pro Text", system-ui, sans-serif';

export default function LanguagePicker({ style, align = 'center' }) {
  const lang = useLanguage();
  return (
    <div
      role="radiogroup"
      aria-label={tr('Language')}
      style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px',
        justifyContent: align === 'start' ? 'flex-start' : 'center',
        ...style,
      }}
    >
      <Globe size={16} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--ink-slate)', marginRight: '4px' }} />
      {LANGUAGES.map(({ code, label }) => {
        const on = code === lang;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={on}
            lang={code}
            onClick={() => setLanguage(code)}
            style={{
              minHeight: '44px', padding: '0 12px', borderRadius: '9999px',
              border: 'none', cursor: 'pointer', fontFamily: SF, fontSize: '15px',
              fontWeight: on ? 600 : 400,
              color: on ? 'var(--ink)' : 'var(--ink-slate)',
              background: on ? 'var(--surface)' : 'transparent',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
