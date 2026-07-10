import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/login" replace />;
  return children;
}
