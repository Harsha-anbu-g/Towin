// Step 2, who plans: the people the server allows, each with the reason they
// are allowed. One click, one confirm, chosen.
import { useEffect, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import Avatar from '../ui/Avatar';
import { chooseReunionOrganiser, listReunionOrganisers, reunionErrorLine } from '../../api/reunions';
import { useToast } from '../../context/useToast';
import { tr } from '../../i18n';

const whyAllowed = (c) => (c.kind === 'FAMILY' ? c.relationship || tr('Family') : tr('Helper you fully trust'));

export default function OrganiserPicker({ reunionId, onChosen }) {
  const { toast } = useToast();
  const [candidates, setCandidates] = useState(null);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setFailed(false);
    listReunionOrganisers(reunionId)
      .then((list) => setCandidates(Array.isArray(list) ? list : []))
      .catch(() => { setFailed(true); setCandidates([]); });
  };
  useEffect(load, [reunionId]);

  async function choose() {
    setSaving(true);
    try {
      const fresh = await chooseReunionOrganiser({ reunionId, organiserId: picking.userId });
      toast.success(tr('{name} will plan it. They have been told.', { name: fresh?.organiserName ?? picking.name }));
      setPicking(null);
      onChosen?.(fresh);
    } catch (err) {
      toast.error(reunionErrorLine(err, tr('Could not choose them right now. Please try again.')));
    } finally {
      setSaving(false);
    }
  }

  if (candidates === null) return <p style={{ color: 'var(--ink-slate)' }}>{tr('Loading…')}</p>;
  if (failed) {
    return (
      <p style={{ color: 'var(--ink-slate)' }}>
        {tr('Could not load who can plan it.')}{' '}
        <button type="button" className="btn-text" onClick={load}>{tr('Try again')}</button>
      </p>
    );
  }

  return (
    <div className="card" style={{ padding: '8px 24px' }}>
      {candidates.length === 0 ? (
        <p style={{ color: 'var(--ink-slate)', lineHeight: 1.6, margin: '12px 0' }}>
          {tr('Nobody to choose yet. A helper you fully trust, or a family member, can plan it.')}
        </p>
      ) : (
        candidates.map((c, i) => (
          <button
            key={c.userId}
            type="button"
            onClick={() => setPicking(c)}
            disabled={saving}
            aria-label={tr('Ask {name} to plan it. {why}', { name: c.name, why: whyAllowed(c) })}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 64, textAlign: 'left',
              padding: '10px 0', background: 'transparent', border: 'none', cursor: 'pointer',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontFamily: 'var(--font-body)',
            }}
          >
            <Avatar name={c.name} photoUrl={c.photoUrl} size={44} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</span>
              <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', marginTop: 2 }}>{whyAllowed(c)}</span>
            </span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--blue-deep)' }}>{tr('Ask')}</span>
          </button>
        ))
      )}
      <ConfirmDialog
        open={!!picking}
        title={picking ? tr('Ask {name} to plan it?', { name: picking.name }) : ''}
        message={tr('They will find the people and plan the day. You approve each step.')}
        confirmLabel={picking ? tr('Yes, ask {name}', { name: picking.name }) : ''}
        cancelLabel={tr('Not now')}
        loading={saving}
        onConfirm={choose}
        onCancel={() => setPicking(null)}
      />
    </div>
  );
}
