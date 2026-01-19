export type AuditExportItem = {
  id: string;
  at: string;
  action: string;
  actor?: { email?: string | null; role?: string | null } | null;
  target?: { userId?: string | null } | null;
  ref?: string;
  requestId?: string;
  meta?: any;
};

export function buildAuditCsv(items: AuditExportItem[]) {
  const header = ["time", "action", "actorEmail", "actorRole", "userId", "ref", "requestId"];
  const lines = items.map((item) => {
    const row = [
      item.at ?? "",
      item.action ?? "",
      item.actor?.email ?? "",
      item.actor?.role ?? "",
      item.target?.userId ?? "",
      item.ref ?? "",
      item.requestId ?? "",
    ];
    return row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
  });
  return [header.join(","), ...lines].join("\n");
}
