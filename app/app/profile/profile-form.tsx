"use client";

import { useState, useTransition } from "react";
import FormField from "@/components/FormField";
import Button from "@/components/Button";
import type { ActionState } from "@/lib/actions/types";
import { initialActionState } from "@/lib/actions/types";
import type { ProfileRecord } from "@/lib/data/profile";

const completionHints = [
  "Add a headline to clarify your focus.",
  "Add a location to help recruiters gauge proximity.",
  "Add at least 3 achievements to show real impact.",
];

type ProfileFormProps = {
  profile: ProfileRecord;
  achievementCount: number;
  completeness: number;
  updateAction: (formData: FormData) => Promise<ActionState>;
};

export default function ProfileForm({
  profile,
  achievementCount,
  completeness,
  updateAction,
}: ProfileFormProps) {
  const [state, setState] = useState(initialActionState);
  const [isPending, startTransition] = useTransition();

  const hintMessages = completionHints.filter((hint, index) => {
    if (index === 0 && profile.headline) return false;
    if (index === 1 && profile.location) return false;
    if (index === 2 && achievementCount >= 3) return false;
    return true;
  });

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

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Full name"
          htmlFor="full_name"
          error={state.fieldErrors?.full_name}
        >
          <input
            id="full_name"
            name="full_name"
            required
            defaultValue={profile.full_name ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          />
        </FormField>
        <FormField
          label="Headline"
          htmlFor="headline"
          error={state.fieldErrors?.headline}
          hint="Short summary of your expertise."
        >
          <input
            id="headline"
            name="headline"
            defaultValue={profile.headline ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          />
        </FormField>
        <FormField
          label="Location"
          htmlFor="location"
          error={state.fieldErrors?.location}
        >
          <input
            id="location"
            name="location"
            defaultValue={profile.location ?? ""}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
          />
        </FormField>
        <div className="rounded-2xl border border-dashed border-black/15 bg-white/70 p-4 text-sm text-[rgb(var(--muted))]">
          <p className="font-medium text-[rgb(var(--ink))]">
            Profile completeness: {completeness}%
          </p>
          <p className="mt-2">
            {achievementCount >= 3
              ? "You have enough achievements to show impact."
              : `Add ${3 - achievementCount} more achievement${
                  3 - achievementCount === 1 ? "" : "s"
                } for full strength.`}
          </p>
          {hintMessages.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {hintMessages.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
