/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { getAlertsWebhookConfig } from "@/lib/ops/alerts-webhook-config";

describe("alerts webhook config helper", () => {
  it("reports disabled when url and secret are missing", () => {
    const res = getAlertsWebhookConfig({ url: "", secret: "" });
    expect(res.mode).toBe("disabled");
    expect(res.configured).toBe(false);
  });

  it("reports missing_url when secret set but url missing", () => {
    const res = getAlertsWebhookConfig({ url: "", secret: "secret" });
    expect(res.mode).toBe("missing_url");
    expect(res.configured).toBe(false);
  });

  it("reports missing_secret when url set but secret missing", () => {
    const res = getAlertsWebhookConfig({ url: "https://example.com/hook", secret: "" });
    expect(res.mode).toBe("missing_secret");
    expect(res.configured).toBe(false);
  });

  it("reports misconfigured when url is invalid", () => {
    const res = getAlertsWebhookConfig({ url: "not-a-url", secret: "secret" });
    expect(res.mode).toBe("misconfigured");
    expect(res.configured).toBe(false);
  });

  it("reports enabled when url and secret are present", () => {
    const res = getAlertsWebhookConfig({ url: "https://example.com/hook", secret: "secret" });
    expect(res.mode).toBe("enabled");
    expect(res.configured).toBe(true);
    expect(res.safeMeta.hasUrl).toBe(true);
    expect(res.safeMeta.hasSecret).toBe(true);
  });
});
