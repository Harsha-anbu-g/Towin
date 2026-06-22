import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import Register from './pages/Register';
import Login from './pages/Login';
import Landing from './pages/Landing';
import ElderDashboard from './pages/ElderDashboard';
import HelperDashboard from './pages/HelperDashboard';
import ProfileEdit from './pages/ProfileEdit';
import ChangePassword from './pages/ChangePassword';
import EmergencyContacts from './pages/EmergencyContacts';
import Messages from './pages/Messages';
import MessagesInbox from './pages/MessagesInbox';
import Admin from './pages/Admin';
import AdminRoute from './components/AdminRoute';
import Trust from './pages/Trust';
import Streaks from './pages/Streaks';
import UserProfile from './pages/UserProfile';
import PeekabooGame from './pages/PeekabooGame';
import BetaBanner from './components/BetaBanner';
import FeedbackWidget from './components/FeedbackWidget';
import CookieConsent from './components/CookieConsent';
import VerifyBanner from './components/VerifyBanner';
import VerifyEmail from './pages/VerifyEmail';
import Feedback from './pages/Feedback';
import Guide from './pages/Guide';
import OAuthCallback from './pages/OAuthCallback';
import FinishSetup from './pages/FinishSetup';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

function BfCacheGuard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handlePageShow = (e) => {
      if (!e.persisted) return;
      const path = window.location.pathname;
      const isPublic = ['/', '/login', '/register', '/auth/callback', '/auth/setup'].includes(path);
      const isProtected = !isPublic && path !== '/feedback' && path !== '/how-it-works';
      if (isPublic && user) {
        // Login page restored from bfcache while logged in → log out
        // so pressing forward to a protected page requires re-login
        logout();
      } else if (isProtected && !user) {
        navigate('/login', { replace: true });
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [user, logout, navigate]);

  return null;
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  // Elders land on the daily check-in first — keeps the post-login flow
  // consistent even when navigation races the auth context update
  if (user.role === 'ELDER' || user.role === 'BOTH') return <Navigate to="/streaks" replace />;
  return <Navigate to="/dashboard" replace />;
}

function ElderOnly({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ELDER' || user.role === 'BOTH') return children;
  return <Navigate to="/dashboard" replace />;
}

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'HELPER') return <HelperDashboard />;
  return <ElderDashboard />;
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* App shell: the beta banner takes its own height and the routed
              content fills whatever viewport space is left. Without this, any
              100svh page sits *below* the banner and its bottom is pushed
              off-screen by the banner's height. */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100svh' }}>
          <BetaBanner />
          <VerifyBanner />
          <BfCacheGuard />
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <Routes>
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/how-it-works" element={<Guide />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/auth/setup" element={<FinishSetup />} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardRouter /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfileEdit /></PrivateRoute>} />
            <Route path="/profile/change-password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
            <Route path="/emergency-contacts" element={<ElderOnly><EmergencyContacts /></ElderOnly>} />
            <Route path="/messages" element={<PrivateRoute><MessagesInbox /></PrivateRoute>} />
            <Route path="/messages/:connectionId" element={<PrivateRoute><Messages /></PrivateRoute>} />
            <Route path="/streaks" element={<ElderOnly><Streaks /></ElderOnly>} />
            <Route path="/game" element={<PrivateRoute><PeekabooGame /></PrivateRoute>} />
            <Route path="/trust" element={<PrivateRoute><Trust /></PrivateRoute>} />
            <Route path="/user/:id" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </div>
          <FeedbackWidget />
          <CookieConsent />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
