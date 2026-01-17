"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { portalDismissKey, type PortalReturnState } from "@/lib/billing/portal-return";
import { getIsoWeekKey } from "@/lib/weekly-review";

type Props = {
  applicationId: string | null;
  state: PortalReturnState;
  isActive: boolean;
};

export default function PortalReturnBanner({ applicationId, state, isActive }: Props) {
  const [visible, setVisible] = useState(false);
  const weekKey = getIsoWeekKey(new Date());

  useEffect(() => {
    const dismissed = typeof window !== "undefined"
      ? window.localStorage.getItem(portalDismissKey(weekKey))
      : null;
    if (state.portal && !dismissed) {
      setVisible(true);
      logMonetisationClientEvent("sub_portal_return_view", applicationId, "billing", {
        flow: state.flow,
        plan: state.plan,
        active: isActive,
        source: "billing",
      });
    }
  }, [applicationId, isActive, state.flow, state.plan, state.portal, weekKey]);

  if (!visible || !state.portal) return null;

  const handleDismiss = (event: "sub_portal_return_dismiss" | "sub_portal_return_keep_momentum") => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(portalDismissKey(weekKey), "1");
      const url = new URL(window.location.href);
      url.searchParams.delete("portal");
      window.history.replaceState({}, "", url.toString());
    }
    setVisible(false);
    logMonetisationClientEvent(event, applicationId, "billing", {
      flow: state.flow,
      plan: state.plan,
      active: isActive,
      source: "billing",
    });
    if (event !== "sub_portal_return_dismiss") {
      logMonetisationClientEvent("sub_portal_return_dismiss", applicationId, "billing", {
        flow: state.flow,
        plan: state.plan,
        active: isActive,
        source: "billing",
      });
    }
  };

  const handleReopen = () => {
    logMonetisationClientEvent("sub_portal_return_still_cancel", applicationId, "billing", {
      flow: state.flow,
      plan: state.plan,
      active: isActive,
      source: "billing",
    });
    logMonetisationClientEvent("sub_portal_return_reopen_portal", applicationId, "billing", {
      flow: "cancel",
      plan: state.plan,
      active: isActive,
      source: "billing",
    });
    fetch("/api/stripe/portal?flow=cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ returnTo: "/app/billing", plan: state.plan ?? undefined }),
    })
      .then((res) => res.json().catch(() => ({})).then((payload) => ({ ok: res.ok, payload })))
      .then(({ ok, payload }) => {
        if (ok && payload?.url) {
          window.location.href = payload.url as string;
        }
      })
      .catch(() => undefined);
  };

  const title = isActive ? "Welcome back" : "Your subscription is no longer active.";
  const body = isActive
    ? "Your subscription settings may have changed. Want to keep your momentum going?"
    : "Restart your plan to keep CVForge tools available.";

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-emerald-900">{title}</p>
            {isActive ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
                Active
              </span>
            ) : null}
          </div>
          <p className="text-xs text-emerald-700">{body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            onClick={() => handleDismiss("sub_portal_return_keep_momentum")}
          >
            {isActive ? "Continue with CVForge" : "Resubscribe"}
          </button>
          {isActive ? (
            <button
              type="button"
              className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              onClick={handleReopen}
            >
              I still want to cancel
            </button>
          ) : null}
          <Link
            href="#subscription-plans"
            className="text-xs font-semibold text-emerald-800 underline-offset-2 hover:underline"
            onClick={() =>
              logMonetisationClientEvent("sub_portal_return_dismiss", applicationId, "billing", {
                flow: state.flow,
                plan: state.plan,
                active: isActive,
                source: "billing",
              })
            }
          >
            See subscription status
          </Link>
        </div>
      </div>
    </div>
  );
}
