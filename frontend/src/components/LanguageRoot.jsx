import App from '../App.jsx';
import { useLanguage } from '../i18n';

// The whole site, keyed on the language, so choosing French or Tamil repaints
// every page at once. The URL and the session (in localStorage) survive the
// remount.
export default function LanguageRoot() {
  const lang = useLanguage();
  return <App key={lang} />;
}
