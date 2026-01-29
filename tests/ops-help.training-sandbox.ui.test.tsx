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
    body: [],
  },
];

const meta = {
  lastUpdatedVersion: "v0.8.51",
  lastUpdatedIso: "2026-01-29T00:00:00.000Z",
  rulesVersion: "ops_runbook_v1",
};

describe("ops help training sandbox ui", () => {
  beforeEach(() => {
    logMock.mockReset();
    fetchMock.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    window.history.pushState({}, "", "http://localhost/app/ops/help");
  });

  it("creates scenario and renders deep links", async () => {
    fetchMock.mockImplementation((input: any, init?: any) => {
      if (init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: {
            scenario: {
              id: "scn_1",
              createdAt: "2024-01-01T00:00:00.000Z",
              createdBy: "ops-user",
              scenarioType: "alerts_test",
              windowLabel: "15m",
              eventId: "evt_train",
              requestId: "req_train",
              acknowledgedAt: null,
              ackRequestId: null,
              meta: {},
              isActive: true,
            },
          },
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: { scenarios: [] } });
    });

    render(<HelpClient sections={sections} meta={meta} />);
    fireEvent.click(screen.getByText("Generate scenario"));

    await waitFor(() => expect(screen.getByText("Alerts: Test alert")).toBeTruthy());
    const alertsLink = screen.getByText("Open Alerts");
    expect(alertsLink.getAttribute("href")).toContain("from=ops_training");
    expect(alertsLink.getAttribute("href")).toContain("eventId=evt_train");
    expect(alertsLink.getAttribute("href")).toContain("scenarioId=scn_1");
    expect(screen.getByText("Open Audits")).toBeTruthy();
    const caseLink = screen.getByText("Open Case View");
    expect(caseLink.getAttribute("href")).toContain("/app/ops/case?q=req_train");
    expect(caseLink.getAttribute("href")).toContain("window=15m");
  });

  it("copies training report with deep links", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: {
        scenarios: [
          {
            id: "scn_1",
            createdAt: "2024-01-01T00:00:00.000Z",
            createdBy: "ops-user",
            scenarioType: "alerts_test",
            windowLabel: "15m",
            eventId: "evt_train",
            requestId: "req_train",
            acknowledgedAt: "2024-01-01T00:10:00.000Z",
            ackRequestId: "req_ack",
            meta: {},
            isActive: true,
          },
        ],
      },
    });

    render(<HelpClient sections={sections} meta={meta} />);
    await waitFor(() => expect(screen.getByText("Alerts: Test alert")).toBeTruthy());
    fireEvent.click(screen.getByText("Copy training report"));

    const clipboardWrite = (navigator.clipboard as any).writeText as any;
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalled());
    const report = clipboardWrite.mock.calls[0][0] as string;
    expect(report).toContain("CVForge Ops Training Report");
    expect(report).toContain("IDs:");
    expect(report).toContain("scenarioId: scn_1");
    expect(report).toContain("Scenario: Alerts: Test alert (scn_1)");
    expect(report).toContain("eventId: evt_train");
    expect(report).toContain("requestId: req_train");
    expect(report).toContain("ackRequestId: req_ack");
    expect(report).toContain("Acknowledged alert: Yes");
    expect(report).toContain("http://localhost/app/ops/alerts");
    expect(report).toContain("http://localhost/app/ops/incidents");
    expect(report).toContain("http://localhost/app/ops/audits");
    expect(report).toContain("http://localhost/app/ops/status");
    expect(report).toContain("http://localhost/app/ops/case");
  });

  it("copies requestId without trailing whitespace", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: {
        scenarios: [
          {
            id: "scn_1",
            createdAt: "2024-01-01T00:00:00.000Z",
            createdBy: "ops-user",
            scenarioType: "alerts_test",
            windowLabel: "15m",
            eventId: "evt_train",
            requestId: "req_train\n",
            acknowledgedAt: null,
            ackRequestId: null,
            meta: {},
            isActive: true,
          },
        ],
      },
    });

    render(<HelpClient sections={sections} meta={meta} />);
    await waitFor(() => expect(screen.getByText("Alerts: Test alert")).toBeTruthy());
    fireEvent.click(screen.getByText("Copy requestId"));

    const clipboardWrite = (navigator.clipboard as any).writeText as any;
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalled());
    const payload = clipboardWrite.mock.calls[0][0] as string;
    expect(payload).toBe("req_train");
  });

  it("preserves last-good list on refresh failure", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: {
          scenarios: [
            {
              id: "scn_1",
              createdAt: "2024-01-01T00:00:00.000Z",
              createdBy: "ops-user",
              scenarioType: "alerts_test",
              windowLabel: "15m",
              eventId: "evt_train",
              requestId: "req_train",
              meta: {},
              isActive: true,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        error: { message: "Unable to load scenarios" },
      });

    render(<HelpClient sections={sections} meta={meta} />);
    await waitFor(() => expect(screen.getByText("Alerts: Test alert")).toBeTruthy());
    fireEvent.click(screen.getByText("Refresh list"));

    await waitFor(() => expect(screen.getByText("Training sandbox unavailable")).toBeTruthy());
    expect(screen.getByText("Alerts: Test alert")).toBeTruthy();
  });
});
