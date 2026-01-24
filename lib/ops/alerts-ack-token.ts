import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

function base64url(input: Buffer | string) {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signAckToken(payload: { eventId: string; exp: number; window_label?: string | null }) {
  const secret = process.env.ALERTS_ACK_SECRET;
  if (!secret) throw new Error("ALERTS_ACK_SECRET missing");
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${base64url(sig)}`;
}

export function verifyAckToken(token: string): { ok: boolean; payload?: any } {
  const secret = process.env.ALERTS_ACK_SECRET;
  if (!secret) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false };
  const [body, sig] = parts;
  const expected = createHmac("sha256", secret).update(body).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } catch {
    return { ok: false };
  }
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return { ok: false };
  try {
    const payload = JSON.parse(Buffer.from(body, "base64").toString("utf8"));
    if (!payload?.eventId || typeof payload.exp !== "number") return { ok: false };
    if (Date.now() / 1000 > payload.exp) return { ok: false };
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}
