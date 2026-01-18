import "server-only";

export function isOpsAdmin(email: string | null | undefined) {
  if (!email) return false;
  const allowedList = (process.env.OPS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowedList.includes(email.toLowerCase())) return true;

  const domain = process.env.OPS_ADMIN_DOMAIN?.toLowerCase().trim();
  if (domain && email.toLowerCase().endsWith(`@${domain}`)) {
    return true;
  }
  return false;
}
