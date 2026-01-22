/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";

describe("invite messages", () => {
  it("includes link for all channels", async () => {
    const { buildInviteMessage } = await import("@/lib/early-access/invite-messages");
    const link = "https://app.cvforge.com/signup?invite=tok";
    const channels: ("email" | "whatsapp" | "sms" | "dm")[] = ["email", "whatsapp", "sms", "dm"];
    for (const channel of channels) {
      const msg = buildInviteMessage(channel, { inviteLink: link });
      expect(msg).toContain(link);
    }
  });
});
