import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-blue-700">Join ToWin</h1>
        <p className="text-center text-gray-500 mb-6">Connect, help, and belong.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-base mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-lg font-medium mb-1 text-gray-700">Email</label>
            <input
              type="email"
              className="w-full border-2 border-gray-300 rounded-xl p-3 text-lg focus:border-blue-500 focus:outline-none"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-lg font-medium mb-1 text-gray-700">Phone Number</label>
            <input
              type="tel"
              placeholder="+1234567890"
              className="w-full border-2 border-gray-300 rounded-xl p-3 text-lg focus:border-blue-500 focus:outline-none"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-lg font-medium mb-1 text-gray-700">Password</label>
            <input
              type="password"
              className="w-full border-2 border-gray-300 rounded-xl p-3 text-lg focus:border-blue-500 focus:outline-none"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-lg font-medium mb-2 text-gray-700">I am joining as:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'ELDER', label: 'Elder', desc: 'Looking for friends or help' },
                { value: 'HELPER', label: 'Helper', desc: 'Want to help others' },
                { value: 'BOTH', label: 'Both', desc: 'Elder and helper' },
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, role: value })}
                  className={`p-3 rounded-xl border-2 text-left transition-colors
                    ${form.role === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:border-blue-400 text-gray-700'}`}
                >
                  <div className="font-semibold text-base">{label}</div>
                  <div className={`text-xs mt-0.5 ${form.role === value ? 'text-blue-100' : 'text-gray-400'}`}>
                    {desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white text-xl py-4 rounded-xl font-bold
                       hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-base mt-5 text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
