export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture?: string;
  role: 'admin' | 'user';
}

const USER_TOKEN_KEY = 'userToken';
const USER_PROFILE_KEY = 'userProfile';
const ADMIN_TOKEN_KEY = 'adminToken';

export function getUserToken(): string {
  try { return localStorage.getItem(USER_TOKEN_KEY) || ''; } catch { return ''; }
}

export function getSavedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function userAuthHeaders(): Record<string, string> {
  const token = getUserToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function saveUserSession(payload: { user: AuthUser; userToken: string; adminToken?: string | null }) {
  try {
    localStorage.setItem(USER_TOKEN_KEY, payload.userToken);
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(payload.user));
    if (payload.adminToken) {
      localStorage.setItem(ADMIN_TOKEN_KEY, payload.adminToken);
    } else if (payload.user?.role !== 'admin') {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {}
  window.dispatchEvent(new Event('userAuthUpdated'));
}

export function clearUserSession() {
  try {
    localStorage.removeItem(USER_TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
  window.dispatchEvent(new Event('userAuthUpdated'));
}

export function saveLocalActivity(storageKey: string, item: Record<string, any>) {
  try {
    const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({ ...item, created_at: new Date().toISOString() });
    localStorage.setItem(storageKey, JSON.stringify(list.slice(0, 30)));
  } catch {}
}
