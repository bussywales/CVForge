/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { buildOpsCaseAlertsLink, buildOpsCaseIncidentsLink, buildOpsCaseWebhooksLink } from "@/lib/ops/ops-case-links";

describe("ops case links", () => {
  it("builds alerts link with ordered params", () => {
    const link = buildOpsCaseAlertsLink({ window: "15m", requestId: "req_1", eventId: "evt_1" });
    expect(link).toBe("/app/ops/alerts?from=ops_case&window=15m&tab=recent&requestId=req_1&eventId=evt_1");
  });

  it("builds incidents link with filters", () => {
    const link = buildOpsCaseIncidentsLink({ window: "24h", requestId: "req_2", userId: "user_1" });
    expect(link).toBe("/app/ops/incidents?from=ops_case&window=24h&requestId=req_2&userId=user_1");
  });

  it("builds webhooks link with window", () => {
    const link = buildOpsCaseWebhooksLink({ window: "7d", q: "req_3" });
    expect(link).toBe("/app/ops/webhooks?from=ops_case&window=7d&q=req_3");
  });
});
