export type RunbookCategory =
  | "Getting started"
  | "Training"
  | "Quick cards"
  | "Templates"
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
export type RunbookOwnerRole = "support" | "admin";

export type RunbookSurface = "alerts" | "incidents" | "webhooks" | "status" | "access" | "billing" | "users";

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
  | { type: "links"; items: Array<{ label: string; href: string }> }
  | {
      type: "drill";
      id: string;
      title: string;
      tags?: string[];
      actions: Array<{ label: string; href: string; actionKind: string }>;
      trigger: string[];
      confirm: string[];
      do: string[];
      record: string[];
      exit: string[];
      escalate: string[];
    }
  | {
      type: "quick-card";
      id: string;
      title: string;
      tags?: string[];
      symptom: string[];
      cause: string[];
      checks: string[];
      next: string[];
      escalate: string[];
    }
  | {
      type: "template";
      id: string;
      title: string;
      tags?: string[];
      description?: string;
      content: string;
    };

export type RunbookSection = {
  id: string;
  title: string;
  category: RunbookCategory;
  owner?: RunbookOwner;
  ownerRole: RunbookOwnerRole;
  lastUpdatedIso: string;
  lastReviewedVersion: string;
  reviewCadenceDays: number;
  linkedSurfaces: RunbookSurface[];
  tags?: string[];
  body: RunbookBlock[];
};

export const RUNBOOK_META = {
  lastUpdatedVersion: "v0.8.60",
  lastUpdatedIso: "2026-03-19T00:00:00.000Z",
  rulesVersion: "ops_runbook_v1",
};

const LAST_UPDATED = RUNBOOK_META.lastUpdatedIso;
const LAST_REVIEWED = RUNBOOK_META.lastUpdatedVersion;
const DEFAULT_REVIEW_DAYS = 14;
const BASE_SUPPORT = { ownerRole: "support" as const, lastReviewedVersion: LAST_REVIEWED, reviewCadenceDays: DEFAULT_REVIEW_DAYS };
const BASE_ADMIN = { ownerRole: "admin" as const, lastReviewedVersion: LAST_REVIEWED, reviewCadenceDays: DEFAULT_REVIEW_DAYS };

export const RUNBOOK_SECTIONS: RunbookSection[] = [
  {
    id: "orientation",
    title: "Orientation: Ops scope and System Status",
    category: "Getting started",
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["status", "alerts", "incidents"],
    tags: ["ops", "requestId", "rag", "status"],
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
    id: "case-view-user-context",
    title: "Case View: auto-resolve user context",
    category: "Getting started",
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["alerts", "incidents", "webhooks", "billing", "users"],
    tags: ["case-view", "requestId", "userId", "email", "ops_request_context"],
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Case View resolves requestId → user context through the canonical ops_request_context mapping. It auto-resolves from touchpoints (audits, outcomes, webhook failures) when requestId + userId appear together in the same row.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: [
          "Case View shows a requestId but Billing panel says user id required.",
          "User context strip shows Missing user context or no sources.",
        ],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: [
          "No touchpoint contains requestId + userId in the selected window.",
          "Upstream events were missing a reliable userId field.",
          "Email lookup was run without attaching it to the requestId.",
        ],
      },
      {
        type: "checks",
        items: [
          "Inspect the User context strip for sources and last-seen time.",
          "Confirm requestId format and try widening the window to 24h or 7d.",
          "Check recent audits/outcomes for matching requestId + userId evidence.",
        ],
      },
      {
        type: "bullets",
        items: [
          "Confidence high: requestId + userId appear in the same touchpoint row.",
          "Confidence medium: requestId matches and userId is present in touchpoint meta.",
        ],
      },
      {
        type: "actions",
        items: [
          "Use the admin Attach user context action to link userId/email when evidence exists.",
          "Refresh Case View panels after attach to rehydrate billing and dossier data.",
          "Capture the source + confidence values when escalating context issues.",
        ],
      },
      {
        type: "escalate",
        items: [
          "RequestId appears in audits/outcomes but ops_request_context never populates.",
          "Conflicting userIds are attached to the same requestId.",
        ],
      },
      {
        type: "send",
        items: ["requestId, window, source + confidence, last seen timestamp, and evidence showing missing or conflicting user context."],
      },
    ],
  },
  {
    id: "case-view-working-case",
    title: "Case View: working a case",
    category: "Getting started",
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["alerts", "incidents", "webhooks", "billing", "status"],
    tags: ["case-view", "checklist", "outcome", "handoff", "training"],
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Case View includes a persistent checklist and notes panel to track ops progress, capture outcomes, and produce a training evidence summary when opened from a drill.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: [
          "Multiple responders are unsure which steps have already been completed.",
          "Handoff notes are missing or out of date during escalation.",
          "Training drills need a paste-ready evidence summary.",
        ],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: [
          "Checklist items were not ticked as actions completed.",
          "Outcome and notes were never saved before handoff.",
          "Case was closed without recording an outcome.",
        ],
      },
      {
        type: "checks",
        items: [
          "Verify checklist items reflect the latest actions (Alerts/Incidents/Audits/Webhooks/Billing).",
          "Confirm Outcome and Notes are saved and show a recent Last handled timestamp.",
          "In training mode, confirm the Training evidence block is visible.",
        ],
      },
      {
        type: "actions",
        items: [
          "Update the Outcome dropdown and add a concise note, then Save.",
          "Tick checklist items as each ops step is completed.",
          "Copy the handoff snippet for support or escalation.",
          "Admin only: Close case once resolution is confirmed.",
        ],
      },
      {
        type: "escalate",
        items: [
          "Checklist/outcome saves fail or revert after refresh.",
          "Cases are closed without sufficient evidence or notes.",
        ],
      },
      {
        type: "send",
        items: [
          "requestId, outcome code, note length, last handled timestamp, and any ErrorBanner requestId values.",
        ],
      },
      {
        type: "links",
        items: [{ label: "Case View", href: "/app/ops/case" }],
      },
    ],
  },
  {
    id: "case-view-workflow",
    title: "Case View workflow: claim → investigate → resolve → close",
    category: "Getting started",
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["alerts", "incidents", "webhooks", "billing", "status"],
    tags: ["case-view", "workflow", "claim", "priority", "escalation", "evidence"],
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Use the Case View workflow controls to claim ownership, set status/priority, and keep ops work coordinated without duplicate effort.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: [
          "Cases are claimed by multiple responders or not owned at all.",
          "Status is stale even though investigation has moved on.",
          "Escalations lack consistent context or evidence.",
        ],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: [
          "Case was never claimed or released after handoff.",
          "Status/priority was not updated after key actions.",
          "Evidence was captured outside the Case View.",
        ],
      },
      {
        type: "checks",
        items: [
          "Confirm the Case workflow section shows the correct owner.",
          "Review time in state and time since opened for escalation urgency.",
          "Verify evidence items and latest outcomes before copying templates.",
        ],
      },
      {
        type: "actions",
        items: [
          "Claim the case when you begin active investigation.",
          "Update status as you move from open → investigating → monitoring → resolved.",
          "Set priority (low/medium/high) for visibility and triage.",
          "Admin only: assign ownership to another ops user when handing off.",
        ],
      },
      { type: "heading", text: "Escalation templates: what's included" },
      {
        type: "bullets",
        items: [
          "RequestId, userId (masked), status, priority, window, and deep links.",
          "Latest outcomes and active watch items (if any).",
          "Up to the last 3 evidence items.",
        ],
      },
      { type: "heading", text: "Evidence: what to store / what not to store" },
      {
        type: "bullets",
        items: [
          "Store short notes, decisions, or links that help the next responder.",
          "Do not store raw emails, webhook URLs, or tokens.",
          "Use masked identifiers and keep evidence concise.",
        ],
      },
      {
        type: "escalate",
        items: [
          "Case claim conflicts persist across multiple attempts.",
          "Status cannot be updated or reverts after refresh.",
        ],
      },
      {
        type: "send",
        items: [
          "requestId, current status/priority, owner, time in state, and the escalation template output.",
        ],
      },
      {
        type: "links",
        items: [{ label: "Case View", href: "/app/ops/case" }],
      },
    ],
  },
  {
    id: "training-drills",
    title: "Training Drills (30-45 mins)",
    category: "Training",
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["status", "alerts", "incidents", "webhooks", "access", "billing"],
    tags: ["training", "drills", "playbook", "ops"],
    body: [
      {
        type: "paragraph",
        text: "Use these drills to practice common ops workflows end-to-end. Each drill is designed to be completed in 30-45 minutes.",
      },
      {
        type: "drill",
        id: "drill-portal-errors",
        title: "Portal errors spike",
        tags: ["billing", "portal", "errors"],
        actions: [
          { label: "Open Ops Status (RAG)", href: "/app/ops/status#rag", actionKind: "open_status" },
          {
            label: "Open Incidents (portal)",
            href: "/app/ops/incidents?from=ops_help&window=15m&surface=portal&signal=portal_errors",
            actionKind: "open_incidents",
          },
          { label: "Open Audits (portal)", href: "/app/ops/audits?from=ops_help&q=portal_error", actionKind: "open_audits" },
        ],
        trigger: ["Ops Status shows portal_errors in amber/red for the 15m window."],
        confirm: ["Check recent portal_error incidents and any audit entries with requestId."],
        do: [
          "Open incidents with surface=portal to confirm scope and top codes.",
          "Open audits to confirm requestId frequency and error summaries.",
          "If user context is required, open Ops user lookup to find affected users.",
        ],
        record: ["requestId samples, top portal error codes, and time window."],
        exit: ["Portal errors return to green or a known upstream incident is acknowledged."],
        escalate: ["Errors remain red for > 30 minutes or user impact is widespread."],
      },
      {
        type: "drill",
        id: "drill-webhook-failures",
        title: "Webhook failures repeating",
        tags: ["webhooks", "failures", "deliveries"],
        actions: [
          { label: "Open Webhook Failures (15m)", href: "/app/ops/webhooks?window=15m", actionKind: "open_webhooks" },
          {
            label: "Open Deliveries (failed)",
            href: "/app/ops/alerts?tab=deliveries&status=failed&window=24h",
            actionKind: "open_deliveries",
          },
          { label: "Open Webhook config", href: "/app/ops/status#alerts", actionKind: "open_status" },
        ],
        trigger: ["Webhook failures queue shows repeats or rising counts."],
        confirm: ["Verify failure codes, repeat counts, and whether webhook config is enabled."],
        do: [
          "Filter webhooks by 15m to confirm active failures.",
          "Check deliveries for failed attempts and capture masked reason codes.",
          "If config missing, follow setup guidance and re-run webhook test.",
        ],
        record: ["failure codes, repeats, delivery statuses, and eventId/requestId samples."],
        exit: ["Webhook failures drop to baseline or the downstream endpoint is confirmed fixed."],
        escalate: ["Failures persist across multiple windows or impact critical billing flow."],
      },
      {
        type: "drill",
        id: "drill-rate-limit-pressure",
        title: "Rate-limit pressure",
        tags: ["rate-limit", "limits", "retry-after"],
        actions: [
          { label: "Open Ops Status (limits)", href: "/app/ops/status#limits", actionKind: "open_status" },
          {
            label: "Open Audits (rate limited)",
            href: "/app/ops/audits?from=ops_help&q=rate_limited",
            actionKind: "open_audits",
          },
          {
            label: "Open Incidents (rate limits)",
            href: "/app/ops/incidents?from=ops_help&window=24h&surface=billing&code=RATE_LIMIT&signal=rate_limits",
            actionKind: "open_incidents",
          },
        ],
        trigger: ["Rate-limit pressure shows in Ops Status or panels show cooldown banners."],
        confirm: ["Check Retry-After values and which routes/budgets are affected."],
        do: [
          "Open Ops Status limits panel and note the top limited routes.",
          "Review audits for rate_limited entries and requestId samples.",
          "Throttle repeated refreshes and consolidate ops actions where possible.",
        ],
        record: ["budget key, retryAfterSeconds, requestId, and affected surfaces."],
        exit: ["Rate-limit pressure clears and panels refresh successfully."],
        escalate: ["Rate limits block critical ops actions for > 30 minutes."],
      },
      {
        type: "drill",
        id: "drill-invite-claim",
        title: "Invite claim stuck / attribution missing",
        tags: ["early-access", "invites", "attribution"],
        actions: [
          { label: "Open Ops Access", href: "/app/ops/access", actionKind: "open_access" },
          { label: "Open Ops Funnel", href: "/app/ops/funnel", actionKind: "open_funnel" },
          { label: "Open User lookup", href: "/app/ops#ops-user-lookup", actionKind: "open_user_lookup" },
        ],
        trigger: ["User reports invite link opened but Early Access still blocked."],
        confirm: ["Check invite status, attribution, and whether an account exists."],
        do: [
          "Search Ops Access for the email hash or invite status.",
          "If the user exists, open dossier and verify invite attribution.",
          "Reissue invite if the original was revoked or expired.",
        ],
        record: ["invite id/token prefix, user id (masked), and requestId if present."],
        exit: ["Invite is claimed and Early Access gate opens on next login."],
        escalate: ["Claim attempts fail repeatedly for the same user or attribution is missing."],
      },
      {
        type: "drill",
        id: "drill-alerts-ops-loop",
        title: "Alert firing end-to-end (claim -> snooze -> acknowledge -> handled)",
        tags: ["alerts", "claim", "snooze", "ack", "handled"],
        actions: [
          { label: "Open Alerts (firing)", href: "/app/ops/alerts?tab=firing&window=15m", actionKind: "open_alerts_firing" },
          { label: "Open Alerts (recent)", href: "/app/ops/alerts?tab=recent&window=24h", actionKind: "open_alerts_recent" },
          { label: "Open Incidents", href: "/app/ops/incidents?from=ops_help&window=15m&surface=ops", actionKind: "open_incidents" },
        ],
        trigger: ["Alert is firing or a test alert needs verification."],
        confirm: ["Check claim/snooze status and confirm handled state for recent events."],
        do: [
          "Claim the alert to avoid duplicate handling.",
          "Snooze noisy alerts (1h/24h) and add a handoff note if needed.",
          "Acknowledge or mark handled once confirmed; verify badge persists on refresh.",
          "Follow up in incidents or audits using the deep links.",
        ],
        record: ["alertKey/eventId, handled timestamp, and any outcomes saved."],
        exit: ["Alert is acknowledged/handled and no longer repeats in the 15m window."],
        escalate: ["Alert continues firing after ACK/handled or signal is unexplained."],
      },
    ],
  },
  {
    id: "training-reports-handoff",
    title: "Training reports and escalation handoff",
    category: "Training",
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["alerts", "incidents", "status", "webhooks"],
    tags: ["training", "report", "handoff", "escalation"],
    body: [
      { type: "heading", text: "What this is / When to use" },
      {
        type: "paragraph",
        text: "Use training reports to capture the drill context, links, and acknowledgement state so handoffs stay consistent across shifts and engineering escalations.",
      },
      { type: "heading", text: "Symptoms" },
      {
        type: "bullets",
        items: ["Training outcomes are shared without links or requestId context.", "Ops handoff lacks clarity on what was already checked."],
      },
      { type: "heading", text: "Likely causes" },
      {
        type: "bullets",
        items: ["Manual note-taking without a standardized report.", "Scenario links not copied from the training sandbox."],
      },
      {
        type: "checks",
        items: [
          "Confirm the training scenario has an eventId and requestId.",
          "Verify the alert was acknowledged and the badge is visible in Alerts.",
          "Ensure the report links open filtered Audits and Incidents.",
        ],
      },
      {
        type: "actions",
        items: [
          "From the Training sandbox, click “Copy training report”.",
          "Use the ID toolbar to copy requestId/eventId for quick cross-panel lookup.",
          "Paste the report into the handoff channel and add outcome notes.",
          "Use the filtered Audits/Incidents links to confirm requestId context.",
        ],
      },
      {
        type: "escalate",
        items: ["The scenario shows repeated failures or missing data after multiple runs.", "Acknowledgement state does not persist across refresh."],
      },
      {
        type: "send",
        items: [
          "Training report text (with scenarioId, eventId, requestId, and links).",
          "Timestamp and window label used during the drill.",
          "Any errors or screenshots observed during the workflow.",
        ],
      },
      {
        type: "links",
        items: [
          { label: "Ops Help", href: "/app/ops/help#training-drills" },
          { label: "Ops Alerts", href: "/app/ops/alerts" },
        ],
      },
    ],
  },
  {
    id: "quick-cards",
    title: "Quick cards: what to do when...",
    category: "Quick cards",
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["alerts", "incidents", "webhooks", "status", "access", "billing"],
    tags: ["quick-cards", "triage", "symptoms"],
    body: [
      {
        type: "quick-card",
        id: "qc-webhook-not-configured",
        title: "Alerts says webhook not configured",
        tags: ["alerts", "webhooks", "config"],
        symptom: ["Alerts header shows webhook notifications disabled."],
        cause: ["Webhook URL or secret missing.", "Env not configured for ops notifications."],
        checks: ["Open Ops Status alerts panel and confirm config truth.", "Check for masked config hint text."],
        next: ["Link to /app/ops/status#alerts and follow setup guidance.", "Re-run webhook test after config."],
        escalate: ["Config present but UI still reports disabled.", "Webhook test fails with unknown reason."],
      },
      {
        type: "quick-card",
        id: "qc-alert-incidents-empty",
        title: "Alert firing but incidents empty",
        tags: ["alerts", "incidents", "empty-state"],
        symptom: ["Alerts deep-link into incidents with no results."],
        cause: ["Filters too narrow for the 15m window.", "Surface/code mismatch."],
        checks: ["Confirm window=15m and surface/code filters in the URL."],
        next: ["Use widen chips to remove code/surface or expand to 24h.", "Pivot to audits with requestId if present."],
        escalate: ["No incidents across 24h and alert continues firing."],
      },
      {
        type: "quick-card",
        id: "qc-webhooks-empty-user-claims",
        title: "Webhook failures queue empty but user says payment not applied",
        tags: ["billing", "webhooks", "credits"],
        symptom: ["User reports missing credits but webhook queue is empty."],
        cause: ["Delayed webhook delivery outside the window.", "Checkout succeeded but ledger delay."],
        checks: ["Open Billing Trace and check correlation confidence.", "Review webhook health badges."],
        next: ["Run billing recheck and capture delay classification.", "Use support snippet for follow-up."],
        escalate: ["Delay persists beyond expected window or correlation shows failed."],
      },
      {
        type: "quick-card",
        id: "qc-ack-reverts",
        title: "ACK toggles but reverts after refresh",
        tags: ["alerts", "ack", "handled"],
        symptom: ["Acknowledged badge disappears after refresh."],
        cause: ["ACK not persisted or dedupe mismatch.", "EventId mismatch between lists."],
        checks: ["Confirm eventId in Recent/Test events matches handled map.", "Retry ACK and watch requestId."],
        next: ["Refresh Alerts page and verify handled state from server.", "Copy support snippet with requestId."],
        escalate: ["ACK succeeds but server never persists handled state."],
      },
      {
        type: "quick-card",
        id: "qc-early-access-blocked",
        title: "User can't access early access features",
        tags: ["early-access", "access"],
        symptom: ["User sees Early Access gate despite invite."],
        cause: ["Allowlist not granted.", "Invite revoked or not claimed."],
        checks: ["Search user in Ops Access.", "Verify invite status and claim timestamp."],
        next: ["Grant access or reissue invite.", "Ask user to re-login after claim."],
        escalate: ["Gate persists after confirmed grant."],
      },
      {
        type: "quick-card",
        id: "qc-invite-claim-missing",
        title: "Invite link opened but claim didn't apply",
        tags: ["invites", "claim", "attribution"],
        symptom: ["Invite link opened, but attribution missing in dossier."],
        cause: ["Email hash mismatch or invite revoked."],
        checks: ["Check Ops Access invite list and recent claims."],
        next: ["Reissue invite, confirm login after claim, and verify attribution."],
        escalate: ["Claim attempts repeat without attribution update."],
      },
      {
        type: "quick-card",
        id: "qc-billing-delay",
        title: "Billing trace shows delay classification",
        tags: ["billing", "delay", "trace"],
        symptom: ["Billing trace shows delayed or unknown classification."],
        cause: ["Webhook or ledger processing lag."],
        checks: ["Review delay bucket and related webhook receipts."],
        next: ["Run recheck after Retry-After; capture requestId and delay reason."],
        escalate: ["Delay classification persists across multiple rechecks."],
      },
    ],
  },
  {
    id: "escalation-templates",
    title: "Escalation templates",
    category: "Templates",
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["alerts", "incidents", "webhooks", "status", "access", "billing"],
    tags: ["templates", "escalation", "support"],
    body: [
      {
        type: "paragraph",
        text: "Use these templates when escalating or replying. Placeholders auto-fill when query params are present (requestId, eventId, userId, emailHash).",
      },
      {
        type: "template",
        id: "template-customer-reply",
        title: "Customer-facing reply (calm + short)",
        tags: ["customer", "reply", "billing"],
        content:
          "Hi there - thanks for the details. We can see the issue and are investigating now.\\n\\nReference: {{requestId}}\\nWhat we observed: {{observed}}\\nNext update: We will follow up once the investigation completes.\\n\\nThanks for your patience.",
      },
      {
        type: "template",
        id: "template-internal-escalation",
        title: "Internal escalation (Slack/Teams)",
        tags: ["internal", "escalation", "ops"],
        content:
          "Escalation: {{observed}}\\nrequestId: {{requestId}}\\nuserId/emailHash: {{userId}} / {{emailHash}}\\nalert/eventId: {{eventId}}\\nActions taken: {{actionsTaken}}\\nNeeded from engineering: {{needed}}\\nLink: {{path}}",
      },
      {
        type: "template",
        id: "template-eng-ticket",
        title: "Engineering ticket template",
        tags: ["engineering", "ticket", "repro"],
        content:
          "Title: {{observed}}\\n\\nEnvironment: prod\\nrequestId: {{requestId}}\\nuserId/emailHash: {{userId}} / {{emailHash}}\\nalert/eventId: {{eventId}}\\n\\nSteps to reproduce:\\n1) {{step1}}\\n2) {{step2}}\\n3) {{step3}}\\n\\nExpected:\\n- {{expected}}\\n\\nActual:\\n- {{actual}}\\n\\nNotes:\\n- {{notes}}",
      },
    ],
  },
  {
    id: "alerts-ops",
    title: "Alerts: ACK, claim, snooze, and deliveries",
    category: "Alerts",
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["alerts", "incidents", "webhooks"],
    tags: ["alerts", "ack", "snooze", "claim", "deliveries"],
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
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["incidents", "alerts"],
    tags: ["incidents", "filters", "empty-state"],
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
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["billing", "webhooks", "incidents"],
    tags: ["billing", "portal", "recheck", "trace"],
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
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["webhooks", "alerts"],
    tags: ["webhooks", "failures", "watch"],
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
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["access", "users"],
    tags: ["early-access", "invites", "attribution"],
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
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["status", "billing", "alerts"],
    tags: ["rate-limit", "retry-after", "limits"],
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
    ...BASE_ADMIN,
    owner: "Engineering",
    lastUpdatedIso: LAST_UPDATED,
    reviewCadenceDays: 30,
    linkedSurfaces: ["alerts", "incidents", "billing"],
    tags: ["security", "privacy", "masking"],
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
    ...BASE_ADMIN,
    owner: "Engineering",
    lastUpdatedIso: LAST_UPDATED,
    linkedSurfaces: ["alerts", "incidents", "status"],
    tags: ["escalation", "playbooks", "engineering"],
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
    ...BASE_SUPPORT,
    owner: "Support",
    lastUpdatedIso: LAST_UPDATED,
    reviewCadenceDays: 30,
    linkedSurfaces: ["alerts", "incidents", "billing"],
    tags: ["glossary", "definitions"],
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
