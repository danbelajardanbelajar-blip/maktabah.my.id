import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, LogIn, LogOut, ShieldCheck, User, X } from 'lucide-react';
import { clearUserSession, getSavedUser, getUserToken, userAuthHeaders } from '../lib/user-auth';
import type { AuthUser } from '../lib/user-auth';
import { GoogleLoginButton } from './GoogleLoginButton';
import type { AppTab } from '../lib/navigation';

interface Props {
  onNavigate: (tab: AppTab) => void;
  onReadBook: (bookId: number) => void;
}

export function DesktopAccountMenu({ onNavigate, onReadBook }: Props) {
  const [user, setUser] = useState<AuthUser | null>(() => getSavedUser());
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState<{ openedBooks: any[]; feedback: any[]; book_requests: any[]; book_submissions: any[] } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setUser(getSavedUser());
    window.addEventListener('userAuthUpdated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('userAuthUpdated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const token = getUserToken();
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (d?.user) {
          localStorage.setItem('userProfile', JSON.stringify(d.user));
          setUser(d.user);
        }
      })
      .catch(() => {
        clearUserSession();
      });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const loadActivity = async () => {
    setActivityOpen(true);
    setMenuOpen(false);
    setActivity(null);
    try {
      const [booksRes, actRes] = await Promise.all([
        fetch('/api/user/opened-books', { headers: userAuthHeaders() }),
        fetch('/api/user/activity', { headers: userAuthHeaders() }),
      ]);
      const booksData = booksRes.ok ? await booksRes.json() : { data: [] };
      const actData = actRes.ok ? await actRes.json() : { feedback: [], book_requests: [], book_submissions: [] };
      setActivity({
        openedBooks: booksData.data || [],
        feedback: actData.feedback || [],
        book_requests: actData.book_requests || [],
        book_submissions: actData.book_submissions || [],
      });
    } catch {
      setActivity({ openedBooks: [], feedback: [], book_requests: [], book_submissions: [] });
    }
  };

  const handleLogout = async () => {
    const token = getUserToken();
    const adminToken = localStorage.getItem('adminToken') || '';
    setMenuOpen(false);
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
    <div className="hidden xl:flex items-center relative" ref={menuRef}>
      {!user ? (
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold border border-white/20 transition-colors"
        >
          <LogIn size={16} /> Masuk
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold border border-white/20 transition-colors"
          >
            {user.picture ? (
              <img src={user.picture} alt="" className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User size={16} />
            )}
            <span className="max-w-[130px] truncate">{user.name || user.email}</span>
            <ChevronDown size={14} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 rounded-xl bg-white text-gray-800 shadow-xl border border-black/10 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-bold truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onNavigate('admin'); }}
                  className="w-full px-4 py-2.5 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                >
                  <ShieldCheck size={16} /> Panel Admin
                </button>
              )}
              <button
                type="button"
                onClick={loadActivity}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <BookOpen size={16} /> Aktivitas Saya
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100 mt-1"
              >
                <LogOut size={16} /> Keluar
              </button>
            </div>
          )}
        </>
      )}

      {loginOpen && (
        <div className="hidden xl:flex fixed inset-0 z-[100] bg-black/50 items-center justify-center p-4" onClick={() => setLoginOpen(false)}>
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Masuk dengan Google</h3>
              <button type="button" onClick={() => setLoginOpen(false)} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Masuk agar riwayat kitab yang dibuka, feedback, request kitab, dan kiriman kitab tersimpan di akun Anda.
            </p>
            <GoogleLoginButton onSuccess={() => setLoginOpen(false)} />
          </div>
        </div>
      )}

      {activityOpen && (
        <div className="hidden xl:flex fixed inset-0 z-[100] bg-black/50 items-center justify-center p-4" onClick={() => setActivityOpen(false)}>
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[82vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Aktivitas Akun Saya</h3>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button type="button" onClick={() => setActivityOpen(false)} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              {!activity ? (
                <p className="text-gray-500">Memuat data akun…</p>
              ) : (
                <>
                  <section>
                    <h4 className="font-bold mb-2">Kitab yang Dibuka ({activity.openedBooks.length})</h4>
                    {activity.openedBooks.length ? (
                      <div className="space-y-1.5">
                        {activity.openedBooks.slice(0, 10).map((b: any) => (
                          <button
                            key={b.bkid}
                            type="button"
                            onClick={() => { setActivityOpen(false); onReadBook(b.bkid); }}
                            className="w-full text-right p-2.5 rounded-lg border hover:bg-gray-50 block"
                            dir="rtl"
                            style={{ fontFamily: 'var(--arabic-font)' }}
                          >
                            {b.bk}
                          </button>
                        ))}
                      </div>
                    ) : <p className="text-gray-500 text-xs">Belum ada riwayat kitab.</p>}
                  </section>

                  <section>
                    <h4 className="font-bold mb-2">Request Kitab ({activity.book_requests.length})</h4>
                    {activity.book_requests.length ? (
                      <ul className="space-y-1.5">
                        {activity.book_requests.map((r: any) => (
                          <li key={r.id} className="p-2.5 rounded-lg border flex justify-between gap-2">
                            <span dir="auto">{r.book_title}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{r.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-gray-500 text-xs">Belum ada request kitab.</p>}
                  </section>

                  <section>
                    <h4 className="font-bold mb-2">Kirim Kitab ({activity.book_submissions.length})</h4>
                    {activity.book_submissions.length ? (
                      <ul className="space-y-1.5">
                        {activity.book_submissions.map((s: any) => (
                          <li key={s.id} className="p-2.5 rounded-lg border flex justify-between gap-2">
                            <span dir="auto">{s.book_title}</span>
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{s.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-gray-500 text-xs">Belum ada kiriman kitab.</p>}
                  </section>

                  <section>
                    <h4 className="font-bold mb-2">Feedback ({activity.feedback.length})</h4>
                    {activity.feedback.length ? (
                      <ul className="space-y-1.5">
                        {activity.feedback.map((f: any) => (
                          <li key={f.id} className="p-2.5 rounded-lg border">
                            <p className="text-gray-800">{f.message}</p>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-gray-500 text-xs">Belum ada feedback.</p>}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
