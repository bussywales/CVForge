export function buildSupportSnippet({
  requestId,
  action,
  path,
  code,
}: {
  requestId: string;
  action: string;
  path: string;
  code?: string | null;
}) {
  return [
    "CVForge support request",
    `Action: ${action}`,
    `Page: ${path}`,
    `Reference: ${requestId}`,
    `Code: ${code ?? "unknown"}`,
  ].join("\n");
}
