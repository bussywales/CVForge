/// <reference types="vitest/globals" />
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import ResolutionsClient from "@/app/app/ops/resolutions/resolutions-client";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const logMock = vi.fn();
vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: (...args: any[]) => logMock(...args),
}));

const emptySummary = {
  totals: { count: 0, uniqueUsers: 0, uniqueRequestIds: 0 },
  topOutcomes: [],
  topActors: [],
  bySurface: [],
  recent: [],
};

describe("Ops resolutions due reviews UI", () => {
  beforeEach(() => {
    logMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          ok: true,
          items: [
            {
              id: "row_1",
              code: "PORTAL_RETRY_SUCCESS",
              createdAt: "2024-02-10T08:00:00.000Z",
              requestId: "req_due",
              userId: "user_due",
              userIdMasked: "[user:due]",
              actorMasked: null,
              noteMasked: null,
              effectivenessState: "unknown",
              effectivenessReason: null,
              effectivenessNote: null,
              effectivenessSource: null,
              effectivenessUpdatedAt: null,
              effectivenessDeferredUntil: null,
            },
          ],
          counts: { due: 1 },
          insights: { topFailedCodes: [], topFailReasons: [], repeatFailedRequestIds: [] },
        }),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders due tab with request and dossier links", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<ResolutionsClient initialSummary={emptySummary as any} />);
    });
    const dueTab = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Due reviews") as HTMLButtonElement;
    await act(async () => dueTab.click());
    await act(async () => {});
    expect(container.textContent).toContain("Due reviews (1)");
    const requestLink = Array.from(container.querySelectorAll("a")).find((el) => el.textContent?.includes("Request req_due")) as HTMLAnchorElement;
    expect(requestLink?.getAttribute("href")).toContain("/app/ops/incidents?requestId=req_due");
    const dossierLink = Array.from(container.querySelectorAll("a")).find((el) => el.textContent === "Open dossier") as HTMLAnchorElement;
    expect(dossierLink?.getAttribute("href")).toContain("/app/ops/users/user_due");
  });
});
