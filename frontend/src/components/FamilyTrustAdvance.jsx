// Guardian mode (ADVANCE_TRUST): the family member takes the parent's next step
// on the trust ladder for them.
//
// The parent keeps their own seat — the step is recorded as theirs, so the
// friendship still belongs to them. What changes is only who tapped, and the
// helper is told that plainly. The server re-checks the parent's grant before
// it accepts the step.
import { useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/useToast';

const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

export default function FamilyTrustAdvance({
  connectionId,
  helperName,
  elderName,
  currentTrustLevel,
  onChanged,
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const parent = elderName || 'your parent';
  const firstName = (helperName || 'them').split(' ')[0];

  // At the top of the ladder there is no next step to take.
  if (!connectionId || currentTrustLevel === 'TRUSTED') return null;

  async function advance() {
    setBusy(true);
    try {
      // No elder id in the body on purpose: the connection already names both
      // seats, so the server works out whose seat this caller may take.
      await api.post(`/trust/${connectionId}/confirm`);
      toast.success(`Step taken for ${parent}. ${firstName} will see you moved it.`);
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not move that step. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <button
        type="button"
        onClick={advance}
        disabled={busy}
        style={{
          display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center',
          gap: '8px', minHeight: '44px', padding: '10px 16px',
          background: 'var(--blue)', color: '#fff', border: 'none',
          borderRadius: '9999px', cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
          fontSize: '16px', fontWeight: 600, fontFamily: SFText,
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
        {busy ? 'Moving…' : `Move the next step forward for ${parent}`}
      </button>
      <p style={{ fontSize: '15px', color: 'var(--gold-deep)', fontFamily: SFText, margin: '8px 0 0', lineHeight: 1.5 }}>
        The step counts as {parent}&apos;s. {firstName} sees that you took it for them.
      </p>
    </div>
  );
}
