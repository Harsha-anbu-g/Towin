import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401/403 on a request that carried a token means the session is dead
// (expired or rejected) — only /api/admin/** is role-gated, and that's
// guarded client-side. Without this, every page renders silently empty
// until the user happens to sign out by hand.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const hadToken = !!error?.config?.headers?.Authorization;
    const onAuthPage = ['/', '/login', '/register'].includes(window.location.pathname);
    if ((status === 401 || status === 403) && hadToken && !onAuthPage) {
      localStorage.removeItem('token');
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
