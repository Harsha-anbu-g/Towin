import { useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/useToast';

const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
// Backend TrustLevel values: FIRST_MEET = 5 — same unlock as the updates thread.
const FIRST_MEET_STAGE = 5;

/* Step 4: a family member may connect directly with a helper their parent
   shared, once that friendship reached Ready to Meet. The helper decides;
   the parent always sees that the two are connected. */
export default function FamilyHelperConnect({ helper, myConnection, onChanged }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  if (helper.stageIndex < FIRST_MEET_STAGE) return null;

  const firstName = (helper.helperName || '').split(' ')[0];
  const status = myConnection?.status;

  if (status === 'ACTIVE') {
    return (
      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--green-deep)', fontFamily: SFText, margin: '10px 0 0' }}>
        You and {firstName} are connected.
      </p>
    );
  }
  if (status === 'PENDING') {
    return (
      <p style={{ fontSize: '14px', color: 'var(--ink-3)', fontFamily: SFText, margin: '10px 0 0', lineHeight: 1.5 }}>
        Waiting for {firstName} to say yes — that&apos;s their choice to make.
      </p>
    );
  }
  // Declined or ended: stay quiet — no pressure on the helper.
  if (status === 'DECLINED' || status === 'ENDED') return null;

  async function connect() {
    setSending(true);
    try {
      await api.post('/family/helper-connections', { connectionId: helper.connectionId });
      toast.success(`Request sent. ${firstName} decides, and your parent can always see that you two are connected.`);
      if (onChanged) onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send the request. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ margin: '10px 0 0' }}>
      <button
        type="button"
        onClick={connect}
        disabled={sending}
        style={{
          background: 'transparent', color: 'var(--blue-deep)',
          border: '1.5px solid var(--blue-soft)', borderRadius: '9999px',
          padding: '10px 18px', minHeight: '44px',
          fontSize: 'var(--text-sm)', fontWeight: 600, fontFamily: SFText,
          cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1,
        }}
      >
        {sending ? 'Sending…' : `Connect with ${firstName}`}
      </button>
      <p style={{ fontSize: '14px', color: 'var(--ink-3)', fontFamily: SFText, margin: '8px 0 0', lineHeight: 1.5 }}>
        You two can build trust step by step. Your parent always sees that you&apos;re connected.
      </p>
    </div>
  );
}
