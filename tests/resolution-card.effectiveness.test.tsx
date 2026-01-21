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

describe("ResolutionCard effectiveness follow-up", () => {
  beforeEach(() => {
    logMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-10T12:00:00.000Z"));
    (global.navigator as any).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: any) => {
        if (typeof url === "string" && url.includes("resolution-effectiveness")) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ "x-request-id": "req_eff" }),
            json: async () => ({ ok: true, item: { id: "o1", effectivenessState: "success", effectivenessDeferredUntil: null } }),
          });
        }
        return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({ ok: true }) });
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
          initialOutcomes={[{ id: "o1", code: "PORTAL_RETRY_SUCCESS", createdAt: "2024-02-10T08:00:00.000Z", actor: null, requestId: "req_123", userId: "user_1" }]}
        />
      );
    });
    return { container, root };
  }

  it("renders follow-up prompt and saves success", async () => {
    const { container } = renderCard();
    await act(async () => {});
    expect(container.textContent).toContain("Did it work?");
    const yesBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Yes") as HTMLButtonElement;
    await act(async () => yesBtn.click());
    const saveBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Save") as HTMLButtonElement;
    await act(async () => saveBtn.click());
    expect(logMock).toHaveBeenCalledWith("ops_resolution_effectiveness_yes_click", null, "ops", expect.objectContaining({ requestId: "req_123" }));
    expect(logMock).toHaveBeenCalledWith("ops_resolution_effectiveness_save_success", null, "ops", expect.objectContaining({ outcomeCode: "PORTAL_RETRY_SUCCESS", state: "success" }));
  });

  it("snoozes effectiveness when selecting later", async () => {
    const { container } = renderCard();
    await act(async () => {});
    const laterBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Later") as HTMLButtonElement;
    await act(async () => laterBtn.click());
    expect(logMock).toHaveBeenCalledWith("ops_resolution_effectiveness_later_click", null, "ops", expect.objectContaining({ requestId: "req_123" }));
    expect(container.textContent).toContain("Snoozed");
  });
});
