// One reunion: the ladder, where it stands, and the panel for the current
// step. Nothing moves without the elder's click on steps 3 and 4; the day and
// the send-off are either side's; the elder can stop at any time, the
// organiser can step down before the day.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import ConfirmDialog from '../components/ConfirmDialog';
import GuestList from '../components/reunion/GuestList';
import OrganiserPicker from '../components/reunion/OrganiserPicker';
import PlanCard from '../components/reunion/PlanCard';
import ReunionLadder from '../components/reunion/ReunionLadder';
import { advanceReunion, closeReunion, getReunion, reunionErrorLine, stepDownFromReunion, stopReunion } from '../api/reunions';
import { useToast } from '../context/useToast';
import { STEP_EXPLAINS, STEP_NAMES, nextAction, stepIndex } from '../lib/reunionSteps';
import { tr } from '../i18n';

const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;
const MODE_FOR = { FINDING: 'finding', PLAN: 'plan', DAY: 'day', SEND_OFF: 'sendoff' };

export default function ReunionDetail() {
  const { reunionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reunion, setReunion] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [thankYou, setThankYou] = useState('');
  const [ask, setAsk] = useState(null); // 'stop' | 'stepDown'

  const load = useCallback(() => {
    setFailed(false);
    return getReunion(reunionId).then(setReunion).catch(() => setFailed(true));
  }, [reunionId]);
  useEffect(() => { load(); }, [load]);

  async function run(work, fallback, after) {
    setBusy(true);
    try {
      const fresh = await work();
      if (after) after(fresh); else setReunion(fresh);
    } catch (err) {
      toast.error(reunionErrorLine(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  if (failed || !reunion) {
    return (
      <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
        <NavBar />
        <main style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px 60px' }}>
          {failed ? (
            <p style={{ color: 'var(--ink-slate)' }}>
              {tr('Could not load this reunion.')}{' '}
              <button type="button" className="btn-text" onClick={load}>{tr('Try again')}</button>
            </p>
          ) : (
            <p style={{ color: 'var(--ink-slate)' }}>{tr('Loading…')}</p>
          )}
        </main>
      </div>
    );
  }

  const isElder = reunion.myRole === 'ELDER';
  const step = reunion.step;
  const idx = stepIndex(step);
  const stopped = step === 'STOPPED';
  const done = step === 'DONE';
  const over = stopped || done;
  const action = nextAction(reunion, reunion.myRole);
  const canEditGuests = !isElder && (step === 'FINDING' || step === 'PLAN');
  const mode = MODE_FOR[step] ?? 'read';
  const sub = [reunion.years, reunion.city].filter(Boolean).join(' · ');
  const withLine = isElder
    ? (reunion.organiserName ? tr('{name} is planning it', { name: reunion.organiserName }) : null)
    : tr('For {name}', { name: reunion.elderName });

  const onNext = () => (action.closes
    ? run(() => closeReunion({ reunionId, thankYou: thankYou.trim() }), tr('Could not do that right now. Please try again.'))
    : run(() => advanceReunion(reunionId), tr('Could not do that right now. Please try again.')));
  const onStop = () => run(() => stopReunion(reunionId), tr('Could not do that right now. Please try again.'), (fresh) => { setReunion(fresh); setAsk(null); });
  const onStepDown = () => run(() => stepDownFromReunion(reunionId), tr('Could not do that right now. Please try again.'), () => {
    setAsk(null);
    toast.success(tr('You stepped down. The elder has been told.'));
    navigate('/reunion');
  });

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px 60px' }}>
        <Link to="/reunion" className="btn-text" style={{ padding: '8px 0', display: 'inline-flex' }}>{tr('← All reunions')}</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', fontSize: 'var(--text-xl)', color: 'var(--ink)', margin: '8px 0 0' }}>
          {reunion.institution}
        </h1>
        {sub && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '6px 0 0' }}>{sub}</p>}
        {withLine && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', margin: '4px 0 0' }}>{withLine}</p>}

        <section style={{ marginTop: 24 }} aria-label={tr('Where this reunion stands')}>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: stopped ? 'var(--ink-4)' : 'var(--blue-deep)', margin: 0 }}>
            {stopped ? tr('Stopped') : tr('Step {n} of 7 · {name}', { n: idx + 1, name: tr(STEP_NAMES[idx]) })}
          </p>
          <div style={{ marginTop: 10 }}><ReunionLadder stepIndex={idx} done={done} /></div>
          <p style={{ fontSize: 17, color: 'var(--ink-slate)', lineHeight: 1.55, margin: '12px 0 0' }}>
            {stopped ? tr('This reunion was stopped.') : tr(STEP_EXPLAINS[idx])}
          </p>
        </section>

        <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
          {step === 'ORGANISER' && isElder && <OrganiserPicker reunionId={reunionId} onChosen={setReunion} />}

          {(step === 'PLAN' || step === 'DAY') && (
            <PlanCard reunion={reunion} canEdit={!isElder && step === 'PLAN'} onChange={setReunion} />
          )}

          {step !== 'ORGANISER' && (
            <GuestList reunion={reunion} mode={mode} canEdit={canEditGuests} addPrimary={step === 'FINDING'} onChange={setReunion} />
          )}

          {step === 'SEND_OFF' && (
            <section className="card" style={{ padding: 24 }}>
              <label htmlFor="thank-you" style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', marginBottom: 6 }}>{tr('A thank-you to each guest')}</label>
              <textarea id="thank-you" className="field" rows={3} value={thankYou} onChange={(e) => setThankYou(e.target.value)} style={{ resize: 'vertical' }} />
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '6px 0 0' }}>{tr('Goes to everyone who came, with Towinly’s name on it.')}</p>
            </section>
          )}

          {done && (
            <section className="card" style={{ padding: 24 }}>
              {reunion.thankYou && <p style={{ fontSize: 17, color: 'var(--ink)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>“{reunion.thankYou}”</p>}
              <p style={{ color: 'var(--ink-slate)', lineHeight: 1.6, margin: reunion.thankYou ? '12px 0 0' : 0 }}>
                {tr('{count} came, and every one of them got home.', { count: reunion.arrivedCount ?? 0 })}
              </p>
              {isElder && (
                <Link to="/what-i-pass-on" className="btn-text" style={{ padding: '10px 0', marginTop: 8, display: 'inline-flex', fontSize: 16 }}>
                  {tr('Keep the story in your box')} →
                </Link>
              )}
            </section>
          )}

          {action.show && (
            <div>
              <button type="button" className="btn-primary" disabled={!action.enabled || busy} onClick={onNext}>{action.label}</button>
              {!action.enabled && action.reason && (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', lineHeight: 1.5, margin: '8px 0 0' }}>{action.reason}</p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isElder && !over && (
              <button type="button" className="btn-text" onClick={() => setAsk('stop')} disabled={busy}>{tr('Stop this reunion')}</button>
            )}
            {!isElder && (step === 'FINDING' || step === 'PLAN') && (
              <button type="button" className="btn-text" onClick={() => setAsk('stepDown')} disabled={busy}>{tr('Step down from planning')}</button>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={ask === 'stop'}
          title={tr('Stop this reunion?')}
          message={tr('Your organiser will be told. The guest list stays, and you can wish again later.')}
          confirmLabel={tr('Stop it')}
          cancelLabel={tr('Keep going')}
          danger
          loading={busy}
          onConfirm={onStop}
          onCancel={() => setAsk(null)}
        />
        <ConfirmDialog
          open={ask === 'stepDown'}
          title={tr('Step down from planning?')}
          message={tr('{name} will be asked to choose someone else. The guest list stays.', { name: reunion.elderName })}
          confirmLabel={tr('Step down')}
          cancelLabel={tr('Keep planning')}
          danger
          loading={busy}
          onConfirm={onStepDown}
          onCancel={() => setAsk(null)}
        />
      </main>
    </div>
  );
}
