import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'inherit', color: 'var(--ink-deep)', lineHeight: 1.7 }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 'var(--text-sm)', marginBottom: 32, padding: 0 }}
      >
        ← Back
      </button>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: 'var(--slate)', fontSize: 'var(--text-sm)', marginBottom: 32 }}>Last updated: June 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>Who can use ToWin</h2>
        <p>ToWin is open to adults aged 18 and over. Elders using the platform must be at least 55 years old. By creating an account you confirm that you meet these requirements and that the information you provide is accurate.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>How it works</h2>
        <p>ToWin connects elderly users with helpers for everyday tasks and companionship. All connections and interactions on the platform are subject to our community guidelines. Users are responsible for their own safety when meeting in person.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>What you must not do</h2>
        <p>You must not use ToWin to harass, deceive, or harm other users. You must not impersonate another person, create fake accounts, or use the platform for commercial solicitation. Violations may result in account suspension or permanent ban.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>Liability</h2>
        <p>ToWin is a platform for connecting people and is not responsible for the actions of its users. We do not guarantee the accuracy of any user-provided information. Use of the platform is at your own risk.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>Contact</h2>
        <p>Questions about these terms? Email <a href="mailto:agharsha.anbu@gmail.com" style={{ color: 'var(--blue)' }}>agharsha.anbu@gmail.com</a>.</p>
      </section>
    </div>
  );
}
