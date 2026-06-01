const SESSION_ID_STORAGE_KEY = "pdv-dona-rose:session-id";

let cachedSessionId: string | null = null;

function createSessionId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getSessionId() {
  if (cachedSessionId) {
    return cachedSessionId;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existing = window.localStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (existing) {
      cachedSessionId = existing;
      return existing;
    }

    const next = createSessionId();
    window.localStorage.setItem(SESSION_ID_STORAGE_KEY, next);
    cachedSessionId = next;
    return next;
  } catch {
    const next = createSessionId();
    cachedSessionId = next;
    return next;
  }
}
