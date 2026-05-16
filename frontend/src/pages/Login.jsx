import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

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
      if (data.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100svh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ fontSize: '28px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Welcome back
          </p>
          <p style={{ fontSize: '15px', color: '#6e6e73' }}>Sign in to your ToWin account</p>
        </div>

        <div style={{
          background: '#fff',
          border: '1px solid #d2d2d7',
          borderRadius: '18px',
          padding: '32px',
        }}>
          {error && (
            <div style={{
              background: '#fff2f2',
              border: '1px solid #ffcdd2',
              color: '#c62828',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '14px',
              marginBottom: '20px',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6e6e73', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                style={{
                  width: '100%',
                  border: '1px solid #d2d2d7',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '17px',
                  color: '#1d1d1f',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#0066cc'}
                onBlur={e => e.target.style.borderColor = '#d2d2d7'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#6e6e73', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                style={{
                  width: '100%',
                  border: '1px solid #d2d2d7',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  fontSize: '17px',
                  color: '#1d1d1f',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = '#0066cc'}
                onBlur={e => e.target.style.borderColor = '#d2d2d7'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#86868b' : '#0066cc',
                color: '#fff',
                border: 'none',
                borderRadius: '9999px',
                padding: '12px',
                fontSize: '17px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '4px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.target.style.background = '#0071e3'; }}
              onMouseLeave={e => { if (!loading) e.target.style.background = '#0066cc'; }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '14px', color: '#6e6e73', marginTop: '20px' }}>
          New here?{' '}
          <Link to="/register" style={{ color: '#0066cc', textDecoration: 'none', fontWeight: 500 }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
