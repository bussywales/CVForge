"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { ActionState } from "@/lib/actions/types";
import { initialActionState } from "@/lib/actions/types";
import type { ApplicationRecord } from "@/lib/data/applications";
import { applicationStatusOptions } from "@/lib/application-status";

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
  const [jobDescription, setJobDescription] = useState(
    initialValues?.job_description ?? ""
  );
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
        label="Job advert link (optional)"
        htmlFor="job_url"
        error={state.fieldErrors?.job_url}
        hint="Paste the advert URL (Indeed, LinkedIn, company site...)."
      >
        <input
          id="job_url"
          name="job_url"
          onBlur={(event) => {
            const value = event.currentTarget.value.trim();
            if (!value) {
              return;
            }
            if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
              event.currentTarget.value = `https://${value}`;
            }
          }}
          defaultValue={initialValues?.job_url ?? ""}
          placeholder="https://"
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

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
          {applicationStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              Contact (optional)
            </p>
            <p className="text-xs text-[rgb(var(--muted))]">
              Used for outreach follow-ups. CVForge never sends emails automatically.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField
            label="Contact name"
            htmlFor="contact_name"
            error={state.fieldErrors?.contact_name}
          >
            <input
              id="contact_name"
              name="contact_name"
              defaultValue={initialValues?.contact_name ?? ""}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
            />
          </FormField>
          <FormField
            label="Contact role"
            htmlFor="contact_role"
            error={state.fieldErrors?.contact_role}
          >
            <input
              id="contact_role"
              name="contact_role"
              defaultValue={initialValues?.contact_role ?? ""}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
            />
          </FormField>
          <FormField
            label="Contact email"
            htmlFor="contact_email"
            error={state.fieldErrors?.contact_email}
          >
            <input
              type="email"
              id="contact_email"
              name="contact_email"
              defaultValue={initialValues?.contact_email ?? ""}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
            />
          </FormField>
          <FormField
            label="Contact LinkedIn"
            htmlFor="contact_linkedin"
            error={state.fieldErrors?.contact_linkedin}
            hint="Paste a profile URL (https://linkedin.com/in/...)."
          >
            <input
              type="url"
              id="contact_linkedin"
              name="contact_linkedin"
              defaultValue={initialValues?.contact_linkedin ?? ""}
              onBlur={(event) => {
                const value = event.currentTarget.value.trim();
                if (!value) {
                  return;
                }
                if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
                  event.currentTarget.value = `https://${value}`;
                }
              }}
              placeholder="https://"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
            />
          </FormField>
        </div>
      </div>

      <FormField
        label="Job description"
        htmlFor="job_description"
        error={state.fieldErrors?.job_description}
      >
        <textarea
          id="job_description"
          name="job_description"
          rows={8}
          required
          defaultValue={initialValues?.job_description ?? ""}
          onChange={(event) => setJobDescription(event.currentTarget.value)}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          {(() => {
            const length = jobDescription.length;
            if (length > 20000) {
              return (
                <span className="text-amber-600">
                  Long adverts may be truncated for generation. Consider pasting key sections only.
                </span>
              );
            }
            if (length > 12000) {
              return (
                <span className="text-amber-600">
                  Long adverts may be truncated for generation.
                </span>
              );
            }
            return (
              <span className="text-[rgb(var(--muted))]">
                Paste the full JD here (minimum 200 characters).
              </span>
            );
          })()}
          <span className="text-[rgb(var(--muted))]">
            {jobDescription.length.toLocaleString("en-GB")} characters
          </span>
        </div>
      </FormField>

      <SubmitButton
        label={mode === "create" ? "Create application" : "Save changes"}
        pending={isPending}
      />
    </form>
  );
}
