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

describe("ResolutionCard outcome flow", () => {
  beforeEach(() => {
    logMock.mockReset();
    (global.navigator as any).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, headers: new Headers(), json: async () => ({ ok: true }) }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderCard() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<ResolutionCard incidentRequestId="req_test" userId="user_1" />);
    });
    return { container, root };
  }

  it("saves outcome successfully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, headers: new Headers(), json: async () => ({ ok: true }) }));
    const { container } = renderCard();
    const saveBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent?.includes("Save outcome")) as HTMLButtonElement;
    await act(async () => saveBtn.click());
    expect(logMock).toHaveBeenCalledWith("ops_resolution_outcome_set_click", null, "ops", expect.any(Object));
    expect(logMock).toHaveBeenCalledWith("ops_resolution_outcome_set_success", null, "ops", { code: "PORTAL_RETRY_SUCCESS" });
  });

  it("shows error on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, headers: new Headers({ "x-request-id": "req_fail" }), json: async () => ({ ok: false }) }));
    const { container } = renderCard();
    const saveBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent?.includes("Save outcome")) as HTMLButtonElement;
    await act(async () => saveBtn.click());
    expect(logMock).toHaveBeenCalledWith("ops_resolution_outcome_set_error", null, "ops", { requestId: "req_fail" });
    expect(container.textContent).toContain("Unable to save outcome");
  });

  it("adds to watchlist when delay outcome", async () => {
    const { container } = renderCard();
    const select = container.querySelector("select:last-of-type") as HTMLSelectElement;
    act(() => {
      select.value = "WEBHOOK_DELAY_WAITED";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const watchBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent?.includes("Add to watchlist")) as HTMLButtonElement;
    await act(async () => watchBtn.click());
    expect(logMock).toHaveBeenCalledWith("ops_watch_add_click", null, "ops", { code: "WEBHOOK_DELAY_WAITED" });
  });
});
