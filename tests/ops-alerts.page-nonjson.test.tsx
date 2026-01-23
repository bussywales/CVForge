/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import AlertsClient from "@/app/app/ops/alerts/alerts-client";

describe("Alerts page initial error render", () => {
  it("renders calm banner when initial load fails", () => {
    render(<AlertsClient initial={null} initialError={{ message: "Unable to load alerts", requestId: "req_init", code: "NON_JSON" }} requestId="req_init" />);
    expect(screen.getByText(/Alerts unavailable/)).toBeTruthy();
    expect(screen.getByText(/Unable to load alerts/)).toBeTruthy();
  });
});
