export type PendingAction =
  | {
      type: "autopack_generate";
      applicationId: string;
      returnTo?: string | null;
      createdAt: number;
    }
  | {
      type: "interview_pack_export";
      applicationId: string;
      variant: "standard" | "ats_minimal";
      returnTo?: string | null;
      createdAt: number;
    }
  | {
      type: "application_kit_download";
      applicationId: string;
      returnTo?: string | null;
      createdAt: number;
    }
  | {
      type: "answer_pack_generate";
      applicationId: string;
      mode: "standard" | "short90";
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

export function buildReturnToUrl(action: PendingAction) {
  if (action.returnTo) return action.returnTo;
  switch (action.type) {
    case "autopack_generate":
      return `/app/applications/${action.applicationId}?tab=apply#apply-autopacks`;
    case "interview_pack_export":
      return `/app/applications/${action.applicationId}?tab=interview#interview-pack`;
    case "application_kit_download":
      return `/app/applications/${action.applicationId}?tab=apply#application-kit`;
    case "answer_pack_generate":
      return `/app/applications/${action.applicationId}/practice/drill`;
    default:
      return "/app/applications";
  }
}
