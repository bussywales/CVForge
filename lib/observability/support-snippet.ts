export function buildSupportSnippet({
  requestId,
  action,
  path,
  code,
}: {
  requestId?: string | null;
  action: string;
  path: string;
  code?: string | null;
}) {
  const lines = ["CVForge support request", `Action: ${action}`, `Page: ${path}`];
  if (requestId) {
    lines.push(`Reference: ${requestId}`);
  }
  lines.push(`Code: ${code ?? "unknown"}`);
  return lines.join("\n");
}
