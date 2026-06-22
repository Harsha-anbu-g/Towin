import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 on a request that carried a token means the session is dead
// (expired or rejected) — log the user out so pages don't render silently
// empty. A 403 is different: the user IS authenticated but lacks an
// authority (e.g. an unverified email hitting a gated write). That must NOT
// log them out — the calling code / verify banner handles it.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const hadToken = !!error?.config?.headers?.Authorization;
    const onAuthPage = ['/', '/login', '/register'].includes(window.location.pathname);
    if (status === 401 && hadToken && !onAuthPage) {
      localStorage.removeItem('token');
      // Tell the login page why the user is suddenly here (H9: help recover from errors).
      try { sessionStorage.setItem('sessionExpired', '1'); } catch { /* ignore */ }
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
