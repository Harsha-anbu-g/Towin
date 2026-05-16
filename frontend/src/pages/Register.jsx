import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const inputStyle = {
  width: '100%',
  border: '1px solid #d2d2d7',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '17px',
  color: '#1d1d1f',
  outline: 'none',
  transition: 'border-color 0.15s',
  background: '#fff',
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#6e6e73',
  marginBottom: '6px',
};

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
    <div style={{ minHeight: '100svh', background: '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={{ fontSize: '28px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: '8px' }}>
            Join ToWin
          </p>
          <p style={{ fontSize: '15px', color: '#6e6e73' }}>Connect, help, and belong</p>
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
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0066cc'}
                onBlur={e => e.target.style.borderColor = '#d2d2d7'}
              />
            </div>

            <div>
              <label style={labelStyle}>Phone Number</label>
              <input
                type="tel"
                placeholder="+1 555 000 0000"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0066cc'}
                onBlur={e => e.target.style.borderColor = '#d2d2d7'}
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0066cc'}
                onBlur={e => e.target.style.borderColor = '#d2d2d7'}
              />
            </div>

            <div>
              <label style={labelStyle}>I am joining as</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {ROLES.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, role: value })}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '12px',
                      border: form.role === value ? '2px solid #0066cc' : '1px solid #d2d2d7',
                      background: form.role === value ? '#e8f0fe' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: form.role === value ? '#0066cc' : '#1d1d1f',
                    }}>{label}</div>
                    <div style={{
                      fontSize: '11px',
                      color: form.role === value ? '#0066cc' : '#86868b',
                      marginTop: '2px',
                    }}>{desc}</div>
                  </button>
                ))}
              </div>
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
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '14px', color: '#6e6e73', marginTop: '20px' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#0066cc', textDecoration: 'none', fontWeight: 500 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
