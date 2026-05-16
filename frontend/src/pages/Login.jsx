import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import BlurFade from '../components/magic/BlurFade';
import ShimmerButton from '../components/magic/ShimmerButton';

/* Curated Unsplash photos — elderly + community lifestyle */
const PHOTOS = [
  { id: 'photo-1576765974256-9b879d60a571', alt: 'Elder with helper' },
  { id: 'photo-1529156069898-49953e39b3ac', alt: 'Community friends' },
  { id: 'photo-1559839734-2b71ea197ec2', alt: 'Smiling elder woman' },
  { id: 'photo-1507679799987-c73779587ccf', alt: 'Elder gentleman' },
];

const unsplash = (id, w = 400, h = 300) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

function HeroPanel() {
  return (
    <div style={{
      flex: '0 0 46%',
      background: '#020817',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '52px 48px',
      minHeight: '100svh',
    }}>
      {/* Full-bleed lifestyle photo */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <LazyLoadImage
          src={unsplash('photo-1576765974256-9b879d60a571', 900, 1100)}
          alt="Elder and helper together"
          effect="blur"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
        />
        {/* Dark gradient overlay so text reads */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(2,8,23,0.95) 0%, rgba(2,8,23,0.55) 50%, rgba(2,8,23,0.2) 100%)',
        }} />
        {/* Aurora tint overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(37,99,235,0.3) 0%, transparent 60%)',
        }} />
      </div>

      {/* Logo top-left */}
      <div style={{ position: 'absolute', top: '32px', left: '48px', zIndex: 2 }}>
        <p style={{ fontSize: '17px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-body)' }}>
          ToWin
        </p>
      </div>

      {/* Photo grid — top right corner mosaic */}
      <div style={{
        position: 'absolute', top: '24px', right: '24px', zIndex: 2,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
        width: '120px',
      }}>
        {PHOTOS.slice(1).map(({ id, alt }) => (
          <div key={id} style={{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '1' }}>
            <LazyLoadImage
              src={unsplash(id, 120, 120)}
              alt={alt}
              effect="blur"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
            />
          </div>
        ))}
      </div>

      {/* Bottom content */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <BlurFade delay={2}>
          <h1 className="font-display" style={{ fontSize: '44px', lineHeight: 1.1, color: '#fff', marginBottom: '16px', letterSpacing: '-0.3px' }}>
            Connecting<br /><em>generations,</em><br />building trust.
          </h1>
        </BlurFade>

        <BlurFade delay={3}>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: '32px', maxWidth: '280px' }}>
            A safe, verified community where elders and helpers find each other.
          </p>
        </BlurFade>

        {/* Social proof avatars */}
        <BlurFade delay={4}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex' }}>
              {PHOTOS.map(({ id }, i) => (
                <div key={id} style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.8)',
                  overflow: 'hidden', marginLeft: i === 0 ? 0 : '-10px',
                  position: 'relative', zIndex: PHOTOS.length - i,
                }}>
                  <LazyLoadImage
                    src={unsplash(id, 64, 64)}
                    alt=""
                    effect="blur"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    wrapperProps={{ style: { width: '100%', height: '100%', display: 'block' } }}
                  />
                </div>
              ))}
            </div>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              <strong style={{ color: '#fff' }}>12,000+</strong> members joined
            </p>
          </div>
        </BlurFade>
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
      <HeroPanel />

      <div style={{
        flex: '0 0 54%',
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
