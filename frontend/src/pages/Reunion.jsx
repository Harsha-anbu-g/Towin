// Reunion: an elder meets old classmates or colleagues again. This page lists
// the reunions the signed-in person is part of (as the elder who wished, or
// as the organiser) and, for an elder, takes a new wish. The seven steps live
// on each reunion's own page. Reached from the account menu and the drawer.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import NavBar from '../components/NavBar';
import BlurFade from '../components/magic/BlurFade';
import ReunionWishForm from '../components/reunion/ReunionWishForm';
import { listMyReunions, postReunionWish, reunionErrorLine } from '../api/reunions';
import { useAuth } from '../context/useAuth';
import { useToast } from '../context/useToast';
import { STEP_NAMES, guestLine, stepIndex } from '../lib/reunionSteps';
import { tr } from '../i18n';

const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

function Row({ reunion, last }) {
  const stopped = reunion.step === 'STOPPED';
  const idx = stepIndex(reunion.step);
  const stage = stopped ? tr('Stopped') : tr('Step {n} of 7 · {name}', { n: idx + 1, name: tr(STEP_NAMES[idx]) });
  return (
    <Link
      to={`/reunion/${reunion.id}`}
      aria-label={tr('{institution}. {stage}', { institution: reunion.institution, stage })}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '12px 0', textDecoration: 'none',
        borderBottom: last ? 'none' : '1px solid var(--border)',
      }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{reunion.institution}</span>
        <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: stopped ? 'var(--ink-4)' : 'var(--blue-deep)', marginTop: 2 }}>{stage}</span>
        <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', marginTop: 2 }}>{guestLine(reunion)}</span>
      </span>
      <ChevronRight size={18} color="var(--ink-4)" aria-hidden="true" />
    </Link>
  );
}

export default function Reunion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isElder = user?.role === 'ELDER' || user?.role === 'BOTH';
  const [list, setList] = useState(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    return listMyReunions()
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => { setFailed(true); setList([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function wish(fields) {
    setSaving(true);
    try {
      const fresh = await postReunionWish(fields);
      if (fresh?.id) navigate(`/reunion/${fresh.id}`);
      else await load();
    } catch (err) {
      toast.error(reunionErrorLine(err, tr('Could not save the wish right now. Please try again.')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)', fontFamily: SFText }}>
      <NavBar />
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px 60px' }}>
        <BlurFade delay={2}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, letterSpacing: '-0.02em', fontSize: 'var(--text-xl)', color: 'var(--ink)', margin: 0 }}>
            {tr('Reunion')}
          </h1>
          <p style={{ fontSize: '17px', color: 'var(--ink-3)', lineHeight: 1.55, margin: '8px 0 0' }}>
            {isElder
              ? tr('Say who you want to see again. A helper you fully trust, or your family, finds them and plans the day. You approve each step. Every guest is seen home.')
              : tr('An elder who fully trusts you, or your parent, can ask you to plan their reunion. You find the people and plan the day. They approve each step.')}
          </p>
        </BlurFade>

        <BlurFade delay={3}>
          <div style={{ marginTop: 24 }}>
            {list === null ? (
              <p style={{ color: 'var(--ink-slate)' }}>{tr('Loading…')}</p>
            ) : failed ? (
              <p style={{ color: 'var(--ink-slate)' }}>
                {tr('Could not load your reunions.')}{' '}
                <button type="button" className="btn-text" onClick={load}>{tr('Try again')}</button>
              </p>
            ) : list.length > 0 ? (
              <div className="card" style={{ padding: '4px 24px' }}>
                {list.map((r, i) => <Row key={r.id} reunion={r} last={i === list.length - 1} />)}
              </div>
            ) : !isElder ? (
              <p className="card" style={{ padding: 24, color: 'var(--ink-slate)', lineHeight: 1.6, margin: 0 }}>
                {tr('When someone asks you to plan their reunion, it shows here.')}
              </p>
            ) : null}
          </div>
        </BlurFade>

        {isElder && (
          <BlurFade delay={4}>
            <div style={{ marginTop: list && list.length > 0 ? 48 : 0 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--text-lg)', color: 'var(--ink)', margin: '0 0 12px' }}>{tr('A new wish')}</h2>
              <ReunionWishForm onSubmit={wish} saving={saving} />
            </div>
          </BlurFade>
        )}
      </main>
    </div>
  );
}
