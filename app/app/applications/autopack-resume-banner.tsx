"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clearPendingAction, loadPendingAction } from "@/lib/billing/pending-action";

type Props = {
  applicationId: string;
};

export default function AutopackResumeBanner({ applicationId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchParams ?? undefined);
    const purchased = params.has("purchased") || params.get("checkout") === "success";
    const pending = loadPendingAction();
    if (
      pending &&
      pending.type === "autopack_generate" &&
      pending.applicationId === applicationId &&
      purchased
    ) {
      setShow(true);
    }
  }, [applicationId, searchParams]);

  const resumeHref = useMemo(() => {
    const url = new URL(
      `/app/applications/${applicationId}?tab=apply#apply-autopacks`,
      "http://localhost"
    );
    return url.pathname + url.search + url.hash;
  }, [applicationId]);

  if (!show) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Credits added. Ready to generate your Autopack.
          </p>
          <p className="text-xs text-emerald-700">
            We saved where you left off. Resume when you’re ready.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-emerald-200 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          onClick={() => {
            clearPendingAction();
            setShow(false);
            router.push(resumeHref);
            window.dispatchEvent(
              new CustomEvent("cvf-resume-autopack", {
                detail: { applicationId },
              })
            );
          }}
        >
          Resume Autopack generation
        </button>
      </div>
    </div>
  );
}
