import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Register from './pages/Register';
import Login from './pages/Login';
import ElderDashboard from './pages/ElderDashboard';
import HelperDashboard from './pages/HelperDashboard';
import ProfileEdit from './pages/ProfileEdit';
import EmergencyContacts from './pages/EmergencyContacts';
import Messages from './pages/Messages';
import Admin from './pages/Admin';
import AdminRoute from './components/AdminRoute';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
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
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardRouter /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfileEdit /></PrivateRoute>} />
          <Route path="/emergency-contacts" element={<ElderOnly><EmergencyContacts /></ElderOnly>} />
          <Route path="/messages/:connectionId" element={<PrivateRoute><Messages /></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
