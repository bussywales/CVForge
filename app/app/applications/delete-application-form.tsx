"use client";

import { useState, useTransition } from "react";
import Button from "@/components/Button";
import type { ActionState } from "@/lib/actions/types";
import { initialActionState } from "@/lib/actions/types";

function DeleteButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? "Deleting..." : label}
    </Button>
  );
}

type DeleteApplicationFormProps = {
  id: string;
  deleteAction: (formData: FormData) => Promise<ActionState>;
  label?: string;
};

export default function DeleteApplicationForm({
  id,
  deleteAction,
  label = "Delete",
}: DeleteApplicationFormProps) {
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
      <DeleteButton label={label} pending={isPending} />
      {state.status === "error" ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </form>
  );
}
