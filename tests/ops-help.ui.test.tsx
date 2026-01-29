/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HelpClient from "@/app/app/ops/help/help-client";
import type { RunbookSection } from "@/lib/ops/runbook-sections";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const logMock = vi.fn();
vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: (...args: any[]) => logMock(...args),
}));

const sections: RunbookSection[] = [
  {
    id: "alpha-section",
    title: "Alpha section",
    category: "Getting started",
    owner: "Support",
    lastUpdatedIso: "2026-01-29T00:00:00.000Z",
    body: [
      { type: "heading", text: "What this is / When to use" },
      { type: "paragraph", text: "Alpha content." },
    ],
  },
  {
    id: "beta-section",
    title: "Beta alerts",
    category: "Alerts",
    owner: "Support",
    lastUpdatedIso: "2026-01-29T00:00:00.000Z",
    body: [
      { type: "heading", text: "What this is / When to use" },
      { type: "paragraph", text: "Beta content." },
    ],
  },
];

const meta = {
  lastUpdatedVersion: "v0.8.50",
  lastUpdatedIso: "2026-01-29T00:00:00.000Z",
  rulesVersion: "ops_runbook_v1",
};

describe("ops help ui", () => {
  beforeEach(() => {
    logMock.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    window.history.pushState({}, "", "http://localhost/app/ops/help");
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("filters sections with search and clears", () => {
    render(<HelpClient sections={sections} meta={meta} />);

    expect(screen.getAllByText("Alpha section").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Beta alerts").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Search runbook"), { target: { value: "alpha" } });
    expect(screen.getAllByText("Alpha section").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Beta alerts").length).toBe(0);

    fireEvent.change(screen.getByPlaceholderText("Search runbook"), { target: { value: "zzz" } });
    expect(screen.getByText("No results")).toBeTruthy();
    fireEvent.click(screen.getByText("Clear search"));
    expect(screen.getAllByText("Beta alerts").length).toBeGreaterThan(0);
  });

  it("updates hash on toc click and logs", () => {
    render(<HelpClient sections={sections} meta={meta} />);
    fireEvent.click(screen.getByTestId("toc-alpha-section"));
    expect(window.location.hash).toBe("#alpha-section");
    expect(logMock).toHaveBeenCalledWith("ops_help_toc_click", null, "ops", {
      sectionId: "alpha-section",
      category: "Getting started",
    });
  });

  it("copies an absolute link", async () => {
    render(<HelpClient sections={sections} meta={meta} />);
    fireEvent.click(screen.getByTestId("copy-link-alpha-section"));
    const clipboard = navigator.clipboard.writeText as any;
    expect(clipboard).toHaveBeenCalledWith("http://localhost/app/ops/help#alpha-section");
    expect(logMock).toHaveBeenCalledWith("ops_help_copy_link_click", null, "ops", { sectionId: "alpha-section" });
  });
});
