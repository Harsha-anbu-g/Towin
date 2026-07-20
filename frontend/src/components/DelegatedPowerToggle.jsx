import { useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/useToast';

const SFT = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

/* Same motion rule and geometry as FamilyShareToggle: <300ms, custom curve,
   transform only (the knob slides), reduced motion → shorter, not zero. */
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * Guardian mode — the parent decides, one thing at a time, what a family member
 * may do for them.
 *
 * Written as a list so the remaining powers drop in without new UI. Each switch
 * sends the WHOLE set the parent wants to keep, matching the endpoint's replace
 * semantics: an unticked power is simply absent, so nothing is left half-on.
 */
const POWERS = [
  {
    key: 'MESSAGE_HELPERS',
    title: 'Write to your helpers for you',
    on: name => `${name} can write in your chats. Your helper always sees the message came from ${name}, writing for you.`,
    off: name => `Off. ${name} cannot open or write in your chats.`,
  },
  {
    key: 'MANAGE_HELP_REQUESTS',
    title: 'Ask for help for you',
    on: name => `${name} can ask for help for you, and close a request you no longer need. Helpers always see ${name} asked for you.`,
    off: name => `Off. ${name} can see your help requests but cannot change them.`,
  },
  {
    key: 'ADVANCE_TRUST',
    title: 'Move a friendship forward for you',
    on: name => `${name} can take your next step with a helper. The step still counts as yours, and your helper sees ${name} took it for you.`,
    off: name => `Off. ${name} can watch how a friendship is going but cannot move it on.`,
  },
  {
    key: 'LEAVE_REVIEWS',
    title: 'Leave a review for you',
    on: name => `${name} can rate a helper you fully trust. The review is yours, with ${name}'s name on it as the person who wrote it.`,
    off: name => `Off. ${name} cannot leave a review for you.`,
  },
];

export default function DelegatedPowerToggle({ linkId, familyName, powers = [], onSaved }) {
  const { toast } = useToast();
  const [granted, setGranted] = useState(() => new Set(powers));
  const [savingKey, setSavingKey] = useState(null);

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const knobTransition = `transform ${reduceMotion ? 60 : 160}ms ${EASE}`;

  const name = familyName || 'They';

  const flip = async (key) => {
    if (savingKey) return;
    const next = new Set(granted);
    if (next.has(key)) next.delete(key); else next.add(key);
    const previous = granted;
    setGranted(next); // optimistic — rolled back on failure
    setSavingKey(key);
    try {
      const { data } = await api.put(`/family/links/${linkId}/powers`, { powers: [...next] });
      // Trust the server's answer over our guess: it is the record that decides.
      setGranted(new Set(data?.delegatedPowers || []));
      onSaved?.(data);
    } catch {
      setGranted(previous);
      toast.error("Couldn't save that change. Please try again.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div style={{ marginTop: '14px' }}>
      <p style={{
        fontSize: '16px', fontWeight: 600, color: 'var(--ink)', fontFamily: SFT,
        margin: '0 0 2px',
      }}>
        Act for me
      </p>
      <p style={{
        fontSize: '14px', color: 'var(--ink-slate)', fontFamily: SFT,
        margin: '0 0 8px', lineHeight: 1.4,
      }}>
        Watching lets {name} see. These let {name} act. Each one stays off until you
        turn it on, and their name is always on whatever they do.
      </p>

      {POWERS.map(p => {
        const isOn = granted.has(p.key);
        const busy = savingKey === p.key;
        return (
          <button
            key={p.key}
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={`${p.title} — ${name}`}
            onClick={() => flip(p.key)}
            disabled={busy}
            style={{
              display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
              gap: '12px', minHeight: '44px', padding: '10px 12px',
              background: 'none', border: '1px solid var(--sky-line-2)', borderRadius: '12px',
              cursor: busy ? 'wait' : 'pointer', fontFamily: SFT, textAlign: 'left',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>
                {p.title}
              </span>
              <span style={{ display: 'block', fontSize: '14px', color: 'var(--ink-slate)', lineHeight: 1.4, marginTop: '2px' }}>
                {isOn ? p.on(name) : p.off(name)}
              </span>
            </span>
            <span aria-hidden="true" style={{
              display: 'inline-flex', alignItems: 'center', flexShrink: 0,
              width: 40, height: 24, padding: 3, borderRadius: 9999, boxSizing: 'content-box',
              background: isOn ? 'var(--blue)' : 'var(--slate-soft)',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', background: 'var(--canvas)',
                transform: isOn ? 'translateX(16px)' : 'translateX(0)',
                transition: knobTransition,
              }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
