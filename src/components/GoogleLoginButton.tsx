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

export function GoogleLoginButton({ onSuccess }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<{ googleEnabled: boolean; clientId: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((d) => { if (alive) setConfig(d); })
      .catch(() => { if (alive) setConfig({ googleEnabled: false, clientId: '' }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!config?.googleEnabled || !config.clientId || !containerRef.current) return;
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
  }, [config, onSuccess]);

  if (!config) {
    return <p className="text-xs text-gray-500">Memeriksa konfigurasi Google Sign-In…</p>;
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
