/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const fetchMock = vi.fn();
vi.mock("@/lib/http/safe-json", () => ({
  fetchJsonSafe: (...args: any[]) => fetchMock(...args),
}));

const sections: RunbookSection[] = [
  {
    id: "training-drills",
    title: "Training Drills (30-45 mins)",
    category: "Training",
    ownerRole: "support",
    lastUpdatedIso: "2026-01-29T00:00:00.000Z",
    lastReviewedVersion: "v0.8.51",
    reviewCadenceDays: 14,
    linkedSurfaces: ["status"],
    tags: ["training"],
    body: [
      {
        type: "drill",
        id: "drill-alpha",
        title: "Portal errors spike",
        tags: ["tag-only"],
        actions: [{ label: "Open Ops Status", href: "/app/ops/status#rag", actionKind: "open_status" }],
        trigger: ["Trigger"],
        confirm: ["Confirm"],
        do: ["Step one"],
        record: ["Record"],
        exit: ["Exit"],
        escalate: ["Escalate"],
      },
    ],
  },
  {
    id: "quick-cards",
    title: "Quick cards",
    category: "Quick cards",
    ownerRole: "support",
    lastUpdatedIso: "2026-01-29T00:00:00.000Z",
    lastReviewedVersion: "v0.8.51",
    reviewCadenceDays: 14,
    linkedSurfaces: ["alerts"],
    tags: ["cards"],
    body: [
      {
        type: "quick-card",
        id: "qc-alpha",
        title: "Alerts says webhook not configured",
        tags: ["webhook-config"],
        symptom: ["Symptom"],
        cause: ["Cause"],
        checks: ["Checks"],
        next: ["Next"],
        escalate: ["Escalate"],
      },
    ],
  },
  {
    id: "escalation-templates",
    title: "Escalation templates",
    category: "Templates",
    ownerRole: "support",
    lastUpdatedIso: "2026-01-29T00:00:00.000Z",
    lastReviewedVersion: "v0.8.51",
    reviewCadenceDays: 14,
    linkedSurfaces: ["alerts"],
    tags: ["templates"],
    body: [
      {
        type: "template",
        id: "template-alpha",
        title: "Customer reply",
        tags: ["reply"],
        content: "Reference {{requestId}}",
      },
    ],
  },
];

const meta = {
  lastUpdatedVersion: "v0.8.51",
  lastUpdatedIso: "2026-01-29T00:00:00.000Z",
  rulesVersion: "ops_runbook_v1",
};

describe("ops help ui", () => {
  beforeEach(() => {
    logMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: { scenarios: [] } });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    window.history.pushState({}, "", "http://localhost/app/ops/help?requestId=req_test");
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("matches search tags", () => {
    render(<HelpClient sections={sections} meta={meta} />);
    fireEvent.change(screen.getByPlaceholderText("Search runbook"), { target: { value: "tag-only" } });
    expect(screen.getByText("Portal errors spike")).toBeTruthy();
    expect(screen.queryByText("Customer reply")).toBeNull();
  });

  it("renders drill action links", () => {
    render(<HelpClient sections={sections} meta={meta} />);
    const action = screen.getByTestId("drill-action-drill-alpha-open_status");
    expect(action.getAttribute("href")).toBe("/app/ops/status#rag");
  });

  it("copies template and logs", async () => {
    render(<HelpClient sections={sections} meta={meta} />);
    fireEvent.click(screen.getByText("Copy template"));
    await waitFor(() => {
      expect(logMock).toHaveBeenCalledWith("ops_help_template_copy", null, "ops", { templateId: "template-alpha" });
    });
  });

  it("toggles print view", () => {
    const { container } = render(<HelpClient sections={sections} meta={meta} />);
    fireEvent.click(screen.getByText("Print view"));
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains("ops-help-print")).toBe(true);
  });
});
