import { useState } from 'react';
import api from '../api/axios';
import { Mail, Phone, MapPin, Briefcase, Code2, Camera, Globe, Star } from 'lucide-react';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const RATINGS = [
  { key: 'ratingIdea', label: 'Idea' },
  { key: 'ratingUi', label: 'UI Design' },
  { key: 'ratingTheme', label: 'Theme' },
  { key: 'ratingSecurity', label: 'Security' },
  { key: 'ratingEaseOfUse', label: 'Ease of Use' },
  { key: 'ratingPerformance', label: 'Performance' },
  { key: 'ratingOverall', label: 'Overall' },
];

const CONTACTS = [
  { icon: Mail, label: 'agharsha.anbu@gmail.com', href: 'mailto:agharsha.anbu@gmail.com' },
  { icon: Phone, label: '+1 438-535-5782 (WhatsApp)', href: 'https://wa.me/14385355782' },
  { icon: MapPin, label: 'Montreal, Quebec, Canada', href: null },
  { icon: Briefcase, label: 'LinkedIn: harsha-anbu-gowri', href: 'https://www.linkedin.com/in/harsha-anbu-gowri/' },
  { icon: Code2, label: 'GitHub: Harsha-anbu-g', href: 'https://github.com/Harsha-anbu-g' },
  { icon: Camera, label: 'Instagram: harsha._.ag', href: 'https://www.instagram.com/harsha._.ag' },
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
            fill={filled ? '#4FA3CE' : 'none'}
            color={filled ? '#4FA3CE' : '#d0d0d5'}
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
    if (!form.message.trim()) { setError('Please write a message before submitting.'); return; }
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
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '1px solid #e0e0e0', fontSize: '15px', fontFamily: SFText,
    color: '#1d1d1f', background: '#fafafc', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: '#1d1d1f', marginBottom: '6px', fontFamily: SFText,
  };

  return (
    <div style={{ minHeight: '100svh', background: '#fafafc' }}>
      <style>{`
        .fb-shell { display: grid; grid-template-columns: 1fr 360px; gap: 32px; max-width: 1100px; margin: 0 auto; padding: 48px 32px; align-items: start; }
        .fb-left { position: sticky; top: 24px; display: flex; flex-direction: column; gap: 16px; }
        .fb-card { background: #fff; border-radius: 18px; border: 1px solid #e0e0e0; padding: 28px 28px; }
        .fb-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
        .fb-ratings { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
        @media (max-width: 860px) {
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

      <div className="fb-shell">

        {/* ── LEFT: Feedback form ── */}
        <div>
          {/* Prototype notice */}
          <div style={{
            background: '#EAF5FB', border: '1px solid #BFD9EA', borderRadius: '14px',
            padding: '14px 20px', marginBottom: '16px',
          }}>
            <p style={{ fontFamily: SFText, fontSize: '14px', color: '#1d1d1f', margin: 0, lineHeight: 1.55 }}>
              <strong>ToWin is an early prototype.</strong> You&apos;re trying a work in
              progress — a full mobile app is planned for the future. Your feedback
              here directly shapes what gets built.
            </p>
          </div>
          {submitted ? (
            <div className="fb-card" style={{ textAlign: 'center', padding: '64px 36px' }}>
              <h2 style={{ fontFamily: SF, fontSize: '28px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 10px' }}>
                Thank you
              </h2>
              <p style={{ fontFamily: SFText, fontSize: '16px', color: '#7a7a7a', margin: 0 }}>
                Your feedback means a lot. It genuinely helps make ToWin better.
              </p>
            </div>
          ) : (
            <div className="fb-card">
              <h2 style={{ fontFamily: SF, fontSize: '26px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 4px' }}>
                Share Your Feedback
              </h2>
              <p style={{ fontFamily: SFText, fontSize: '14px', color: '#7a7a7a', margin: '0 0 24px' }}>
                All fields are optional except your message.
              </p>
              {error && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
                  padding: '12px 16px', fontSize: '14px', color: '#dc2626',
                  marginBottom: '20px', fontFamily: SFText,
                }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="fb-3col">
                  <div>
                    <label style={labelStyle}>Name <span style={{ color: '#a0a0a5', fontWeight: 400 }}>(optional)</span></label>
                    <input style={inputStyle} value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Your name" />
                  </div>
                  <div>
                    <label style={labelStyle}>Email <span style={{ color: '#a0a0a5', fontWeight: 400 }}>(optional)</span></label>
                    <input type="email" style={inputStyle} value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone <span style={{ color: '#a0a0a5', fontWeight: 400 }}>(optional)</span></label>
                    <input type="tel" style={inputStyle} value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 000-000-0000" />
                  </div>
                </div>
                <div style={{ height: '1px', background: '#e0e0e0' }} />
                <div>
                  <label style={labelStyle}>Message <span style={{ color: '#dc2626' }}>*</span></label>
                  <p style={{ fontFamily: SFText, fontSize: '12px', color: '#7a7a7a', margin: '0 0 8px', lineHeight: 1.5 }}>
                    Be honest! Include <strong style={{ color: '#1d1d1f' }}>at least one thing you didn't like</strong> — that's where the real value is.
                  </p>
                  <textarea required rows={7} style={{ ...inputStyle, resize: 'vertical' }}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder={"What did you think? What worked, what didn't?\nBe honest — one thing you didn't like is more valuable than ten compliments."}
                  />
                </div>
                <div style={{ height: '1px', background: '#e0e0e0' }} />
                <div>
                  <p style={{ ...labelStyle, marginBottom: '14px' }}>
                    Rate the app <span style={{ color: '#a0a0a5', fontWeight: 400 }}>(optional)</span>
                  </p>
                  <div className="fb-ratings">
                    {RATINGS.map(({ key, label }) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontFamily: SFText, fontSize: '14px', color: '#1d1d1f' }}>{label}</span>
                        <StarRating value={ratings[key] || 0} onChange={val => setRating(key, val)} />
                      </div>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', height: '48px',
                  background: loading ? '#7BB8D6' : '#4FA3CE',
                  color: '#fff', border: 'none', borderRadius: '9999px',
                  fontSize: '16px', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: SFText, transition: 'background 0.15s',
                }}>
                  {loading ? 'Submitting…' : 'Submit Feedback'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── RIGHT: Creator info (sticky) ── */}
        <div className="fb-left">
          <div className="fb-card">
            {/* Avatar placeholder with initials */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4FA3CE, #2a7da8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', fontWeight: 700, color: '#fff', fontFamily: SF, flexShrink: 0,
              }}>H</div>
              <div>
                <h2 style={{ fontFamily: SF, fontSize: '17px', fontWeight: 700, color: '#1d1d1f', margin: 0 }}>
                  Harshavardhan Anbuchezhian Gowri
                </h2>
                <p style={{ fontFamily: SFText, fontSize: '13px', color: '#7a7a7a', margin: 0 }}>Harsha</p>
              </div>
            </div>

            <p style={{ fontFamily: SFText, fontSize: '13px', color: '#4FA3CE', fontWeight: 600, margin: '0 0 2px' }}>
              Full-Stack Engineer · Aspiring Entrepreneur · AI-Driven Developer
            </p>
            <p style={{ fontFamily: SFText, fontSize: '12px', color: '#7a7a7a', margin: '0 0 16px' }}>
              Master's in Applied Computer Science · Concordia University, Montreal
            </p>

            <div style={{ height: '1px', background: '#e0e0e0', margin: '0 0 16px' }} />

            <p style={{ fontFamily: SFText, fontSize: '14px', color: '#1d1d1f', fontWeight: 600, margin: '0 0 6px', lineHeight: 1.5 }}>
              This isn't a university project — ToWin is my future startup.
            </p>
            <p style={{ fontFamily: SFText, fontSize: '13px', color: '#7a7a7a', margin: '0 0 20px', lineHeight: 1.6 }}>
              I'm building something real, and your feedback is what shapes it. Love the idea? Want to connect? Let's talk!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {CONTACTS.map(({ icon: Icon, label, href }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={15} color="#4FA3CE" style={{ flexShrink: 0 }} />
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily: SFText, fontSize: '13px', color: '#4FA3CE', textDecoration: 'none' }}>
                      {label}
                    </a>
                  ) : (
                    <span style={{ fontFamily: SFText, fontSize: '13px', color: '#7a7a7a' }}>{label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio link */}
          <div className="fb-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '18px 24px' }}>
            <div>
              <p style={{ fontFamily: SFText, fontSize: '12px', color: '#7a7a7a', margin: '0 0 2px' }}>Want to know more?</p>
              <p style={{ fontFamily: SF, fontSize: '14px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>Visit my portfolio</p>
            </div>
            <a
              href="https://portfolioharsha.vercel.app/"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#4FA3CE', color: '#fff', padding: '9px 16px',
                borderRadius: '9999px', fontSize: '13px', fontWeight: 600,
                fontFamily: SFText, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <Globe size={13} />
              My Portfolio
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
