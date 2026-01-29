"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
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

const CATEGORY_ORDER: RunbookCategory[] = [
  "Getting started",
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
    default:
      return "";
  }
}

function buildSearchText(section: RunbookSection) {
  const body = section.body.map(blockText).join(" ");
  return `${section.title} ${section.category} ${body}`.toLowerCase();
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

  const handleTocClick = (section: RunbookSection) => {
    if (typeof window !== "undefined") {
      window.location.hash = section.id;
      const el = document.getElementById(section.id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
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

    return null;
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs text-[rgb(var(--muted))]">Ops runbook for support/admin/super_admin.</p>
          <p className="text-[11px] text-[rgb(var(--muted))]">
            Last updated: {formatIsoDate(meta.lastUpdatedIso)} ({meta.lastUpdatedVersion}) - Rules version: {meta.rulesVersion}
          </p>
        </div>
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
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
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

        <div className="space-y-6">
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
                  <button
                    type="button"
                    onClick={() => handleCopyLink(section.id)}
                    data-testid={`copy-link-${section.id}`}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                  >
                    {copiedId === section.id ? "Copied" : "Copy link"}
                  </button>
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
