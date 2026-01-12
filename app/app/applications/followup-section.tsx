"use client";

import { useEffect, useState, useTransition } from "react";
import Button from "@/components/Button";
import type { ActionState } from "@/lib/actions/types";
import type { FollowupTemplate } from "@/lib/followup-templates";

type FollowupSectionProps = {
  applicationId: string;
  templates: FollowupTemplate[];
  createFollowupAction: (formData: FormData) => Promise<ActionState>;
  calendarUrl?: string | null;
};

export default function FollowupSection({
  applicationId,
  templates,
  createFollowupAction,
  calendarUrl,
}: FollowupSectionProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast("Copied.");
    } catch (error) {
      console.error("[followup.copy]", error);
      setToast("Unable to copy right now.");
    }
  };

  const handleCreate = (template: FollowupTemplate) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("application_id", applicationId);
      formData.set("subject", template.subject);
      formData.set("body", template.body);
      const result = await createFollowupAction(formData);
      if (result.status === "success") {
        setToast("Follow-up logged and next reminder set.");
      } else if (result.message) {
        setToast(result.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {toast}
        </div>
      ) : null}

      {calendarUrl ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-[rgb(var(--muted))]">
          <span className="font-semibold text-[rgb(var(--ink))]">
            Add a reminder
          </span>{" "}
          <a
            href={calendarUrl}
            className="ml-2 text-sm font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
          >
            Add follow-up to calendar
          </a>
          .
        </div>
      ) : null}

      <div className="space-y-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="rounded-2xl border border-black/10 bg-white/70 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                  {template.label}
                </p>
                <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                  Subject: {template.subject}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleCreate(template)}
                disabled={isPending}
              >
                {isPending ? "Logging..." : "Create follow-up activity"}
              </Button>
            </div>

            <div className="mt-3 space-y-2 text-sm text-[rgb(var(--muted))]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.2em]">
                  Subject
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(template.subject)}
                  className="rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-xs font-semibold text-[rgb(var(--ink))]"
                >
                  Copy subject
                </button>
              </div>
              <p className="text-sm text-[rgb(var(--ink))]">{template.subject}</p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.2em]">
                  Body
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(template.body)}
                  className="rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-xs font-semibold text-[rgb(var(--ink))]"
                >
                  Copy body
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-[rgb(var(--ink))]">
                {template.body}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
