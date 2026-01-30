/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import {
  decodeCaseQueueCursor,
  encodeCaseQueueCursor,
  normaliseCaseQueueQuery,
  resolveCaseLastTouched,
} from "@/lib/ops/ops-case-queue";

describe("ops case queue helpers", () => {
  it("encodes and decodes cursor", () => {
    const cursor = encodeCaseQueueCursor({ ts: "2024-01-01T00:00:00.000Z", id: "req_123" });
    expect(decodeCaseQueueCursor(cursor)).toEqual({ ts: "2024-01-01T00:00:00.000Z", id: "req_123" });
  });

  it("returns null for invalid cursor", () => {
    expect(decodeCaseQueueCursor("bad")).toBeNull();
  });

  it("normalises query kinds", () => {
    expect(normaliseCaseQueueQuery("req_abc")).toEqual({ kind: "requestId", value: "req_abc" });
    expect(normaliseCaseQueueQuery("0b5a3a50-3f6e-4b79-8c4e-48b8d8a7c111")).toEqual({
      kind: "userId",
      value: "0b5a3a50-3f6e-4b79-8c4e-48b8d8a7c111",
    });
  });

  it("resolves latest touched timestamp", () => {
    const touched = resolveCaseLastTouched({
      workflowTouched: "2024-01-01T01:00:00.000Z",
      notesUpdated: "2024-01-01T03:00:00.000Z",
      evidenceUpdated: "2024-01-01T02:00:00.000Z",
    });
    expect(touched).toBe("2024-01-01T03:00:00.000Z");
  });
});
