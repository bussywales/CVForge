"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import CopyIconButton from "@/components/CopyIconButton";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import {
  RUNBOOK_META,
  RUNBOOK_SECTIONS,
  type RunbookBlock,
  type RunbookCategory,
  type RunbookSection,
} from "@/lib/ops/runbook-sections";

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
                <div className="space-y-3">{section.body.map((block, index) => renderBlock(block, index))}</div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
