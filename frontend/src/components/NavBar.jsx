import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const isElder = user?.role === 'ELDER' || user?.role === 'BOTH';
  const isHelper = user?.role === 'HELPER' || user?.role === 'BOTH';

  const link = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        pathname === to
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="text-lg font-bold text-indigo-700">ToWin</Link>
        <div className="flex items-center gap-1">
          {link('/dashboard', 'Dashboard')}
          {link('/profile', 'Profile')}
          {isElder && link('/emergency-contacts', 'Emergency Contacts')}
        </div>
      </div>
      <button
        onClick={logout}
        className="text-sm text-red-500 hover:underline"
      >
        Sign out
      </button>
    </nav>
  );
}
