/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import CaseClient from "@/app/app/ops/case/case-client";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const replaceMock = vi.fn();
let searchParamsValue = new URLSearchParams();
let caseResponse: any = { ok: true, workflow: null, evidence: [], context: null };
let caseNotesResponse: any = { ok: true, notes: null };
let caseNotesUpsertResponse: any = { ok: true, notes: null };
let claimResponse: any = { ok: true, workflow: null };
let claimStatus = 200;
let releaseResponse: any = { ok: true, workflow: null };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/app/ops/case",
  useSearchParams: () => searchParamsValue,
}));

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("Ops case view", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    searchParamsValue = new URLSearchParams();
    caseResponse = { ok: true, workflow: null, evidence: [], context: null };
    caseNotesResponse = { ok: true, notes: null };
    caseNotesUpsertResponse = { ok: true, notes: null };
    claimResponse = { ok: true, workflow: null };
    claimStatus = 200;
    releaseResponse = { ok: true, workflow: null };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/ops/case?")) {
          return Promise.resolve(new Response(JSON.stringify(caseResponse), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/case/claim")) {
          return Promise.resolve(
            new Response(JSON.stringify(claimResponse), { status: claimStatus, headers: { "content-type": "application/json" } })
          );
        }
        if (url.includes("/api/ops/case/release")) {
          return Promise.resolve(
            new Response(JSON.stringify(releaseResponse), { status: 200, headers: { "content-type": "application/json" } })
          );
        }
        if (url.includes("/api/ops/case/evidence")) {
          const payload = init?.body ? JSON.parse(init.body.toString()) : {};
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                evidence: {
                  id: "ev_1",
                  requestId: payload.requestId ?? "req_123",
                  type: payload.type ?? "note",
                  body: payload.body ?? "Evidence note",
                  meta: payload.meta ?? null,
                  createdByUserId: "user_ops",
                  createdAt: "2024-01-01T00:00:00.000Z",
                },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          );
        }
        if (url.includes("/api/ops/case/notes/upsert")) {
          return Promise.resolve(
            new Response(JSON.stringify(caseNotesUpsertResponse), { status: 200, headers: { "content-type": "application/json" } })
          );
        }
        if (url.includes("/api/ops/case/notes")) {
          return Promise.resolve(new Response(JSON.stringify(caseNotesResponse), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/alerts")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true, alerts: [], recentEvents: [], firingCount: 0, handled: {} }), { status: 200, headers: { "content-type": "application/json" } })
          );
        }
        if (url.includes("/api/ops/incidents/preview")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, items: [], count: 0 }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/audits")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/webhook-failures")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/resolution-outcomes/recent")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/watch")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, records: [] }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        if (url.includes("/api/ops/billing/snapshot")) {
          return Promise.resolve(new Response(JSON.stringify({ ok: true, local: { subscriptionStatus: "active", creditsAvailable: 10 }, delayState: { state: "ok" }, webhookHealth: { status: "ok" } }), { status: 200, headers: { "content-type": "application/json" } }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders empty state when no query", () => {
    render(
      <CaseClient
        initialQuery={{ requestId: null, userId: null, email: null, window: null, from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    expect(screen.getByText(/Paste a requestId to begin/i)).toBeTruthy();
  });

  it("submits search and updates URL once", () => {
    render(
      <CaseClient
        initialQuery={{ requestId: null, userId: null, email: null, window: null, from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    const input = screen.getByPlaceholderText(/req_.../i);
    fireEvent.change(input, { target: { value: "req_123" } });
    fireEvent.click(screen.getByText("Search"));
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock.mock.calls[0][0]).toContain("requestId=req_123");
  });

  it("shows snippet copy when query is present", async () => {
    searchParamsValue = new URLSearchParams("requestId=req_123&window=15m");
    render(
      <CaseClient
        initialQuery={{ requestId: "req_123", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    await waitFor(() => expect(screen.getByText(/Copy case snippet/i)).toBeTruthy());
  });

  it("uses context userId to enable billing panel", async () => {
    caseResponse = {
      ok: true,
      workflow: {
        requestId: "req_ctx",
        status: "open",
        priority: "medium",
        assignedToUserId: null,
        claimedAt: null,
        resolvedAt: null,
        closedAt: null,
        lastTouchedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      evidence: [],
      context: {
        requestId: "req_ctx",
        userId: "user_ctx",
        emailMasked: "us***@example.com",
        userRole: "user",
        source: "ops_audit",
        confidence: "high",
        evidenceAt: "2024-01-01T00:05:00.000Z",
        sources: ["ops_audit"],
        firstSeenAt: "2024-01-01T00:00:00.000Z",
        lastSeenAt: "2024-01-01T00:05:00.000Z",
      },
    };
    searchParamsValue = new URLSearchParams("requestId=req_ctx&window=15m");
    render(
      <CaseClient
        initialQuery={{ requestId: "req_ctx", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    await waitFor(() => expect(screen.queryByText(/Billing: user id required/i)).toBeNull());
    expect(screen.getByText(/Copy userId/i)).toBeTruthy();
  });

  it("shows missing context guidance and admin attach controls", async () => {
    caseResponse = { ok: true, workflow: null, evidence: [], context: null };
    searchParamsValue = new URLSearchParams("requestId=req_missing&window=15m");
    render(
      <CaseClient
        initialQuery={{ requestId: "req_missing", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="admin"
        viewerId="user_admin"
      />
    );
    await waitFor(() => expect(screen.getByText(/Missing user context/i)).toBeTruthy());
    expect(screen.getByText(/Attach user context/i)).toBeTruthy();
    expect(screen.getByText(/No touchpoints with userId/i)).toBeTruthy();
  });

  it("normalises requestId with newlines for fetches", async () => {
    caseResponse = { ok: true, workflow: null, evidence: [], context: null };
    searchParamsValue = new URLSearchParams("requestId=req_trim%0A&window=15m");
    render(
      <CaseClient
        initialQuery={{ requestId: "req_trim\n", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    await waitFor(() => expect((global.fetch as any).mock.calls.length).toBeGreaterThan(0));
    const urls = (global.fetch as any).mock.calls.map((call: any[]) => call[0].toString());
    const caseCall = urls.find((url: string) => url.includes("/api/ops/case?")) ?? "";
    expect(caseCall).toContain("requestId=req_trim");
    expect(caseCall).not.toContain("%0A");
  });

  it("toggles checklist items", async () => {
    caseNotesResponse = {
      ok: true,
      notes: {
        caseType: "request",
        caseKey: "req_123",
        windowLabel: "15m",
        checklist: { open_alerts: { done: false, at: null, by: null } },
        outcomeCode: null,
        notes: null,
        status: "open",
        lastHandledAt: null,
        lastHandledBy: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    caseNotesUpsertResponse = {
      ok: true,
      notes: {
        caseType: "request",
        caseKey: "req_123",
        windowLabel: "15m",
        checklist: { open_alerts: { done: true, at: "2024-01-01T00:05:00.000Z", by: "user_ops" } },
        outcomeCode: null,
        notes: null,
        status: "open",
        lastHandledAt: "2024-01-01T00:05:00.000Z",
        lastHandledBy: "user_ops",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:05:00.000Z",
      },
    };
    searchParamsValue = new URLSearchParams("requestId=req_123&window=15m");
    render(
      <CaseClient
        initialQuery={{ requestId: "req_123", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    const checklistItem = await screen.findByLabelText("Open Alerts");
    fireEvent.click(checklistItem);
    await waitFor(() => expect((global.fetch as any).mock.calls.some((call: any[]) => call[0].toString().includes("/api/ops/case/notes/upsert"))).toBeTruthy());
  });

  it("saves notes and outcome", async () => {
    caseNotesResponse = {
      ok: true,
      notes: {
        caseType: "request",
        caseKey: "req_123",
        windowLabel: "15m",
        checklist: {},
        outcomeCode: null,
        notes: null,
        status: "open",
        lastHandledAt: null,
        lastHandledBy: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    caseNotesUpsertResponse = {
      ok: true,
      notes: {
        caseType: "request",
        caseKey: "req_123",
        windowLabel: "15m",
        checklist: { outcome_recorded: { done: true, at: "2024-01-01T00:05:00.000Z", by: "user_ops" } },
        outcomeCode: "resolved",
        notes: "All good",
        status: "open",
        lastHandledAt: "2024-01-01T00:05:00.000Z",
        lastHandledBy: "user_ops",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:05:00.000Z",
      },
    };
    searchParamsValue = new URLSearchParams("requestId=req_123&window=15m");
    render(
      <CaseClient
        initialQuery={{ requestId: "req_123", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    const outcomeSelect = await screen.findByDisplayValue("Select outcome");
    fireEvent.change(outcomeSelect, { target: { value: "resolved" } });
    fireEvent.change(screen.getByPlaceholderText(/Short handoff note/i), { target: { value: "All good" } });
    fireEvent.click(screen.getByText("Save notes"));
    await waitFor(() => expect(screen.getByText(/Saved/i)).toBeTruthy());
  });

  it("copies training evidence when scenarioId is present", async () => {
    caseNotesResponse = {
      ok: true,
      notes: {
        caseType: "request",
        caseKey: "req_train",
        windowLabel: "15m",
        checklist: {},
        outcomeCode: null,
        notes: null,
        status: "open",
        lastHandledAt: null,
        lastHandledBy: null,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
    };
    searchParamsValue = new URLSearchParams("requestId=req_train&window=15m&from=ops_training&scenarioId=scn_123&eventId=evt_456");
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.assign(global.navigator, { clipboard: { writeText: clipboardWrite } });
    render(
      <CaseClient
        initialQuery={{ requestId: "req_train", userId: null, email: null, window: "15m", from: "ops_training", scenarioId: "scn_123", eventId: "evt_456" }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    const copyButton = await screen.findByRole("button", { name: /Copy training evidence/i });
    fireEvent.click(copyButton);
    expect(clipboardWrite).toHaveBeenCalled();
    const copied = clipboardWrite.mock.calls[0][0] as string;
    expect(copied).toContain("ScenarioId: scn_123");
    expect(copied).toContain("RequestId: req_train");
  });

  it("adds evidence and shows the item", async () => {
    caseResponse = { ok: true, workflow: null, evidence: [], context: null };
    searchParamsValue = new URLSearchParams("requestId=req_123&window=15m");
    render(
      <CaseClient
        initialQuery={{ requestId: "req_123", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    const evidenceInput = await screen.findByPlaceholderText(/Add a short note/i);
    fireEvent.change(evidenceInput, { target: { value: "Evidence note" } });
    fireEvent.click(screen.getByText("Add evidence"));
    await waitFor(() => expect(screen.getByText("Evidence note")).toBeTruthy());
  });

  it("copies escalation template with masked email", async () => {
    caseResponse = {
      ok: true,
      workflow: {
        requestId: "req_1",
        status: "open",
        priority: "medium",
        assignedToUserId: null,
        claimedAt: null,
        resolvedAt: null,
        closedAt: null,
        lastTouchedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      evidence: [],
      context: {
        requestId: "req_1",
        userId: "user_1",
        emailMasked: "op***@example.com",
        source: "ops_audit",
        confidence: "high",
        evidenceAt: "2024-01-01T00:05:00.000Z",
        sources: ["ops_audit"],
        firstSeenAt: "2024-01-01T00:00:00.000Z",
        lastSeenAt: "2024-01-01T00:05:00.000Z",
      },
    };
    searchParamsValue = new URLSearchParams("requestId=req_1&window=15m");
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.assign(global.navigator, { clipboard: { writeText: clipboardWrite } });
    render(
      <CaseClient
        initialQuery={{ requestId: "req_1", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    const copyButton = await screen.findByRole("button", { name: /Copy template/i });
    fireEvent.click(copyButton);
    expect(clipboardWrite).toHaveBeenCalled();
    const copied = clipboardWrite.mock.calls[0][0] as string;
    expect(copied).toContain("CVForge Ops Escalation");
    expect(copied).toContain("RequestId: req_1");
    expect(copied).toContain("Email: op***@example.com");
    expect(copied).not.toContain("ops@example.com");
  });

  it("claims and releases a case", async () => {
    caseResponse = {
      ok: true,
      workflow: {
        requestId: "req_123",
        status: "open",
        priority: "medium",
        assignedToUserId: null,
        claimedAt: null,
        resolvedAt: null,
        closedAt: null,
        lastTouchedAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      evidence: [],
      context: null,
    };
    claimResponse = {
      ok: true,
      workflow: {
        requestId: "req_123",
        status: "open",
        priority: "medium",
        assignedToUserId: "user_ops",
        claimedAt: "2024-01-01T00:10:00.000Z",
        resolvedAt: null,
        closedAt: null,
        lastTouchedAt: "2024-01-01T00:10:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:10:00.000Z",
      },
    };
    releaseResponse = {
      ok: true,
      workflow: {
        requestId: "req_123",
        status: "open",
        priority: "medium",
        assignedToUserId: null,
        claimedAt: null,
        resolvedAt: null,
        closedAt: null,
        lastTouchedAt: "2024-01-01T00:15:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:15:00.000Z",
      },
    };
    searchParamsValue = new URLSearchParams("requestId=req_123&window=15m");
    render(
      <CaseClient
        initialQuery={{ requestId: "req_123", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    const claimButton = await screen.findByText("Claim");
    fireEvent.click(claimButton);
    await waitFor(() => expect(screen.getByText(/Assigned to me/i)).toBeTruthy());
    fireEvent.click(screen.getByText("Release"));
    await waitFor(() => expect(screen.getByText(/Unassigned/i)).toBeTruthy());
  });

  it("shows conflict banner when claim fails", async () => {
    claimStatus = 409;
    claimResponse = { error: { code: "CASE_CONFLICT", message: "Case already claimed" } };
    searchParamsValue = new URLSearchParams("requestId=req_999&window=15m");
    render(
      <CaseClient
        initialQuery={{ requestId: "req_999", userId: null, email: null, window: "15m", from: null }}
        requestId="req_test"
        viewerRole="support"
        viewerId="user_ops"
      />
    );
    const claimButton = await screen.findByText("Claim");
    fireEvent.click(claimButton);
    await waitFor(() => expect(screen.getByText(/Case already claimed/i)).toBeTruthy());
    claimStatus = 200;
  });
});
