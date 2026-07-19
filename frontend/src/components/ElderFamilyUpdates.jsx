// US-004 (Step 3): the elder-side thread section on the elder's connection
// card — the transparency guarantee in UI form. While the friendship is
// shared, it's labeled "Updates your family can see". If the elder turns
// sharing off, family loses the thread but the elder keeps any existing
// notes (locked rule: helper/elder keep seeing it); a truly private
// friendship with no notes shows nothing.
import { useEffect, useState } from 'react';
import api from '../api/axios';
import FamilyUpdatesThread from './FamilyUpdatesThread';

const TRUST_LEVEL_ORDER = {
  DISCOVERED: 1, MESSAGING: 2, PHONE_CALL: 3, VIDEO_CALL: 4,
  VERIFIED: 5, FIRST_MEET: 6, TRUSTED: 7,
};

const baseGateHolds = (conn) =>
  conn?.status === 'ACTIVE' &&
  (TRUST_LEVEL_ORDER[conn?.currentTrustLevel] ?? 0) >= TRUST_LEVEL_ORDER.FIRST_MEET;

export default function ElderFamilyUpdates({ conn }) {
  const gate = baseGateHolds(conn);
  const shared = conn?.sharedWithFamily === true;
  // When sharing is off, only keep the thread if notes already exist.
  const [hasNotes, setHasNotes] = useState(false);

  useEffect(() => {
    if (!gate || shared) return undefined;
    let cancelled = false;
    api.get(`/messages/${conn.id}?channel=FAMILY_UPDATES&size=1`)
      .then(res => {
        if (!cancelled) setHasNotes((res.data.content ?? []).length > 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [gate, shared, conn?.id]);

  if (!gate) return null;
  if (!shared && !hasNotes) return null;

  const helperName = conn.otherUserName || 'your helper';

  return (
    <div style={{ borderTop: '1px solid var(--hairline)', marginTop: '14px', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          {shared ? 'Updates your family can see' : `Updates with ${helperName}`}
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '4px 0 0', lineHeight: 1.5 }}>
          {shared
            ? `You, your family and ${helperName} all see the same notes.`
            : `Sharing is off, so your family can't see these notes. You and ${helperName} still can. Use the switch above to share again.`}
        </p>
      </div>
      <FamilyUpdatesThread
        connectionId={conn.id}
        placeholder={shared
          ? `Write a note your family and ${helperName} can read`
          : `Write a note ${helperName} can read`}
        emptyText={`No updates yet. After a visit, ${helperName} can write how it went.`}
        sendLabel="Send"
      />
    </div>
  );
}
