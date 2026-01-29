export type RunbookCategory =
  | "Getting started"
  | "Alerts"
  | "Incidents"
  | "Billing"
  | "Webhooks"
  | "Early access"
  | "Rate limits"
  | "Security"
  | "Escalation"
  | "Glossary";

export type RunbookOwner = "Support" | "Admin" | "Engineering";

export type RunbookBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "checks"; items: string[] }
  | { type: "actions"; items: string[] }
  | { type: "escalate"; items: string[] }
  | { type: "send"; items: string[] }
  | { type: "code"; code: string; language?: string }
  | { type: "links"; items: Array<{ label: string; href: string }> };

export type RunbookSection = {
  id: string;
  title: string;
  category: RunbookCategory;
  owner?: RunbookOwner;
  lastUpdatedIso: string;
  body: RunbookBlock[];
};

export const RUNBOOK_META = {
  lastUpdatedVersion: "v0.8.50",
  lastUpdatedIso: "2026-01-29T00:00:00.000Z",
  rulesVersion: "ops_runbook_v1",
};

const LAST_UPDATED = RUNBOOK_META.lastUpdatedIso;

export const RUNBOOK_SECTIONS: RunbookSection[] = [
  {
    id: "orientation",
    title: "Orientation: Ops scope and System Status",
    category: "Getting started",
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Use this section to orient new ops agents (support, admin, super_admin) on where to work and how to read the Ops Status signals.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: ["Unclear where to start with Ops tools.", "Missing context on requestId or 15m RAG status."],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: ["New operator onboarding.", "Recent changes to alerts/incidents without shared context."],
      },
      {
        type: "checks",
        items: [
          "Confirm the user role is support/admin/super_admin.",
          "Open /app/ops/status and read the 15m RAG window + Why this status list.",
          "Locate requestId in any banner or audit entry for correlation.",
        ],
      },
      {
        type: "actions",
        items: [
          "Use Ops Status for 24h health, and Ops Alerts for 15m thresholded signals.",
          "Copy requestId from ErrorBanner or log panel to correlate incidents/audits.",
        ],
      },
      {
        type: "escalate",
        items: ["Ops Status shows persistent red signals without clear cause.", "Multiple windows show the same spike with no resolution path."],
      },
      {
        type: "send",
        items: [
          "requestId(s), timestamps, and the Ops Status window.",
          "Screenshots of the RAG headline + Why this status section.",
        ],
      },
      { type: "code", language: "text", code: "requestId example: req_ab12cd34 (masked)" },
      {
        type: "links",
        items: [
          { label: "Ops Status", href: "/app/ops/status" },
          { label: "Ops Alerts", href: "/app/ops/alerts" },
          { label: "Ops Incidents", href: "/app/ops/incidents" },
        ],
      },
    ],
  },
  {
    id: "alerts-ops",
    title: "Alerts: ACK, claim, snooze, and deliveries",
    category: "Alerts",
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Use Ops Alerts to triage 15m thresholded signals, confirm delivery, and acknowledge handled events.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: ["Alert firing with no follow-up context.", "Test events not appearing.", "Webhook deliveries failing."],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: ["Alert is acknowledged but UI not refreshed.", "Webhook config missing or deliveries failing.", "Noise repeats without claim/snooze."],
      },
      {
        type: "checks",
        items: [
          "Check Firing vs Recent tabs; confirm test events in Recent.",
          "Verify webhook deliveries status (Sent/Delivered/Failed).",
          "Check claim/snooze state and handoff notes for coordination.",
        ],
      },
      {
        type: "actions",
        items: [
          "Use Acknowledge to mark handled; it mints an ops token and calls public ack.",
          "Claim alerts to avoid duplicate handling; release when done.",
          "Snooze noisy alerts for 1h/24h and add a handoff note if needed.",
          "If webhookConfigured is false, configure first and re-test deliveries.",
        ],
      },
      {
        type: "escalate",
        items: ["Repeated failures in deliveries despite valid config.", "ACK calls dedupe but handled state does not persist."],
      },
      {
        type: "send",
        items: [
          "eventId, requestId, and delivery status timeline.",
          "Whether the alert was ACKed, claimed, or snoozed (with timestamps).",
        ],
      },
      {
        type: "code",
        language: "text",
        code: "Handled example: handled.at=2024-02-24T12:03:00Z source=ui (masked)",
      },
      {
        type: "links",
        items: [
          { label: "Ops Alerts", href: "/app/ops/alerts" },
          { label: "Deliveries (failed)", href: "/app/ops/alerts?tab=deliveries&status=failed" },
        ],
      },
    ],
  },
  {
    id: "incidents-triage",
    title: "Incidents: filters, deep links, and empty states",
    category: "Incidents",
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Incidents aggregate recent errors by surface, code, and signal. Use it after alerts and when you have a requestId.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: ["Alerts deep-link to an empty incidents view.", "Filters look too narrow for the window."],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: ["Window is too short (15m).", "Filters include a code or surface that is too specific."],
      },
      {
        type: "checks",
        items: [
          "Confirm deep link parameters (window=15m, from=ops_alerts).",
          "Inspect surface/code/signal filters in the URL.",
        ],
      },
      {
        type: "actions",
        items: [
          "Use widen chips to remove code or surface, expand to 24h, or clear all filters.",
          "Use requestId to pivot to audits if available.",
        ],
      },
      {
        type: "escalate",
        items: ["Incident groups persist but no resolution path exists.", "The surface or code is unknown/uncategorized."],
      },
      {
        type: "send",
        items: ["Incident group key, top surface/code/signal, time window, and sample requestId."],
      },
      {
        type: "links",
        items: [
          { label: "Ops Incidents", href: "/app/ops/incidents" },
          { label: "Ops Audits", href: "/app/ops/audits" },
        ],
      },
    ],
  },
  {
    id: "billing-support",
    title: "Billing support: trace, recheck, portal errors",
    category: "Billing",
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Use Billing tools to verify subscription status, webhook health, and credit delays. Ops billing triage snapshots are admin-only.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: ["Portal error banner persists.", "Recheck is rate-limited.", "Credits not applied after checkout."],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: ["Stripe portal failure or webhook delay.", "Rate-limit budgets exhausted.", "Delayed credits classification (waiting_ledger/webhook)."],
      },
      {
        type: "checks",
        items: [
          "Open Billing Trace to review webhook health and correlation confidence.",
          "Use Recheck and respect cooldown when rate-limited.",
          "Confirm portal_error banner includes requestId for support correlation.",
        ],
      },
      {
        type: "actions",
        items: [
          "If Recheck throttles, wait for Retry-After and document the budget key.",
          "Use support snippets (masked) when responding to users.",
          "If admin, use Ops billing triage snapshot for Stripe status.",
        ],
      },
      {
        type: "escalate",
        items: ["Delayed credits persist beyond expected window.", "Webhook health is degraded with increasing failures."],
      },
      {
        type: "send",
        items: [
          "requestId, billing trace summary, webhook health status, and delay classification.",
          "User ID (masked), subscription status, and portal error code if present.",
        ],
      },
      {
        type: "links",
        items: [
          { label: "Billing page", href: "/app/billing" },
          { label: "Ops Incidents (billing)", href: "/app/ops/incidents?surface=billing&range=24h" },
        ],
      },
    ],
  },
  {
    id: "webhooks-ops",
    title: "Webhooks: failures queue, watch, suppression",
    category: "Webhooks",
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "The Webhooks console shows failures and repeats with filters; use Watch to track recurring issues without noise.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: ["Webhook failure counts spiking.", "Repeats increasing in 24h view."],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: ["Downstream endpoint issues.", "Invalid webhook secret or URL.", "Unexpected payload changes."],
      },
      {
        type: "checks",
        items: [
          "Review repeats and last seen timestamp.",
          "Filter by code/surface to identify the dominant error.",
          "Confirm webhook configuration in Ops Status.",
        ],
      },
      {
        type: "actions",
        items: [
          "Open Watch for repeated failures when you need tracking across days.",
          "Add watch items with clear notes and a 24h TTL.",
          "Use Ops Alerts deliveries to cross-check recent attempts.",
        ],
      },
      {
        type: "escalate",
        items: ["Failures persist across multiple windows with no recovery.", "Repeated failures across unrelated endpoints."],
      },
      {
        type: "send",
        items: ["Top failure code(s), repeat count, last seen time, and any related requestId."],
      },
      {
        type: "links",
        items: [
          { label: "Ops Webhooks", href: "/app/ops/webhooks" },
          { label: "Ops Alerts Deliveries", href: "/app/ops/alerts?tab=deliveries" },
        ],
      },
    ],
  },
  {
    id: "early-access-invites",
    title: "Early access and invites",
    category: "Early access",
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Early Access controls who can onboard; invites can be created before signup and claimed on login.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: ["User blocked by Early Access gate.", "Invite token not claimed after login."],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: ["User not allowlisted.", "Invite revoked or expired.", "Email hash mismatch."],
      },
      {
        type: "checks",
        items: [
          "Look up invite status in Ops Access.",
          "Verify invite attribution and funnel counters.",
          "Confirm allowlist vs invite token flow.",
        ],
      },
      {
        type: "actions",
        items: [
          "Create an invite for the user email (masked).",
          "Revoke and re-issue if claim failed.",
          "Share high-level invite guidance (detailed templates already exist).",
        ],
      },
      {
        type: "escalate",
        items: ["Invite claim fails repeatedly with correct email.", "Attribution missing after successful claim."],
      },
      {
        type: "send",
        items: ["Invite id/token prefix, user id, requestId, and timestamps of claim attempts."],
      },
      {
        type: "links",
        items: [
          { label: "Ops Access", href: "/app/ops/access" },
          { label: "Ops Funnel", href: "/app/ops/funnel" },
        ],
      },
    ],
  },
  {
    id: "rate-limits",
    title: "Rate limits and 429 handling",
    category: "Rate limits",
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Rate limits protect ops and billing routes. UI shows Retry-After and calm banners on 429.",
      },
      { type: "heading", text: "Symptoms" },
      { type: "bullets", items: ["429 responses with Retry-After.", "Ops actions temporarily disabled."] },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: ["Repeated refresh/test calls within a budget window.", "Concurrent ops actions across multiple agents."],
      },
      {
        type: "checks",
        items: [
          "Check Retry-After header and budget key in error metadata.",
          "Review Ops Status Limits panel for top limited routes.",
        ],
      },
      {
        type: "actions",
        items: [
          "Wait for cooldown before re-trying actions.",
          "Reduce repeated refresh/testing and consolidate actions.",
        ],
      },
      {
        type: "escalate",
        items: ["Frequent 429s during normal usage.", "Limiter blocks critical ops actions repeatedly."],
      },
      {
        type: "send",
        items: ["Budget key, retryAfterSeconds, route, and requestId from the banner."],
      },
      {
        type: "links",
        items: [
          { label: "Ops Status Limits", href: "/app/ops/status#limits" },
          { label: "Ops Audits", href: "/app/ops/audits?q=rate_limited" },
        ],
      },
    ],
  },
  {
    id: "security-privacy",
    title: "Security and privacy",
    category: "Security",
    owner: "Engineering",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Ops tooling is masked and privacy-first. Logs, snippets, and exports must avoid raw emails/URLs.",
      },
      { type: "heading", text: "Symptoms" },
      { type: "bullets", items: ["Accidental exposure of raw identifiers.", "Logs contain full URLs or email addresses."] },
      { type: "heading", text: "Likely causes" },
      { type: "bullets", items: ["Copying raw payloads into logs or snippets.", "Using unmasked exports."] },
      {
        type: "checks",
        items: [
          "Verify outputs show masked values only.",
          "Confirm support snippets redact sensitive values.",
        ],
      },
      {
        type: "actions",
        items: ["Use built-in support snippets and masked logs.", "Avoid pasting raw payloads into tickets."],
      },
      {
        type: "escalate",
        items: ["Any instance of raw emails/URLs in logs or exports.", "Suspicion of secret leakage."],
      },
      {
        type: "send",
        items: ["Masked examples, requestId, timestamp, and where the exposure occurred."],
      },
      { type: "code", language: "text", code: "Masked email example: a***@e******.com" },
    ],
  },
  {
    id: "escalation-playbooks",
    title: "Escalation and playbooks",
    category: "Escalation",
    owner: "Engineering",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Escalate when issues are persistent, user-impacting, or involve system integrity. Include actionable context.",
      },
      { type: "heading", text: "Symptoms" },
      { type: "bullets", items: ["Red RAG signals persisting across windows.", "High-severity alerts without resolution."] },
      { type: "heading", text: "Likely causes" },
      { type: "bullets", items: ["Service degradation or external dependency outage.", "Unrecognized error pattern."] },
      {
        type: "checks",
        items: ["Confirm repeated failures across multiple windows.", "Gather requestId/eventId for the most recent failures."],
      },
      {
        type: "actions",
        items: ["Escalate to engineering when thresholds are met.", "Attach screenshots of ops dashboards and filtered incident views."],
      },
      {
        type: "escalate",
        items: ["Any unresolved alert firing > 30 minutes.", "Webhooks failing with rising repeat counts."],
      },
      {
        type: "send",
        items: ["requestId/eventId, timestamps, affected surfaces/codes, and screenshots."],
      },
    ],
  },
  {
    id: "glossary",
    title: "Glossary",
    category: "Glossary",
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    body: [
      { type: "heading", text: "What this is / When to use" },
      { type: "paragraph", text: "Use this glossary to align on operational terms during triage and escalation." },
      { type: "heading", text: "Symptoms" },
      { type: "bullets", items: ["Confusion about eventId/requestId/window_label terminology."] },
      { type: "heading", text: "Likely causes" },
      { type: "bullets", items: ["New team members or fast-moving releases."] },
      {
        type: "checks",
        items: ["Confirm which identifier you have before escalating.", "Map window labels to the ops UI filters."],
      },
      {
        type: "actions",
        items: ["Use glossary terms in support and engineering notes.", "Include both requestId and eventId when available."],
      },
      {
        type: "escalate",
        items: ["Terms are missing or ambiguous for a new feature area."],
      },
      {
        type: "send",
        items: ["The term, where it appears, and suggested definition updates."],
      },
      {
        type: "bullets",
        items: [
          "eventId: Unique id for an alert event record.",
          "requestId: Request correlation id shown in banners and logs.",
          "window_label: Time window label (e.g., 15m, 24h).",
          "rulesVersion: Version of the alerting or RAG ruleset.",
          "handled: Alert acknowledged/handled state with timestamp.",
          "snooze: Temporarily mute an alert for a set window.",
          "claim: Assign ownership of an alert to an ops user.",
        ],
      },
    ],
  },
];
