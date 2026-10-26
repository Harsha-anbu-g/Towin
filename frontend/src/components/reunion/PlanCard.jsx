// Step 4, the plan, in words the elder reads. The organiser writes it; the
// elder reads it and approves from the page. The form seeds once and keeps
// what is typed; a refetch never wipes a half-written plan.
import { useState } from 'react';
import { reunionErrorLine, setReunionPlan } from '../../api/reunions';
import { useToast } from '../../context/useToast';
import { tr } from '../../i18n';

const label = { display: 'block', fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', marginBottom: 6 };
const help = { fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '6px 0 0' };

function Line({ title, value }) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)' }}>{title}</div>
      <div style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.5, marginTop: 2, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}

export default function PlanCard({ reunion, canEdit, primary = true, onChange }) {
  const { toast } = useToast();
  const [plannedOn, setPlannedOn] = useState(reunion.plannedOn ?? '');
  const [venue, setVenue] = useState(reunion.venue ?? '');
  const [rides, setRides] = useState(reunion.rides ?? '');
  const [food, setFood] = useState(reunion.food ?? '');
  const [budget, setBudget] = useState(reunion.budget ?? '');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const fresh = await setReunionPlan({ reunionId: reunion.id, plannedOn, venue, rides, food, budget });
      toast.success(tr('Plan saved.'));
      onChange?.(fresh);
    } catch (err) {
      toast.error(reunionErrorLine(err, tr('Could not save the plan right now. Please try again.')));
    } finally {
      setSaving(false);
    }
  }

  const empty = !reunion.plannedOn && !reunion.venue && !reunion.rides && !reunion.food && !reunion.budget;

  return (
    <section className="card" style={{ padding: 24 }} aria-label={tr('The plan')}>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', margin: 0, fontFamily: 'var(--font-body)' }}>{tr('The plan')}</h2>
      {canEdit ? (
        <form onSubmit={save} noValidate style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <div>
            <label htmlFor="plan-when" style={label}>{tr('When')}</label>
            <input id="plan-when" className="field" value={plannedOn} onChange={(e) => setPlannedOn(e.target.value)} />
            <p style={help}>{tr('Sunday 14 December, 11 in the morning')}</p>
          </div>
          <div>
            <label htmlFor="plan-where" style={label}>{tr('Where')}</label>
            <input id="plan-where" className="field" value={venue} onChange={(e) => setVenue(e.target.value)} />
            <p style={help}>{tr('A public place or a family home. Never your own.')}</p>
          </div>
          <div>
            <label htmlFor="plan-rides" style={label}>{tr('Rides')}</label>
            <textarea id="plan-rides" className="field" rows={3} value={rides} onChange={(e) => setRides(e.target.value)} style={{ resize: 'vertical' }} />
            <p style={help}>{tr('Who brings whom, and who takes them home.')}</p>
          </div>
          <div>
            <label htmlFor="plan-food" style={label}>{tr('Food')}</label>
            <textarea id="plan-food" className="field" rows={2} value={food} onChange={(e) => setFood(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div>
            <label htmlFor="plan-budget" style={label}>{tr('Who covers what')}</label>
            <input id="plan-budget" className="field" value={budget} onChange={(e) => setBudget(e.target.value)} />
            <p style={help}>{tr('Never a guest.')}</p>
          </div>
          <div>
            <button type="submit" className={primary ? 'btn-primary' : 'btn-text'} disabled={saving}>{saving ? tr('Saving…') : tr('Save the plan')}</button>
          </div>
        </form>
      ) : empty ? (
        <p style={{ color: 'var(--ink-slate)', lineHeight: 1.6, margin: '8px 0 0' }}>{tr('Your organiser is still writing the plan.')}</p>
      ) : (
        <div>
          <Line title={tr('When')} value={reunion.plannedOn} />
          <Line title={tr('Where')} value={reunion.venue} />
          <Line title={tr('Rides')} value={reunion.rides} />
          <Line title={tr('Food')} value={reunion.food} />
          <Line title={tr('Who covers what')} value={reunion.budget} />
        </div>
      )}
    </section>
  );
}
