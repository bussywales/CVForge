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
