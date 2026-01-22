/// <reference types="vitest/globals" />
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { act } from "react-dom/test-utils";
import ReactDOM from "react-dom/client";
import AccessClient from "@/app/app/ops/access/access-client";

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("Ops Access page client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string, init?: any) => {
        if (url.includes("/api/ops/access?")) {
          return {
            status: 200,
            headers: new Headers(),
            json: async () => ({ ok: true, allowedNow: false, source: "blocked", record: null, userFound: false }),
          } as any;
        }
        if (url.includes("/api/ops/access/grant") && init?.method === "POST") {
          return { status: 200, headers: new Headers(), json: async () => ({ ok: true, requestId: "req1" }) } as any;
        }
        return { status: 200, headers: new Headers(), json: async () => ({ ok: true }) } as any;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders status and supports grant", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      ReactDOM.createRoot(container).render(<AccessClient requestId="req_ui" />);
      await Promise.resolve();
    });
    const input = container.querySelector("input");
    if (!input) throw new Error("missing input");
    await act(async () => {
      (input as HTMLInputElement).value = "user@example.com";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const button = container.querySelector("button");
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Early Access");
    expect(container.textContent).toContain("Access status");
    const grant = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Grant access");
    await act(async () => {
      grant?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Access granted");
    container.remove();
  });
});
