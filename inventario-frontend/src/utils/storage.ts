const KEY = "inv.auth";

export type AuthStatePersist = { token: string; when: number };

export function saveAuth(token: string) {
  localStorage.setItem(KEY, JSON.stringify({ token, when: Date.now() }));
}

export function loadAuth(): AuthStatePersist | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}
