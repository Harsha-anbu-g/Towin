import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import AuroraBackground from '../components/magic/AuroraBackground';
import BlurFade from '../components/magic/BlurFade';
import ShimmerButton from '../components/magic/ShimmerButton';

function HeroPanel() {
  return (
    <AuroraBackground style={{ flex: '0 0 44%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 52px', minHeight: '100svh' }}>
        <BlurFade delay={1}>
          <p style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.3px', marginBottom: '52px', fontFamily: 'var(--font-body)' }}>
            ToWin
          </p>
        </BlurFade>

        <BlurFade delay={2}>
          <h1 className="font-display" style={{ fontSize: '48px', lineHeight: 1.08, color: '#fff', marginBottom: '20px', letterSpacing: '-0.5px' }}>
            Connecting<br /><em>generations,</em><br />building trust.
          </h1>
        </BlurFade>

        <BlurFade delay={3}>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.75, marginBottom: '48px', maxWidth: '300px' }}>
            A safe, verified community where elders and helpers find each other.
          </p>
        </BlurFade>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {[
            '12,000+ verified members',
            'Trust score system',
            'Completely free to join',
          ].map((text, i) => (
            <BlurFade key={text} delay={i + 4}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>✦</span>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', fontWeight: 400 }}>{text}</span>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </AuroraBackground>
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
      <HeroPanel />

      <div style={{
        flex: '0 0 56%',
        background: 'var(--canvas)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 64px',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <BlurFade delay={1}>
            <div style={{ marginBottom: '36px' }}>
              <h2 className="font-display" style={{ fontSize: '38px', color: 'var(--ink)', marginBottom: '8px', letterSpacing: '-0.3px' }}>
                Welcome back
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--ink-2)' }}>Sign in to your account</p>
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
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Email address
                </label>
                <input
                  type="email" required autoComplete="email"
                  className="field"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>
            </BlurFade>

            <BlurFade delay={3}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password" required autoComplete="current-password"
                  className="field"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </BlurFade>

            <BlurFade delay={4}>
              <ShimmerButton type="submit" disabled={loading} style={{ width: '100%', marginTop: '4px', padding: '14px 28px', fontSize: '16px' }}>
                {loading ? 'Signing in…' : 'Sign in'}
              </ShimmerButton>
            </BlurFade>
          </form>

          <BlurFade delay={5}>
            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--ink-2)' }}>
                Don't have an account?{' '}
                <Link to="/register" style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'none' }}>
                  Create one
                </Link>
              </p>
            </div>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
