/// <reference types="vitest/globals" />
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import BillingHelpPrompt from "@/app/app/billing/billing-help-prompt";

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
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-02-10T10:00:00.000Z"));
  (global.navigator as any).clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPrompt(props?: Partial<React.ComponentProps<typeof BillingHelpPrompt>>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<BillingHelpPrompt supportSnippet="snippet" requestId="req_1" {...props} />);
  });
  return { container, root };
}

describe("BillingHelpPrompt", () => {
  it("logs view once and renders prompt", () => {
    const { container } = renderPrompt();
    expect(container.textContent).toContain("Did this resolve your billing issue?");
    expect(logMock).toHaveBeenCalledWith("billing_help_prompt_view", null, "billing");
  });

  it("No reveals support actions and logs copy/retry", () => {
    const { container } = renderPrompt();
    const noBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "No") as HTMLButtonElement;
    act(() => noBtn.click());
    expect(container.textContent).toContain("Copy support snippet");
    const copyBtn = Array.from(container.querySelectorAll("button")).find((el) => el.textContent === "Copy support snippet") as HTMLButtonElement;
    act(() => copyBtn.click());
    expect(logMock).toHaveBeenCalledWith("billing_help_prompt_copy_snippet", null, "billing");
    const portalLink = Array.from(container.querySelectorAll("a")).find((el) => el.textContent === "Try portal again") as HTMLAnchorElement;
    act(() => portalLink.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(logMock).toHaveBeenCalledWith("billing_help_prompt_retry_portal_click", null, "billing", { requestId: "req_1" });
  });

  it("dismiss persists for 7 days", () => {
    const { container, root } = renderPrompt();
    const dismiss = Array.from(container.querySelectorAll("button")).find((el) => el.getAttribute("aria-label") === "Dismiss") as HTMLButtonElement;
    act(() => dismiss.click());
    expect(logMock).toHaveBeenCalledWith("billing_help_prompt_dismiss", null, "billing");
    act(() => {
      root.render(<BillingHelpPrompt supportSnippet="snippet" requestId="req_1" />);
    });
    expect(document.body.textContent).not.toContain("Did this resolve your billing issue?");
  });
});
