import { useState } from 'react';
import api from '../api/axios';
import { Mail, Phone, MapPin, Briefcase, Code2, Camera, Globe, Star } from 'lucide-react';
import SiteFooter from '../components/SiteFooter';
import SmoothInput from '../components/SmoothInput';
import { tr } from '../i18n';
import emphasize from '../i18n/emphasize';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const RATINGS = [
  { key: 'ratingIdea', get label() { return tr('Idea'); } },
  { key: 'ratingUi', get label() { return tr('UI Design'); } },
  { key: 'ratingTheme', get label() { return tr('Theme'); } },
  { key: 'ratingSecurity', get label() { return tr('Security'); } },
  { key: 'ratingEaseOfUse', get label() { return tr('Ease of Use'); } },
  { key: 'ratingPerformance', get label() { return tr('Performance'); } },
  { key: 'ratingOverall', get label() { return tr('Overall'); } },
];

const CONTACTS = [
  { icon: Mail, label: 'agharsha.anbu@gmail.com', href: 'mailto:agharsha.anbu@gmail.com' },
  { icon: Phone, label: '+1 438-535-5782 (WhatsApp)', href: 'https://wa.me/14385355782' },
  { icon: MapPin, get label() { return tr('Montreal, Quebec, Canada'); }, href: null },
  { icon: Briefcase, get label() { return tr('LinkedIn: harsha-anbu-gowri'); }, href: 'https://www.linkedin.com/in/harsha-anbu-gowri/' },
  { icon: Code2, get label() { return tr('GitHub: Harsha-anbu-g'); }, href: 'https://github.com/Harsha-anbu-g' },
  { icon: Camera, get label() { return tr('Instagram: harsha._.ag'); }, href: 'https://www.instagram.com/harsha._.ag' },
];

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= (hovered || value);
        return (
          <Star
            key={n}
            size={20}
            fill={filled ? 'var(--blue)' : 'none'}
            color={filled ? 'var(--blue)' : 'var(--idle-grey)'}
            style={{ cursor: 'pointer', transition: 'color 0.1s' }}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(value === n ? 0 : n)}
          />
        );
      })}
    </div>
  );
}

export default function Feedback() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const setRating = (key, val) => setRatings(r => ({ ...r, [key]: val || null }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.message.trim()) { setError(tr('Please write a message before submitting.')); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/feedback', {
        name: form.name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        message: form.message.trim(),
        ...Object.fromEntries(RATINGS.map(({ key }) => [key, ratings[key] || null])),
      });
      setSubmitted(true);
    } catch {
      setError(tr('Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '1px solid var(--border)', fontSize: '16px', fontFamily: SFText,
    color: 'var(--ink)', background: 'var(--surface-pearl)', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block', fontSize: '14px', fontWeight: 600,
    color: 'var(--ink)', marginBottom: '6px', fontFamily: SFText,
  };

  return (
    <div style={{ minHeight: '100svh', background: 'var(--surface-pearl)' }}>
      <style>{`
        .fb-shell { display: grid; grid-template-columns: 1fr 360px; gap: 32px; max-width: 1100px; margin: 0 auto; padding: 48px 32px; align-items: start; }
        .fb-left { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 16px; }
        .fb-card { background: var(--canvas); border-radius: 18px; border: 1px solid var(--border); padding: 28px 28px; }
        .fb-portfolio { transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
        .fb-portfolio:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(156,122,60,0.18); border-color: var(--trust-gold); }
        .fb-brand { display: flex; align-items: center; gap: 10px; padding: 24px 20px 0; }
        .fb-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
        .fb-ratings { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
        @media (max-width: 860px) {
          .fb-brand { padding: 20px 16px 0; }
          .fb-shell { grid-template-columns: 1fr; padding: 24px 16px; }
          .fb-left { position: static; }
          .fb-3col { grid-template-columns: 1fr; }
          .fb-ratings { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .fb-card { padding: 20px 18px; }
          .fb-3col { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Brand header ── */}
      <div className="fb-brand">
        <img src="/logo.png" alt={tr('Towinly logo')} style={{ width: 40, height: 40, objectFit: 'contain' }} />
        <span style={{
          fontFamily: SF, fontSize: '24px', fontWeight: 600,
          letterSpacing: '-0.374px', color: 'var(--green-deep)',
        }}>{tr('Towinly')}</span>
      </div>

      <div className="fb-shell">

        {/* ── LEFT: Feedback form ── */}
        <div>
          {submitted ? (
            <div className="fb-card" style={{ textAlign: 'center', padding: '64px 36px' }}>
              <h2 style={{ fontFamily: SF, fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--ink)', margin: '0 0 10px' }}>
                {tr('Thank you')}
              </h2>
              <p style={{ fontFamily: SFText, fontSize: '16px', color: 'var(--ink-3)', margin: 0 }}>
                {tr('Your feedback means a lot. It genuinely helps make Towinly better.')}
              </p>
            </div>
          ) : (
            <div className="fb-card">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 400, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                {tr('Share Your Feedback')}
              </h2>
              <p style={{ fontFamily: SFText, fontSize: 'var(--text-sm)', color: 'var(--ink-3)', margin: '0 0 24px' }}>
                {tr('All fields are optional except your message.')}
              </p>
              {error && (
                <div style={{
                  background: 'var(--red-tint)', border: '1px solid var(--red-line)', borderRadius: '10px',
                  padding: '12px 16px', fontSize: 'var(--text-sm)', color: 'var(--red-error)',
                  marginBottom: '20px', fontFamily: SFText,
                }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="fb-3col">
                  <div>
                    <label style={labelStyle}>{emphasize(tr('Name *(optional)*'), (part) => <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>{part}</span>)}</label>
                    <SmoothInput style={inputStyle} value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={tr('Your name')} />
                  </div>
                  <div>
                    <label style={labelStyle}>{emphasize(tr('Email *(optional)*'), (part) => <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>{part}</span>)}</label>
                    <SmoothInput type="email" style={inputStyle} value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label style={labelStyle}>{emphasize(tr('Phone *(optional)*'), (part) => <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>{part}</span>)}</label>
                    <SmoothInput type="tel" style={inputStyle} value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 000-000-0000" />
                  </div>
                </div>
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <div>
                  <label style={labelStyle}>{tr('Message')}{' '}<span style={{ color: 'var(--red-error)' }}>*</span></label>
                  <p style={{ fontFamily: SFText, fontSize: 'var(--text-xs)', color: 'var(--ink-3)', margin: '0 0 8px', lineHeight: 1.5 }}>
                    {emphasize(tr("Be honest! Include *at least one thing you didn't like*. That's where the real value is."), (part) => <strong style={{ color: 'var(--ink)' }}>{part}</strong>)}
                  </p>
                  <textarea required rows={7} style={{ ...inputStyle, resize: 'vertical' }}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder={tr("What did you think? What worked, what didn't?\nBe honest. One thing you didn't like is more valuable than ten compliments.")}
                  />
                </div>
                <div style={{ height: '1px', background: 'var(--border)' }} />
                <div>
                  <p style={{ ...labelStyle, marginBottom: '14px' }}>
                    {emphasize(tr('Rate the app *(optional)*'), (part) => <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>{part}</span>)}
                  </p>
                  <div className="fb-ratings">
                    {RATINGS.map(({ key, label }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontFamily: SFText, fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>{label}</span>
                        <StarRating value={ratings[key] || 0} onChange={val => setRating(key, val)} />
                      </div>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', height: '48px',
                  background: loading ? 'var(--blue-mid)' : 'var(--blue)',
                  color: '#fff', border: 'none', borderRadius: '9999px',
                  fontSize: '16px', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: SFText, transition: 'background 0.15s',
                }}>
                  {loading ? tr('Submitting…') : tr('Submit Feedback')}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── RIGHT: Creator info (sticky) ── */}
        <div className="fb-left">
          <div className="fb-card">
            {/* Creator photo (supplied 2026-07-06 — the asset is canonical, never redraw) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <img
                src="/founder.jpg"
                alt={tr('Portrait of Harshavardhan')}
                width="52"
                height="52"
                loading="lazy"
                decoding="async"
                style={{
                  width: 52, height: 52, borderRadius: '50%', objectFit: 'cover',
                  border: '1px solid var(--border)', flexShrink: 0,
                }}
              />
              <div>
                <h2 style={{ fontFamily: SF, fontSize: '17px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                  {tr('Harshavardhan Anbuchezhian Gowri')}
                </h2>
                <p style={{ fontFamily: SFText, fontSize: '14px', color: 'var(--ink-3)', margin: 0 }}>{tr('Harsha')}</p>
              </div>
            </div>

            <p style={{ fontFamily: SFText, fontSize: '14px', color: 'var(--blue-deep)', fontWeight: 600, margin: '0 0 2px' }}>
              {tr('Full-Stack Engineer · Aspiring Entrepreneur · AI-Driven Developer')}
            </p>
            <p style={{ fontFamily: SFText, fontSize: 'var(--text-xs)', color: 'var(--ink-3)', margin: '0 0 16px' }}>
              {tr("Master's in Applied Computer Science · Concordia University, Montreal")}
            </p>

            <div style={{ height: '1px', background: 'var(--border)', margin: '0 0 16px' }} />

            <p style={{ fontFamily: SFText, fontSize: 'var(--text-sm)', color: 'var(--ink)', fontWeight: 600, margin: '0 0 6px', lineHeight: 1.5 }}>
              {tr("This isn't a university project. Towinly is my future startup.")}
            </p>
            <p style={{ fontFamily: SFText, fontSize: '14px', color: 'var(--ink-3)', margin: '0 0 20px', lineHeight: 1.6 }}>
              {tr("I'm building something real, and your feedback is what shapes it. Love the idea? Want to connect? Let's talk!")}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {CONTACTS.map(({ icon: Icon, label, href }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={15} color="var(--blue)" style={{ flexShrink: 0 }} />
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: SFText, fontSize: '14px', color: 'var(--blue-deep)', textDecoration: 'none' }}>
                      {label}
                    </a>
                  ) : (
                    <span style={{ fontFamily: SFText, fontSize: '14px', color: 'var(--ink-3)' }}>{label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio link */}
          <a
            className="fb-card fb-portfolio"
            href="https://harshavardhanag.com/"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
              padding: '18px 24px', textDecoration: 'none', cursor: 'pointer',
            }}
          >
            <div>
              <p style={{ fontFamily: SFText, fontSize: 'var(--text-xs)', color: 'var(--ink-3)', margin: '0 0 2px' }}>{tr('Want to know more?')}</p>
              <p style={{ fontFamily: SF, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--trust-gold)', margin: 0, textDecoration: 'underline', textUnderlineOffset: '3px' }}>{tr('Visit my portfolio')}</p>
            </div>
            <span
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--trust-gold)', color: '#fff', padding: '9px 16px',
                borderRadius: '9999px', fontSize: '14px', fontWeight: 600,
                fontFamily: SFText, whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <Globe size={13} />
              {tr('My Portfolio')}
            </span>
          </a>
        </div>

      </div>
      <SiteFooter />
    </div>
  );
}
