import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { landingPathForRole } from '../lib/landingPath';

/**
 * The three route guards, kept out of App.jsx so they can be imported and
 * tested directly. A guard that can only be exercised through the whole app
 * cannot be defended by a test — mirroring its logic inside a test file would
 * only prove the mirror agrees with itself.
 */

/** Signed in, any role. */
export function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

/** Landing, login, register — anyone signed in gets sent to their own home. */
export function PublicRoute({ children }) {
  const { user } = useAuth();
  if (!user) return children;
  // One rule, shared with every sign-in path — see lib/landingPath.js.
  return <Navigate to={landingPathForRole(user.role)} replace />;
}

/**
 * Elder-only pages: the daily check-in, My Family, emergency contacts.
 * BOTH counts as an elder. Helpers and family members are not shown an error —
 * they simply get their own dashboard.
 */
export function ElderOnly({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ELDER' || user.role === 'BOTH') return children;
  return <Navigate to="/dashboard" replace />;
}
