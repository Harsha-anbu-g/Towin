import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import AuroraBackground from '../components/magic/AuroraBackground';
import BlurFade from '../components/magic/BlurFade';
import ShimmerButton from '../components/magic/ShimmerButton';

function HeroPanel() {
  return (
    <AuroraBackground style={{ flex: '0 0 42%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 48px', minHeight: '100svh' }}>
        <BlurFade delay={1}>
          <p style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.3px', marginBottom: '52px' }}>
            ToWin
          </p>
        </BlurFade>

        <BlurFade delay={2}>
          <h1 className="font-display" style={{ fontSize: '44px', lineHeight: 1.1, color: '#fff', marginBottom: '20px' }}>
            Your community<br /><em>is waiting</em><br />for you.
          </h1>
        </BlurFade>

        <BlurFade delay={3}>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, marginBottom: '48px', maxWidth: '280px' }}>
            Join thousands of elders and helpers building real, trusted connections every day.
          </p>
        </BlurFade>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            'Free to join — no credit card',
            'Verified and safe community',
            'Your data stays private',
          ].map((text, i) => (
            <BlurFade key={text} delay={i + 4}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: '1px solid rgba(255,255,255,0.2)',
                }}>
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>{text}</span>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </AuroraBackground>
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
      <HeroPanel />

      <div style={{
        flex: '0 0 58%',
        background: 'var(--canvas)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 64px',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <BlurFade delay={1}>
            <div style={{ marginBottom: '32px' }}>
              <h2 className="font-display" style={{ fontSize: '36px', color: 'var(--ink)', marginBottom: '8px', letterSpacing: '-0.3px' }}>
                Create your account
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--ink-2)' }}>Connect, help, and belong</p>
            </div>
          </BlurFade>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '12px', padding: '12px 16px',
              fontSize: '14px', color: '#dc2626', marginBottom: '20px',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <BlurFade delay={2}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Email address</label>
                <input type="email" autoComplete="email" required className="field"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com" />
              </div>
            </BlurFade>

            <BlurFade delay={3}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Phone number</label>
                <input type="tel" required className="field"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 555 000 0000" />
              </div>
            </BlurFade>

            <BlurFade delay={4}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>Password</label>
                <input type="password" autoComplete="new-password" required className="field"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Create a password" />
              </div>
            </BlurFade>

            <BlurFade delay={5}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>I am joining as</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {ROLES.map(({ value, label, desc }) => {
                    const active = form.role === value;
                    return (
                      <button key={value} type="button" onClick={() => setForm({ ...form, role: value })}
                        style={{
                          padding: '12px 8px',
                          borderRadius: '14px',
                          border: active ? '2px solid var(--blue)' : '1.5px solid var(--border)',
                          background: active ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : 'var(--canvas)',
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.15s',
                          transform: active ? 'scale(1.02)' : 'scale(1)',
                        }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: active ? 'var(--blue)' : 'var(--ink)', marginBottom: '3px' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: '11px', color: active ? 'var(--blue-light)' : 'var(--ink-3)', lineHeight: 1.3 }}>
                          {desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </BlurFade>

            <BlurFade delay={6}>
              <ShimmerButton type="submit" disabled={loading} style={{ width: '100%', marginTop: '4px', padding: '14px 28px', fontSize: '16px' }}>
                {loading ? 'Creating account…' : 'Create Account'}
              </ShimmerButton>
            </BlurFade>
          </form>

          <BlurFade delay={7}>
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--ink-2)' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
              </p>
            </div>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
