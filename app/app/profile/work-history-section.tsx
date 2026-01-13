"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { ActionState } from "@/lib/actions/types";
import { initialActionState } from "@/lib/actions/types";
import type { WorkHistoryRecord } from "@/lib/data/work-history";

type WorkHistorySectionProps = {
  entries: WorkHistoryRecord[];
  createAction: (formData: FormData) => Promise<ActionState>;
  updateAction: (formData: FormData) => Promise<ActionState>;
  deleteAction: (formData: FormData) => Promise<ActionState>;
};

type WorkHistoryFormProps = {
  mode: "create" | "edit";
  initialValues?: Partial<WorkHistoryRecord>;
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

function toMonthInputValue(value?: string | null) {
  if (!value) {
    return "";
  }
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) {
    return "";
  }
  return `${match[1]}-${match[2]}`;
}

function formatDateRange(entry: WorkHistoryRecord) {
  const startLabel = formatMonthYear(entry.start_date);
  const endLabel = entry.is_current
    ? "Present"
    : entry.end_date
      ? formatMonthYear(entry.end_date)
      : "Present";
  return `${startLabel} – ${endLabel}`;
}

function formatMonthYear(value?: string | null) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function WorkHistoryForm({
  mode,
  initialValues,
  action,
  onCancel,
  onSuccess,
}: WorkHistoryFormProps) {
  const [state, setState] = useState(initialActionState);
  const [isPending, startTransition] = useTransition();
  const [isCurrent, setIsCurrent] = useState(Boolean(initialValues?.is_current));
  const [bullets, setBullets] = useState<string[]>(
    initialValues?.bullets?.length ? [...initialValues.bullets] : [""]
  );

  useEffect(() => {
    if (state.status === "success") {
      onSuccess?.();
    }
  }, [state.status, onSuccess]);

  useEffect(() => {
    setIsCurrent(Boolean(initialValues?.is_current));
    setBullets(initialValues?.bullets?.length ? [...initialValues.bullets] : [""]);
  }, [initialValues?.is_current, initialValues?.bullets]);

  return (
    <form
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

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Job title"
          htmlFor={`${mode}-job_title`}
          error={state.fieldErrors?.job_title}
        >
          <input
            id={`${mode}-job_title`}
            name="job_title"
            required
            defaultValue={initialValues?.job_title ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          />
        </FormField>
        <FormField
          label="Company"
          htmlFor={`${mode}-company`}
          error={state.fieldErrors?.company}
        >
          <input
            id={`${mode}-company`}
            name="company"
            required
            defaultValue={initialValues?.company ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          />
        </FormField>
        <FormField
          label="Location"
          htmlFor={`${mode}-location`}
          error={state.fieldErrors?.location}
        >
          <input
            id={`${mode}-location`}
            name="location"
            defaultValue={initialValues?.location ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          />
        </FormField>
        <FormField
          label="Start month"
          htmlFor={`${mode}-start_month`}
          error={state.fieldErrors?.start_month}
        >
          <input
            id={`${mode}-start_month`}
            name="start_month"
            type="month"
            required
            defaultValue={toMonthInputValue(initialValues?.start_date)}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          />
        </FormField>
        <FormField
          label="End month"
          htmlFor={`${mode}-end_month`}
          error={state.fieldErrors?.end_month}
        >
          <input
            id={`${mode}-end_month`}
            name="end_month"
            type="month"
            disabled={isCurrent}
            defaultValue={toMonthInputValue(initialValues?.end_date)}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm disabled:bg-slate-100"
          />
        </FormField>
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--muted))]">
          <input
            id={`${mode}-is_current`}
            type="checkbox"
            name="is_current"
            checked={isCurrent}
            onChange={(event) => setIsCurrent(event.target.checked)}
          />
          <label htmlFor={`${mode}-is_current`}>Current role</label>
        </div>
      </div>

      <FormField
        label="Summary"
        htmlFor={`${mode}-summary`}
        error={state.fieldErrors?.summary}
        hint="Short overview of your role (1–2 lines)."
      >
        <textarea
          id={`${mode}-summary`}
          name="summary"
          rows={2}
          defaultValue={initialValues?.summary ?? ""}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
        />
      </FormField>

      <FormField
        label="Highlights (up to 6)"
        htmlFor={`${mode}-bullets-0`}
        error={state.fieldErrors?.bullets}
      >
        <div className="space-y-3">
          {bullets.map((bullet, index) => (
            <div key={`${mode}-bullet-${index}`} className="flex items-center gap-2">
              <input
                id={`${mode}-bullets-${index}`}
                name="bullets"
                value={bullet}
                onChange={(event) => {
                  const next = [...bullets];
                  next[index] = event.target.value;
                  setBullets(next);
                }}
                placeholder={`Bullet ${index + 1}`}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
              />
              {bullets.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setBullets((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {bullets.length < 6 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setBullets((prev) => [...prev, ""])}
            >
              Add bullet
            </Button>
          ) : null}
        </div>
      </FormField>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          label={mode === "create" ? "Add role" : "Save changes"}
          pending={isPending}
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

function DeleteWorkHistoryForm({
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
        if (!window.confirm("Delete this role from work history?")) {
          return;
        }
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

export default function WorkHistorySection({
  entries,
  createAction,
  updateAction,
  deleteAction,
}: WorkHistorySectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedBullets, setExpandedBullets] = useState<Record<string, boolean>>(
    {}
  );

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.is_current !== b.is_current) {
        return a.is_current ? -1 : 1;
      }
      const aDate = a.end_date ?? a.start_date;
      const bDate = b.end_date ?? b.start_date;
      return bDate.localeCompare(aDate);
    });
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Work History</h3>
          <p className="text-sm text-[rgb(var(--muted))]">
            Capture roles so exports can show consistent experience.
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
          {isAdding ? "Close" : "Add role"}
        </Button>
      </div>

      {isAdding ? (
        <WorkHistoryForm
          mode="create"
          action={createAction}
          onCancel={() => setIsAdding(false)}
          onSuccess={() => setIsAdding(false)}
        />
      ) : null}

      {sortedEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-[rgb(var(--muted))]">
          No work history yet. Add a role to populate exports.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedEntries.map((entry) => {
            const bullets = Array.isArray(entry.bullets) ? entry.bullets : [];
            const showAll = expandedBullets[entry.id];
            const visibleBullets = showAll ? bullets : bullets.slice(0, 4);
            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-black/10 bg-white/70 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-[rgb(var(--ink))]">
                      {entry.job_title} — {entry.company}
                    </p>
                    {entry.location ? (
                      <p className="text-xs text-[rgb(var(--muted))]">
                        {entry.location}
                      </p>
                    ) : null}
                    <p className="text-xs text-[rgb(var(--muted))]">
                      {formatDateRange(entry)}
                    </p>
                    {entry.summary ? (
                      <p className="text-sm text-[rgb(var(--muted))]">
                        {entry.summary}
                      </p>
                    ) : null}
                    {bullets.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[rgb(var(--muted))]">
                        {visibleBullets.map((bullet, index) => (
                          <li key={`${entry.id}-bullet-${index}`}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                    {bullets.length > 4 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBullets((prev) => ({
                            ...prev,
                            [entry.id]: !prev[entry.id],
                          }))
                        }
                        className="text-xs font-semibold text-[rgb(var(--accent))] hover:underline"
                      >
                        {showAll ? "Hide bullets" : "View all bullets"}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingId((prev) =>
                          prev === entry.id ? null : entry.id
                        );
                        setIsAdding(false);
                      }}
                    >
                      {editingId === entry.id ? "Close" : "Edit"}
                    </Button>
                    <DeleteWorkHistoryForm
                      id={entry.id}
                      deleteAction={deleteAction}
                    />
                  </div>
                </div>

                {editingId === entry.id ? (
                  <div className="mt-4">
                    <WorkHistoryForm
                      mode="edit"
                      action={updateAction}
                      initialValues={entry}
                      onCancel={() => setEditingId(null)}
                      onSuccess={() => setEditingId(null)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
