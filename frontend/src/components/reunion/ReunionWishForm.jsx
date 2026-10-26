// Step 1, the wish: who the elder wants to see again, in their own words.
import { useState } from 'react';
import { tr } from '../../i18n';

const label = { display: 'block', fontSize: 'var(--text-sm)', color: 'var(--ink-slate)', marginBottom: 6 };
const help = { fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '6px 0 0' };

export default function ReunionWishForm({ onSubmit, saving }) {
  const [institution, setInstitution] = useState('');
  const [years, setYears] = useState('');
  const [city, setCity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!institution.trim()) {
      setError(tr('Say which batch, class or office it was.'));
      return;
    }
    setError(null);
    onSubmit({ institution: institution.trim(), years: years.trim(), city: city.trim(), note: note.trim() });
  };

  return (
    <form onSubmit={submit} className="card" style={{ padding: 24, display: 'grid', gap: 16 }} noValidate>
      <div>
        <label htmlFor="reunion-institution" style={label}>{tr('Who do you want to see again?')}</label>
        <input
          id="reunion-institution"
          className="field"
          value={institution}
          onChange={(e) => { setInstitution(e.target.value); if (error) setError(null); }}
          aria-invalid={!!error}
          aria-describedby={error ? 'reunion-institution-error' : 'reunion-institution-help'}
        />
        {error ? (
          <p id="reunion-institution-error" role="alert" className="danger-text" style={{ ...help, color: 'var(--red-deep)' }}>{error}</p>
        ) : (
          <p id="reunion-institution-help" style={help}>{tr('For example: B.Sc. batch, Presidency College')}</p>
        )}
      </div>
      <div>
        <label htmlFor="reunion-years" style={label}>{tr('Which years?')}</label>
        <input id="reunion-years" className="field" value={years} onChange={(e) => setYears(e.target.value)} placeholder={tr('1968 to 1971')} />
      </div>
      <div>
        <label htmlFor="reunion-city" style={label}>{tr('Which city?')}</label>
        <input id="reunion-city" className="field" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div>
        <label htmlFor="reunion-note" style={label}>{tr('Names you remember')}</label>
        <textarea id="reunion-note" className="field" rows={4} value={note} onChange={(e) => setNote(e.target.value)} style={{ resize: 'vertical' }} />
        <p style={help}>{tr('Anything that helps find them. A cousin who has a number, a street, a nickname.')}</p>
      </div>
      <div>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? tr('Saving…') : tr('Make the wish')}</button>
      </div>
    </form>
  );
}
