import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

function HeroPanel() {
  return (
    <div style={{
      flex: '0 0 55%',
      background: 'linear-gradient(-45deg, #004499, #0066cc, #5856d6, #003380)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 10s ease infinite',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '64px 56px',
    }}>
      {/* Decorative floating shapes */}
      <div style={{
        position: 'absolute', width: '420px', height: '420px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
        top: '-80px', right: '-100px',
        animation: 'float 7s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: '280px', height: '280px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
        bottom: '-60px', left: '-60px',
        animation: 'floatReverse 9s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: '180px', height: '180px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
        bottom: '30%', right: '15%',
        animation: 'float 11s ease-in-out infinite',
      }} />

      {/* Connection network SVG */}
      <svg style={{ position: 'absolute', bottom: '80px', right: '40px', opacity: 0.12 }}
        width="260" height="220" viewBox="0 0 260 220" fill="none">
        <circle cx="130" cy="40" r="24" stroke="white" strokeWidth="2"/>
        <circle cx="40" cy="180" r="18" stroke="white" strokeWidth="2"/>
        <circle cx="220" cy="180" r="18" stroke="white" strokeWidth="2"/>
        <line x1="130" y1="64" x2="40" y2="162" stroke="white" strokeWidth="1.5"/>
        <line x1="130" y1="64" x2="220" y2="162" stroke="white" strokeWidth="1.5"/>
        <line x1="58" y1="180" x2="202" y2="180" stroke="white" strokeWidth="1"/>
        <circle cx="130" cy="40" r="6" fill="white"/>
        <circle cx="40" cy="180" r="5" fill="white"/>
        <circle cx="220" cy="180" r="5" fill="white"/>
      </svg>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '48px' }}>
          <p style={{
            fontSize: '28px', fontWeight: 700, color: '#fff',
            letterSpacing: '-0.5px', marginBottom: '4px',
            fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
          }}>
            ToWin
          </p>
          <div style={{ width: '32px', height: '3px', background: 'rgba(255,255,255,0.5)', borderRadius: '2px' }} />
        </div>

        <h1 style={{
          fontSize: '42px', fontWeight: 700, color: '#fff',
          lineHeight: 1.1, letterSpacing: '-1px', marginBottom: '20px',
          fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif",
        }}>
          Connecting<br />generations,<br />building trust.
        </h1>

        <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.75)', marginBottom: '48px', lineHeight: 1.6 }}>
          A trusted platform where elders find helpers and helpers find purpose — all through real human connection.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            ['Verified identities', 'ID and phone verification for every member'],
            ['Location-based matching', 'Find helpers and elders near you'],
            ['Trust score engine', 'Built on real interactions, not ratings'],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px',
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>{title}</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.role, data.userId);
      navigate(data.role === 'ADMIN' ? '/admin' : '/dashboard');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100svh', display: 'flex' }}>
      {/* Left: Hero */}
      <HeroPanel />

      {/* Right: Form */}
      <div style={{
        flex: '0 0 45%',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 56px',
      }}>
        <div style={{ width: '100%', maxWidth: '360px', animation: 'fadeSlideUp 0.5s ease forwards' }}>
          <div style={{ marginBottom: '36px' }}>
            <p style={{ fontSize: '30px', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '8px',
              fontFamily: "-apple-system, 'SF Pro Display', system-ui, sans-serif" }}>
              Welcome back
            </p>
            <p style={{ fontSize: '15px', color: '#6e6e73' }}>Sign in to your ToWin account</p>
          </div>

          {error && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fecaca',
              borderRadius: '12px', padding: '12px 16px',
              fontSize: '14px', color: '#c62828',
              marginBottom: '20px',
              animation: 'scaleIn 0.2s ease',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label className="field-label">Email address</label>
              <input
                type="email" autoComplete="email" required
                className="input-field"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="field-label">Password</label>
              <input
                type="password" autoComplete="current-password" required
                className="input-field"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="btn-primary"
              style={{ width: '100%', marginTop: '4px', fontSize: '17px', padding: '14px' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: '#6e6e73' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: '#0066cc', fontWeight: 600, textDecoration: 'none' }}>
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
