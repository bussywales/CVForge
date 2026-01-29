export type OpsCaseSearchKind = "requestId" | "userId" | "email" | "unknown";
export type OpsCaseSearchMode = "requestId" | "userId";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value.trim());
}

export function parseOpsCaseInput(input: string, mode: OpsCaseSearchMode = "requestId"): { kind: OpsCaseSearchKind; value: string } {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "unknown", value: "" };

  if (trimmed.includes("@")) {
    return { kind: "email", value: trimmed };
  }

  if (trimmed.toLowerCase().startsWith("req_")) {
    return { kind: "requestId", value: trimmed };
  }

  if (mode === "userId") {
    return { kind: "userId", value: trimmed };
  }

  return { kind: "requestId", value: trimmed };
}
