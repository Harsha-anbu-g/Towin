import { useState } from 'react';
import api from '../api/axios';
import SmoothInput from './SmoothInput';

/**
 * Shown when GPS is denied/unavailable. Lets the user type a town or postcode;
 * on success it resolves coordinates (backend Nominatim forward geocode), saves
 * them, and tells the parent to reload the nearby list. Shared by the Elder and
 * Helper dashboards so both behave identically.
 *
 * Props:
 *   onResolved({ lat, lng, city }) — called after a successful lookup + save
 */
export default function LocationPrompt({ onResolved }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | notfound | error
  const [city, setCity] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setStatus('loading');
    try {
      const { data } = await api.get(`/geocode/search?q=${encodeURIComponent(q)}`);
      const loc = { lat: data.lat, lng: data.lng };
      await api.put('/profile/location', { locationLat: loc.lat, locationLng: loc.lng }).catch(() => {});
      setCity(data.city);
      setStatus('idle');
      onResolved({ ...loc, city: data.city });
    } catch (err) {
      setStatus(err?.response?.status === 404 ? 'notfound' : 'error');
    }
  }

  return (
    <div style={{ background: 'var(--canvas)', borderRadius: '14px', padding: '16px', border: '1px solid var(--hairline-2)' }}>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--ink-slate-dark)', margin: '0 0 10px' }}>
        Enter your town or postcode to see people near you
      </p>
      <form onSubmit={submit} style={{ display: 'flex', gap: '8px' }}>
        <SmoothInput
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. Scarborough or M1B 1A1"
          wrapperStyle={{ flex: 1 }}
          style={{ width: '100%', boxSizing: 'border-box', height: '40px', padding: '0 14px', fontSize: '15px', color: 'var(--ink-slate)', border: '1px solid var(--line-idle-2)', borderRadius: '9999px', outline: 'none', fontFamily: 'inherit' }}
        />
        <button type="submit" disabled={status === 'loading'} className="btn-primary" style={{ padding: '0 22px', fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
          {status === 'loading' ? 'Finding…' : 'Find'}
        </button>
      </form>
      {status === 'notfound' && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--red-mild)', margin: '10px 0 0' }}>
          We couldn't find that place — try a postcode.
        </p>
      )}
      {status === 'error' && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--red-mild)', margin: '10px 0 0' }}>
          Something went wrong. Please try again.
        </p>
      )}
      {city && status === 'idle' && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--blue)', margin: '10px 0 0' }}>
          Showing people near {city}.
        </p>
      )}
    </div>
  );
}
