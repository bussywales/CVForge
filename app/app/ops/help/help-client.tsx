"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import CopyIconButton from "@/components/CopyIconButton";
import ErrorBanner from "@/components/ErrorBanner";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import {
  RUNBOOK_META,
  RUNBOOK_SECTIONS,
  type RunbookBlock,
  type RunbookCategory,
  type RunbookSection,
} from "@/lib/ops/runbook-sections";
import { coerceTrainingScenario, coerceTrainingScenarios, type TrainingScenario } from "@/lib/ops/training-scenarios-model";
import { formatShortLocalTime } from "@/lib/time/format-short";
import { normaliseId } from "@/lib/ops/normalise-id";

type Props = {
  sections?: RunbookSection[];
  meta?: typeof RUNBOOK_META;
};

type TemplateTokens = {
  requestId: string;
  eventId: string;
  alertKey: string;
  userId: string;
  emailHash: string;
  window: string;
  surface: string;
  signal: string;
  code: string;
  path: string;
};

const EMPTY_TEMPLATE_TOKENS: TemplateTokens = {
  requestId: "",
  eventId: "",
  alertKey: "",
  userId: "",
  emailHash: "",
  window: "",
  surface: "",
  signal: "",
  code: "",
  path: "",
};

const CATEGORY_ORDER: RunbookCategory[] = [
  "Getting started",
  "Training",
  "Quick cards",
  "Templates",
  "Alerts",
  "Incidents",
  "Billing",
  "Webhooks",
  "Early access",
  "Rate limits",
  "Security",
  "Escalation",
  "Glossary",
];

type TrainingScenarioKind = "alerts_test" | "mixed_basic";

const TRAINING_SCENARIO_OPTIONS: Array<{ value: TrainingScenarioKind; label: string }> = [
  { value: "alerts_test", label: "Alerts: Test alert" },
  { value: "mixed_basic", label: "Mixed: Basic end-to-end" },
];

function formatIsoDate(iso: string) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function blockText(block: RunbookBlock) {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return block.text;
    case "bullets":
    case "steps":
    case "checks":
    case "actions":
    case "escalate":
    case "send":
      return block.items.join(" ");
    case "code":
      return block.code;
    case "links":
      return block.items.map((item) => `${item.label} ${item.href}`).join(" ");
    case "drill":
      return [
        block.title,
        ...(block.tags ?? []),
        ...block.trigger,
        ...block.confirm,
        ...block.do,
        ...block.record,
        ...block.exit,
        ...block.escalate,
        ...block.actions.map((action) => `${action.label} ${action.actionKind}`),
      ].join(" ");
    case "quick-card":
      return [
        block.title,
        ...(block.tags ?? []),
        ...block.symptom,
        ...block.cause,
        ...block.checks,
        ...block.next,
        ...block.escalate,
      ].join(" ");
    case "template":
      return [block.title, block.description ?? "", block.content, ...(block.tags ?? [])].join(" ");
    default:
      return "";
  }
}

function buildSearchText(section: RunbookSection) {
  const body = section.body.map(blockText).join(" ");
  const tags = section.tags ? section.tags.join(" ") : "";
  const surfaces = section.linkedSurfaces?.join(" ") ?? "";
  return `${section.title} ${section.category} ${tags} ${surfaces} ${body}`.toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const escaped = escapeRegExp(trimmed);
  const regex = new RegExp(escaped, "ig");
  const matches = text.match(regex);
  if (!matches) return text;
  const parts = text.split(regex);
  const output: Array<string | JSX.Element> = [];
  parts.forEach((part, index) => {
    output.push(part);
    const match = matches[index];
    if (match) {
      output.push(
        <span key={`${match}-${index}`} className="rounded bg-amber-100 px-0.5 text-amber-900">
          {match}
        </span>
      );
    }
  });
  return output;
}

export default function HelpClient({ sections = RUNBOOK_SECTIONS, meta = RUNBOOK_META }: Props) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(sections[0]?.id ?? "");
  const [printView, setPrintView] = useState(false);
  const [scenarioType, setScenarioType] = useState<TrainingScenarioKind>("alerts_test");
  const [scenarios, setScenarios] = useState<TrainingScenario[]>([]);
  const [scenariosError, setScenariosError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [scenarioHint, setScenarioHint] = useState<string | null>(null);
  const [scenarioCreating, setScenarioCreating] = useState(false);
  const [scenarioHighlightId, setScenarioHighlightId] = useState<string | null>(null);
  const [scenarioReportCopiedId, setScenarioReportCopiedId] = useState<string | null>(null);
  const [scenarioCopiedKey, setScenarioCopiedKey] = useState<string | null>(null);
  const [scenariosRequestId, setScenariosRequestId] = useState<string | null>(null);
  const scenariosViewLogged = useRef(false);
  const scenarioHighlightTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      logMonetisationClientEvent("ops_help_view", null, "ops");
    } catch {
      // ignore
    }
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const searchableSections = useMemo(
    () =>
      sections.map((section) => ({
        section,
        searchText: buildSearchText(section),
      })),
    [sections]
  );

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return searchableSections
      .filter((item) => item.searchText.includes(normalizedQuery))
      .map((item) => item.section);
  }, [normalizedQuery, searchableSections, sections]);

  const groupedSections = useMemo(() => {
    const map = new Map<RunbookCategory, RunbookSection[]>();
    filteredSections.forEach((section) => {
      const existing = map.get(section.category) ?? [];
      existing.push(section);
      map.set(section.category, existing);
    });

    const ordered: Array<{ category: RunbookCategory; sections: RunbookSection[] }> = [];
    CATEGORY_ORDER.forEach((category) => {
      const items = map.get(category);
      if (items?.length) {
        ordered.push({ category, sections: items });
      }
    });

    return ordered;
  }, [filteredSections]);

  const trainingSection = useMemo(() => {
    return sections.find((section) => section.id === "training-drills" || section.category === "Training") ?? null;
  }, [sections]);

  const templateTokens = useMemo<TemplateTokens>(() => {
    if (typeof window === "undefined") return EMPTY_TEMPLATE_TOKENS;
    const params = new URLSearchParams(window.location.search);
    const pick = (keys: string[]) => {
      for (const key of keys) {
        const value = params.get(key);
        if (value && value.trim()) return value.trim();
      }
      return "";
    };

    return {
      requestId: pick(["requestId", "req"]),
      eventId: pick(["eventId", "event"]),
      alertKey: pick(["alertKey", "alert"]),
      userId: pick(["userId", "uid"]),
      emailHash: pick(["emailHash", "email_hash"]),
      window: pick(["window"]),
      surface: pick(["surface"]),
      signal: pick(["signal"]),
      code: pick(["code"]),
      path: window.location.pathname,
    };
  }, []);

  const supportSnippet = useMemo(() => {
    if (!templateTokens.requestId) return "";
    return buildSupportSnippet({
      action: "Ops escalation template",
      path: typeof window !== "undefined" ? window.location.pathname : "/app/ops/help",
      requestId: templateTokens.requestId,
      code: null,
    });
  }, [templateTokens.requestId]);

  const loadScenarios = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!silent) setScenariosLoading(true);
      try {
        const res = await fetchJsonSafe<{ scenarios?: any[] }>("/api/ops/training/scenarios?active=1&limit=20", { method: "GET", cache: "no-store" });
        if (!res.ok || !res.json) {
          if (!silent) {
            setScenariosError({ message: res.error?.message ?? "Unable to load scenarios", requestId: res.requestId ?? null });
          }
          return null;
        }
        const next = coerceTrainingScenarios(res.json.scenarios);
        setScenarios(next);
        setScenariosRequestId(res.requestId ?? null);
        if (!silent) setScenariosError(null);
        if (!scenariosViewLogged.current) {
          scenariosViewLogged.current = true;
          logMonetisationClientEvent("ops_training_list_view", null, "ops", { meta: { count: next.length } });
        }
        return next;
      } catch {
        if (!silent) {
          setScenariosError({ message: "Unable to load scenarios", requestId: null });
        }
        return null;
      } finally {
        if (!silent) setScenariosLoading(false);
      }
    },
    [scenariosViewLogged]
  );

  useEffect(() => {
    loadScenarios();
    return () => {
      if (scenarioHighlightTimer.current) window.clearTimeout(scenarioHighlightTimer.current);
    };
  }, [loadScenarios]);

  useEffect(() => {
    if (!filteredSections.length) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!selectedId || !filteredSections.some((section) => section.id === selectedId)) {
      setSelectedId(filteredSections[0]?.id ?? "");
    }
  }, [filteredSections, selectedId]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setQuery(next);
    try {
      logMonetisationClientEvent("ops_help_search", null, "ops", { queryLength: next.trim().length });
    } catch {
      // ignore
    }
  };

  const handleClearSearch = () => {
    setQuery("");
  };

  const scrollToAnchor = (anchorId: string) => {
    if (typeof window !== "undefined") {
      window.location.hash = anchorId;
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleTocClick = (section: RunbookSection) => {
    scrollToAnchor(section.id);
    try {
      logMonetisationClientEvent("ops_help_toc_click", null, "ops", { sectionId: section.id, category: section.category });
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async (sectionId: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.hash = sectionId;
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedId(sectionId);
      window.setTimeout(() => setCopiedId(null), 1500);
      logMonetisationClientEvent("ops_help_copy_link_click", null, "ops", { sectionId });
    } catch {
      setCopiedId(null);
    }
  };

  const handleJump = () => {
    if (!selectedId) return;
    const target = filteredSections.find((section) => section.id === selectedId);
    if (target) {
      handleTocClick(target);
    }
  };

  const applyTemplate = (content: string) => {
    return content.replace(/{{(\w+)}}/g, (match, key) => {
      const value = (templateTokens as Record<string, string>)[key];
      return value ? value : match;
    });
  };

  const handleStartTraining = () => {
    if (!trainingSection) return;
    scrollToAnchor(trainingSection.id);
    try {
      logMonetisationClientEvent("ops_help_training_view", null, "ops", { sectionId: trainingSection.id });
    } catch {
      // ignore
    }
  };

  const handleDrillView = (drillId: string) => {
    scrollToAnchor(drillId);
    try {
      logMonetisationClientEvent("ops_help_drill_view", null, "ops", { drillKey: drillId });
    } catch {
      // ignore
    }
  };

  const handleQuickCardView = (cardId: string) => {
    scrollToAnchor(cardId);
    try {
      logMonetisationClientEvent("ops_help_quickcard_view", null, "ops", { cardKey: cardId });
    } catch {
      // ignore
    }
  };

  const handlePrintToggle = () => {
    setPrintView((current) => {
      const next = !current;
      try {
        logMonetisationClientEvent("ops_help_print_view_toggle", null, "ops", { enabled: next });
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleDrillActionClick = (drillId: string, actionKind: string) => {
    try {
      logMonetisationClientEvent("ops_help_drill_action_click", null, "ops", { drillKey: drillId, actionKind });
    } catch {
      // ignore
    }
  };

  const handleTemplateCopy = (templateId: string) => {
    try {
      logMonetisationClientEvent("ops_help_template_copy", null, "ops", { templateId });
    } catch {
      // ignore
    }
  };

  const highlightScenario = (scenarioId: string) => {
    setScenarioHighlightId(scenarioId);
    if (scenarioHighlightTimer.current) {
      window.clearTimeout(scenarioHighlightTimer.current);
    }
    scenarioHighlightTimer.current = window.setTimeout(() => setScenarioHighlightId(null), 3000);
  };

  const handleScenarioCreate = async () => {
    if (scenarioCreating) return;
    setScenarioHint(null);
    setScenariosError(null);
    setScenarioCreating(true);
    try {
      logMonetisationClientEvent("ops_training_scenario_create_click", null, "ops", { meta: { type: scenarioType } });
    } catch {
      // ignore
    }
    try {
      const res = await fetchJsonSafe<{ scenario?: any }>("/api/ops/training/scenarios", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioType }),
      });
      if (!res.ok || !res.json?.scenario) {
        setScenariosError({ message: res.error?.message ?? "Unable to create scenario", requestId: res.requestId ?? null });
        return;
      }
      const scenario = coerceTrainingScenario(res.json.scenario);
      if (!scenario) {
        setScenariosError({ message: "Unable to create scenario", requestId: res.requestId ?? null });
        return;
      }
      setScenarios((prev) => [scenario, ...prev.filter((item) => item.id !== scenario.id)]);
      setScenariosRequestId(res.requestId ?? null);
      setScenarioHint("Scenario created.");
      highlightScenario(scenario.id);
      try {
        logMonetisationClientEvent("ops_training_scenario_created", null, "ops", {
          meta: { type: scenario.scenarioType, hasEventId: Boolean(scenario.eventId) },
        });
      } catch {
        // ignore
      }
    } catch {
      setScenariosError({ message: "Unable to create scenario", requestId: null });
    } finally {
      setScenarioCreating(false);
    }
  };

  const handleScenarioDeactivate = async (scenario: TrainingScenario) => {
    try {
      logMonetisationClientEvent("ops_training_scenario_deactivate_click", null, "ops", {
        meta: { scenarioId: scenario.id.slice(0, 8), type: scenario.scenarioType },
      });
    } catch {
      // ignore
    }
    try {
      const res = await fetchJsonSafe<{ scenario?: any }>(`/api/ops/training/scenarios/${scenario.id}/deactivate`, {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok || !res.json?.scenario) {
        setScenariosError({ message: res.error?.message ?? "Unable to deactivate scenario", requestId: res.requestId ?? null });
        return;
      }
      setScenarios((prev) => prev.filter((item) => item.id !== scenario.id));
      setScenarioHint("Scenario deactivated.");
    } catch {
      setScenariosError({ message: "Unable to deactivate scenario", requestId: null });
    }
  };

  const handleScenarioLinkClick = (scenario: TrainingScenario, destination: string) => {
    try {
      const scenarioId = normaliseScenarioId(scenario.id);
      logMonetisationClientEvent("ops_training_link_click", null, "ops", {
        meta: { destination, type: scenario.scenarioType, scenarioId: scenarioId ? scenarioId.slice(0, 8) : null },
      });
      logMonetisationClientEvent("ops_training_prefilled_link_opened", null, "ops", {
        meta: { target: destination, type: scenario.scenarioType, hasEventId: Boolean(scenario.eventId) },
      });
    } catch {
      // ignore
    }
  };

  const scenarioLabel = (scenario: TrainingScenario) => {
    return scenario.scenarioType === "alerts_test" ? "Alerts: Test alert" : "Mixed: Basic end-to-end";
  };

  const normaliseScenarioId = (value?: string | null) => {
    const normalised = normaliseId(value);
    return normalised || "";
  };

  const buildScenarioLinks = (scenario: TrainingScenario) => {
    const windowLabel = normaliseScenarioId(scenario.windowLabel) || "15m";
    const eventId = normaliseScenarioId(scenario.eventId);
    const scenarioId = normaliseScenarioId(scenario.id);
    const requestId = normaliseScenarioId(scenario.requestId);
    const eventParam = eventId ? `&eventId=${encodeURIComponent(eventId)}` : "";
    const scenarioParam = scenarioId ? `&scenarioId=${encodeURIComponent(scenarioId)}` : "";
    const requestParam = requestId ? `&requestId=${encodeURIComponent(requestId)}` : "";
    const alertsPath = `/app/ops/alerts?from=ops_training&tab=recent&window=${encodeURIComponent(windowLabel)}${eventParam}${scenarioParam}`;
    const incidentsPath = requestId
      ? `/app/ops/incidents?from=ops_training&window=${encodeURIComponent(windowLabel)}${requestParam}`
      : `/app/ops/incidents?from=ops_training&window=${encodeURIComponent(windowLabel)}&surface=ops&signal=alert_test`;
    const auditsPath = requestId
      ? `/app/ops/audits?requestId=${encodeURIComponent(requestId)}`
      : eventId
        ? `/app/ops/audits?eventId=${encodeURIComponent(eventId)}`
        : `/app/ops/audits?from=ops_training&q=alert_test`;
    const statusPath = `/app/ops/status?window=${encodeURIComponent(windowLabel)}&from=ops_training#alerts`;
    const caseBase = requestId
      ? `/app/ops/case?requestId=${encodeURIComponent(requestId)}&window=${encodeURIComponent(windowLabel)}&from=ops_training`
      : `/app/ops/case?window=${encodeURIComponent(windowLabel)}&from=ops_training`;
    const casePath = `${caseBase}${scenarioId ? `&scenarioId=${encodeURIComponent(scenarioId)}` : ""}${eventId ? `&eventId=${encodeURIComponent(eventId)}` : ""}`;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return {
      alertsPath,
      incidentsPath,
      auditsPath,
      statusPath,
      casePath,
      alerts: `${origin}${alertsPath}`,
      incidents: `${origin}${incidentsPath}`,
      audits: `${origin}${auditsPath}`,
      status: `${origin}${statusPath}`,
      case: `${origin}${casePath}`,
    };
  };

  const buildScenarioReport = (scenario: TrainingScenario) => {
    const now = new Date();
    const localStamp = typeof window !== "undefined" ? now.toLocaleString("sv-SE") : now.toISOString();
    const utcStamp = now.toISOString();
    const links = buildScenarioLinks(scenario);
    const scenarioId = normaliseScenarioId(scenario.id) || "--";
    const eventId = normaliseScenarioId(scenario.eventId) || "--";
    const requestId = normaliseScenarioId(scenario.requestId) || "--";
    const ackRequestId = normaliseScenarioId(scenario.ackRequestId) || "--";
    const windowLabel = normaliseScenarioId(scenario.windowLabel) || "15m";
    const acknowledged = scenario.acknowledgedAt ? "Yes" : "Not yet";
    const lines = [
      "CVForge Ops Training Report",
      "",
      "IDs:",
      `- scenarioId: ${scenarioId}`,
      `- requestId: ${requestId}`,
      `- eventId: ${eventId}`,
      `- ackRequestId: ${ackRequestId}`,
      `- window: ${windowLabel}`,
      "",
      `Scenario: ${scenarioLabel(scenario)} (${scenarioId})`,
      `Generated at: ${localStamp} (UTC ${utcStamp})`,
      `Window: ${windowLabel}`,
      "Links:",
      `- Alerts: ${links.alerts}`,
      `- Incidents: ${links.incidents}`,
      `- Audits: ${links.audits}`,
      `- System Status: ${links.status}`,
      `- Case View: ${links.case}`,
      "Checklist:",
      "- Opened Alerts and confirmed event visible",
      `- Acknowledged alert: ${acknowledged}`,
      "- Opened Audits/Incidents filtered by requestId",
      "Outcome/notes:",
      "",
      `RequestId (last scenarios fetch): ${normaliseScenarioId(scenariosRequestId) || "--"}`,
    ];
    return lines.join("\\n").trim();
  };

  const handleScenarioReportCopy = async (scenario: TrainingScenario) => {
    if (!navigator?.clipboard?.writeText) return;
    try {
      const report = buildScenarioReport(scenario);
      await navigator.clipboard.writeText(report);
      setScenarioReportCopiedId(scenario.id);
      window.setTimeout(() => setScenarioReportCopiedId(null), 1500);
      logMonetisationClientEvent("ops_help_training_report_copied", null, "ops", {
        meta: { scenarioType: scenario.scenarioType, hasEventId: Boolean(scenario.eventId), hasRequestId: Boolean(scenario.requestId) },
      });
    } catch {
      setScenarioReportCopiedId(null);
    }
  };

  const markScenarioCopied = (scenarioId: string, kind: string) => {
    setScenarioCopiedKey(`${scenarioId}:${kind}`);
    window.setTimeout(() => setScenarioCopiedKey(null), 1500);
  };

  const handleScenarioIdCopy = async (scenario: TrainingScenario, kind: "requestId" | "eventId" | "all") => {
    if (!navigator?.clipboard?.writeText) return;
    try {
      const scenarioId = normaliseScenarioId(scenario.id) || "--";
      const requestId = normaliseScenarioId(scenario.requestId) || "--";
      const eventId = normaliseScenarioId(scenario.eventId) || "--";
      const ackRequestId = normaliseScenarioId(scenario.ackRequestId) || "--";
      const windowLabel = normaliseScenarioId(scenario.windowLabel) || "15m";
      let payload = "";
      if (kind === "requestId") payload = requestId;
      if (kind === "eventId") payload = eventId;
      if (kind === "all") {
        payload = [
          `scenarioId: ${scenarioId}`,
          `requestId: ${requestId}`,
          `eventId: ${eventId}`,
          `ackRequestId: ${ackRequestId}`,
          `window: ${windowLabel}`,
        ].join("\\n");
      }
      await navigator.clipboard.writeText(payload.trim());
      markScenarioCopied(scenarioId, kind);
      const eventName =
        kind === "requestId" ? "ops_training_copy_request_id" : kind === "eventId" ? "ops_training_copy_event_id" : "ops_training_copy_all_ids";
      logMonetisationClientEvent(eventName, null, "ops", {
        meta: { scenarioType: scenario.scenarioType, hasRequestId: Boolean(scenario.requestId), hasEventId: Boolean(scenario.eventId) },
      });
    } catch {
      setScenarioCopiedKey(null);
    }
  };

  const renderList = (items: string[], ordered = false) => {
    const Tag = ordered ? "ol" : "ul";
    return (
      <Tag className={`${ordered ? "list-decimal" : "list-disc"} ml-5 space-y-1 text-sm text-[rgb(var(--muted))]`}>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
      </Tag>
    );
  };

  const renderTags = (tags?: string[]) => {
    if (!tags?.length) return null;
    return (
      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full border border-black/10 bg-white px-2 py-0.5">
            {tag}
          </span>
        ))}
      </div>
    );
  };

  const renderBlock = (block: RunbookBlock, index: number) => {
    if (block.type === "heading") {
      return (
        <h3 key={`${block.text}-${index}`} className="text-sm font-semibold text-[rgb(var(--ink))]">
          {block.text}
        </h3>
      );
    }

    if (block.type === "paragraph") {
      return (
        <p key={`${block.text}-${index}`} className="text-sm text-[rgb(var(--muted))]">
          {block.text}
        </p>
      );
    }

    if (block.type === "steps") {
      return <div key={`steps-${index}`}>{renderList(block.items, true)}</div>;
    }

    if (
      block.type === "bullets" ||
      block.type === "checks" ||
      block.type === "actions" ||
      block.type === "escalate" ||
      block.type === "send"
    ) {
      return <div key={`list-${index}`}>{renderList(block.items)}</div>;
    }

    if (block.type === "code") {
      return (
        <pre
          key={`code-${index}`}
          className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-[11px] text-[rgb(var(--ink))]"
        >
          <code className="font-mono">{block.code}</code>
        </pre>
      );
    }

    if (block.type === "links") {
      return (
        <div key={`links-${index}`} className="flex flex-wrap gap-2">
          {block.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
            >
              {item.label}
            </Link>
          ))}
        </div>
      );
    }

    if (block.type === "drill") {
      return (
        <div key={`drill-${block.id}`} id={block.id} className="scroll-mt-24 rounded-2xl border border-black/10 bg-white/90 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => handleDrillView(block.id)}
              className="text-left text-sm font-semibold text-[rgb(var(--ink))] hover:underline"
            >
              {highlightText(block.title, query)}
            </button>
            {showControls ? (
              <button
                type="button"
                onClick={() => handleCopyLink(block.id)}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                {copiedId === block.id ? "Copied" : "Copy link"}
              </button>
            ) : null}
          </div>
          {renderTags(block.tags)}
          <div className="mt-3 flex flex-wrap gap-2">
            {block.actions.map((action) => (
              <Link
                key={`${block.id}-${action.actionKind}`}
                href={action.href}
                onClick={() => handleDrillActionClick(block.id, action.actionKind)}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                data-testid={`drill-action-${block.id}-${action.actionKind}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">When you see this</p>
              {renderList(block.trigger)}
            </div>
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Confirm</p>
              {renderList(block.confirm)}
            </div>
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Do</p>
              {renderList(block.do, true)}
            </div>
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Log / Record</p>
              {renderList(block.record)}
            </div>
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Exit criteria</p>
              {renderList(block.exit)}
            </div>
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Escalate if</p>
              {renderList(block.escalate)}
            </div>
          </div>
        </div>
      );
    }

    if (block.type === "quick-card") {
      return (
        <div key={`quick-${block.id}`} id={block.id} className="scroll-mt-24 rounded-2xl border border-black/10 bg-white/90 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => handleQuickCardView(block.id)}
              className="text-left text-sm font-semibold text-[rgb(var(--ink))] hover:underline"
            >
              {highlightText(block.title, query)}
            </button>
            {showControls ? (
              <button
                type="button"
                onClick={() => handleCopyLink(block.id)}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                {copiedId === block.id ? "Copied" : "Copy link"}
              </button>
            ) : null}
          </div>
          {renderTags(block.tags)}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Symptom</p>
              {renderList(block.symptom)}
            </div>
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Likely cause</p>
              {renderList(block.cause)}
            </div>
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Fast checks</p>
              {renderList(block.checks)}
            </div>
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Best next action</p>
              {renderList(block.next)}
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">Escalation threshold</p>
              {renderList(block.escalate)}
            </div>
          </div>
        </div>
      );
    }

    if (block.type === "template") {
      const filled = applyTemplate(block.content);
      return (
        <div key={`template-${block.id}`} id={block.id} className="scroll-mt-24 rounded-2xl border border-black/10 bg-white/90 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[rgb(var(--ink))]">{highlightText(block.title, query)}</h3>
              {block.description ? <p className="text-xs text-[rgb(var(--muted))]">{block.description}</p> : null}
            </div>
            {showControls ? (
              <button
                type="button"
                onClick={() => handleCopyLink(block.id)}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                {copiedId === block.id ? "Copied" : "Copy link"}
              </button>
            ) : null}
          </div>
          {renderTags(block.tags)}
          <pre className="mt-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-[11px] text-[rgb(var(--ink))]">
            <code className="font-mono whitespace-pre-wrap">{filled}</code>
          </pre>
          {showControls ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyIconButton text={filled} label="Copy template" onCopy={() => handleTemplateCopy(block.id)} />
              {supportSnippet ? <CopyIconButton text={supportSnippet} label="Copy support snippet" /> : null}
            </div>
          ) : null}
        </div>
      );
    }

    return null;
  };

  const renderTrainingSandbox = () => {
    return (
      <div className="rounded-2xl border border-black/10 bg-white/90 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">Training sandbox</p>
            <p className="text-[11px] text-[rgb(var(--muted))]">
              Generate safe, labeled scenarios to practice ops workflows end-to-end.
            </p>
          </div>
          {showControls ? (
            <button
              type="button"
              onClick={() => loadScenarios()}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
            >
              Refresh list
            </button>
          ) : null}
        </div>
        {showControls ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={scenarioType}
              onChange={(event) => setScenarioType(event.target.value as TrainingScenarioKind)}
              className="min-w-[220px] rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-[rgb(var(--ink))]"
            >
              {TRAINING_SCENARIO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleScenarioCreate}
              disabled={scenarioCreating}
              className="rounded-full bg-[rgb(var(--ink))] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {scenarioCreating ? "Generating..." : "Generate scenario"}
            </button>
          </div>
        ) : null}
        {scenarioHint ? <p className="mt-2 text-[11px] text-emerald-700">{scenarioHint}</p> : null}
        {scenariosError ? (
          <div className="mt-3">
            <ErrorBanner title="Training sandbox unavailable" message={scenariosError.message} requestId={scenariosError.requestId ?? undefined} />
          </div>
        ) : null}
        {scenariosLoading ? <p className="mt-3 text-[11px] text-[rgb(var(--muted))]">Loading scenarios...</p> : null}
        {!scenariosLoading && !scenariosError ? (
          scenarios.length ? (
            <div className="mt-3 space-y-2">
              {scenarios.map((scenario) => {
                const links = buildScenarioLinks(scenario);
                const highlight = scenarioHighlightId === scenario.id;
                const scenarioId = normaliseScenarioId(scenario.id) || "--";
                const requestId = normaliseScenarioId(scenario.requestId);
                const eventId = normaliseScenarioId(scenario.eventId);
                const windowLabel = normaliseScenarioId(scenario.windowLabel) || "15m";
                const copyRequestKey = `${scenarioId}:requestId`;
                const copyEventKey = `${scenarioId}:eventId`;
                const copyAllKey = `${scenarioId}:all`;
                return (
                  <div
                    key={scenario.id}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      highlight ? "border-amber-200 bg-amber-50" : "border-black/5 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[rgb(var(--ink))]">{scenarioLabel(scenario)}</p>
                        <p className="text-[11px] text-[rgb(var(--muted))]">
                          Created {scenario.createdAt ? formatShortLocalTime(scenario.createdAt) : "--"} · Window {windowLabel}
                        </p>
                        <p className="text-[11px] text-[rgb(var(--muted))]">
                          eventId: {eventId ? eventId.slice(0, 8) : "--"}
                          {requestId ? ` · requestId: ${requestId}` : ""}
                        </p>
                      </div>
                      {showControls ? (
                        <button
                          type="button"
                          onClick={() => handleScenarioDeactivate(scenario)}
                          className="text-[11px] font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
                        >
                          Deactivate
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={links.alertsPath}
                        onClick={() => handleScenarioLinkClick(scenario, "alerts")}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                      >
                        Open Alerts
                      </Link>
                      <Link
                        href={links.incidentsPath}
                        onClick={() => handleScenarioLinkClick(scenario, "incidents")}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                      >
                        Open Incidents
                      </Link>
                      <Link
                        href={links.auditsPath}
                        onClick={() => handleScenarioLinkClick(scenario, "audits")}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                      >
                        Open Audits
                      </Link>
                      <Link
                        href={links.statusPath}
                        onClick={() => handleScenarioLinkClick(scenario, "status")}
                        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                      >
                        Open System Status
                      </Link>
                      {requestId ? (
                        <Link
                          href={links.casePath}
                          onClick={() =>
                            logMonetisationClientEvent("ops_training_open_case", null, "ops", {
                              meta: { scenarioType: scenario.scenarioType, hasRequestId: Boolean(requestId) },
                            })
                          }
                          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                        >
                          Open Case View
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleScenarioReportCopy(scenario)}
                        className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white"
                      >
                        {scenarioReportCopiedId === scenario.id ? "Copied" : "Copy training report"}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">IDs</span>
                      {requestId ? (
                        <button
                          type="button"
                          onClick={() => handleScenarioIdCopy(scenario, "requestId")}
                          className="rounded-full border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                        >
                          {scenarioCopiedKey === copyRequestKey ? "Copied" : "Copy requestId"}
                        </button>
                      ) : null}
                      {eventId ? (
                        <button
                          type="button"
                          onClick={() => handleScenarioIdCopy(scenario, "eventId")}
                          className="rounded-full border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                        >
                          {scenarioCopiedKey === copyEventKey ? "Copied" : "Copy eventId"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleScenarioIdCopy(scenario, "all")}
                        className="rounded-full border border-black/10 bg-white px-2 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                      >
                        {scenarioCopiedKey === copyAllKey ? "Copied" : "Copy all IDs"}
                      </button>
                    </div>
                    {scenario.scenarioType === "mixed_basic" ? (
                      <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">No incidents generated for this scenario type yet.</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-[rgb(var(--muted))]">No training scenarios yet.</p>
          )
        ) : null}
      </div>
    );
  };

  const showNav = !printView;
  const showControls = !printView;

  return (
    <div className={`rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm ${printView ? "ops-help-print" : ""}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs text-[rgb(var(--muted))]">Ops runbook for support/admin/super_admin.</p>
          <p className="text-[11px] text-[rgb(var(--muted))]">
            Last updated: {formatIsoDate(meta.lastUpdatedIso)} ({meta.lastUpdatedVersion}) - Rules version: {meta.rulesVersion}
          </p>
        </div>
        {showControls ? (
          <div className="w-full max-w-sm">
            <label htmlFor="ops-help-search" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Search
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="ops-help-search"
                type="search"
                value={query}
                onChange={handleSearchChange}
                placeholder="Search runbook"
                className="w-full rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-[rgb(var(--ink))] focus:border-black/30 focus:outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {trainingSection && showControls ? (
          <button
            type="button"
            onClick={handleStartTraining}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
          >
            Start training
          </button>
        ) : null}
        <button
          type="button"
          onClick={handlePrintToggle}
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
        >
          {printView ? "Exit print view" : "Print view"}
        </button>
      </div>

      <div className={`mt-4 ${showNav ? "grid gap-4 lg:grid-cols-[240px_1fr]" : ""}`}>
        {showNav ? (
          <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-auto rounded-2xl border border-black/10 bg-white px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Contents</p>
            <div className="mt-3 space-y-4">
              {groupedSections.map((group) => (
                <div key={group.category}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{group.category}</p>
                  <div className="mt-2 space-y-1">
                    {group.sections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => handleTocClick(section)}
                        data-testid={`toc-${section.id}`}
                        className="block w-full text-left text-xs font-semibold text-[rgb(var(--ink))] hover:underline"
                      >
                        {highlightText(section.title, query)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
        ) : null}

        <div className="space-y-6">
          {showControls ? (
            <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={!filteredSections.length}
              className="min-w-[200px] flex-1 rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-[rgb(var(--ink))]"
            >
              {filteredSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleJump}
              disabled={!selectedId}
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              Jump to
            </button>
          </div>
          ) : null}

          {!filteredSections.length ? (
            <div className="rounded-2xl border border-black/10 bg-white px-4 py-6 text-center">
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">No results</p>
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">Try another term or clear the search.</p>
              <button
                type="button"
                onClick={handleClearSearch}
                className="mt-3 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Clear search
              </button>
            </div>
          ) : (
            filteredSections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                      {section.category} {section.owner ? `- ${section.owner}` : ""}
                    </p>
                    <h2 className="text-base font-semibold text-[rgb(var(--ink))]">{highlightText(section.title, query)}</h2>
                    <p className="text-[11px] text-[rgb(var(--muted))]">Updated {formatIsoDate(section.lastUpdatedIso)}</p>
                  </div>
                  {showControls ? (
                    <button
                      type="button"
                      onClick={() => handleCopyLink(section.id)}
                      data-testid={`copy-link-${section.id}`}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                    >
                      {copiedId === section.id ? "Copied" : "Copy link"}
                    </button>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {section.id === "training-drills" ? renderTrainingSandbox() : null}
                  {section.body.map((block, index) => renderBlock(block, index))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
