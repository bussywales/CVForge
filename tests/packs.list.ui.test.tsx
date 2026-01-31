/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PacksClient from "@/app/app/packs/packs-client";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("packs list UI", () => {
  it("renders empty state", () => {
    render(<PacksClient initialPacks={[]} />);
    expect(screen.getByText(/No packs yet/i)).toBeTruthy();
  });

  it("disables export when no version is ready", () => {
    render(
      <PacksClient
        initialPacks={[
          {
            id: "pack_1",
            userId: "user_1",
            title: "Pack one",
            company: "Acme",
            roleTitle: "Engineer",
            status: "draft",
            source: null,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
            latestVersionId: null,
            latestVersionCreatedAt: null,
          },
        ]}
      />
    );
    const exportButton = screen.getByText("Export DOCX") as HTMLButtonElement;
    expect(exportButton.disabled).toBe(true);
  });
});
