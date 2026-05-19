import { useEffect, useRef } from 'react';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import ConsolePage from './pages/ConsolePage';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const login = useAuthStore((s) => s.login);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current || isAuthenticated) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem('jvscrew_auth');
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.externalUserId) {
          void login(data.externalUserId);
        }
      }
    } catch { /* ignore */ }
  }, [isAuthenticated, login]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-black/50">正在恢复登录...</span>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <ConsolePage /> : <LoginPage />;
}
