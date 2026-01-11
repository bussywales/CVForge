"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { ActionState } from "@/lib/actions/types";
import { initialActionState } from "@/lib/actions/types";
import type { AchievementRecord } from "@/lib/data/achievements";

type AchievementsSectionProps = {
  achievements: AchievementRecord[];
  createAction: (formData: FormData) => Promise<ActionState>;
  updateAction: (formData: FormData) => Promise<ActionState>;
  deleteAction: (formData: FormData) => Promise<ActionState>;
};

type AchievementFormProps = {
  mode: "create" | "edit";
  initialValues?: Partial<AchievementRecord>;
  action: (formData: FormData) => Promise<ActionState>;
  onCancel?: () => void;
  onSuccess?: () => void;
};

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

function AchievementForm({
  mode,
  initialValues,
  action,
  onCancel,
  onSuccess,
}: AchievementFormProps) {
  const [state, setState] = useState(initialActionState);
  const [isPending, startTransition] = useTransition();
  const [metrics, setMetrics] = useState(initialValues?.metrics ?? "");
  const formRef = useRef<HTMLFormElement | null>(null);
  const metricsLength = metrics.length;
  const isMetricsOverLimit = metricsLength > 120;
  const metricsCounterClass =
    metricsLength > 120
      ? "text-red-600"
      : metricsLength >= 100
        ? "text-amber-600"
        : "text-[rgb(var(--muted))]";

  useEffect(() => {
    if (state.status === "success") {
      onSuccess?.();
      if (mode === "create") {
        formRef.current?.reset();
        setMetrics("");
      }
    }
  }, [state.status, onSuccess, mode]);

  useEffect(() => {
    setMetrics(initialValues?.metrics ?? "");
  }, [initialValues?.metrics]);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await action(formData);
          setState(result);
        });
      }}
      className="space-y-4 rounded-3xl border border-black/10 bg-white/70 p-5"
    >
      {state.message ? (
        <div
          className={`rounded-2xl border p-3 text-sm ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {mode === "edit" ? (
        <input type="hidden" name="id" value={initialValues?.id} />
      ) : null}

      <FormField label="Title" htmlFor={`${mode}-title`} error={state.fieldErrors?.title}>
        <input
          id={`${mode}-title`}
          name="title"
          required
          defaultValue={initialValues?.title ?? ""}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

      <FormField
        label="Situation"
        htmlFor={`${mode}-situation`}
        error={state.fieldErrors?.situation}
        hint="Context for the achievement."
      >
        <textarea
          id={`${mode}-situation`}
          name="situation"
          rows={3}
          defaultValue={initialValues?.situation ?? ""}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

      <FormField
        label="Task"
        htmlFor={`${mode}-task`}
        error={state.fieldErrors?.task}
      >
        <textarea
          id={`${mode}-task`}
          name="task"
          rows={2}
          defaultValue={initialValues?.task ?? ""}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

      <FormField
        label="Action"
        htmlFor={`${mode}-action`}
        error={state.fieldErrors?.action}
        hint="Minimum 20 characters. Focus on what you did."
      >
        <textarea
          id={`${mode}-action`}
          name="action"
          rows={3}
          required
          defaultValue={initialValues?.action ?? ""}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

      <FormField
        label="Result"
        htmlFor={`${mode}-result`}
        error={state.fieldErrors?.result}
        hint="Minimum 20 characters. Focus on outcomes."
      >
        <textarea
          id={`${mode}-result`}
          name="result"
          rows={3}
          required
          defaultValue={initialValues?.result ?? ""}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

      <FormField
        label="Metrics"
        htmlFor={`${mode}-metrics`}
        error={state.fieldErrors?.metrics}
        hint="Optional numbers to quantify impact."
      >
        <div className="space-y-2">
          <input
            id={`${mode}-metrics`}
            name="metrics"
            value={metrics}
            onChange={(event) => setMetrics(event.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          />
          <div className={`text-right text-xs ${metricsCounterClass}`}>
            {metricsLength} / 120
          </div>
        </div>
      </FormField>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          label={mode === "create" ? "Add achievement" : "Save changes"}
          pending={isPending || isMetricsOverLimit}
        />
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function DeleteAchievementForm({
  id,
  deleteAction,
}: {
  id: string;
  deleteAction: (formData: FormData) => Promise<ActionState>;
}) {
  const [state, setState] = useState(initialActionState);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await deleteAction(formData);
          setState(result);
        });
      }}
      className="space-y-1"
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" disabled={isPending}>
        {isPending ? "Deleting..." : "Delete"}
      </Button>
      {state.status === "error" ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}

export default function AchievementsSection({
  achievements,
  createAction,
  updateAction,
  deleteAction,
}: AchievementsSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedMetrics, setExpandedMetrics] = useState<Record<string, boolean>>(
    {}
  );
  const metricsPreviewLimit = 80;

  const formattedAchievements = useMemo(
    () =>
      achievements.map((achievement) => ({
        ...achievement,
        createdLabel: new Date(achievement.created_at).toLocaleDateString(
          undefined,
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          }
        ),
      })),
    [achievements]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Achievements</h3>
          <p className="text-sm text-[rgb(var(--muted))]">
            Capture proof points you can reuse across roles.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setIsAdding((prev) => !prev);
            setEditingId(null);
          }}
        >
          {isAdding ? "Close" : "Add achievement"}
        </Button>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-[rgb(var(--muted))]">
        <span className="font-semibold text-[rgb(var(--ink))]">
          Achievements are your evidence bank.
        </span>{" "}
        Focus on outcomes, metrics, and the actions you personally owned so the
        generator can ground every claim.
      </div>

      {isAdding ? (
        <AchievementForm
          mode="create"
          action={createAction}
          onCancel={() => setIsAdding(false)}
          onSuccess={() => setIsAdding(false)}
        />
      ) : null}

      {formattedAchievements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-[rgb(var(--muted))]">
          No achievements yet. Add one to start your evidence bank.
        </div>
      ) : (
        <div className="space-y-4">
          {formattedAchievements.map((achievement) => (
            <div
              key={achievement.id}
              className="rounded-2xl border border-black/10 bg-white/70 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-[rgb(var(--ink))]">
                    {achievement.title}
                  </p>
                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                    Added {achievement.createdLabel}
                  </p>
                  {achievement.metrics ? (
                    <div className="mt-2 text-sm text-[rgb(var(--muted))]">
                      <span className="font-medium text-[rgb(var(--ink))]">
                        Metrics:
                      </span>{" "}
                      {achievement.metrics.length > metricsPreviewLimit &&
                      !expandedMetrics[achievement.id]
                        ? `${achievement.metrics.slice(0, metricsPreviewLimit).trim()}…`
                        : achievement.metrics}
                      {achievement.metrics.length > metricsPreviewLimit ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedMetrics((prev) => ({
                              ...prev,
                              [achievement.id]: !prev[achievement.id],
                            }))
                          }
                          className="ml-2 text-xs font-semibold text-[rgb(var(--accent))] hover:underline"
                        >
                          {expandedMetrics[achievement.id] ? "Hide" : "View"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingId((prev) =>
                        prev === achievement.id ? null : achievement.id
                      );
                      setIsAdding(false);
                    }}
                  >
                    {editingId === achievement.id ? "Close" : "Edit"}
                  </Button>
                  <DeleteAchievementForm
                    id={achievement.id}
                    deleteAction={deleteAction}
                  />
                </div>
              </div>

              {editingId === achievement.id ? (
                <div className="mt-4">
                  <AchievementForm
                    mode="edit"
                    action={updateAction}
                    initialValues={achievement}
                    onCancel={() => setEditingId(null)}
                    onSuccess={() => setEditingId(null)}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
