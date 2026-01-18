import { redirect } from "next/navigation";

export default function LegacyAuthSignup({ searchParams }: { searchParams?: Record<string, string> }) {
  const params = new URLSearchParams(searchParams as Record<string, string>);
  const nextPath = `/login${params.toString() ? `?${params.toString()}` : ""}`;
  redirect(nextPath);
}
