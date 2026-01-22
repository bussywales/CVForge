/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import React from "react";
import { vi, describe, it } from "vitest";
import OnboardingCard from "@/app/app/onboarding-card";

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("OnboardingCard", () => {
  it("renders progress and CTA", () => {
    render(
      <OnboardingCard
        model={{
          steps: [
            { key: "create_cv", status: "todo" },
            { key: "export_cv", status: "todo" },
            { key: "create_application", status: "todo" },
            { key: "schedule_interview_optional", status: "todo", optional: true },
          ],
          doneCount: 0,
          totalCount: 3,
          skipUntil: null,
        }}
        primaryHref="/app/applications/new"
      />
    );
    expect(screen.getByText("Getting started")).toBeTruthy();
    expect(screen.getByText(/0 of 3/)).toBeTruthy();
    expect(screen.getByText(/Create your first CV/)).toBeTruthy();
  });
});
