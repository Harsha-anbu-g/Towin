import { useState } from 'react';
import api from '../api/axios';
import { Mail, Phone, MapPin, Briefcase, Code2, Camera, Globe, Star } from 'lucide-react';

const SF = `-apple-system, 'SF Pro Display', system-ui, sans-serif`;
const SFText = `-apple-system, 'SF Pro Text', system-ui, sans-serif`;

const RATINGS = [
  { key: 'ratingIdea', label: 'Idea (concept)' },
  { key: 'ratingUi', label: 'UI' },
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
    <div style={{ display: 'flex', gap: '4px' }}>
      {[1, 2, 3, 4, 5].map(n => {
        const filled = n <= (hovered || value);
        return (
          <Star
            key={n}
            size={24}
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

function CreatorCard() {
  return (
    <div style={{
      background: '#fff', borderRadius: '18px',
      padding: '32px 36px', border: '1px solid #e0e0e0', marginTop: '20px',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontFamily: SF, fontSize: '22px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 4px' }}>
          Harshavardhan Anbuchezhian Gowri
          <span style={{ fontWeight: 400, color: '#7a7a7a', fontSize: '18px' }}> (Harsha)</span>
        </h2>
        <p style={{ fontFamily: SFText, fontSize: '14px', color: '#4FA3CE', fontWeight: 600, margin: '0 0 2px' }}>
          Full-Stack Engineer
        </p>
        <p style={{ fontFamily: SFText, fontSize: '13px', color: '#7a7a7a', margin: 0 }}>
          Master's in Applied Computer Science · Concordia University, Montreal
        </p>
      </div>

      <div style={{ height: '1px', background: '#e0e0e0', margin: '16px 0' }} />

      <p style={{ fontFamily: SFText, fontSize: '14px', color: '#1d1d1f', fontWeight: 600, margin: '0 0 6px', lineHeight: 1.5 }}>
        This isn't a university project — ToWin is my future startup. I'm building something real, and your feedback is what shapes it.
      </p>
      <p style={{ fontFamily: SFText, fontSize: '14px', color: '#7a7a7a', margin: '0 0 20px', lineHeight: 1.6 }}>
        You can also drop your feedback directly on any of my socials. Love the idea? Want to connect or collaborate? Let's connect!
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {CONTACTS.map(({ icon: Icon, label, href }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon size={16} color="#4FA3CE" style={{ flexShrink: 0 }} />
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: SFText, fontSize: '14px', color: '#4FA3CE', textDecoration: 'none' }}>
                {label}
              </a>
            ) : (
              <span style={{ fontFamily: SFText, fontSize: '14px', color: '#7a7a7a' }}>{label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioCard() {
  return (
    <div style={{
      background: '#fff', borderRadius: '18px',
      padding: '24px 36px', border: '1px solid #e0e0e0', marginTop: '20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
    }}>
      <div>
        <p style={{ fontFamily: SFText, fontSize: '13px', color: '#7a7a7a', margin: '0 0 4px' }}>
          Want to know more about me?
        </p>
        <p style={{ fontFamily: SF, fontSize: '15px', fontWeight: 600, color: '#1d1d1f', margin: 0 }}>
          Visit my portfolio
        </p>
      </div>
      <a
        href="https://portfolioharsha.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: '#4FA3CE', color: '#fff',
          padding: '10px 18px', borderRadius: '9999px',
          fontSize: '14px', fontWeight: 600, fontFamily: SFText,
          textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        <Globe size={14} />
        portfolioharsha.vercel.app
      </a>
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
    <div style={{ minHeight: '100svh', background: '#fafafc', padding: '48px 24px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>

        {/* 1. Feedback form — first thing */}
        {submitted ? (
          <div style={{
            background: '#fff', borderRadius: '18px', padding: '48px 36px',
            border: '1px solid #e0e0e0', textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🙏</div>
            <h2 style={{ fontFamily: SF, fontSize: '26px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 10px' }}>
              Thank you!
            </h2>
            <p style={{ fontFamily: SFText, fontSize: '16px', color: '#7a7a7a', margin: 0 }}>
              Your feedback means a lot. It genuinely helps make ToWin better.
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '18px', padding: '36px', border: '1px solid #e0e0e0' }}>
            <h2 style={{ fontFamily: SF, fontSize: '26px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 6px' }}>
              Share Your Feedback
            </h2>
            <p style={{ fontFamily: SFText, fontSize: '15px', color: '#7a7a7a', margin: '0 0 24px' }}>
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Name, Email, Phone */}
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

              <div style={{ height: '1px', background: '#e0e0e0' }} />

              {/* Message — most important */}
              <div>
                <label style={labelStyle}>Message <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea required rows={5}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Tell us anything — bugs, ideas, impressions, anything at all..."
                />
              </div>

              <div style={{ height: '1px', background: '#e0e0e0' }} />

              {/* Rate the app */}
              <div>
                <p style={{ ...labelStyle, marginBottom: '14px' }}>
                  Rate the app <span style={{ color: '#a0a0a5', fontWeight: 400 }}>(optional)</span>
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {RATINGS.map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: SFText, fontSize: '14px', color: '#1d1d1f', minWidth: '120px' }}>{label}</span>
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

        {/* 2. Creator bio — after the form */}
        <CreatorCard />

        {/* 3. Portfolio link — last */}
        <PortfolioCard />

      </div>
    </div>
  );
}
