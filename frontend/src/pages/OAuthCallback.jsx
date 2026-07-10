import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  // A missing code / provider error is known at mount — derive it as the
  // initial state instead of setting state synchronously inside the effect.
  const [error, setError] = useState(() =>
    (searchParams.get('error') || !searchParams.get('code'))
      ? 'Could not connect with Google. Please try again.'
      : ''
  );

  useEffect(() => {
    const code = searchParams.get('code');
    if (searchParams.get('error') || !code) return; // error already derived above

    api.post('/auth/oauth/exchange', { code })
      .then(({ data }) => {
        if (data.status === 'READY') {
          login(data.token);
          const role = JSON.parse(atob(data.token.split('.')[1])).role;
          navigate(
            role === 'ADMIN' ? '/admin' :
            (role === 'ELDER' || role === 'BOTH') ? '/streaks' : '/dashboard',
            { replace: true }
          );
        } else if (data.status === 'NEEDS_ONBOARDING') {
          navigate('/auth/setup', {
            replace: true,
            state: {
              onboardingToken: data.onboardingToken,
              email: data.email,
              name: data.name,
            },
          });
        }
      })
      .catch(() => {
        setError('Something went wrong. Please try again.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const SF = '-apple-system, "SF Pro Text", system-ui, sans-serif';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: '40px 24px',
      fontFamily: SF,
    }}>
      {error ? (
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{
            background: 'var(--red-tint)', border: '1px solid var(--red-line)',
            borderRadius: '14px', padding: '20px 24px',
            fontSize: '16px', color: 'var(--red-error)', marginBottom: '20px',
          }}>
            {error}
          </div>
          <button
            onClick={() => navigate('/login', { replace: true })}
            style={{
              height: '44px', padding: '0 28px',
              background: 'var(--action-fill)', color: 'var(--action-ink)',
              border: 'none', borderRadius: '9999px',
              fontSize: '16px', cursor: 'pointer', fontFamily: SF,
            }}
          >
            Back to log in
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--ink-slate)' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '3px solid var(--blue-soft)', borderTopColor: 'var(--blue)',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: '16px', margin: 0 }}>One moment…</p>
        </div>
      )}
    </div>
  );
}
