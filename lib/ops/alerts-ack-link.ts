export function buildAckLink(token: string, { returnTo }: { returnTo?: string | null } = {}) {
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = new URL("/api/alerts/ack", base);
  url.searchParams.set("token", token);
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  return url.toString();
}
