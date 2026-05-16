import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import BlurFade from '../components/magic/BlurFade';
import ShimmerButton from '../components/magic/ShimmerButton';

const unsplash = (id, w = 400, h = 300) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const COMMUNITY_PHOTOS = [
  'photo-1529156069898-49953e39b3ac',
  'photo-1544005313-94ddf0286df2',
  'photo-1507679799987-c73779587ccf',
  'photo-1438761681033-6461ffad8d80',
  'photo-1534528741775-53994a69daeb',
  'photo-1573497491208-6b1acb260507',
];

function HeroPanel() {
  return (
    <div style={{
      flex: '0 0 42%',
      background: '#020817',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '52px 44px',
      minHeight: '100svh',
    }}>
      {/* Background photo */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <LazyLoadImage
          src={unsplash('photo-1529156069898-49953e39b3ac', 900, 1200)}
          alt="Community"
          effect="blur"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(2,8,23,0.96) 0%, rgba(2,8,23,0.6) 45%, rgba(2,8,23,0.15) 100%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(5,150,105,0.25) 0%, transparent 55%)',
        }} />
      </div>

      {/* Logo */}
      <div style={{ position: 'absolute', top: '32px', left: '44px', zIndex: 2 }}>
        <p style={{ fontSize: '17px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-body)' }}>ToWin</p>
      </div>

      {/* Community photo mosaic — right side vertical strip */}
      <div style={{
        position: 'absolute', top: '60px', right: '20px', bottom: '220px', zIndex: 2,
        display: 'flex', flexDirection: 'column', gap: '6px', width: '80px',
      }}>
        {COMMUNITY_PHOTOS.slice(0, 4).map((id) => (
          <div key={id} style={{ flex: 1, borderRadius: '10px', overflow: 'hidden' }}>
            <LazyLoadImage
              src={unsplash(id, 160, 160)}
              alt=""
              effect="blur"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
            />
          </div>
        ))}
      </div>

      {/* Bottom text */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <BlurFade delay={2}>
          <h1 className="font-display" style={{ fontSize: '40px', lineHeight: 1.1, color: '#fff', marginBottom: '14px' }}>
            Your community<br /><em>is waiting</em><br />for you.
          </h1>
        </BlurFade>

        <BlurFade delay={3}>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.7, marginBottom: '28px', maxWidth: '240px' }}>
            Join thousands of elders and helpers building real, trusted connections every day.
          </p>
        </BlurFade>

        <BlurFade delay={4}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {['Free to join — no credit card', 'Verified and safe community', 'Your data stays private'].map((text) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                    <path d="M1 2.5L2.8 4L6 1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>{text}</span>
              </div>
            ))}
          </div>
        </BlurFade>
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
                          padding: '12px 8px', borderRadius: '14px',
                          border: active ? '2px solid var(--blue)' : '1.5px solid var(--border)',
                          background: active ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : 'var(--canvas)',
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
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
