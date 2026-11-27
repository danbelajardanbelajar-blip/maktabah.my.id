import { useEffect, useState } from 'react';
import { BookOpen, LogOut, ShieldCheck, User } from 'lucide-react';
import { clearUserSession, getSavedUser, getUserToken } from '../lib/user-auth';
import type { AuthUser } from '../lib/user-auth';
import { GoogleLoginButton } from './GoogleLoginButton';
import { UserActivityModal } from './UserActivityModal';
import type { AppTab } from '../lib/navigation';

interface Props {
  onNavigate: (tab: AppTab) => void;
  onReadBook: (bookId: number) => void;
}

export function MobileAccountCard({ onNavigate, onReadBook }: Props) {
  const [user, setUser] = useState<AuthUser | null>(() => getSavedUser());
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    const sync = () => setUser(getSavedUser());
    window.addEventListener('userAuthUpdated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('userAuthUpdated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const handleLogout = async () => {
    const token = getUserToken();
    const adminToken = localStorage.getItem('adminToken') || '';
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ adminToken }),
      });
    } catch {}
    clearUserSession();
    onNavigate('home');
  };

  return (
    <section className="bg-[var(--reader-bg)] rounded-2xl border p-5 space-y-4">
      <h2 className="text-xl font-bold">Akun Google</h2>
      {!user ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Masuk agar riwayat kitab yang dibuka, feedback, request kitab, dan kiriman kitab tersimpan di akun Anda.
          </p>
          <GoogleLoginButton />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {user.picture ? (
              <img src={user.picture} alt="" className="w-11 h-11 rounded-full object-cover border" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[var(--app-primary)]/10 text-[var(--app-primary)] flex items-center justify-center">
                <User size={20} />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-base truncate">{user.name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActivityOpen(true)}
              className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50"
            >
              <BookOpen size={16} /> Aktivitas Saya
            </button>
            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-[var(--app-primary)] text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                <ShieldCheck size={16} /> Panel Admin
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-50"
            >
              <LogOut size={16} /> Keluar
            </button>
          </div>
        </div>
      )}
      <UserActivityModal open={activityOpen} user={user} onClose={() => setActivityOpen(false)} onReadBook={onReadBook} />
    </section>
  );
}
