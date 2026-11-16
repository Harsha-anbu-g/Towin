import { useEffect, useState } from 'react';
import api from '../api/axios';
import { tr } from '../i18n';

const SF = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const STORAGE_KEY = 'towinly_trust_rule_explained';

/* The one-time note about when points count (trust tiers step 1): a friendship
   adds to the score once the elder has ended a help between the two. It shows
   only when the server speaks that rule, which it does by sending `counted` on
   a friendship card; an older server sends none and the note stays away. One
   flag for every place it is mounted (the dashboards and the Trust Score
   page), so "Got it" on one puts all of them away.

   customers: the friendship cards of GET /trust/my-score when the page already
   has them. Left out, the note loads them itself, and only while it has not
   been dismissed. onSeeScore: when given, the note carries a "See your score"
   link. */
export default function TrustRuleNote({ customers, onSeeScore }) {
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'true');
  const [loaded, setLoaded] = useState(null);
  const needsLoad = visible && customers === undefined;

  useEffect(() => {
    if (!needsLoad) return undefined;
    let alive = true;
    api.get('/trust/my-score')
      .then((r) => { if (alive) setLoaded(r?.data?.customers ?? []); })
      // A note that explains a score is no use without the score: on a failed
      // load it stays away, and the Trust Score page still carries it.
      .catch(() => { if (alive) setLoaded([]); });
    return () => { alive = false; };
  }, [needsLoad]);

  const cards = customers ?? loaded ?? [];
  if (!visible || !cards.some((c) => typeof c.counted === 'boolean')) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };
  const pill = {
    borderRadius: '9999px', padding: '10px 22px', minHeight: '44px',
    fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: SF, cursor: 'pointer',
  };
  return (
    <div style={{
      background: 'var(--canvas)', border: '1px solid var(--border)', borderRadius: '18px',
      padding: '18px 20px', marginBottom: '16px',
    }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', fontWeight: 400, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
        {tr('Points count after a help is finished')}
      </h2>
      <p style={{ fontFamily: SF, fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '0 0 12px', lineHeight: 1.5 }}>
        {tr('A friendship adds to your score once a help between you two is finished. If your score went down, this is why.')}
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {onSeeScore && (
          <button onClick={onSeeScore} style={{ ...pill, background: 'transparent', color: 'var(--blue-deep)', border: 'none', padding: '10px 6px' }}>
            {tr('See your score')}
          </button>
        )}
        <button onClick={dismiss} style={{ ...pill, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--border)' }}>
          {tr('Got it')}
        </button>
      </div>
    </div>
  );
}
