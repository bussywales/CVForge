/// <reference types="vitest/globals" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import FunnelPanel from "@/app/app/ops/funnel-panel";

const replaceMock = vi.fn();
const writeTextMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: vi.fn(),
}));

describe("FunnelPanel filters", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    writeTextMock.mockReset();
    (global as any).navigator = {
      clipboard: { writeText: writeTextMock },
    };
    (global as any).fetch = vi.fn(async () => ({
      status: 200,
      json: async () => ({
        ok: true,
        summary: {
          windows: [
            {
              windowLabel: "24h",
              invited: 2,
              signed_up: 1,
              created_cv: 1,
              exported_cv: 0,
              created_application: 0,
              created_interview: 0,
              conversion: { invitedToSignup: 50, signupToCv: 100, cvToExport: 0, exportToApplication: 0 },
              source: "link",
            },
          ],
          sources: ["link"],
        },
      }),
    })) as any;
  });

  it("changes filters and copies link", async () => {
    render(<FunnelPanel />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/Source/i), { target: { value: "link" } });
    expect(replaceMock).toHaveBeenCalled();

    const copyBtn = screen.getByText(/Copy link/i);
    await fireEvent.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalled();
  });
});
