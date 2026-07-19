import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/useToast';

const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
// Backend TrustLevel values: MESSAGING = 1 — the inheritance unlock
// (user decision 2026-07-19: family can chat when the elder can).
const MESSAGING_STAGE = 1;

/* Trust inheritance: the parent's earned trust is the bridge. When the elder's
   friendship is shared and has reached Messaging, the family member holds the
   same standing — they can message the helper directly, no request, no accept.
   The family member stays in control on their side: pause or remove it. */
export default function FamilyHelperConnect({ helper, standing, standingsLoaded = true, elderName, onChanged }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const firstName = (helper.helperName || '').split(' ')[0];
  const parent = elderName || 'your parent';

  // Below Messaging there is nothing to inherit yet — say what unlocks it.
  if (helper.stageIndex < MESSAGING_STAGE) {
    return (
      <p style={{ fontSize: '14px', color: 'var(--ink-3)', fontFamily: SFText, margin: '10px 0 0', lineHeight: 1.5 }}>
        Family chat opens when {parent} and {firstName} reach Messaging — they&apos;re still at the first step.
      </p>
    );
  }

  async function call(path, okMessage) {
    setBusy(true);
    try {
      await api.post(path);
      if (okMessage) toast.success(okMessage);
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'That didn’t work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Standings haven't finished loading (or the fetch failed) — say nothing rather
  // than falsely claim the person removed a connection they never touched.
  if (!standing && !standingsLoaded) return null;

  // Shared and high enough, but no standing: the family member removed it.
  if (!standing) {
    return (
      <p style={{ fontSize: '14px', color: 'var(--ink-3)', fontFamily: SFText, margin: '10px 0 0', lineHeight: 1.5 }}>
        You removed this connection.{' '}
        <button
          type="button"
          disabled={busy}
          onClick={() => call(`/family/standings/${helper.connectionId}/resume`, 'Connection restored.')}
          style={{
            background: 'transparent', border: 'none', padding: '10px 6px', minHeight: '44px',
            color: 'var(--blue-deep)', fontSize: '14px', fontWeight: 600, fontFamily: SFText,
            cursor: busy ? 'default' : 'pointer', textDecoration: 'underline',
          }}
        >
          Bring it back
        </button>
      </p>
    );
  }

  if (standing.paused) {
    return (
      <div style={{ margin: '10px 0 0' }}>
        <p style={{ fontSize: '14px', color: 'var(--ink-3)', fontFamily: SFText, margin: 0, lineHeight: 1.5 }}>
          You paused this chat — neither of you can send messages until you resume it.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => call(`/family/standings/${standing.standingConnectionId}/resume`, 'Chat resumed.')}
          style={{
            marginTop: '8px', background: 'transparent', color: 'var(--blue-deep)',
            border: '1.5px solid var(--blue-soft)', borderRadius: '9999px',
            padding: '10px 18px', minHeight: '44px',
            fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: SFText,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          }}
        >
          Resume
        </button>
      </div>
    );
  }

  async function message() {
    if (standing.chatConnectionId) {
      navigate(`/messages/${standing.chatConnectionId}`);
      return;
    }
    setBusy(true);
    try {
      const r = await api.post(`/family/standings/${standing.standingConnectionId}/chat`);
      navigate(`/messages/${r.data}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not open the chat. Please try again.');
      setBusy(false);
    }
  }

  async function remove() {
    const sure = window.confirm(
      `Remove your connection with ${firstName}? You can bring it back later from this card.`
    );
    if (!sure) return;
    await call(`/family/standings/${standing.standingConnectionId}/revoke`, 'Connection removed.');
  }

  return (
    <div style={{ margin: '10px 0 0' }}>
      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green-deep)', fontFamily: SFText, margin: 0, lineHeight: 1.5 }}>
        You hold {parent}&apos;s trust with {firstName} — you can message them directly.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
        <button
          type="button"
          onClick={message}
          disabled={busy}
          style={{
            background: 'var(--action-fill, var(--blue-deep))', color: '#fff',
            border: 'none', borderRadius: '9999px',
            padding: '10px 20px', minHeight: '44px',
            fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: SFText,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Opening…' : `Message ${firstName}`}
        </button>
        <button
          type="button"
          onClick={() => call(`/family/standings/${standing.standingConnectionId}/pause`, 'Chat paused.')}
          disabled={busy}
          style={{
            background: 'transparent', border: 'none', padding: '10px 8px', minHeight: '44px',
            color: 'var(--ink-3)', fontSize: '14px', fontWeight: 600, fontFamily: SFText,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          Pause
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          style={{
            background: 'transparent', border: 'none', padding: '10px 8px', minHeight: '44px',
            color: 'var(--ink-3)', fontSize: '14px', fontWeight: 600, fontFamily: SFText,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          Remove
        </button>
      </div>
      <p style={{ fontSize: '14px', color: 'var(--ink-3)', fontFamily: SFText, margin: '8px 0 0', lineHeight: 1.5 }}>
        {parent} always sees that you two can talk. If they stop sharing this friendship, the chat closes.
      </p>
    </div>
  );
}
