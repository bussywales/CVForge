"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { ActionState } from "@/lib/actions/types";
import { initialActionState } from "@/lib/actions/types";
import type { ApplicationActivityRecord } from "@/lib/data/application-activities";
import { formatDateTimeUk } from "@/lib/tracking-utils";

const activityTypeOptions = [
  { value: "note", label: "Note" },
  { value: "applied", label: "Applied" },
  { value: "followup", label: "Follow-up" },
  { value: "call", label: "Call" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejection", label: "Rejection" },
];

const activityChannelOptions = [
  { value: "", label: "Select" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "portal", label: "Portal" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "in_person", label: "In person" },
];

type ActivityPanelProps = {
  applicationId: string;
  activities: ApplicationActivityRecord[];
  createAction: (formData: FormData) => Promise<ActionState>;
  deleteAction: (formData: FormData) => Promise<ActionState>;
  logAppliedAction: (formData: FormData) => Promise<ActionState>;
  logFollowupAction: (formData: FormData) => Promise<ActionState>;
};

export default function ActivityPanel({
  applicationId,
  activities,
  createAction,
  deleteAction,
  logAppliedAction,
  logFollowupAction,
}: ActivityPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState(initialActionState);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const formattedActivities = useMemo(
    () =>
      activities.map((activity) => ({
        ...activity,
        occurredLabel: formatDateTimeUk(activity.occurred_at),
      })),
    [activities]
  );

  const submitQuickAction = async (
    action: (formData: FormData) => Promise<ActionState>,
    successMessage: string
  ) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("application_id", applicationId);
      const result = await action(formData);
      if (result.status === "success") {
        setToast(successMessage);
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => submitQuickAction(logAppliedAction, "Logged as applied.")}
            disabled={isPending}
          >
            Log Applied
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => submitQuickAction(logFollowupAction, "Follow-up logged.")}
            disabled={isPending}
          >
            Log Follow-up
          </Button>
        </div>
        <Button type="button" onClick={() => setIsOpen(true)}>
          Add activity
        </Button>
      </div>

      {formattedActivities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm text-[rgb(var(--muted))]">
          No activities yet. Add a note or log your first touchpoint.
        </div>
      ) : (
        <div className="space-y-3">
          {formattedActivities.map((activity) => (
            <div
              key={activity.id}
              className="rounded-2xl border border-black/10 bg-white/70 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {activity.type}
                    {activity.channel ? ` · ${activity.channel}` : ""}
                  </p>
                  <p className="text-xs text-[rgb(var(--muted))]">
                    {activity.occurredLabel}
                  </p>
                  {activity.subject ? (
                    <p className="mt-2 text-sm text-[rgb(var(--ink))]">
                      {activity.subject}
                    </p>
                  ) : null}
                  {activity.body ? (
                    <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                      {activity.body}
                    </p>
                  ) : null}
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    startTransition(async () => {
                      const result = await deleteAction(formData);
                      if (result.status === "success") {
                        setToast("Activity deleted.");
                      } else if (result.message) {
                        setToast(result.message);
                      }
                    });
                  }}
                >
                  <input type="hidden" name="id" value={activity.id} />
                  <input
                    type="hidden"
                    name="application_id"
                    value={applicationId}
                  />
                  <Button type="submit" variant="ghost" disabled={isPending}>
                    Delete
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen ? (
        <ActivityModal
          applicationId={applicationId}
          state={state}
          isPending={isPending}
          onClose={() => {
            setIsOpen(false);
            setState(initialActionState);
          }}
          onSubmit={async (formData) => {
            startTransition(async () => {
              const result = await createAction(formData);
              setState(result);
              if (result.status === "success") {
                setIsOpen(false);
                setToast("Activity logged.");
                setState(initialActionState);
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}

type ActivityModalProps = {
  applicationId: string;
  state: ActionState;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
};

function ActivityModal({
  applicationId,
  state,
  isPending,
  onClose,
  onSubmit,
}: ActivityModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40"
        role="presentation"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-black/10 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-[rgb(var(--ink))]">
              Log activity
            </p>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              Capture touchpoints and keep the timeline accurate.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-sm font-semibold text-[rgb(var(--ink))]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {state.message ? (
          <div
            className={`mt-4 rounded-2xl border p-3 text-sm ${
              state.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            onSubmit(formData);
          }}
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="application_id" value={applicationId} />
          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              label="Type"
              htmlFor="activity-type"
              error={state.fieldErrors?.type}
            >
              <select
                id="activity-type"
                name="type"
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                {activityTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Channel"
              htmlFor="activity-channel"
              error={state.fieldErrors?.channel}
            >
              <select
                id="activity-channel"
                name="channel"
                className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
              >
                {activityChannelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Subject" htmlFor="activity-subject">
            <input
              id="activity-subject"
              name="subject"
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
          </FormField>

          <FormField label="Body" htmlFor="activity-body">
            <textarea
              id="activity-body"
              name="body"
              rows={4}
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
          </FormField>

          <FormField label="Occurred at" htmlFor="activity-occurred">
            <input
              type="datetime-local"
              id="activity-occurred"
              name="occurred_at"
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
          </FormField>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save activity"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
