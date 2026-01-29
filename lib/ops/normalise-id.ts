export function normaliseId(input: string | null | undefined) {
  const raw = String(input ?? "");
  if (!raw) return "";
  const trimmed = raw.trim();
  return trimmed.replace(/^[\r\n\t]+|[\r\n\t]+$/g, "");
}
