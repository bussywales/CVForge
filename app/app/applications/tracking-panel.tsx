"use client";

import { useState, useTransition } from "react";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { ActionState } from "@/lib/actions/types";
import { initialActionState } from "@/lib/actions/types";
import type { ApplicationRecord } from "@/lib/data/applications";
import { applicationStatusOptions } from "@/lib/application-status";
import { toDateInputValue } from "@/lib/tracking-utils";

type TrackingPanelProps = {
  application: ApplicationRecord;
  updateAction: (formData: FormData) => Promise<ActionState>;
};

export default function TrackingPanel({
  application,
  updateAction,
}: TrackingPanelProps) {
  const [state, setState] = useState(initialActionState);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await updateAction(formData);
          setState(result);
        });
      }}
      className="space-y-4"
    >
      <input type="hidden" name="id" value={application.id} />

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

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Status" htmlFor="tracking-status" error={state.fieldErrors?.status}>
          <select
            id="tracking-status"
            name="status"
            defaultValue={application.status ?? "draft"}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          >
            {applicationStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Applied date" htmlFor="applied_at" error={state.fieldErrors?.applied_at}>
          <input
            type="date"
            id="applied_at"
            name="applied_at"
            defaultValue={toDateInputValue(application.applied_at)}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          />
        </FormField>

        <FormField
          label="Next follow-up"
          htmlFor="next_followup_at"
          error={state.fieldErrors?.next_followup_at}
        >
          <input
            type="date"
            id="next_followup_at"
            name="next_followup_at"
            defaultValue={toDateInputValue(application.next_followup_at)}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          />
        </FormField>

        <FormField
          label="Contact name"
          htmlFor="contact_name"
          error={state.fieldErrors?.contact_name}
        >
          <input
            id="contact_name"
            name="contact_name"
            defaultValue={application.contact_name ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
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
            defaultValue={application.contact_email ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          />
        </FormField>

        <FormField
          label="Company name"
          htmlFor="company_name"
          error={state.fieldErrors?.company_name}
        >
          <input
            id="company_name"
            name="company_name"
            defaultValue={application.company_name ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          />
        </FormField>

        <FormField label="Source" htmlFor="source" error={state.fieldErrors?.source}>
          <input
            id="source"
            name="source"
            placeholder="LinkedIn, NHS Jobs, Indeed..."
            defaultValue={application.source ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save tracking"}
        </Button>
      </div>
    </form>
  );
}
