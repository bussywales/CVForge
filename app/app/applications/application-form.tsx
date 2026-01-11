"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { ActionState } from "@/lib/actions/types";
import { initialActionState } from "@/lib/actions/types";
import type { ApplicationRecord } from "@/lib/data/applications";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

type ApplicationFormProps = {
  mode: "create" | "edit";
  initialValues?: Partial<ApplicationRecord>;
  action: (formData: FormData) => Promise<ActionState>;
};

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </Button>
  );
}

export default function ApplicationForm({
  mode,
  initialValues,
  action,
}: ApplicationFormProps) {
  const [state, setState] = useState(initialActionState);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (mode === "create" && state.status === "success" && state.id) {
      router.push(`/app/applications/${state.id}?created=1`);
      router.refresh();
    }
  }, [mode, state.status, state.id, router]);

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
      className="space-y-6"
    >
      {state.message ? (
        <div
          className={`rounded-2xl border p-4 text-sm ${
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
          htmlFor="job_title"
          error={state.fieldErrors?.job_title}
        >
          <input
            id="job_title"
            name="job_title"
            required
            defaultValue={initialValues?.job_title ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          />
        </FormField>
        <FormField
          label="Company"
          htmlFor="company"
          error={state.fieldErrors?.company}
        >
          <input
            id="company"
            name="company"
            defaultValue={initialValues?.company ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          />
        </FormField>
      </div>

      <FormField
        label="Status"
        htmlFor="status"
        error={state.fieldErrors?.status}
      >
        <select
          id="status"
          name="status"
          defaultValue={initialValues?.status ?? "draft"}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Job description"
        htmlFor="job_description"
        error={state.fieldErrors?.job_description}
        hint="Paste the full JD here (minimum 200 characters)."
      >
        <textarea
          id="job_description"
          name="job_description"
          rows={8}
          required
          defaultValue={initialValues?.job_description ?? ""}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

      <SubmitButton
        label={mode === "create" ? "Create application" : "Save changes"}
        pending={isPending}
      />
    </form>
  );
}
