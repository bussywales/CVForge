export type DeeplinkIntent = {
  anchor: string;
  fallbackAnchor?: string;
};

type ApplyOptions = {
  intent: DeeplinkIntent;
  getElement: () => HTMLElement | null;
  onFound: (el: HTMLElement, elapsedMs: number, fallbackUsed: boolean) => void;
  onMissing?: (elapsedMs: number) => void;
  intervalMs?: number;
  maxMs?: number;
};

/**
 * Retry until the anchor exists or timeout; calls onFound once.
 * Uses setTimeout for predictable testing.
 */
export function applyBillingDeeplinkIntent({
  intent,
  getElement,
  onFound,
  onMissing,
  intervalMs = 100,
  maxMs = 1500,
}: ApplyOptions) {
  const start = Date.now();
  let attempts = 0;
  const tryFind = () => {
    attempts += 1;
    const el = getElement();
    if (el) {
      const elapsed = Date.now() - start;
      onFound(el, elapsed, false);
      return;
    }
    if (Date.now() - start >= maxMs) {
      if (intent.fallbackAnchor) {
        const fallbackEl = document.getElementById(intent.fallbackAnchor);
        if (fallbackEl) {
          onFound(fallbackEl, Date.now() - start, true);
          return;
        }
      }
      onMissing?.(Date.now() - start);
      return;
    }
    setTimeout(tryFind, intervalMs);
  };
  tryFind();
}
