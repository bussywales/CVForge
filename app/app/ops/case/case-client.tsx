"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CopyIconButton from "@/components/CopyIconButton";
import ErrorBanner from "@/components/ErrorBanner";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { coerceOpsAlertsModel, type OpsAlertsModel } from "@/lib/ops/alerts-model";
import { formatShortLocalTime } from "@/lib/time/format-short";
import { formatRelativeTime } from "@/lib/tracking-utils";
import { parseOpsCaseInput, type OpsCaseSearchMode } from "@/lib/ops/ops-case-parse";
import { buildCaseKey, resolveCaseWindow, type CaseWindow } from "@/lib/ops/ops-case-model";
import { normaliseId } from "@/lib/ops/normalise-id";
import { CASE_CHECKLIST_ITEMS, CASE_OUTCOME_CODES, type CaseChecklistEntry } from "@/lib/ops/ops-case-notes";
import { formatCasePriority } from "@/lib/ops/ops-case-format";
import {
  buildOpsCaseAlertsLink,
  buildOpsCaseAuditsLink,
  buildOpsCaseIncidentsLink,
  buildOpsCaseResolutionsLink,
  buildOpsCaseStatusLink,
  buildOpsCaseWebhooksLink,
} from "@/lib/ops/ops-case-links";
import { groupIncidents, type IncidentRecord } from "@/lib/ops/incidents-shared";

type Props = {
  initialQuery: {
    requestId: string | null;
    userId: string | null;
    email: string | null;
    window: string | null;
    from: string | null;
    q?: string | null;
    scenarioId?: string | null;
    eventId?: string | null;
    signal?: string | null;
    surface?: string | null;
    code?: string | null;
    returnTo?: string | null;
  };
  requestId: string | null;
  viewerRole: ViewerRole;
  viewerId: string;
};

type ViewerRole = "user" | "support" | "admin" | "super_admin";

type AuditItem = {
  id: string;
  at: string;
  action: string;
  actor?: { email?: string | null; role?: string | null } | null;
  requestId?: string | null;
  ref?: string | null;
  meta?: Record<string, any>;
};

type WebhookFailure = {
  id: string;
  requestId: string | null;
  at: string;
  code: string | null;
  summary: string | null;
  repeatCount: number;
  eventIdHash?: string | null;
  groupKeyHash?: string | null;
};

type BillingSnapshot = {
  local?: { subscriptionStatus?: string; creditsAvailable?: number; lastBillingEvent?: { kind?: string; at?: string | null; requestId?: string | null } | null };
  delayState?: { state?: string; message?: string };
  webhookHealth?: { status?: string };
  requestId?: string | null;
};

type MaskedOutcome = {
  id: string | null;
  code: string;
  createdAt: string;
  requestId: string | null;
  userId: string | null;
  actorMasked: string | null;
  noteMasked: string | null;
  effectivenessState: string;
};

type WatchRecord = {
  requestId: string;
  userId?: string | null;
  reasonCode: string;
  note?: string | null;
  createdAt: string;
  expiresAt: string;
  createdBy?: string | null;
};

type CaseContext = {
  requestId: string;
  userId: string | null;
  emailMasked: string | null;
  userRole?: string | null;
  source?: string | null;
  confidence?: string | null;
  evidenceAt?: string | null;
  sources: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  lastSeenPath?: string | null;
};

type CaseWorkflow = {
  requestId: string;
  status: string;
  priority: string;
  assignedToUserId: string | null;
  claimedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  lastTouchedAt: string;
  createdAt: string;
  updatedAt: string;
};

type CaseEvidence = {
  id: string;
  requestId: string;
  type: string;
  body: string;
  meta?: Record<string, any> | null;
  createdByUserId: string;
  createdAt: string;
};

type CaseNotesRecord = {
  caseType: string;
  caseKey: string;
  windowLabel?: string | null;
  checklist?: Record<string, CaseChecklistEntry>;
  outcomeCode?: string | null;
  notes?: string | null;
  status?: string | null;
  lastHandledAt?: string | null;
  lastHandledBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const WINDOW_OPTIONS: Array<{ value: CaseWindow; label: string }> = [
  { value: "15m", label: "15m" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
];

const EVIDENCE_TYPE_OPTIONS = [
  { value: "note", label: "Note" },
  { value: "link", label: "Link" },
  { value: "screenshot_ref", label: "Screenshot" },
  { value: "decision", label: "Decision" },
] as const;

function maskEmail(email?: string | null) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  const domainParts = domain.split(".");
  const maskedDomain = domainParts
    .map((part, idx) => (idx === domainParts.length - 1 ? part : `${part[0] ?? ""}${"*".repeat(Math.max(0, part.length - 1))}`))
    .join(".");
  return `${maskedLocal}@${maskedDomain}`;
}

function maskId(value?: string | null) {
  if (!value) return null;
  if (value.length <= 6) return `${value[0] ?? ""}***`;
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function normaliseReturnTo(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/app/ops/cases")) return null;
  return trimmed;
}

function buildCaseSnippet({
  requestId,
  userId,
  emailMasked,
  contextSources,
  contextLastSeenAt,
  contextSource,
  contextConfidence,
  contextEvidenceAt,
  window,
  latestAlertEventId,
  latestWebhookRef,
  billingRequestId,
  caseLink,
  queueLink,
}: {
  requestId?: string | null;
  userId?: string | null;
  emailMasked?: string | null;
  contextSources?: string[] | null;
  contextLastSeenAt?: string | null;
  contextSource?: string | null;
  contextConfidence?: string | null;
  contextEvidenceAt?: string | null;
  window: CaseWindow;
  latestAlertEventId?: string | null;
  latestWebhookRef?: string | null;
  billingRequestId?: string | null;
  caseLink?: string | null;
  queueLink?: string | null;
}) {
  const lines = ["CVForge Ops Case", `Window: ${window}`];
  if (requestId) lines.push(`RequestId: ${requestId}`);
  if (userId) lines.push(`UserId: ${maskId(userId)}`);
  if (emailMasked) lines.push(`Email: ${emailMasked}`);
  if (contextSources && contextSources.length) lines.push(`Context sources: ${contextSources.join(", ")}`);
  if (contextSource) lines.push(`Context source: ${contextSource}`);
  if (contextConfidence) lines.push(`Context confidence: ${contextConfidence}`);
  if (contextEvidenceAt) lines.push(`Context evidence at: ${formatShortLocalTime(contextEvidenceAt)}`);
  if (contextLastSeenAt) lines.push(`Context last seen: ${formatShortLocalTime(contextLastSeenAt)}`);
  if (latestAlertEventId) lines.push(`Latest alert event: ${latestAlertEventId}`);
  if (latestWebhookRef) lines.push(`Webhook ref: ${latestWebhookRef}`);
  if (billingRequestId) lines.push(`Billing requestId: ${billingRequestId}`);
  if (caseLink || queueLink) {
    lines.push("Links:");
    if (caseLink) lines.push(`- Case View: ${caseLink}`);
    if (queueLink) lines.push(`- Queue View: ${queueLink}`);
  }
  lines.push("Checklist:");
  lines.push("- Opened Alerts and confirmed event visible");
  lines.push("- Acknowledged alert (yes/no)");
  lines.push("- Opened Audits/Incidents filtered by requestId");
  lines.push("Outcome: ");
  return lines.join("\n");
}

function buildCaseHandoffSnippet({
  requestId,
  userId,
  outcome,
  notes,
  window,
  alertsCount,
  incidentsCount,
  webhooksCount,
  billingSummary,
}: {
  requestId?: string | null;
  userId?: string | null;
  outcome?: string | null;
  notes?: string | null;
  window: CaseWindow;
  alertsCount: number;
  incidentsCount: number;
  webhooksCount: number;
  billingSummary: string;
}) {
  const lines = ["CVForge Ops Handoff", `Window: ${window}`];
  if (requestId) lines.push(`RequestId: ${requestId}`);
  if (userId) lines.push(`UserId: ${userId}`);
  if (outcome) lines.push(`Outcome: ${outcome}`);
  if (notes) lines.push(`Notes: ${notes}`);
  lines.push(`Alerts: ${alertsCount} firing`);
  lines.push(`Incidents: ${incidentsCount}`);
  lines.push(`Webhooks: ${webhooksCount}`);
  lines.push(`Billing: ${billingSummary}`);
  return lines.join("\n");
}

function buildTrainingEvidenceSnippet({
  scenarioId,
  requestId,
  eventId,
  checklist,
  outcome,
  notes,
  links,
}: {
  scenarioId?: string | null;
  requestId?: string | null;
  eventId?: string | null;
  checklist: Record<string, CaseChecklistEntry> | null;
  outcome?: string | null;
  notes?: string | null;
  links: { alerts: string; incidents: string; audits: string; webhooks: string; status: string; caseView: string };
}) {
  const lines = ["CVForge Ops Training Evidence"];
  if (scenarioId) lines.push(`ScenarioId: ${scenarioId}`);
  if (requestId) lines.push(`RequestId: ${requestId}`);
  if (eventId) lines.push(`EventId: ${eventId}`);
  if (outcome) lines.push(`Outcome: ${outcome}`);
  if (notes) lines.push(`Notes: ${notes}`);
  lines.push("Checklist:");
  CASE_CHECKLIST_ITEMS.forEach((item) => {
    const done = Boolean(checklist?.[item.key]?.done);
    lines.push(`- ${item.label}: ${done ? "yes" : "no"}`);
  });
  lines.push("Links:");
  lines.push(`- Alerts: ${links.alerts}`);
  lines.push(`- Incidents: ${links.incidents}`);
  lines.push(`- Audits: ${links.audits}`);
  lines.push(`- Webhooks: ${links.webhooks}`);
  lines.push(`- Status: ${links.status}`);
  lines.push(`- Case View: ${links.caseView}`);
  return lines.join("\n");
}

function resolveStatusTimestamp(workflow: CaseWorkflow | null) {
  if (!workflow) return null;
  if (workflow.status === "resolved") return workflow.resolvedAt ?? workflow.updatedAt;
  if (workflow.status === "closed") return workflow.closedAt ?? workflow.updatedAt;
  return workflow.updatedAt ?? workflow.claimedAt ?? workflow.createdAt;
}

function buildEscalationTemplate({
  kind,
  requestId,
  userId,
  emailMasked,
  status,
  priority,
  window,
  links,
  outcomes,
  watchItems,
  evidence,
  trainingScenarioId,
}: {
  kind: "internal" | "customer" | "engineering";
  requestId: string | null;
  userId: string | null;
  emailMasked: string | null;
  status: string;
  priority: string;
  window: CaseWindow;
  links: Record<string, string | null>;
  outcomes: MaskedOutcome[];
  watchItems: WatchRecord[];
  evidence: CaseEvidence[];
  trainingScenarioId: string | null;
}) {
  const lines: string[] = [];
  const title =
    kind === "internal"
      ? "CVForge Ops Escalation (Internal)"
      : kind === "customer"
        ? "CVForge Support Escalation (Customer)"
        : "CVForge Engineering Escalation";
  lines.push(title);
  lines.push("");
  if (requestId) lines.push(`RequestId: ${requestId}`);
  if (userId) lines.push(`UserId: ${userId}`);
  if (emailMasked) lines.push(`Email: ${emailMasked}`);
  lines.push(`Status: ${status}`);
  lines.push(`Priority: ${formatCasePriority(priority)}`);
  lines.push(`Window: ${window}`);
  if (trainingScenarioId) lines.push(`Training scenario: ${trainingScenarioId.slice(0, 8)}…`);

  if (outcomes.length) {
    lines.push("");
    lines.push("Latest outcomes:");
    outcomes.slice(0, 3).forEach((item) => {
      lines.push(`- ${item.code} (${formatShortLocalTime(item.createdAt)})`);
    });
  }
  if (watchItems.length) {
    lines.push("");
    lines.push("Watch items:");
    watchItems.slice(0, 3).forEach((item) => {
      lines.push(`- ${item.reasonCode} (expires ${formatShortLocalTime(item.expiresAt)})`);
    });
  }
  if (evidence.length) {
    lines.push("");
    lines.push("Evidence:");
    evidence.slice(0, 3).forEach((item) => {
      lines.push(`- [${item.type}] ${item.body}`);
    });
  }

  lines.push("");
  lines.push("Links:");
  Object.entries(links).forEach(([label, href]) => {
    if (href) lines.push(`- ${label}: ${href}`);
  });

  if (kind === "customer") {
    lines.push("");
    lines.push("Summary:");
    lines.push("- [Add a calm summary for the customer]");
    lines.push("");
    lines.push("Next steps:");
    lines.push("- [Add any expected follow-up or timeline]");
  } else if (kind === "engineering") {
    lines.push("");
    lines.push("Impact:");
    lines.push("- [Describe impact, scope, and urgency]");
    lines.push("");
    lines.push("Steps taken:");
    lines.push("- [List actions performed + results]");
  } else {
    lines.push("");
    lines.push("Summary:");
    lines.push("- [Add internal summary + blockers]");
  }
  return lines.join("\n");
}

function withQueryParam(href: string, key: string, value?: string | null) {
  if (!value) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}${key}=${encodeURIComponent(value)}`;
}

export default function CaseClient({ initialQuery, requestId, viewerRole, viewerId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safeLog = useCallback((event: string, meta?: Record<string, any>) => {
    try {
      logMonetisationClientEvent(event as any, null, "ops", meta ?? undefined);
    } catch {
      // ignore
    }
  }, []);

  const requestIdRaw = searchParams?.get("requestId") ?? initialQuery.requestId ?? null;
  const userIdRaw = searchParams?.get("userId") ?? initialQuery.userId ?? null;
  const emailRaw = searchParams?.get("email") ?? initialQuery.email ?? null;
  const qRaw = searchParams?.get("q") ?? initialQuery.q ?? null;
  const scenarioIdRaw = searchParams?.get("scenarioId") ?? initialQuery.scenarioId ?? null;
  const eventIdRaw = searchParams?.get("eventId") ?? initialQuery.eventId ?? null;
  const signalRaw = searchParams?.get("signal") ?? initialQuery.signal ?? null;
  const surfaceRaw = searchParams?.get("surface") ?? initialQuery.surface ?? null;
  const codeRaw = searchParams?.get("code") ?? initialQuery.code ?? null;
  const returnToRaw = searchParams?.get("returnTo") ?? initialQuery.returnTo ?? null;
  const requestIdParamRaw = normaliseId(requestIdRaw) || null;
  const userIdParamRaw = normaliseId(userIdRaw) || null;
  const emailParamRaw = normaliseId(emailRaw) || null;
  const scenarioIdParamRaw = normaliseId(scenarioIdRaw) || null;
  const eventIdParamRaw = normaliseId(eventIdRaw) || null;
  const fromParam = searchParams?.get("from") ?? initialQuery.from ?? null;
  const windowParam = resolveCaseWindow(searchParams?.get("window") ?? initialQuery.window);
  const fallbackFromQ = qRaw ? parseOpsCaseInput(qRaw, "requestId") : null;
  const qFallbackRequestId =
    !requestIdParamRaw && !userIdParamRaw && !emailParamRaw && fallbackFromQ?.kind === "requestId" ? fallbackFromQ.value : null;
  const qFallbackUserId =
    !requestIdParamRaw && !userIdParamRaw && !emailParamRaw && fallbackFromQ?.kind === "userId" ? fallbackFromQ.value : null;
  const qFallbackEmail =
    !requestIdParamRaw && !userIdParamRaw && !emailParamRaw && fallbackFromQ?.kind === "email" ? fallbackFromQ.value : null;
  const resolvedRequestIdParam = requestIdParamRaw ?? qFallbackRequestId;
  const resolvedUserIdParam = userIdParamRaw ?? qFallbackUserId;
  const resolvedEmailParam = emailParamRaw ?? qFallbackEmail;
  const requestIdParam = resolvedRequestIdParam;
  const userIdParam = resolvedUserIdParam;
  const emailParam = resolvedEmailParam;
  const scenarioIdParam = scenarioIdParamRaw ?? null;
  const eventIdParam = eventIdParamRaw ?? null;
  const signalParam = normaliseId(signalRaw) || null;
  const surfaceParam = normaliseId(surfaceRaw) || null;
  const codeParam = normaliseId(codeRaw) || null;
  const returnToParam = normaliseReturnTo(returnToRaw);
  const trainingMode = fromParam === "ops_training" || Boolean(scenarioIdParam);
  const fromAlerts = fromParam === "ops_alerts";

  const [input, setInput] = useState(resolvedRequestIdParam ?? resolvedUserIdParam ?? resolvedEmailParam ?? "");
  const [searchMode, setSearchMode] = useState<OpsCaseSearchMode>(resolvedUserIdParam ? "userId" : "requestId");
  const [windowValue, setWindowValue] = useState<CaseWindow>(windowParam);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [contextData, setContextData] = useState<CaseContext | null>(null);
  const [contextError, setContextError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [workflowData, setWorkflowData] = useState<CaseWorkflow | null>(null);
  const [workflowError, setWorkflowError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [evidenceItems, setEvidenceItems] = useState<CaseEvidence[]>([]);
  const [evidenceError, setEvidenceError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [evidenceType, setEvidenceType] = useState("note");
  const [evidenceBody, setEvidenceBody] = useState("");
  const [assignQuery, setAssignQuery] = useState("");
  const [assignResults, setAssignResults] = useState<Array<{ id: string; email?: string | null }> | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [workflowActionError, setWorkflowActionError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [escalationTab, setEscalationTab] = useState<"internal" | "customer" | "engineering">("internal");
  const [caseNotes, setCaseNotes] = useState<CaseNotesRecord | null>(null);
  const [caseNotesError, setCaseNotesError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [caseNotesLoading, setCaseNotesLoading] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [outcomeDraft, setOutcomeDraft] = useState<string>("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<string | null>(null);
  const [checklistSaving, setChecklistSaving] = useState<Record<string, boolean>>({});
  const [closeSaving, setCloseSaving] = useState(false);
  const [attachValue, setAttachValue] = useState("");
  const [attachNote, setAttachNote] = useState("");
  const [attachLoading, setAttachLoading] = useState(false);
  const [attachError, setAttachError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [attachSuccess, setAttachSuccess] = useState<string | null>(null);

  const [alertsData, setAlertsData] = useState<OpsAlertsModel>(() => coerceOpsAlertsModel(null));
  const [alertsError, setAlertsError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [incidentsData, setIncidentsData] = useState<IncidentRecord[]>([]);
  const [incidentsCount, setIncidentsCount] = useState(0);
  const [incidentsError, setIncidentsError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  const [auditsData, setAuditsData] = useState<AuditItem[]>([]);
  const [auditsError, setAuditsError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [auditsLoading, setAuditsLoading] = useState(false);

  const [webhooksData, setWebhooksData] = useState<WebhookFailure[]>([]);
  const [webhooksError, setWebhooksError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [webhooksLoading, setWebhooksLoading] = useState(false);

  const [billingData, setBillingData] = useState<BillingSnapshot | null>(null);
  const [billingError, setBillingError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingRecheckHint, setBillingRecheckHint] = useState<string | null>(null);
  const [billingRecheckError, setBillingRecheckError] = useState<string | null>(null);
  const [billingRecheckLoading, setBillingRecheckLoading] = useState(false);

  const [outcomesData, setOutcomesData] = useState<MaskedOutcome[]>([]);
  const [outcomesError, setOutcomesError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [outcomesLoading, setOutcomesLoading] = useState(false);

  const [watchData, setWatchData] = useState<WatchRecord[]>([]);
  const [watchError, setWatchError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [watchLoading, setWatchLoading] = useState(false);

  const caseKey = useMemo(
    () => buildCaseKey({ requestId: resolvedRequestIdParam, userId: resolvedUserIdParam, email: resolvedEmailParam }),
    [resolvedEmailParam, resolvedRequestIdParam, resolvedUserIdParam]
  );
  const hasQuery = Boolean(resolvedRequestIdParam || resolvedUserIdParam || resolvedEmailParam);
  const effectiveUserId = resolvedUserIdParam ?? contextData?.userId ?? resolvedUserId;
  const effectiveEmailMasked = contextData?.emailMasked ?? (resolvedEmailParam ? maskEmail(resolvedEmailParam) : null);
  const isAdminViewer = viewerRole === "admin" || viewerRole === "super_admin";
  const workflowStatus = workflowData?.status ?? "open";
  const workflowPriority = workflowData?.priority ?? "p2";
  const assignedToUserId = workflowData?.assignedToUserId ?? null;
  const isAssignedToMe = Boolean(assignedToUserId && assignedToUserId === viewerId);

  const alertsViewLogged = useRef<string | null>(null);
  const incidentsViewLogged = useRef<string | null>(null);
  const auditsViewLogged = useRef<string | null>(null);
  const webhooksViewLogged = useRef<string | null>(null);
  const billingViewLogged = useRef<string | null>(null);
  const resolutionViewLogged = useRef<string | null>(null);
  const caseViewLogged = useRef<string | null>(null);
  const trainingEvidenceRef = useRef<string | null>(null);

  const refreshCaseSummary = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!resolvedRequestIdParam) return;
      if (!opts?.silent) {
        setContextLoading(true);
        setWorkflowLoading(true);
      }
      setWorkflowError(null);
      setEvidenceError(null);
      const res = await fetchJsonSafe<{
        ok: boolean;
        workflow?: CaseWorkflow | null;
        evidence?: CaseEvidence[];
        context?: CaseContext | null;
      }>(`/api/ops/case?requestId=${encodeURIComponent(resolvedRequestIdParam)}&window=${windowValue}`, { method: "GET", cache: "no-store" });
      if (res.ok && res.json?.ok) {
        setWorkflowData(res.json.workflow ?? null);
        setEvidenceItems(res.json.evidence ?? []);
        setContextData(res.json.context ?? null);
        setContextError(null);
      } else {
        const message = res.error?.message ?? "Unable to load case workflow";
        setWorkflowError({ message, requestId: res.requestId ?? requestId });
        setEvidenceError({ message, requestId: res.requestId ?? requestId });
        setContextError({ message, requestId: res.requestId ?? requestId });
        safeLog("ops_case_load_error", { window: windowValue });
      }
      setWorkflowLoading(false);
      setContextLoading(false);
    },
    [requestId, resolvedRequestIdParam, safeLog, windowValue]
  );

  useEffect(() => {
    setInput(resolvedRequestIdParam ?? resolvedUserIdParam ?? resolvedEmailParam ?? "");
    if (resolvedUserIdParam) {
      setSearchMode("userId");
    } else if (resolvedRequestIdParam) {
      setSearchMode("requestId");
    }
    setWindowValue(windowParam);
  }, [resolvedEmailParam, resolvedRequestIdParam, resolvedUserIdParam, windowParam]);

  useEffect(() => {
    if (!resolvedRequestIdParam) return;
    const viewKey = `${resolvedRequestIdParam}:${windowValue}`;
    if (caseViewLogged.current === viewKey) return;
    safeLog("ops_case_view", { window: windowValue });
    safeLog("ops_case_view_open", { window: windowValue });
    caseViewLogged.current = viewKey;
  }, [resolvedRequestIdParam, safeLog, windowValue]);

  useEffect(() => {
    if (!resolvedEmailParam || resolvedUserIdParam) {
      setResolvedUserId(null);
      setResolveError(null);
      return;
    }
    let active = true;
    const lookup = async () => {
      setResolveError(null);
      const params = new URLSearchParams({ q: resolvedEmailParam });
      if (resolvedRequestIdParam) params.set("requestId", resolvedRequestIdParam);
      const res = await fetchJsonSafe<{ ok: boolean; users?: Array<{ id: string; email?: string | null }> }>(
        `/api/ops/users/search?${params.toString()}`,
        { method: "GET", cache: "no-store" }
      );
      if (!active) return;
      if (!res.ok || !res.json?.ok) {
        setResolveError(res.error?.message ?? "Unable to resolve user id");
        return;
      }
      const match = (res.json.users ?? []).find((u) => (u.email ?? "").toLowerCase() === resolvedEmailParam.toLowerCase());
      setResolvedUserId(match?.id ?? null);
    };
    lookup();
    return () => {
      active = false;
    };
  }, [resolvedEmailParam, resolvedRequestIdParam, resolvedUserIdParam]);

  useEffect(() => {
    if (!resolvedRequestIdParam) {
      setContextData(null);
      setContextError(null);
      setWorkflowData(null);
      setWorkflowError(null);
      setEvidenceItems([]);
      setEvidenceError(null);
      setAttachSuccess(null);
      return;
    }
    let active = true;
    const load = async () => {
      if (!active) return;
      await refreshCaseSummary();
    };
    load();
    return () => {
      active = false;
    };
  }, [refreshCaseSummary, resolvedRequestIdParam]);

  useEffect(() => {
    if (!trainingMode || !scenarioIdParam || !requestIdParam) return;
    if (trainingEvidenceRef.current === scenarioIdParam) return;
    const scenarioKey = scenarioIdParam.slice(0, 8);
    const hasEvidence = evidenceItems.some((item) => item.meta?.scenarioId === scenarioKey);
    if (hasEvidence) {
      trainingEvidenceRef.current = scenarioIdParam;
      return;
    }
    const addEvidence = async () => {
      try {
        const res = await fetchJsonSafe<{ ok: boolean; evidence?: CaseEvidence }>(`/api/ops/case/evidence`, {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requestId: requestIdParam,
            type: "decision",
            body: `Training scenario evidence attached (${scenarioKey}).`,
            meta: { scenarioId: scenarioIdParam, source: "ops_training" },
          }),
        });
        if (res.ok && res.json?.ok && res.json.evidence) {
          setEvidenceItems((prev) => [res.json!.evidence as CaseEvidence, ...prev]);
        }
      } catch {
        // best-effort only
      } finally {
        trainingEvidenceRef.current = scenarioIdParam;
      }
    };
    addEvidence();
  }, [evidenceItems, requestIdParam, scenarioIdParam, trainingMode]);

  useEffect(() => {
    if (!resolvedRequestIdParam) {
      setCaseNotes(null);
      setCaseNotesError(null);
      setNotesDraft("");
      setOutcomeDraft("");
      setNotesSavedAt(null);
      return;
    }
    let active = true;
    setCaseNotesLoading(true);
    setCaseNotesError(null);
    const load = async () => {
      const res = await fetchJsonSafe<{ ok: boolean; notes?: CaseNotesRecord | null }>(
        `/api/ops/case/notes?caseType=request&caseKey=${encodeURIComponent(resolvedRequestIdParam)}&window=${windowValue}`,
        { method: "GET", cache: "no-store" }
      );
      if (!active) return;
      if (res.ok && res.json?.ok) {
        setCaseNotes(res.json.notes ?? null);
        setNotesDraft(res.json.notes?.notes ?? "");
        setOutcomeDraft(res.json.notes?.outcomeCode ?? "");
      } else {
        setCaseNotesError({ message: res.error?.message ?? "Unable to load case notes", requestId: res.requestId ?? requestId });
      }
      setCaseNotesLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [requestId, resolvedRequestIdParam, windowValue]);

  const updateQuery = useCallback(
    (next: { requestId?: string | null; userId?: string | null; email?: string | null; window?: CaseWindow }) => {
      const params = new URLSearchParams();
      const windowNext = next.window ?? windowValue;
      if (windowNext) params.set("window", windowNext);
      if (next.requestId) params.set("requestId", normaliseId(next.requestId));
      if (next.userId) params.set("userId", normaliseId(next.userId));
      if (next.email) params.set("email", normaliseId(next.email));
      if (fromParam) params.set("from", fromParam);
      if (scenarioIdParam) params.set("scenarioId", scenarioIdParam);
      if (eventIdParam) params.set("eventId", eventIdParam);
      if (signalParam) params.set("signal", signalParam);
      if (surfaceParam) params.set("surface", surfaceParam);
      if (codeParam) params.set("code", codeParam);
      if (returnToParam) params.set("returnTo", returnToParam);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [codeParam, eventIdParam, fromParam, pathname, returnToParam, router, scenarioIdParam, signalParam, surfaceParam, windowValue]
  );

  const handleSearch = useCallback(() => {
    const parsed = parseOpsCaseInput(input, searchMode);
    if (!parsed.value) return;
    const next: { requestId?: string | null; userId?: string | null; email?: string | null; window?: CaseWindow } = { window: windowValue };
    if (parsed.kind === "requestId") next.requestId = parsed.value;
    if (parsed.kind === "userId") next.userId = parsed.value;
    if (parsed.kind === "email") next.email = parsed.value;
    updateQuery(next);
    safeLog("ops_case_search_submit", { kind: parsed.kind, window: windowValue });
  }, [input, safeLog, searchMode, updateQuery, windowValue]);

  const handleClear = useCallback(() => {
    setInput("");
    setResolvedUserId(null);
    updateQuery({ window: windowValue });
    safeLog("ops_case_search_clear");
  }, [safeLog, updateQuery, windowValue]);

  const refreshAlerts = useCallback(async () => {
    if (!hasQuery) return;
    setAlertsLoading(true);
    const res = await fetchJsonSafe<OpsAlertsModel>("/api/ops/alerts", { method: "GET", cache: "no-store" });
    if (res.ok && res.json) {
      const next = coerceOpsAlertsModel(res.json);
      setAlertsData(next);
      setAlertsError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${emailParam ?? ""}`;
      if (alertsViewLogged.current !== viewKey) {
        safeLog("ops_case_alerts_view");
        alertsViewLogged.current = viewKey;
      }
    } else {
      setAlertsError({ message: res.error?.message ?? "Unable to load alerts", requestId: res.requestId ?? requestId });
    }
    setAlertsLoading(false);
  }, [effectiveUserId, emailParam, hasQuery, requestId, requestIdParam, safeLog]);

  const refreshIncidents = useCallback(async () => {
    if (!hasQuery) return;
    setIncidentsLoading(true);
    const params = new URLSearchParams();
    params.set("window", windowValue);
    if (requestIdParam) params.set("requestId", requestIdParam);
    if (effectiveUserId) params.set("userId", effectiveUserId);
    const res = await fetchJsonSafe<{ ok: boolean; items?: IncidentRecord[]; count?: number }>(`/api/ops/incidents/preview?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok && res.json?.ok) {
      setIncidentsData(res.json.items ?? []);
      setIncidentsCount(res.json.count ?? (res.json.items ?? []).length);
      setIncidentsError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${windowValue}`;
      if (incidentsViewLogged.current !== viewKey) {
        safeLog("ops_case_incidents_view", { window: windowValue });
        incidentsViewLogged.current = viewKey;
      }
    } else {
      setIncidentsError({ message: res.error?.message ?? "Unable to load incidents", requestId: res.requestId ?? requestId });
    }
    setIncidentsLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, safeLog, windowValue]);

  const refreshAudits = useCallback(async () => {
    if (!hasQuery) return;
    setAuditsLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "20");
    if (requestIdParam) params.set("q", requestIdParam);
    if (effectiveUserId) params.set("userId", effectiveUserId);
    const res = await fetchJsonSafe<{ ok: boolean; items?: AuditItem[] }>(`/api/ops/audits?${params.toString()}`, { method: "GET", cache: "no-store" });
    if (res.ok && res.json?.ok) {
      setAuditsData((res.json.items ?? []).slice(0, 6));
      setAuditsError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${windowValue}`;
      if (auditsViewLogged.current !== viewKey) {
        safeLog("ops_case_audits_view", { window: windowValue });
        auditsViewLogged.current = viewKey;
      }
    } else {
      setAuditsError({ message: res.error?.message ?? "Unable to load audits", requestId: res.requestId ?? requestId });
    }
    setAuditsLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, safeLog, windowValue]);

  const refreshWebhooks = useCallback(async () => {
    if (!hasQuery) return;
    setWebhooksLoading(true);
    const params = new URLSearchParams();
    params.set("window", windowValue);
    if (requestIdParam) {
      params.set("q", requestIdParam);
    } else if (effectiveUserId) {
      params.set("q", effectiveUserId);
    }
    params.set("limit", "20");
    const res = await fetchJsonSafe<{ ok: boolean; items?: WebhookFailure[] }>(`/api/ops/webhook-failures?${params.toString()}`, { method: "GET", cache: "no-store" });
    if (res.ok && res.json?.ok) {
      setWebhooksData((res.json.items ?? []).slice(0, 6));
      setWebhooksError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${windowValue}`;
      if (webhooksViewLogged.current !== viewKey) {
        safeLog("ops_case_webhooks_view", { window: windowValue });
        webhooksViewLogged.current = viewKey;
      }
    } else {
      setWebhooksError({ message: res.error?.message ?? "Unable to load webhook failures", requestId: res.requestId ?? requestId });
    }
    setWebhooksLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, safeLog, windowValue]);

  const refreshBilling = useCallback(async () => {
    if (!hasQuery || !effectiveUserId) {
      setBillingData(null);
      setBillingError(null);
      return;
    }
    setBillingLoading(true);
    const res = await fetchJsonSafe<{ ok: boolean } & BillingSnapshot>(`/api/ops/billing/snapshot?userId=${encodeURIComponent(effectiveUserId)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok && res.json?.ok) {
      setBillingData(res.json);
      setBillingError(null);
      const viewKey = `${effectiveUserId ?? ""}|${windowValue}`;
      if (billingViewLogged.current !== viewKey) {
        safeLog("ops_case_billing_view", { window: windowValue });
        billingViewLogged.current = viewKey;
      }
    } else {
      setBillingError({ message: res.error?.message ?? "Unable to load billing snapshot", requestId: res.requestId ?? requestId });
    }
    setBillingLoading(false);
  }, [effectiveUserId, hasQuery, requestId, safeLog, windowValue]);

  const runBillingRecheck = useCallback(async () => {
    if (!hasQuery) return;
    setBillingRecheckLoading(true);
    setBillingRecheckHint(null);
    setBillingRecheckError(null);
    safeLog("ops_case_billing_recheck_click", { window: windowValue });
    const res = await fetchJsonSafe<{ ok: boolean }>(`/api/billing/recheck`, { method: "GET", cache: "no-store" });
    if (res.ok && res.json?.ok) {
      setBillingRecheckHint("Recheck completed for the current ops session.");
    } else {
      setBillingRecheckError(res.error?.message ?? "Unable to recheck billing");
    }
    setBillingRecheckLoading(false);
  }, [hasQuery, safeLog, windowValue]);

  const refreshOutcomes = useCallback(async () => {
    if (!hasQuery) return;
    setOutcomesLoading(true);
    const params = new URLSearchParams();
    if (requestIdParam) params.set("requestId", requestIdParam);
    if (!requestIdParam && effectiveUserId) params.set("userId", effectiveUserId);
    const res = await fetchJsonSafe<{ ok: boolean; items?: MaskedOutcome[] }>(`/api/ops/resolution-outcomes/recent?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (res.ok && res.json?.ok) {
      setOutcomesData(res.json.items ?? []);
      setOutcomesError(null);
      const viewKey = `${requestIdParam ?? ""}|${effectiveUserId ?? ""}|${windowValue}`;
      if (resolutionViewLogged.current !== viewKey) {
        safeLog("ops_case_resolution_view", { window: windowValue });
        resolutionViewLogged.current = viewKey;
      }
    } else {
      setOutcomesError({ message: res.error?.message ?? "Unable to load outcomes", requestId: res.requestId ?? requestId });
    }
    setOutcomesLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, safeLog, windowValue]);

  const refreshWatch = useCallback(async () => {
    if (!hasQuery) return;
    setWatchLoading(true);
    const params = new URLSearchParams();
    if (requestIdParam) params.set("requestId", requestIdParam);
    if (!requestIdParam && effectiveUserId) params.set("userId", effectiveUserId);
    if (windowValue === "7d") params.set("window", "7d");
    const res = await fetchJsonSafe<{ ok: boolean; records?: WatchRecord[] }>(`/api/ops/watch?${params.toString()}`, { method: "GET", cache: "no-store" });
    if (res.ok && res.json?.ok) {
      setWatchData(res.json.records ?? []);
      setWatchError(null);
    } else {
      setWatchError({ message: res.error?.message ?? "Unable to load watch items", requestId: res.requestId ?? requestId });
    }
    setWatchLoading(false);
  }, [effectiveUserId, hasQuery, requestId, requestIdParam, windowValue]);

  const handleAttach = useCallback(async () => {
    if (!requestIdParam) return;
    const value = attachValue.trim();
    if (!value) return;
    setAttachLoading(true);
    setAttachError(null);
    setAttachSuccess(null);
    const payload: Record<string, any> = { requestId: requestIdParam };
    if (value.includes("@")) {
      payload.email = value;
    } else {
      payload.userId = value;
    }
    if (attachNote.trim()) {
      payload.note = attachNote.trim();
    }
    const res = await fetchJsonSafe<{ ok: boolean; context?: CaseContext | null }>(`/api/ops/case/context/attach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok && res.json?.ok) {
      setContextData(res.json.context ?? null);
      setAttachSuccess("Context attached.");
      setAttachValue("");
      setAttachNote("");
      refreshCaseSummary({ silent: true });
      refreshIncidents();
      refreshAudits();
      refreshWebhooks();
      refreshBilling();
      refreshOutcomes();
      refreshWatch();
    } else {
      setAttachError({ message: res.error?.message ?? "Unable to attach context", requestId: res.requestId ?? requestId });
    }
    setAttachLoading(false);
  }, [
    attachNote,
    attachValue,
    refreshAudits,
    refreshBilling,
    refreshIncidents,
    refreshOutcomes,
    refreshWatch,
    refreshWebhooks,
    refreshCaseSummary,
    requestId,
    requestIdParam,
  ]);

  useEffect(() => {
    if (!hasQuery) return;
    refreshAlerts();
    refreshIncidents();
    refreshAudits();
    refreshWebhooks();
    refreshBilling();
    refreshOutcomes();
    refreshWatch();
  }, [hasQuery, refreshAlerts, refreshAudits, refreshBilling, refreshIncidents, refreshOutcomes, refreshWatch, refreshWebhooks]);

  const filteredAlertEvents = useMemo(() => {
    if (!hasQuery) return [];
    const byId = requestIdParam ? alertsData.recentEvents.filter((event: any) => event.id === requestIdParam) : [];
    const byRequest =
      requestIdParam && byId.length === 0
        ? alertsData.recentEvents.filter((event: any) => {
            const signals = event?.signals ?? {};
            const req = signals.requestId ?? signals.request_id ?? null;
            return req && req === requestIdParam;
          })
        : [];
    return (byId.length ? byId : byRequest).slice(0, 6);
  }, [alertsData.recentEvents, hasQuery, requestIdParam]);

  const firingAlerts = useMemo(() => alertsData.alerts.filter((alert: any) => alert.state === "firing"), [alertsData.alerts]);
  const latestHandled = useMemo(() => {
    const handled = alertsData.handled ?? {};
    if (requestIdParam && handled[requestIdParam]) return handled[requestIdParam].at;
    if (filteredAlertEvents.length === 0) return null;
    const handledMatches = filteredAlertEvents
      .map((event: any) => handled[event.id]?.at ?? null)
      .filter(Boolean) as string[];
    if (!handledMatches.length) return null;
    return handledMatches.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [alertsData.handled, filteredAlertEvents, requestIdParam]);

  const incidentGroups = useMemo(() => groupIncidents(incidentsData), [incidentsData]);
  const incidentsEmpty = hasQuery && incidentsData.length === 0 && !incidentsLoading;

  const caseLink = useMemo(() => {
    if (!requestIdParam) return null;
    const params = new URLSearchParams();
    params.set("requestId", requestIdParam);
    if (windowValue) params.set("window", windowValue);
    if (returnToParam) params.set("returnTo", returnToParam);
    const path = `/app/ops/case?${params.toString()}`;
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [requestIdParam, returnToParam, windowValue]);

  const queueLink = useMemo(() => {
    if (!returnToParam) return null;
    if (typeof window === "undefined") return returnToParam;
    return `${window.location.origin}${returnToParam}`;
  }, [returnToParam]);

  const summarySnippet = useMemo(
    () =>
      buildCaseSnippet({
        requestId: requestIdParam,
        userId: effectiveUserId,
        emailMasked: effectiveEmailMasked,
        contextSources: contextData?.sources ?? null,
        contextLastSeenAt: contextData?.lastSeenAt ?? null,
        contextSource: contextData?.source ?? null,
        contextConfidence: contextData?.confidence ?? null,
        contextEvidenceAt: contextData?.evidenceAt ?? null,
        window: windowValue,
        latestAlertEventId: filteredAlertEvents[0]?.id ?? null,
        latestWebhookRef: webhooksData[0]?.eventIdHash ?? webhooksData[0]?.groupKeyHash ?? null,
        billingRequestId: billingData?.local?.lastBillingEvent?.requestId ?? null,
        caseLink,
        queueLink,
      }),
    [
      billingData?.local?.lastBillingEvent?.requestId,
      caseLink,
      contextData?.lastSeenAt,
      contextData?.source,
      contextData?.confidence,
      contextData?.evidenceAt,
      contextData?.sources,
      effectiveEmailMasked,
      effectiveUserId,
      filteredAlertEvents,
      requestIdParam,
      queueLink,
      webhooksData,
      windowValue,
    ]
  );

  const openAlertsLink = buildOpsCaseAlertsLink({
    window: windowValue,
    requestId: requestIdParam,
    eventId: filteredAlertEvents[0]?.id ?? null,
  });
  const backToAlertsLink = buildOpsCaseAlertsLink({
    window: windowValue,
    requestId: requestIdParam,
    eventId: eventIdParam ?? filteredAlertEvents[0]?.id ?? null,
    from: "ops_case",
    tab: "recent",
  });
  const openIncidentsLink = buildOpsCaseIncidentsLink({
    window: windowValue,
    requestId: requestIdParam,
    userId: effectiveUserId,
    surface: surfaceParam,
    signal: signalParam,
    code: codeParam,
  });
  const openAuditsLink = buildOpsCaseAuditsLink({
    requestId: requestIdParam,
    userId: effectiveUserId,
  });
  const openWebhooksLink = buildOpsCaseWebhooksLink({
    window: windowValue,
    q: requestIdParam ?? effectiveUserId ?? null,
  });
  const openStatusLink = buildOpsCaseStatusLink({ window: windowValue });
  const userLookupHref = emailParam ? `/app/ops?q=${encodeURIComponent(emailParam)}` : "/app/ops";
  const displayedUserId = contextData?.userId ?? effectiveUserId;
  const displayedEmailMasked = contextData?.emailMasked ?? effectiveEmailMasked;
  const contextSourcesLabel = contextData?.sources?.length ? contextData.sources.join(", ") : displayedUserId ? "manual" : "—";
  const contextConfidence = contextData?.confidence ?? null;
  const contextSource = contextData?.source ?? null;
  const contextEvidenceAt = contextData?.evidenceAt ?? null;
  const missingContextHint =
    windowValue === "15m"
      ? "No touchpoints with userId in this window — try 24h."
      : windowValue === "24h"
        ? "No touchpoints with userId in this window — try 7d."
        : "No touchpoints with userId in this window.";
  const showMissingContext = Boolean(requestIdParam && !displayedUserId);
  const billingSummary = !effectiveUserId ? "user id required" : billingLoading ? "loading" : billingData?.local?.subscriptionStatus ?? "unavailable";
  const statusSince = resolveStatusTimestamp(workflowData);
  const openedSince = workflowData?.createdAt ?? null;
  const statusSinceLabel = statusSince ? formatRelativeTime(statusSince) : "—";
  const openedSinceLabel = openedSince ? formatRelativeTime(openedSince) : "—";
  const lastTouchedLabel = workflowData?.lastTouchedAt ? formatShortLocalTime(workflowData.lastTouchedAt) : "—";
  const fromAlertsSummary = [surfaceParam ? `surface=${surfaceParam}` : null, signalParam ? `signal=${signalParam}` : null, codeParam ? `code=${codeParam}` : null]
    .filter(Boolean)
    .join(" · ");

  const handleSnippetCopy = () => {
    safeLog("ops_case_snippet_copy", {
      hasRequestId: Boolean(requestIdParam),
      hasUserId: Boolean(effectiveUserId),
      hasEmail: Boolean(effectiveEmailMasked),
    });
  };

  const checklistEntries = useMemo(() => caseNotes?.checklist ?? {}, [caseNotes?.checklist]);
  const notesStatus = caseNotes?.status ?? "open";
  const notesUpdatedAt = caseNotes?.updatedAt ?? null;
  const notesLastHandled = caseNotes?.lastHandledAt ?? null;
  const notesLastHandledBy = caseNotes?.lastHandledBy ?? null;
  const notesOutcomeValue = outcomeDraft;
  const notesHasChanges =
    (notesDraft ?? "") !== (caseNotes?.notes ?? "") || (notesOutcomeValue ?? "") !== (caseNotes?.outcomeCode ?? "");
  const evidencePlaceholder =
    evidenceType === "link"
      ? "Paste a URL or support reference (masked)."
      : evidenceType === "screenshot_ref"
        ? "Screenshot ref or short label (no URLs)."
        : evidenceType === "decision"
          ? "Decision summary (short)."
          : "Add a short note (no emails/URLs).";

  const trainingLinks = useMemo(() => {
    const from = trainingMode ? "ops_training" : "ops_case";
    const alertsLink = withQueryParam(
      buildOpsCaseAlertsLink({
        window: windowValue,
        requestId: requestIdParam,
        eventId: eventIdParam ?? filteredAlertEvents[0]?.id ?? null,
        from,
        tab: "recent",
      }),
      "scenarioId",
      scenarioIdParam
    );
    const incidentsLink = withQueryParam(
      buildOpsCaseIncidentsLink({
        window: windowValue,
        requestId: requestIdParam,
        userId: effectiveUserId,
        surface: surfaceParam,
        signal: signalParam,
        code: codeParam,
        from,
      }),
      "scenarioId",
      scenarioIdParam
    );
    const auditsLink = withQueryParam(
      buildOpsCaseAuditsLink({
        requestId: requestIdParam,
        userId: effectiveUserId,
        eventId: eventIdParam ?? null,
        from,
      }),
      "scenarioId",
      scenarioIdParam
    );
    const webhooksLink = withQueryParam(
      buildOpsCaseWebhooksLink({
        window: windowValue,
        q: requestIdParam ?? effectiveUserId ?? null,
        from,
      }),
      "scenarioId",
      scenarioIdParam
    );
    const statusLink = withQueryParam(buildOpsCaseStatusLink({ window: windowValue, from }), "scenarioId", scenarioIdParam);
    const caseParams = new URLSearchParams();
    caseParams.set("window", windowValue);
    caseParams.set("from", from);
    if (requestIdParam) caseParams.set("requestId", requestIdParam);
    if (!requestIdParam && effectiveUserId) caseParams.set("userId", effectiveUserId);
    const caseBase = `/app/ops/case?${caseParams.toString()}`;
    const caseLink = withQueryParam(withQueryParam(caseBase, "scenarioId", scenarioIdParam), "eventId", eventIdParam);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      alerts: origin ? `${origin}${alertsLink}` : alertsLink,
      incidents: origin ? `${origin}${incidentsLink}` : incidentsLink,
      audits: origin ? `${origin}${auditsLink}` : auditsLink,
      webhooks: origin ? `${origin}${webhooksLink}` : webhooksLink,
      status: origin ? `${origin}${statusLink}` : statusLink,
      caseView: origin ? `${origin}${caseLink}` : caseLink,
    };
  }, [
    codeParam,
    effectiveUserId,
    eventIdParam,
    filteredAlertEvents,
    requestIdParam,
    scenarioIdParam,
    signalParam,
    surfaceParam,
    trainingMode,
    windowValue,
  ]);

  const trainingEvidenceSnippet = useMemo(
    () =>
      buildTrainingEvidenceSnippet({
        scenarioId: scenarioIdParam,
        requestId: requestIdParam,
        eventId: eventIdParam ?? filteredAlertEvents[0]?.id ?? null,
        checklist: checklistEntries ?? null,
        outcome: caseNotes?.outcomeCode ?? null,
        notes: caseNotes?.notes ?? null,
        links: trainingLinks,
      }),
    [
      caseNotes?.notes,
      caseNotes?.outcomeCode,
      checklistEntries,
      eventIdParam,
      filteredAlertEvents,
      requestIdParam,
      scenarioIdParam,
      trainingLinks,
    ]
  );

  const handoffSnippet = useMemo(
    () =>
      buildCaseHandoffSnippet({
        requestId: requestIdParam,
        userId: effectiveUserId,
        outcome: caseNotes?.outcomeCode ?? null,
        notes: caseNotes?.notes ?? null,
        window: windowValue,
        alertsCount: alertsData.firingCount ?? firingAlerts.length,
        incidentsCount,
        webhooksCount: webhooksData.length,
        billingSummary,
      }),
    [
      alertsData.firingCount,
      billingSummary,
      caseNotes?.notes,
      caseNotes?.outcomeCode,
      effectiveUserId,
      firingAlerts.length,
      incidentsCount,
      requestIdParam,
      webhooksData.length,
      windowValue,
    ]
  );

  const escalationLinks = useMemo(() => {
    const from = fromParam ?? "ops_case";
    const alertsPath = buildOpsCaseAlertsLink({
      window: windowValue,
      requestId: requestIdParam,
      eventId: eventIdParam ?? filteredAlertEvents[0]?.id ?? null,
      from,
      tab: "recent",
    });
    const incidentsPath = buildOpsCaseIncidentsLink({
      window: windowValue,
      requestId: requestIdParam,
      userId: effectiveUserId,
      surface: surfaceParam,
      signal: signalParam,
      code: codeParam,
      from,
    });
    const auditsPath = buildOpsCaseAuditsLink({
      requestId: requestIdParam,
      userId: effectiveUserId,
      eventId: eventIdParam ?? null,
      from,
    });
    const webhooksPath = buildOpsCaseWebhooksLink({
      window: windowValue,
      q: requestIdParam ?? effectiveUserId ?? null,
      from,
    });
    const statusPath = buildOpsCaseStatusLink({ window: windowValue, from });
    const casePath = `/app/ops/case?requestId=${encodeURIComponent(requestIdParam ?? "")}&window=${encodeURIComponent(windowValue)}`;
    const billingPath = effectiveUserId ? `/app/ops/users/${effectiveUserId}#billing-triage` : null;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const makeAbs = (path: string | null) => (path ? `${origin}${path}` : null);
    return {
      Case: makeAbs(casePath),
      Alerts: makeAbs(alertsPath),
      Incidents: makeAbs(incidentsPath),
      Audits: makeAbs(auditsPath),
      Webhooks: makeAbs(webhooksPath),
      Status: makeAbs(statusPath),
      Billing: billingPath ? makeAbs(billingPath) : null,
    };
  }, [codeParam, effectiveUserId, eventIdParam, filteredAlertEvents, fromParam, requestIdParam, signalParam, surfaceParam, windowValue]);

  const escalationTemplate = useMemo(
    () =>
      buildEscalationTemplate({
        kind: escalationTab,
        requestId: requestIdParam,
        userId: effectiveUserId,
        emailMasked: effectiveEmailMasked,
        status: workflowStatus,
        priority: workflowPriority,
        window: windowValue,
        links: escalationLinks,
        outcomes: outcomesData,
        watchItems: watchData,
        evidence: evidenceItems,
        trainingScenarioId: scenarioIdParam ?? null,
      }),
    [
      escalationLinks,
      escalationTab,
      evidenceItems,
      effectiveEmailMasked,
      effectiveUserId,
      outcomesData,
      requestIdParam,
      scenarioIdParam,
      watchData,
      windowValue,
      workflowPriority,
      workflowStatus,
    ]
  );

  const handleNotesSave = useCallback(async () => {
    if (!requestIdParam) return;
    setNotesSaving(true);
    setCaseNotesError(null);
    const payload = {
      caseType: "request",
      caseKey: requestIdParam,
      patch: {
        notes: notesDraft || null,
        outcome_code: notesOutcomeValue || null,
      },
      windowLabel: windowValue,
      source: trainingMode ? "ops_case_training" : "ops_case",
    };
    const res = await fetchJsonSafe<{ ok: boolean; notes?: CaseNotesRecord | null }>(`/api/ops/case/notes/upsert`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok && res.json?.ok) {
      setCaseNotes(res.json.notes ?? null);
      setNotesDraft(res.json.notes?.notes ?? "");
      setOutcomeDraft(res.json.notes?.outcomeCode ?? "");
      setNotesSavedAt(res.json.notes?.updatedAt ?? new Date().toISOString());
      safeLog("ops_case_notes_save", { window: windowValue });
      refreshCaseSummary({ silent: true });
    } else {
      setCaseNotesError({ message: res.error?.message ?? "Unable to save case notes", requestId: res.requestId ?? requestId });
    }
    setNotesSaving(false);
  }, [notesDraft, notesOutcomeValue, refreshCaseSummary, requestId, requestIdParam, safeLog, trainingMode, windowValue]);

  const handleChecklistToggle = useCallback(
    async (key: string) => {
      if (!requestIdParam) return;
      const nextValue = !Boolean(caseNotes?.checklist?.[key]?.done);
      setChecklistSaving((prev) => ({ ...prev, [key]: true }));
      setCaseNotesError(null);
      const res = await fetchJsonSafe<{ ok: boolean; notes?: CaseNotesRecord | null }>(`/api/ops/case/notes/upsert`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          caseType: "request",
          caseKey: requestIdParam,
          patch: { checklist: { [key]: nextValue } },
          windowLabel: windowValue,
          source: trainingMode ? "ops_case_training" : "ops_case",
        }),
      });
      if (res.ok && res.json?.ok) {
        setCaseNotes(res.json.notes ?? null);
        setNotesSavedAt(res.json.notes?.updatedAt ?? new Date().toISOString());
        safeLog("ops_case_checklist_toggle", { window: windowValue });
        refreshCaseSummary({ silent: true });
      } else {
        setCaseNotesError({ message: res.error?.message ?? "Unable to update checklist", requestId: res.requestId ?? requestId });
      }
      setChecklistSaving((prev) => ({ ...prev, [key]: false }));
    },
    [caseNotes?.checklist, refreshCaseSummary, requestId, requestIdParam, safeLog, trainingMode, windowValue]
  );

  const handleCloseCase = useCallback(async () => {
    if (!requestIdParam || !isAdminViewer) return;
    setCloseSaving(true);
    setCaseNotesError(null);
    const res = await fetchJsonSafe<{ ok: boolean; notes?: CaseNotesRecord | null }>(`/api/ops/case/notes/upsert`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        caseType: "request",
        caseKey: requestIdParam,
        patch: { status: "closed" },
        windowLabel: windowValue,
        source: "ops_case",
      }),
    });
    if (res.ok && res.json?.ok) {
      setCaseNotes(res.json.notes ?? null);
      setNotesSavedAt(res.json.notes?.updatedAt ?? new Date().toISOString());
      safeLog("ops_case_close", { window: windowValue });
      refreshCaseSummary({ silent: true });
    } else {
      setCaseNotesError({ message: res.error?.message ?? "Unable to close case", requestId: res.requestId ?? requestId });
    }
    setCloseSaving(false);
  }, [isAdminViewer, refreshCaseSummary, requestId, requestIdParam, safeLog, windowValue]);

  const applyWorkflowUpdate = (workflow: CaseWorkflow | null) => {
    if (!workflow) return;
    setWorkflowData(workflow);
  };

  const handleClaimCase = useCallback(async () => {
    if (!requestIdParam) return;
    setWorkflowActionError(null);
    const res = await fetchJsonSafe<{ ok: boolean; workflow?: CaseWorkflow }>(`/api/ops/case/claim`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: requestIdParam }),
    });
    if (res.ok && res.json?.ok) {
      applyWorkflowUpdate(res.json.workflow ?? null);
      safeLog("ops_case_claim", { window: windowValue });
      refreshCaseSummary({ silent: true });
    } else {
      const message = res.error?.message ?? "Unable to claim case";
      setWorkflowActionError({ message, requestId: res.requestId ?? requestId });
      if (res.status === 409) {
        safeLog("ops_case_conflict", { window: windowValue });
      }
    }
  }, [refreshCaseSummary, requestId, requestIdParam, safeLog, windowValue]);

  const handleReleaseCase = useCallback(async () => {
    if (!requestIdParam) return;
    setWorkflowActionError(null);
    const res = await fetchJsonSafe<{ ok: boolean; workflow?: CaseWorkflow }>(`/api/ops/case/release`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: requestIdParam }),
    });
    if (res.ok && res.json?.ok) {
      applyWorkflowUpdate(res.json.workflow ?? null);
      safeLog("ops_case_release", { window: windowValue });
      refreshCaseSummary({ silent: true });
    } else {
      const message = res.error?.message ?? "Unable to release case";
      setWorkflowActionError({ message, requestId: res.requestId ?? requestId });
      if (res.status === 409) {
        safeLog("ops_case_conflict", { window: windowValue });
      }
    }
  }, [refreshCaseSummary, requestId, requestIdParam, safeLog, windowValue]);

  const handleStatusChange = useCallback(
    async (nextStatus: string) => {
      if (!requestIdParam) return;
      setWorkflowActionError(null);
      const res = await fetchJsonSafe<{ ok: boolean; workflow?: CaseWorkflow }>(`/api/ops/case/status`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: requestIdParam, status: nextStatus, priority: workflowPriority }),
      });
      if (res.ok && res.json?.ok) {
        applyWorkflowUpdate(res.json.workflow ?? null);
        safeLog("ops_case_status_change", { status: nextStatus });
        refreshCaseSummary({ silent: true });
      } else {
        const message = res.error?.message ?? "Unable to update status";
        setWorkflowActionError({ message, requestId: res.requestId ?? requestId });
        if (res.status === 409) {
          safeLog("ops_case_conflict", { window: windowValue });
        }
      }
    },
    [refreshCaseSummary, requestId, requestIdParam, safeLog, windowValue, workflowPriority]
  );

  const handlePriorityChange = useCallback(
    async (nextPriority: string) => {
      if (!requestIdParam) return;
      setWorkflowActionError(null);
      const res = await fetchJsonSafe<{ ok: boolean; workflow?: CaseWorkflow }>(`/api/ops/case/status`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: requestIdParam, status: workflowStatus, priority: nextPriority }),
      });
      if (res.ok && res.json?.ok) {
        applyWorkflowUpdate(res.json.workflow ?? null);
        safeLog("ops_case_priority_change", { priority: nextPriority });
        refreshCaseSummary({ silent: true });
      } else {
        const message = res.error?.message ?? "Unable to update priority";
        setWorkflowActionError({ message, requestId: res.requestId ?? requestId });
        if (res.status === 409) {
          safeLog("ops_case_conflict", { window: windowValue });
        }
      }
    },
    [refreshCaseSummary, requestId, requestIdParam, safeLog, windowValue, workflowStatus]
  );

  const handleAssignSearch = useCallback(async () => {
    if (!assignQuery.trim()) return;
    setAssignLoading(true);
    setAssignError(null);
    const res = await fetchJsonSafe<{ ok: boolean; users?: Array<{ id: string; email?: string | null }> }>(
      `/api/ops/users/search?q=${encodeURIComponent(assignQuery.trim())}`,
      { method: "GET", cache: "no-store" }
    );
    if (res.ok && res.json?.ok) {
      setAssignResults(res.json.users ?? []);
    } else {
      setAssignError(res.error?.message ?? "Unable to search users");
    }
    setAssignLoading(false);
  }, [assignQuery]);

  const handleAssignCase = useCallback(
    async (userId: string) => {
      if (!requestIdParam || !userId) return;
      setAssignSaving(true);
      setWorkflowActionError(null);
      const res = await fetchJsonSafe<{ ok: boolean; workflow?: CaseWorkflow }>(`/api/ops/case/assign`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: requestIdParam, assignedToUserId: userId }),
      });
      if (res.ok && res.json?.ok) {
        applyWorkflowUpdate(res.json.workflow ?? null);
        setAssignResults(null);
        setAssignQuery("");
        safeLog("ops_case_assign", { hasAssignee: true });
        refreshCaseSummary({ silent: true });
      } else {
        setWorkflowActionError({ message: res.error?.message ?? "Unable to assign case", requestId: res.requestId ?? requestId });
      }
      setAssignSaving(false);
    },
    [refreshCaseSummary, requestId, requestIdParam, safeLog]
  );

  const handleEvidenceAdd = useCallback(async () => {
    if (!requestIdParam || !evidenceBody.trim()) return;
    setEvidenceSaving(true);
    setEvidenceError(null);
    const res = await fetchJsonSafe<{ ok: boolean; evidence?: CaseEvidence }>(`/api/ops/case/evidence`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId: requestIdParam,
        type: evidenceType,
        body: evidenceBody,
        meta: trainingMode && scenarioIdParam ? { scenarioId: scenarioIdParam } : undefined,
      }),
    });
    if (res.ok && res.json?.ok && res.json.evidence) {
      setEvidenceItems((prev) => [res.json!.evidence as CaseEvidence, ...prev]);
      setEvidenceBody("");
      safeLog("ops_case_evidence_add", { type: evidenceType });
      refreshCaseSummary({ silent: true });
    } else {
      setEvidenceError({ message: res.error?.message ?? "Unable to add evidence", requestId: res.requestId ?? requestId });
    }
    setEvidenceSaving(false);
  }, [
    evidenceBody,
    evidenceType,
    refreshCaseSummary,
    requestId,
    requestIdParam,
    safeLog,
    scenarioIdParam,
    trainingMode,
  ]);

  const handleTemplateCopy = (kind: "internal" | "customer" | "engineering") => {
    safeLog("ops_case_template_copy", { templateKind: kind });
  };

  const handleIncidentsWiden = (removed: string, href: string) => {
    safeLog("ops_case_incidents_widen_click", { removed, window: windowValue });
    window.open(href, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-black/10 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Case key</p>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              {caseKey.label}: {caseKey.value}
            </p>
            <p className="text-[11px] text-[rgb(var(--muted))]">Paste a requestId, eventId, userId, or email to start.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={windowValue}
              onChange={(e) => {
                const nextWindow = resolveCaseWindow(e.target.value);
                setWindowValue(nextWindow);
                updateQuery({ requestId: requestIdParam, userId: userIdParam, email: emailParam, window: nextWindow });
              }}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Window {option.label}
                </option>
              ))}
            </select>
            {returnToParam ? (
              <Link
                href={returnToParam}
                onClick={() => safeLog("ops_case_back_to_queue_clicked")}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Back to queue
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex overflow-hidden rounded-full border border-black/10 bg-white text-xs font-semibold">
              {(["requestId", "userId"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`px-3 py-1 ${searchMode === mode ? "bg-black/80 text-white" : "text-[rgb(var(--ink))]"}`}
                  onClick={() => setSearchMode(mode)}
                >
                  {mode === "requestId" ? "Request" : "User"}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[rgb(var(--muted))]">Email is auto-detected.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="req_... / eventId / userId / email"
              className="flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white"
            >
              Search
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))]"
            >
              Clear
            </button>
          </div>
          {resolveError ? <p className="text-[11px] text-rose-600">{resolveError}</p> : null}
        </div>
      </div>

      {!hasQuery ? (
        <div className="rounded-3xl border border-black/10 bg-white/70 p-6 text-sm text-[rgb(var(--muted))]">
          Paste a requestId to begin. Case View will assemble alerts, incidents, audits, and billing signals for quick triage.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-xs text-[rgb(var(--muted))]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                Alerts: {alertsData.firingCount ?? firingAlerts.length} firing
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                Incidents: {incidentsCount}
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                Webhooks: {webhooksData.length}
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                Billing: {billingSummary}
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                Last handled: {latestHandled ? formatShortLocalTime(latestHandled) : "—"}
              </span>
            </div>
            <CopyIconButton text={summarySnippet} label="Copy case snippet" onCopy={handleSnippetCopy} />
          </div>

          {fromAlerts ? (
            <div className="mt-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-xs text-[rgb(var(--muted))]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">From Alerts</p>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    Filters: {fromAlertsSummary || "window=" + windowValue}
                  </p>
                </div>
                <Link href={backToAlertsLink} className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                  Back to Alerts
                </Link>
              </div>
            </div>
          ) : null}

          {requestIdParam ? (
            <div className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-xs text-[rgb(var(--muted))]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">User context</p>
                  {displayedUserId ? (
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                      User linked: {maskId(displayedUserId)} {displayedEmailMasked ? `· ${displayedEmailMasked}` : ""}
                      {contextData?.userRole ? ` · ${contextData.userRole}` : ""}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Missing user context</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {displayedUserId ? (
                    <CopyIconButton
                      text={displayedUserId}
                      label="Copy userId"
                      onCopy={() => safeLog("ops_case_context_copy_userId", { hasUserId: true })}
                    />
                  ) : null}
                  {contextLoading ? <span className="text-[11px] text-[rgb(var(--muted))]">Loading…</span> : null}
                </div>
              </div>
              {contextError ? (
                <div className="mt-2">
                  <ErrorBanner title="Context unavailable" message={contextError.message} requestId={contextError.requestId ?? undefined} />
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[rgb(var(--muted))]">
                <span>Sources: {contextSourcesLabel}</span>
                {contextSource ? <span>Source: {contextSource}</span> : null}
                {contextConfidence ? <span>Confidence: {contextConfidence}</span> : null}
                {contextEvidenceAt ? <span>Evidence: {formatShortLocalTime(contextEvidenceAt)}</span> : null}
                {contextData?.lastSeenAt ? <span>Last seen: {formatShortLocalTime(contextData.lastSeenAt)}</span> : null}
                {contextData?.lastSeenPath ? <span>Path: {contextData.lastSeenPath}</span> : null}
              </div>
              {showMissingContext ? (
                <div className="mt-3 rounded-2xl border border-dashed border-black/10 bg-white/70 px-3 py-2">
                  <p className="text-[11px] text-[rgb(var(--muted))]">
                    Link a user to unlock billing and dossier signals. {missingContextHint}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={userLookupHref}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                    >
                      Open user lookup
                    </Link>
                  </div>
                </div>
              ) : null}
              {isAdminViewer && showMissingContext ? (
                <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-3">
                  <p className="text-[11px] font-semibold text-[rgb(var(--ink))]">Attach user context (admin)</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={attachValue}
                      onChange={(e) => setAttachValue(e.target.value)}
                      placeholder="userId or email"
                      className="min-w-[220px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      value={attachNote}
                      onChange={(e) => setAttachNote(e.target.value)}
                      placeholder="Optional note"
                      className="min-w-[200px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAttach}
                      disabled={attachLoading || !attachValue.trim()}
                      className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
                    >
                      {attachLoading ? "Attaching…" : "Attach"}
                    </button>
                  </div>
                  {attachError ? (
                    <div className="mt-2">
                      <ErrorBanner title="Attach failed" message={attachError.message} requestId={attachError.requestId ?? undefined} />
                    </div>
                  ) : null}
                  {attachSuccess ? <p className="mt-2 text-[11px] text-emerald-700">{attachSuccess}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {requestIdParam ? (
            <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Case workflow</p>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">Status, priority, and ownership</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[rgb(var(--muted))]">
                  <span>Opened {openedSinceLabel}</span>
                  <span>In status {statusSinceLabel}</span>
                  <span>Last touched {lastTouchedLabel}</span>
                </div>
              </div>
              {workflowError ? (
                <div className="mt-2">
                  <ErrorBanner title="Workflow unavailable" message={workflowError.message} requestId={workflowError.requestId ?? undefined} />
                </div>
              ) : null}
              {workflowActionError ? (
                <div className="mt-2">
                  <ErrorBanner title="Workflow update failed" message={workflowActionError.message} requestId={workflowActionError.requestId ?? undefined} />
                </div>
              ) : null}
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <label className="block text-xs font-semibold text-[rgb(var(--ink))]">
                  Status
                  <select
                    value={workflowStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    {[
                      "open",
                      "investigating",
                      "monitoring",
                      "waiting_on_user",
                      "waiting_on_provider",
                      "resolved",
                      "closed",
                    ].map((status) => (
                      <option key={status} value={status} disabled={!isAdminViewer && status === "closed"}>
                        {status.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[rgb(var(--ink))]">
                  Priority
                  <select
                    value={workflowPriority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    {["p0", "p1", "p2", "p3"].map((priority) => (
                      <option key={priority} value={priority}>
                        {priority.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="text-xs font-semibold text-[rgb(var(--ink))]">
                  Ownership
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {assignedToUserId ? (
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                        {isAssignedToMe ? "Assigned to me" : `Assigned to ${maskId(assignedToUserId)}`}
                      </span>
                    ) : (
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                        Unassigned
                      </span>
                    )}
                    {assignedToUserId ? (
                      <CopyIconButton text={assignedToUserId} label="Copy assignee" onCopy={() => safeLog("ops_case_assign")} />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {!assignedToUserId ? (
                  <button
                    type="button"
                    onClick={handleClaimCase}
                    className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Claim
                  </button>
                ) : isAssignedToMe ? (
                  <button
                    type="button"
                    onClick={handleReleaseCase}
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
                  >
                    Release
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--muted))]"
                  >
                    Claimed
                  </button>
                )}
                {workflowLoading ? <span className="text-[11px] text-[rgb(var(--muted))]">Syncing…</span> : null}
              </div>
              {isAdminViewer ? (
                <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 px-3 py-3">
                  <p className="text-[11px] font-semibold text-[rgb(var(--ink))]">Assign to another ops user</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={assignQuery}
                      onChange={(e) => setAssignQuery(e.target.value)}
                      placeholder="Search by email or userId"
                      className="min-w-[220px] flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAssignSearch}
                      disabled={assignLoading || !assignQuery.trim()}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))] disabled:cursor-not-allowed"
                    >
                      {assignLoading ? "Searching…" : "Search"}
                    </button>
                  </div>
                  {assignError ? <p className="mt-2 text-[11px] text-rose-600">{assignError}</p> : null}
                  {assignResults?.length ? (
                    <div className="mt-2 space-y-2 text-[11px] text-[rgb(var(--muted))]">
                      {assignResults.map((result) => (
                        <div key={result.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                          <span>
                            {maskId(result.id)} {result.email ? `· ${maskEmail(result.email)}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAssignCase(result.id)}
                            disabled={assignSaving}
                            className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white disabled:cursor-not-allowed"
                          >
                            {assignSaving ? "Assigning…" : "Assign"}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {requestIdParam ? (
            <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Case Notes</p>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">Outcome, checklist, and handoff context</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                    {notesStatus === "closed" ? "Closed" : "Open"}
                  </span>
                  <CopyIconButton
                    text={handoffSnippet}
                    label="Copy handoff snippet"
                    onCopy={() => safeLog("ops_case_snippet_copy", { kind: "handoff" })}
                  />
                </div>
              </div>
              {caseNotesError ? (
                <div className="mt-3">
                  <ErrorBanner title="Case notes unavailable" message={caseNotesError.message} requestId={caseNotesError.requestId ?? undefined} />
                </div>
              ) : null}
              {caseNotesLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading case notes…</p> : null}
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-[rgb(var(--ink))]">
                    Outcome
                    <select
                      value={notesOutcomeValue}
                      onChange={(e) => setOutcomeDraft(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select outcome</option>
                      {CASE_OUTCOME_CODES.map((code) => (
                        <option key={code} value={code}>
                          {code.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[rgb(var(--ink))]">
                    Notes
                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      rows={4}
                      placeholder="Short handoff note (masked, no URLs/emails)."
                      className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[rgb(var(--muted))]">
                    <span>{notesDraft.length}/800</span>
                    <span>
                      Last handled:{" "}
                      {notesLastHandled
                        ? `${formatShortLocalTime(notesLastHandled)} by ${notesLastHandledBy ? maskId(notesLastHandledBy) : "Ops"}`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleNotesSave}
                      disabled={notesSaving || !notesHasChanges}
                      className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
                    >
                      {notesSaving ? "Saving…" : "Save notes"}
                    </button>
                    {isAdminViewer && notesStatus !== "closed" ? (
                      <button
                        type="button"
                        onClick={handleCloseCase}
                        disabled={closeSaving}
                        className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))] disabled:cursor-not-allowed"
                      >
                        {closeSaving ? "Closing…" : "Close case"}
                      </button>
                    ) : null}
                    {notesSavedAt || notesUpdatedAt ? (
                      <span className="text-[11px] text-[rgb(var(--muted))]">
                        Saved {formatShortLocalTime(notesSavedAt ?? notesUpdatedAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[rgb(var(--ink))]">Checklist</p>
                  <div className="mt-2 space-y-2 text-xs text-[rgb(var(--muted))]">
                    {CASE_CHECKLIST_ITEMS.map((item) => {
                      const entry = checklistEntries?.[item.key];
                      const done = Boolean(entry?.done);
                      return (
                        <label key={item.key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => handleChecklistToggle(item.key)}
                            disabled={Boolean(checklistSaving[item.key])}
                            className="h-4 w-4 rounded border-black/20"
                          />
                          <span className={done ? "text-[rgb(var(--ink))]" : ""}>{item.label}</span>
                          {entry?.at ? <span className="text-[10px] text-[rgb(var(--muted))]">{formatShortLocalTime(entry.at)}</span> : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              {trainingMode ? (
                <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-xs text-[rgb(var(--muted))]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Training evidence</p>
                      <p className="text-sm font-semibold text-[rgb(var(--ink))]">Paste-ready summary for drills</p>
                    </div>
                    <CopyIconButton
                      text={trainingEvidenceSnippet}
                      label="Copy training evidence"
                      onCopy={() => safeLog("ops_case_training_evidence_copy", { window: windowValue })}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[rgb(var(--muted))]">
                    {scenarioIdParam ? <span>Scenario: {scenarioIdParam.slice(0, 8)}…</span> : null}
                    {eventIdParam ? <span>Event: {eventIdParam.slice(0, 8)}…</span> : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Alerts</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Recent events + firing signals</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openAlertsLink} onClick={() => safeLog("ops_case_alerts_open_click", { window: windowValue })}>
                      Open Alerts
                    </Link>
                  </div>
                </div>
                {alertsError ? <ErrorBanner title="Alerts unavailable" message={alertsError.message} requestId={alertsError.requestId ?? undefined} /> : null}
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-[rgb(var(--ink))]">Firing now</p>
                    {firingAlerts.length === 0 ? (
                      <p className="text-xs text-[rgb(var(--muted))]">No alerts firing in the last 15m.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-xs text-[rgb(var(--muted))]">
                        {firingAlerts.slice(0, 4).map((alert: any) => (
                          <li key={alert.key} className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-[rgb(var(--ink))]">{alert.summary}</span>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{alert.severity}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[rgb(var(--ink))]">Related recent events</p>
                    {filteredAlertEvents.length === 0 ? (
                      <p className="text-xs text-[rgb(var(--muted))]">No recent alert events matched this case.</p>
                    ) : (
                      <ul className="mt-1 space-y-2 text-xs text-[rgb(var(--muted))]">
                        {filteredAlertEvents.map((event: any) => (
                          <li key={event.id} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-semibold text-[rgb(var(--ink))]">{event.summary}</p>
                              <span className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                                {event.severity ?? "low"}
                              </span>
                            </div>
                            <p className="text-[11px] text-[rgb(var(--muted))]">{formatShortLocalTime(event.at)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {alertsLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Refreshing alerts…</p> : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Incidents</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Windowed incident preview</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openIncidentsLink} onClick={() => safeLog("ops_case_incidents_open_click", { window: windowValue })}>
                      Open Incidents
                    </Link>
                  </div>
                </div>
                {incidentsError ? <ErrorBanner title="Incidents unavailable" message={incidentsError.message} requestId={incidentsError.requestId ?? undefined} /> : null}
                {incidentsLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading incidents…</p> : null}
                {!incidentsLoading && incidentsData.length > 0 ? (
                  <div className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    {incidentGroups.slice(0, 4).map((group) => (
                      <div key={group.key} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[rgb(var(--ink))]">{group.message ?? group.code ?? "Incident"}</p>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{group.surface}</span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--muted))]">
                          {group.count} occurrences · last {formatShortLocalTime(group.lastSeen)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {incidentsEmpty ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-black/10 bg-white/70 px-3 py-3 text-xs text-[rgb(var(--muted))]">
                    <p className="font-semibold text-[rgb(var(--ink))]">No incidents match this case.</p>
                    <p className="mt-1">Widen the net:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {requestIdParam ? (
                        <button
                          type="button"
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                          onClick={() =>
                            handleIncidentsWiden("requestId", buildOpsCaseIncidentsLink({ window: windowValue, userId: effectiveUserId }))
                          }
                        >
                          Remove requestId
                        </button>
                      ) : null}
                      {effectiveUserId ? (
                        <button
                          type="button"
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                          onClick={() =>
                            handleIncidentsWiden("userId", buildOpsCaseIncidentsLink({ window: windowValue, requestId: requestIdParam }))
                          }
                        >
                          Remove userId
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                        onClick={() => handleIncidentsWiden("window", buildOpsCaseIncidentsLink({ window: "24h", requestId: requestIdParam, userId: effectiveUserId }))}
                      >
                        Window 24h
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                        onClick={() => handleIncidentsWiden("clear", buildOpsCaseIncidentsLink({ window: "24h" }))}
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Audits</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Recent ops audit entries</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openAuditsLink} onClick={() => safeLog("ops_case_audits_open_click", { window: windowValue })}>
                      Open Audits
                    </Link>
                  </div>
                </div>
                {auditsError ? <ErrorBanner title="Audits unavailable" message={auditsError.message} requestId={auditsError.requestId ?? undefined} /> : null}
                {auditsLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading audits…</p> : null}
                {!auditsLoading && auditsData.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    {auditsData.map((item) => (
                      <li key={item.id} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[rgb(var(--ink))]">{item.action}</span>
                          <span className="text-[11px] text-[rgb(var(--muted))]">{formatShortLocalTime(item.at)}</span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--muted))]">
                          {item.actor?.email ?? "Ops"} · {item.requestId ?? item.ref ?? "No ref"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!auditsLoading && auditsData.length === 0 ? (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">No recent audits matched this case.</p>
                ) : null}
              </section>
            </div>

            <div className="space-y-4">
              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Evidence</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Notes, links, and decisions</p>
                  </div>
                  <div className="text-[11px] text-[rgb(var(--muted))]">{evidenceItems.length} items</div>
                </div>
                {evidenceError ? (
                  <div className="mt-2">
                    <ErrorBanner title="Evidence unavailable" message={evidenceError.message} requestId={evidenceError.requestId ?? undefined} />
                  </div>
                ) : null}
                {!requestIdParam ? (
                  <p className="mt-3 text-xs text-[rgb(var(--muted))]">Add a requestId to capture evidence for this case.</p>
                ) : (
                  <>
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {EVIDENCE_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setEvidenceType(option.value)}
                            className={`rounded-full border border-black/10 px-3 py-1 text-[11px] font-semibold ${
                              evidenceType === option.value ? "bg-black/80 text-white" : "bg-white text-[rgb(var(--ink))]"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={evidenceBody}
                        onChange={(event) => setEvidenceBody(event.target.value)}
                        rows={3}
                        placeholder={evidencePlaceholder}
                        className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[rgb(var(--muted))]">
                        <span>{evidenceBody.length}/800</span>
                        <button
                          type="button"
                          onClick={handleEvidenceAdd}
                          disabled={evidenceSaving || !evidenceBody.trim()}
                          className="rounded-full bg-[rgb(var(--ink))] px-4 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
                        >
                          {evidenceSaving ? "Saving…" : "Add evidence"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                  {evidenceItems.length === 0 ? (
                    <p>No evidence captured yet.</p>
                  ) : (
                    evidenceItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                            {item.type.replace(/_/g, " ")}
                          </span>
                          <span className="text-[11px] text-[rgb(var(--muted))]">{formatShortLocalTime(item.createdAt)}</span>
                        </div>
                        <p className="mt-1 text-sm text-[rgb(var(--ink))]">{item.body}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[rgb(var(--muted))]">
                          <span>{item.createdByUserId === viewerId ? "By you" : `By ${maskId(item.createdByUserId)}`}</span>
                          {item.meta?.scenarioId ? <span>Scenario {item.meta.scenarioId}</span> : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Escalation</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Copyable escalation templates</p>
                  </div>
                  <CopyIconButton
                    text={escalationTemplate}
                    label="Copy template"
                    onCopy={() => handleTemplateCopy(escalationTab)}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["internal", "customer", "engineering"] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setEscalationTab(kind)}
                      className={`rounded-full border border-black/10 px-3 py-1 text-[11px] font-semibold ${
                        escalationTab === kind ? "bg-black/80 text-white" : "bg-white text-[rgb(var(--ink))]"
                      }`}
                    >
                      {kind === "internal" ? "Internal" : kind === "customer" ? "Customer" : "Engineering"}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">
                  Shares masked identifiers, outcomes, watch items, and the latest evidence for quick escalation.
                </p>
                <pre className="mt-3 max-h-72 overflow-auto rounded-2xl border border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--ink))] whitespace-pre-wrap">
                  {escalationTemplate}
                </pre>
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Webhooks</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Failure queue snapshot</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openWebhooksLink} onClick={() => safeLog("ops_case_webhooks_open_click", { window: windowValue })}>
                      Open Webhooks
                    </Link>
                  </div>
                </div>
                {webhooksError ? <ErrorBanner title="Webhook failures unavailable" message={webhooksError.message} requestId={webhooksError.requestId ?? undefined} /> : null}
                {webhooksLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading webhook failures…</p> : null}
                {!webhooksLoading && webhooksData.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    {webhooksData.map((item) => (
                      <li key={item.id} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[rgb(var(--ink))]">{item.summary ?? "Webhook failure"}</span>
                          <span className="text-[11px] text-[rgb(var(--muted))]">{formatShortLocalTime(item.at)}</span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--muted))]">
                          {item.code ?? "unknown"} · repeats {item.repeatCount}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!webhooksLoading && webhooksData.length === 0 ? (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">No webhook failures matched this case.</p>
                ) : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Billing</p>
                      <p className="text-sm font-semibold text-[rgb(var(--ink))]">Billing snapshot + recheck</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                      <Link
                        href={`/app/billing${requestIdParam ? `?requestId=${encodeURIComponent(requestIdParam)}` : ""}`}
                        onClick={() => safeLog("ops_case_billing_open_click", { window: windowValue })}
                      >
                        Open Billing Trace
                      </Link>
                      <button type="button" onClick={runBillingRecheck} className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]">
                        {billingRecheckLoading ? "Rechecking…" : "Recheck"}
                      </button>
                      {effectiveUserId ? (
                        <Link
                          href={`/app/ops/users/${effectiveUserId}#billing-triage`}
                          onClick={() => safeLog("ops_case_billing_open_click", { target: "triage" })}
                        >
                          Ops Billing Triage
                        </Link>
                      ) : null}
                  </div>
                </div>
                {billingError ? <ErrorBanner title="Billing snapshot unavailable" message={billingError.message} requestId={billingError.requestId ?? undefined} /> : null}
                {billingRecheckError ? <ErrorBanner title="Billing recheck failed" message={billingRecheckError} requestId={requestId ?? undefined} /> : null}
                {billingLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading billing snapshot…</p> : null}
                {billingRecheckHint ? <p className="mt-2 text-[11px] text-emerald-700">{billingRecheckHint}</p> : null}
                {!effectiveUserId ? (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">Billing snapshot requires a userId. Search by user or email to enable.</p>
                ) : null}
                {effectiveUserId && billingData ? (
                  <div className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    <p>
                      Subscription: <span className="font-semibold text-[rgb(var(--ink))]">{billingData.local?.subscriptionStatus ?? "unknown"}</span>
                    </p>
                    <p>
                      Credits: <span className="font-semibold text-[rgb(var(--ink))]">{billingData.local?.creditsAvailable ?? 0}</span>
                    </p>
                    <p>
                      Webhook health: <span className="font-semibold text-[rgb(var(--ink))]">{billingData.webhookHealth?.status ?? "unknown"}</span>
                    </p>
                    {billingData.delayState?.state && billingData.delayState.state !== "ok" ? (
                      <p className="text-amber-700">Delay: {billingData.delayState.message ?? billingData.delayState.state}</p>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Resolution / Watch</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Outcomes + watch items</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link
                      href={buildOpsCaseResolutionsLink({})}
                      onClick={() => safeLog("ops_case_resolution_open_click", { window: windowValue })}
                    >
                      Open Resolutions
                    </Link>
                    <Link
                      href={openIncidentsLink}
                      onClick={() => safeLog("ops_case_watch_open_click", { window: windowValue })}
                    >
                      Add watch
                    </Link>
                  </div>
                </div>
                {outcomesError ? <ErrorBanner title="Outcomes unavailable" message={outcomesError.message} requestId={outcomesError.requestId ?? undefined} /> : null}
                {watchError ? <ErrorBanner title="Watch list unavailable" message={watchError.message} requestId={watchError.requestId ?? undefined} /> : null}
                {outcomesLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading outcomes…</p> : null}
                {!outcomesLoading && outcomesData.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    {outcomesData.map((item) => (
                      <li key={item.id ?? item.createdAt} className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[rgb(var(--ink))]">{item.code}</span>
                          <span className="text-[11px] text-[rgb(var(--muted))]">{formatShortLocalTime(item.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-[rgb(var(--muted))]">{item.noteMasked ?? "No note"}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {watchLoading ? <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">Loading watch list…</p> : null}
                {!watchLoading && watchData.length > 0 ? (
                  <div className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
                    <p className="font-semibold text-[rgb(var(--ink))]">Active watch items</p>
                    <ul className="space-y-1">
                      {watchData.slice(0, 4).map((item) => (
                        <li key={`${item.requestId}-${item.expiresAt}`}>
                          {item.reasonCode} · expires {formatShortLocalTime(item.expiresAt)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!watchLoading && watchData.length === 0 ? (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">No active watch items for this case.</p>
                ) : null}
              </section>

              <section className="rounded-3xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">System status</p>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">Quick health context</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[rgb(var(--ink))]">
                    <Link href={openStatusLink} onClick={() => safeLog("ops_system_status_link_click", { from: "case" })}>
                      Open System Status
                    </Link>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                  Use System Status to confirm RAG signals, webhook health, and rate-limit pressure before escalation.
                </p>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
