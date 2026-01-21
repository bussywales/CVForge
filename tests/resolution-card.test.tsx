/// <reference types="vitest/globals" />
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { ResolutionCard } from "@/app/app/ops/incidents/resolution-card";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const logMock = vi.fn();
vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: (...args: any[]) => logMock(...args),
}));

beforeEach(() => {
  logMock.mockReset();
  (global.navigator as any).clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  vi.useRealTimers();
});

function renderCard() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ResolutionCard
        incidentRequestId="req_123"
        userId="user_1"
        supportLink="/app/billing?from=ops_support"
        incidentsLink="/app/ops/incidents?requestId=req_123"
        auditsLink="/app/ops/audits?requestId=req_123"
        defaultLabel="resolved_portal"
      />
    );
  });
  return { container, root };
}

describe("ResolutionCard", () => {
  it("logs view once and renders actions", async () => {
    const { container } = renderCard();
    await act(async () => {});
    expect(logMock).toHaveBeenCalledWith("ops_resolution_view", null, "ops", { label: "resolved_portal", requestId: "req_123" });
    const copyBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Copy reply") as HTMLButtonElement;
    act(() => copyBtn.click());
    expect(logMock).toHaveBeenCalledWith("ops_resolution_copy_reply", null, "ops", { label: "resolved_portal", requestId: "req_123" });
    const regenBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Regenerate") as HTMLButtonElement;
    act(() => regenBtn.click());
    expect(logMock).toHaveBeenCalledWith("ops_resolution_regenerate", null, "ops", { label: "resolved_portal", requestId: "req_123" });
    const markBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Mark as used") as HTMLButtonElement;
    act(() => markBtn.click());
    expect(logMock).toHaveBeenCalledWith("ops_resolution_mark_used", null, "ops", { label: "resolved_portal", requestId: "req_123" });
    const snippetBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Copy support snippet") as HTMLButtonElement;
    act(() => snippetBtn.click());
    expect(logMock).toHaveBeenCalledWith("ops_resolution_copy_snippet", null, "ops", { requestId: "req_123" });
    const billingLink = Array.from(container.querySelectorAll("a")).find((el) => el.textContent === "Open Billing") as HTMLAnchorElement;
    act(() => billingLink.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(logMock).toHaveBeenCalledWith("ops_resolution_link_click", null, "ops", {
      target: "billing",
      requestId: "req_123",
      userId: "user_1",
    });
  });
});
