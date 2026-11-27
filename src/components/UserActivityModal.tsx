import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { userAuthHeaders } from '../lib/user-auth';
import type { AuthUser } from '../lib/user-auth';

interface Props {
  open: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onReadBook: (bookId: number) => void;
}

export function UserActivityModal({ open, user, onClose, onReadBook }: Props) {
  const [activity, setActivity] = useState<{ openedBooks: any[]; feedback: any[]; book_requests: any[]; book_submissions: any[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setActivity(null);
    Promise.all([
      fetch('/api/user/opened-books', { headers: userAuthHeaders() }).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch('/api/user/activity', { headers: userAuthHeaders() }).then((r) => (r.ok ? r.json() : { feedback: [], book_requests: [], book_submissions: [] })),
    ])
      .then(([booksData, actData]) => {
        if (!alive) return;
        setActivity({
          openedBooks: booksData.data || [],
          feedback: actData.feedback || [],
          book_requests: actData.book_requests || [],
          book_submissions: actData.book_submissions || [],
        });
      })
      .catch(() => {
        if (alive) setActivity({ openedBooks: [], feedback: [], book_requests: [], book_submissions: [] });
      });
    return () => { alive = false; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="flex fixed inset-0 z-[100] bg-black/50 items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[82vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Aktivitas Akun Saya</h3>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Tutup">
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
                        onClick={() => { onClose(); onReadBook(b.bkid); }}
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
    </div>,
    document.body
  );
}
