/// <reference types="vitest/globals" />
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CasesQueueCard from "@/app/app/ops/cases-queue-card";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("cases queue summary card", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/ops/cases/summary")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                ok: true,
                summary: {
                  myAssignedCount: 2,
                  unassignedCount: 3,
                  ageingBuckets: { over1h: 1, over6h: 0, over24h: 0 },
                  statusCounts: { open: 2 },
                },
              }),
              { status: 200, headers: { "content-type": "application/json" } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
      })
    );
  });

  it("renders summary counts", async () => {
    render(<CasesQueueCard />);
    await waitFor(() => expect(screen.getByText("2")).toBeTruthy());
    expect(screen.getByText(/Assigned to me/i)).toBeTruthy();
    expect(screen.getByText(/Unassigned/i)).toBeTruthy();
  });
});
