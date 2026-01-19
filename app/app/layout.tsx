import Link from "next/link";
import LogoutButton from "./logout-button";
import { getSupabaseUser } from "@/lib/data/supabase";
import { canSeeOpsNav, getUserRole, type UserRole } from "@/lib/rbac";
import OpsNavLink from "./ops-nav-link";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/pipeline", label: "Pipeline" },
  { href: "/app/insights", label: "Insights" },
  { href: "/app/profile", label: "Profile" },
  { href: "/app/applications", label: "Applications" },
  { href: "/app/billing", label: "Billing" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSupabaseUser();
  let role: UserRole = "user";
  if (user) {
    try {
      role = (await getUserRole(user.id)).role;
    } catch {
      role = "user";
    }
  }
  const showOps = canSeeOpsNav(role);

  return (
    <div className="min-h-screen bg-[rgba(255,255,255,0.45)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xl font-semibold">
            CVForge
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm text-[rgb(var(--muted))]">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-black/10 bg-white/70 px-4 py-2 font-medium text-[rgb(var(--ink))] transition hover:border-black/20"
              >
                {item.label}
              </Link>
            ))}
            {showOps ? <OpsNavLink /> : null}
            <LogoutButton />
          </nav>
        </header>
        <main className="mt-10 flex-1">{children}</main>
      </div>
    </div>
  );
}
