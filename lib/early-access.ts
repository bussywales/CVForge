import "server-only";

import { getUserRole, isOpsRole } from "@/lib/rbac";

function parseEmails(raw?: string | null) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isEarlyAccessAllowed({ userId, email }: { userId: string; email?: string | null }) {
  const mode = (process.env.EARLY_ACCESS_MODE ?? "on").toLowerCase();
  if (mode === "off") return true;
  const roleInfo = await getUserRole(userId);
  if (isOpsRole(roleInfo.role)) return true;
  const allowed = parseEmails(process.env.EARLY_ACCESS_EMAILS);
  if (!email) return false;
  return allowed.includes(email.toLowerCase());
}

export function maskEmail(email?: string | null) {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  const domainParts = domain.split(".");
  const maskedDomain = domainParts
    .map((part, idx) => (idx === domainParts.length - 1 ? part : `${part[0] ?? ""}${"*".repeat(Math.max(0, part.length - 1))}`))
    .join(".");
  return `${maskedLocal}@${maskedDomain}`;
}
