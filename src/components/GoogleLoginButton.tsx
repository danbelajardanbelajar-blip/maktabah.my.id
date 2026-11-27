import { useEffect, useRef, useState } from 'react';
import { saveUserSession } from '../lib/user-auth';
import type { AuthUser } from '../lib/user-auth';

declare global {
  interface Window {
    google?: any;
  }
}

interface Props {
  onSuccess?: (result: { user: AuthUser; redirectTo: string; adminToken?: string | null }) => void;
}

const isMaktabahApp = () => typeof navigator !== 'undefined' && navigator.userAgent.includes('MaktabahApp/');

export function GoogleLoginButton({ onSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<{ googleEnabled: boolean; appOAuthEnabled?: boolean; clientId: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inApp = isMaktabahApp();

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((d) => { if (alive) setConfig(d); })
      .catch(() => { if (alive) setConfig({ googleEnabled: false, appOAuthEnabled: false, clientId: '' }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (inApp || !config?.googleEnabled || !config.clientId || !containerRef.current) return;
    let cancelled = false;

    const handleCredential = async (response: { credential?: string }) => {
      if (!response?.credential) return;
      setBusy(true);
      setError('');
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Login Google gagal.');
        saveUserSession({
          user: data.user,
          userToken: data.userToken,
          adminToken: data.adminToken,
        });
        const target = data.redirectTo || (data.user?.role === 'admin' ? '#/admin' : '#/');
        if (window.location.hash !== target) {
          window.location.hash = target;
        }
        window.dispatchEvent(new Event('maktabah:navigate'));
        onSuccess?.({ user: data.user, redirectTo: target, adminToken: data.adminToken });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Login Google gagal.');
      } finally {
        setBusy(false);
      }
    };

    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        locale: 'id',
        width: 280,
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
      return () => { cancelled = true; };
    }

    const existing = document.querySelector('script[data-google-gsi="1"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', renderButton);
      return () => { cancelled = true; existing.removeEventListener('load', renderButton); };
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = '1';
    script.onload = renderButton;
    script.onerror = () => { if (!cancelled) setError('Gagal memuat layanan Google Sign-In.'); };
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [config, inApp, onSuccess]);

  if (!config) {
    return <p className="text-xs text-gray-500">Memeriksa konfigurasi Google Sign-In…</p>;
  }

  if (inApp) {
    if (!config.appOAuthEnabled) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Login Google di aplikasi belum aktif. Pastikan <code className="font-mono font-semibold">GOOGLE_CLIENT_ID</code> dan <code className="font-mono font-semibold">GOOGLE_CLIENT_SECRET</code> sudah diatur di server.
        </div>
      );
    }
    return (
      <a
        href="/api/auth/google/start?app=1"
        className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm shadow-sm transition-colors"
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"/><path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"/></svg>
        Masuk dengan Google
      </a>
    );
  }

  if (!config.googleEnabled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Login Google belum aktif di server. Atur environment variable <code className="font-mono font-semibold">GOOGLE_CLIENT_ID</code> untuk mengaktifkan tombol masuk Google.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="flex justify-center min-h-[44px]" />
      {busy && <p className="text-xs text-center text-gray-500">Memverifikasi akun Google…</p>}
      {error && <p role="alert" className="text-xs text-red-600 text-center">{error}</p>}
    </div>
  );
}
