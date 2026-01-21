const STORAGE_KEY = "billing-help-prompt-dismissed";
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function recordHelpPromptDismiss(now = Date.now(), storage: Storage | null = typeof window !== "undefined" ? window.localStorage : null) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, String(now));
  } catch {
    /* ignore */
  }
}

export function helpPromptShouldShow(now = Date.now(), storage: Storage | null = typeof window !== "undefined" ? window.localStorage : null) {
  if (!storage) return true;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return true;
    return now - ts > WINDOW_MS;
  } catch {
    return true;
  }
}
