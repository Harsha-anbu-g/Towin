import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'inherit', color: '#2d3748', lineHeight: 1.7 }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 'var(--text-sm)', marginBottom: 32, padding: 0 }}
      >
        ← Back
      </button>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--slate)', fontSize: 'var(--text-sm)', marginBottom: 32 }}>Last updated: June 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>What we collect</h2>
        <p>ToWin collects the information you provide when you create an account (username, date of birth, role), information you add to your profile (name, bio, photo, phone number), and messages you exchange with other users. We also collect your device's approximate location when you choose to share it.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>How we use your data</h2>
        <p>Your data is used to connect elders with helpers, calculate your trust score, send emergency alerts to your nominated contacts, and improve the platform. We do not sell your data to third parties.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>Your rights</h2>
        <p>You have the right to access, correct, or request deletion of your personal data. You can update your profile at any time from the app. To request a full export of your data or account deletion, email <a href="mailto:privacy@towin.app" style={{ color: 'var(--blue)' }}>privacy@towin.app</a>.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>Data storage</h2>
        <p>Your data is stored on servers in the United States. Profile photos and identity documents are stored in Amazon S3. We retain your data for as long as your account is active. If you delete your account, all personal data is removed within 30 days.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 12 }}>Contact</h2>
        <p>For privacy questions or data requests, contact us at <a href="mailto:privacy@towin.app" style={{ color: 'var(--blue)' }}>privacy@towin.app</a>.</p>
      </section>
    </div>
  );
}
