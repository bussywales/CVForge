export function getAdminEmails() {
  const raw = process.env.CVFORGE_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }
  const admins = getAdminEmails();
  if (!admins.length) {
    return false;
  }
  return admins.includes(email.trim().toLowerCase());
}
