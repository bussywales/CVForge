/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import PackDetailClient from "@/app/app/packs/[id]/pack-detail-client";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("pack detail UI", () => {
  let generateOk = false;

  beforeEach(() => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    } as any);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/packs/pack_1/generate")) {
          if (generateOk) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  ok: true,
                  requestId: "req_ok",
                  pack: { id: "pack_1", status: "ready" },
                  version: {
                    id: "ver_new",
                    packId: "pack_1",
                    userId: "user_1",
                    jobDescription: "JD generated",
                    inputsMasked: {},
                    outputs: { cv: { summary: "Generated", sections: [] }, coverLetter: "Cover", starStories: [], fitMap: [], rationale: "Why" },
                    modelMeta: null,
                    createdAt: "2024-01-01T02:00:00.000Z",
                  },
                }),
                { status: 200, headers: { "content-type": "application/json", "x-request-id": "req_ok" } }
              )
            );
          }
          return Promise.resolve(
            new Response(
              JSON.stringify({ ok: false, error: { code: "RATE_LIMITED", message: "Rate limited", requestId: "req_rl" } }),
              { status: 429, headers: { "content-type": "application/json", "x-request-id": "req_rl" } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    generateOk = false;
  });

  it("disables export until a version exists", async () => {
    render(
      <PackDetailClient
        initialPack={{
          id: "pack_1",
          userId: "user_1",
          title: "Pack",
          company: "Acme",
          roleTitle: "Engineer",
          status: "draft",
          source: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T01:00:00.000Z",
        }}
        initialVersions={[]}
      />
    );

    const exportBtn = screen.getByText("Export DOCX") as HTMLButtonElement;
    const atsBtn = screen.getByText("ATS DOCX") as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(true);
    expect(atsBtn.disabled).toBe(true);
    expect(screen.getByText(/Generate a version first/i)).toBeTruthy();
  });

  it("renders tabs and switches version", async () => {
    render(
      <PackDetailClient
        initialPack={{
          id: "pack_1",
          userId: "user_1",
          title: "Pack",
          company: "Acme",
          roleTitle: "Engineer",
          status: "ready",
          source: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T01:00:00.000Z",
        }}
        initialVersions={[
          {
            id: "ver_1",
            packId: "pack_1",
            userId: "user_1",
            jobDescription: "JD one",
            inputsMasked: {},
            outputs: { cv: { summary: "Summary", sections: [] }, coverLetter: "Cover", starStories: [], fitMap: [], rationale: "Why" },
            modelMeta: null,
            createdAt: "2024-01-01T01:00:00.000Z",
          },
          {
            id: "ver_2",
            packId: "pack_1",
            userId: "user_1",
            jobDescription: "JD two",
            inputsMasked: {},
            outputs: { cv: { summary: "Summary 2", sections: [] }, coverLetter: "Cover 2", starStories: [], fitMap: [], rationale: "Why 2" },
            modelMeta: null,
            createdAt: "2024-01-01T00:30:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByText("CV")).toBeTruthy();
    expect(screen.getByText("Cover letter")).toBeTruthy();
    expect(screen.getByText("STAR / Evidence")).toBeTruthy();
    expect(screen.getByText("Fit map")).toBeTruthy();

    const select = screen.getByDisplayValue(/Latest/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "ver_2" } });
    await waitFor(() => {
      const textarea = screen.getByLabelText("Job description") as HTMLTextAreaElement;
      expect(textarea.value).toBe("JD two");
    });
  });

  it("generates a new version and enables export", async () => {
    generateOk = true;
    render(
      <PackDetailClient
        initialPack={{
          id: "pack_1",
          userId: "user_1",
          title: "Pack",
          company: "Acme",
          roleTitle: "Engineer",
          status: "draft",
          source: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T01:00:00.000Z",
        }}
        initialVersions={[]}
      />
    );

    fireEvent.change(screen.getByLabelText("Job description"), { target: { value: "JD" } });
    fireEvent.click(screen.getByText("Generate pack"));
    await waitFor(() => {
      expect(screen.getByText(/Pack generated/i)).toBeTruthy();
    });
    const exportBtn = screen.getByText("Export DOCX") as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(false);
  });

  it("copies output for the active tab", async () => {
    render(
      <PackDetailClient
        initialPack={{
          id: "pack_1",
          userId: "user_1",
          title: "Pack",
          company: "Acme",
          roleTitle: "Engineer",
          status: "ready",
          source: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T01:00:00.000Z",
        }}
        initialVersions={[
          {
            id: "ver_1",
            packId: "pack_1",
            userId: "user_1",
            jobDescription: "JD one",
            inputsMasked: {},
            outputs: { cv: { summary: "Summary", sections: [{ title: "Experience", bullets: ["Did thing"] }] }, coverLetter: "Cover", starStories: [], fitMap: [], rationale: "Why" },
            modelMeta: null,
            createdAt: "2024-01-01T01:00:00.000Z",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText("Copy"));
    await waitFor(() => {
      expect((navigator as any).clipboard.writeText).toHaveBeenCalled();
    });
  });

  it("shows what changed empty state when no previous version exists", async () => {
    render(
      <PackDetailClient
        initialPack={{
          id: "pack_1",
          userId: "user_1",
          title: "Pack",
          company: "Acme",
          roleTitle: "Engineer",
          status: "ready",
          source: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T01:00:00.000Z",
        }}
        initialVersions={[
          {
            id: "ver_1",
            packId: "pack_1",
            userId: "user_1",
            jobDescription: "JD one",
            inputsMasked: {},
            outputs: { cv: { summary: "Summary", sections: [] }, coverLetter: "Cover", starStories: [], fitMap: [], rationale: "Why" },
            modelMeta: null,
            createdAt: "2024-01-01T01:00:00.000Z",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText("What changed"));
    expect(screen.getByText(/No previous version to compare/i)).toBeTruthy();
  });

  it("shows rate-limit banner on generate failure", async () => {
    render(
      <PackDetailClient
        initialPack={{
          id: "pack_1",
          userId: "user_1",
          title: "Pack",
          company: "Acme",
          roleTitle: "Engineer",
          status: "draft",
          source: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T01:00:00.000Z",
        }}
        initialVersions={[]}
      />
    );

    fireEvent.change(screen.getByLabelText("Job description"), { target: { value: "JD" } });
    fireEvent.click(screen.getByText("Generate pack"));
    await waitFor(() => {
      expect(screen.getByText(/Rate limited/i)).toBeTruthy();
    });
    expect(screen.getByText(/Copy requestId/i)).toBeTruthy();
  });
});
