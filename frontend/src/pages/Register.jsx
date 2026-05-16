import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function HeroPanel() {
  return (
    <div style={{
      flex: '0 0 45%',
      background: 'linear-gradient(-45deg, #004499, #0066cc, #5856d6, #003380)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 10s ease infinite',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '64px 48px',
    }}>
      {/* Decorative shapes */}
      <div style={{
        position: 'absolute', width: '360px', height: '360px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        top: '-80px', right: '-80px',
        animation: 'float 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: '240px', height: '240px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)',
        bottom: '-40px', left: '-40px',
        animation: 'floatReverse 10s ease-in-out infinite',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{
          fontSize: '24px', fontWeight: 700, color: '#fff',
          letterSpacing: '-0.5px', marginBottom: '40px',
          fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
        }}>
          ToWin
        </p>

        <h1 style={{
          fontSize: '36px', fontWeight: 700, color: '#fff',
          lineHeight: 1.12, letterSpacing: '-0.8px', marginBottom: '16px',
          fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
        }}>
          Your community<br />is waiting for you.
        </h1>

        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, marginBottom: '40px' }}>
          Join thousands of elders and helpers building real, trusted connections every day.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            'Free to join — no credit card needed',
            'Verified and safe community',
            'Your data stays private',
          ].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#0066cc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)' }}>{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', phone: '', password: '', role: 'ELDER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', form);
      login(data.token, data.role, data.userId);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const ROLES = [
    { value: 'ELDER', label: 'Elder', desc: 'Looking for friends or help' },
    { value: 'HELPER', label: 'Helper', desc: 'Want to help others' },
    { value: 'BOTH', label: 'Both', desc: 'Elder and helper' },
  ];

  return (
    <div style={{ minHeight: '100svh', display: 'flex' }}>
      {/* Left: Hero */}
      <HeroPanel />

      {/* Right: Form */}
      <div style={{
        flex: '0 0 55%',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 56px',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '400px', animation: 'fadeSlideUp 0.5s ease forwards' }}>
          <div style={{ marginBottom: '32px' }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '8px',
              fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}>
              Create your account
            </p>
            <p style={{ fontSize: '15px', color: '#6e6e73' }}>Connect, help, and belong</p>
          </div>

          {error && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fecaca',
              borderRadius: '12px', padding: '12px 16px',
              fontSize: '14px', color: '#c62828', marginBottom: '20px',
              animation: 'scaleIn 0.2s ease',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label className="field-label">Email address</label>
              <input type="email" autoComplete="email" required className="input-field"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com" />
            </div>

            <div>
              <label className="field-label">Phone number</label>
              <input type="tel" required className="input-field"
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 555 000 0000" />
            </div>

            <div>
              <label className="field-label">Password</label>
              <input type="password" autoComplete="new-password" required className="input-field"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Create a password" />
            </div>

            <div>
              <label className="field-label">I am joining as</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {ROLES.map(({ value, label, desc }) => (
                  <button key={value} type="button" onClick={() => setForm({ ...form, role: value })}
                    style={{
                      padding: '12px 8px',
                      borderRadius: '14px',
                      border: form.role === value ? '2px solid #0066cc' : '1px solid #d2d2d7',
                      background: form.role === value ? 'linear-gradient(135deg, #e8f0fe 0%, #dbeafe 100%)' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      transform: form.role === value ? 'scale(1.02)' : 'scale(1)',
                    }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: form.role === value ? '#0066cc' : '#1d1d1f', marginBottom: '3px' }}>
                      {label}
                    </div>
                    <div style={{ fontSize: '11px', color: form.role === value ? '#0066cc' : '#86868b', lineHeight: 1.3 }}>
                      {desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary"
              style={{ width: '100%', marginTop: '4px', padding: '14px', fontSize: '17px' }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#6e6e73' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#0066cc', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
