"use client";

import { useState } from "react";
import { withRequestIdHeaders } from "@/lib/observability/request-id";
import { safeReadJson } from "@/lib/http/safe-json";
import ErrorBanner from "@/components/ErrorBanner";
import { ERROR_COPY } from "@/lib/microcopy/errors";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import type { UserRole } from "@/lib/rbac";

type Props = {
  targetUserId: string;
  targetEmail: string;
  currentRole: UserRole;
  canSetSuperAdmin: boolean;
};

export default function RoleEditor({ targetUserId, targetEmail, currentRole, canSetSuperAdmin }: Props) {
  const [role, setRole] = useState<UserRole>(currentRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [supportSnippet, setSupportSnippet] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    setRequestId(null);
    setSupportSnippet(null);
    try {
      const { headers, requestId: rid } = withRequestIdHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/ops/roles/set", {
        method: "POST",
        headers,
        body: JSON.stringify({ targetUserId, role }),
      });
      const payload = await safeReadJson<any>(res);
      const payloadError = (payload.data as any)?.error;
      const resolvedRequestId = payloadError?.requestId ?? res.headers.get("x-request-id") ?? rid ?? null;
      if (!res.ok || !(payload.data as any)?.ok) {
        setError(payloadError?.message ?? "Unable to update role.");
        if (resolvedRequestId) {
          setRequestId(resolvedRequestId);
          setSupportSnippet(
            buildSupportSnippet({
              action: "Set user role",
              path: "/app/ops/users",
              requestId: resolvedRequestId,
              code: payloadError?.code,
            })
          );
        }
        return;
      }
      setMessage("Role updated");
    } catch (err) {
      setError("Unable to update role.");
    } finally {
      setSaving(false);
    }
  };

  const roleOptions: UserRole[] = ["user", "support", "admin", "super_admin"];

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <p className="text-sm font-semibold text-[rgb(var(--ink))]">Role management</p>
      <p className="text-xs text-[rgb(var(--muted))]">Update role for {targetEmail}</p>
      {error ? (
        <div className="mt-2">
          <ErrorBanner
            title={ERROR_COPY.generic.title}
            message={error}
            requestId={requestId}
            supportSnippet={supportSnippet}
            onDismiss={() => setError(null)}
          />
        </div>
      ) : null}
      {message ? <p className="mt-2 text-xs text-emerald-700">{message}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        >
          {roleOptions
            .filter((r) => (r === "super_admin" ? canSetSuperAdmin : true))
            .map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save role"}
        </button>
      </div>
    </div>
  );
}
