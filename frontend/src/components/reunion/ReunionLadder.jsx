// The seven reunion steps as a horizontal ladder, in the Trust Ladder's
// grammar: filled check circles for steps taken, a ring for the current one,
// 2px connectors. The goal node is a check in a wash circle; the tortoise
// stays the trust mark.
import { Check } from 'lucide-react';
import { tr } from '../../i18n';

export default function ReunionLadder({ stepIndex, done = false }) {
  const label = done
    ? tr('Reunion: step 7 of 7, everyone home')
    : tr('Reunion: step {n} of 7', { n: Math.min(stepIndex + 1, 7) });
  return (
    <div role="img" aria-label={label} style={{ display: 'flex', alignItems: 'center' }}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const isGoal = i === 6;
        const taken = i < stepIndex || (done && isGoal);
        const current = i === stepIndex && !taken;
        const size = isGoal ? 22 : 20;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i > 0 ? 1 : '0 0 auto' }}>
            {i > 0 && (
              <div style={{ flex: 1, height: 2, background: i <= stepIndex ? 'var(--blue)' : 'var(--border)' }} />
            )}
            <div style={{
              width: size, height: size, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0,
              background: taken ? 'var(--blue)' : isGoal ? 'var(--blue-wash)' : 'var(--canvas)',
              border: `${isGoal && !taken ? 1 : 2}px solid ${taken || current ? 'var(--blue)' : isGoal ? 'var(--blue-soft)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {taken && <Check size={10} color="var(--action-ink)" strokeWidth={2.5} aria-hidden="true" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
