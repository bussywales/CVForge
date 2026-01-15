export type PendingAction =
  | {
      type: "autopack_generate";
      applicationId: string;
      returnTo?: string | null;
      createdAt: number;
    };

const STORAGE_KEY = "cvf_pending_action_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function savePendingAction(action: PendingAction) {
  if (typeof window === "undefined") return;
  try {
    const payload = { ...action, createdAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadPendingAction(): PendingAction | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAction;
    if (!parsed?.createdAt || Date.now() - parsed.createdAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingAction() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
