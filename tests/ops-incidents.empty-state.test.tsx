/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IncidentsClient from "@/app/app/ops/incidents/incidents-client";
import type { IncidentRecord } from "@/lib/ops/incidents-shared";

vi.mock("next/link", () => ({
  __esModule: true,
  default: (props: any) => <a {...props} />,
}));

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/app/ops/incidents",
}));

const logMock = vi.fn();
vi.mock("@/lib/monetisation-client", () => ({
  logMonetisationClientEvent: (...args: any[]) => logMock(...args),
}));

describe("Incidents empty state wideners", () => {
  afterEach(() => {
    replaceMock.mockReset();
    logMock.mockReset();
  });

  it("shows widen chips and updates params", () => {
    const incidents: IncidentRecord[] = [];
    render(<IncidentsClient incidents={incidents} initialTime="0.25" initialSurface="billing" initialCode="ERR" initialFrom="ops_alerts" />);
    expect(screen.getByText(/No incidents match these filters/i)).toBeTruthy();
    const removeCode = screen.getByText(/Remove code/i);
    fireEvent.click(removeCode);
    expect(replaceMock).toHaveBeenCalledWith("/app/ops/incidents?window=15m&surface=billing&from=ops_alerts", { scroll: false });
    expect(logMock).toHaveBeenCalledWith("ops_incidents_widen_click", null, "ops", expect.objectContaining({ removed: "code" }));
  });
});
