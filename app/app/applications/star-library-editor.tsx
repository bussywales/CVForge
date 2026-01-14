"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import { formatStarDraft } from "@/lib/star-library";

type EvidenceSummary = {
  id: string;
  title: string;
  kind: "achievement" | "work_history";
  qualityScore: number;
};

type StarDraft = {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  quality_hint: string | null;
};

type StarLibraryEditorProps = {
  draft: StarDraft;
  evidence: EvidenceSummary[];
};

type ToastState = { message: string; variant?: "success" | "error" };

export default function StarLibraryEditor({
  draft,
  evidence,
}: StarLibraryEditorProps) {
  const [title, setTitle] = useState(draft.title);
  const [situation, setSituation] = useState(draft.situation);
  const [task, setTask] = useState(draft.task);
  const [action, setAction] = useState(draft.action);
  const [result, setResult] = useState(draft.result);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const formatted = useMemo(
    () =>
      formatStarDraft({
        situation,
        task,
        action,
        result,
      }),
    [situation, task, action, result]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setToast({ message: "Copied.", variant: "success" });
    } catch (error) {
      console.error("[star-library.copy]", error);
      setToast({ message: "Unable to copy right now.", variant: "error" });
    }
  };

  const handleSave = async () => {
    setPending(true);
    try {
      const response = await fetch(`/api/star-library/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          situation,
          task,
          action,
          result,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to save draft.",
          variant: "error",
        });
        return;
      }
      setToast({ message: "Draft saved.", variant: "success" });
    } catch (error) {
      console.error("[star-library.save]", error);
      setToast({ message: "Unable to save draft.", variant: "error" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {toast ? (
        <div
          className={`rounded-2xl border p-3 text-xs ${
            toast.variant === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-[rgb(var(--muted))]">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
        </label>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]">
          <p className="font-semibold text-[rgb(var(--ink))]">
            Quality hint
          </p>
          <p className="mt-2">
            {draft.quality_hint ? draft.quality_hint : "Medium"}
          </p>
        </div>
      </div>

      <label className="text-xs font-semibold text-[rgb(var(--muted))]">
        Situation
        <textarea
          value={situation}
          onChange={(event) => setSituation(event.target.value)}
          rows={3}
          className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
      </label>

      <label className="text-xs font-semibold text-[rgb(var(--muted))]">
        Task
        <textarea
          value={task}
          onChange={(event) => setTask(event.target.value)}
          rows={3}
          className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
      </label>

      <label className="text-xs font-semibold text-[rgb(var(--muted))]">
        Action
        <textarea
          value={action}
          onChange={(event) => setAction(event.target.value)}
          rows={4}
          className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
      </label>

      <label className="text-xs font-semibold text-[rgb(var(--muted))]">
        Result
        <textarea
          value={result}
          onChange={(event) => setResult(event.target.value)}
          rows={3}
          className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={handleSave} disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCopy}>
          Copy STAR
        </Button>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
          Evidence used
        </p>
        {evidence.length ? (
          <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
            {evidence.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/70 p-2"
              >
                <div>
                  <p className="text-xs font-semibold text-[rgb(var(--ink))]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">
                    {item.kind === "work_history" ? "Work history" : "Achievement"}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Quality {item.qualityScore}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">
            No evidence attached.
          </p>
        )}
      </div>
    </div>
  );
}
