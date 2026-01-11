"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import type { AutopackRecord } from "@/lib/data/autopacks";

type AutopackEditorFormProps = {
  autopack: AutopackRecord;
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message?: string;
};

export default function AutopackEditorForm({
  autopack,
}: AutopackEditorFormProps) {
  const router = useRouter();
  const [cvText, setCvText] = useState(autopack.cv_text ?? "");
  const [coverLetter, setCoverLetter] = useState(autopack.cover_letter ?? "");
  const [answersJson, setAnswersJson] = useState(() => {
    try {
      return JSON.stringify(autopack.answers_json ?? {}, null, 2);
    } catch {
      return "{}";
    }
  });
  const [state, setState] = useState<SaveState>({ status: "idle" });

  const handleSave = async () => {
    setState({ status: "saving" });

    let parsedAnswers: unknown;
    try {
      parsedAnswers = JSON.parse(answersJson);
    } catch (error) {
      setState({
        status: "error",
        message: "Answers JSON must be valid JSON.",
      });
      return;
    }

    try {
      const response = await fetch(`/api/autopack/${autopack.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cv_text: cvText,
          cover_letter: coverLetter,
          answers_json: parsedAnswers,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setState({
          status: "error",
          message: payload?.error ?? "Unable to save changes.",
        });
        return;
      }

      setState({ status: "success", message: "Autopack saved." });
      router.refresh();
    } catch (error) {
      setState({ status: "error", message: "Unable to save changes." });
    }
  };

  return (
    <div className="space-y-6">
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

      <FormField label="CV text" htmlFor="cv_text">
        <textarea
          id="cv_text"
          rows={16}
          value={cvText}
          onChange={(event) => setCvText(event.target.value)}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

      <FormField label="Cover letter" htmlFor="cover_letter">
        <textarea
          id="cover_letter"
          rows={12}
          value={coverLetter}
          onChange={(event) => setCoverLetter(event.target.value)}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

      <FormField
        label="STAR answers (JSON)"
        htmlFor="answers_json"
        hint="Edit the JSON to refine questions and STAR answers."
      >
        <textarea
          id="answers_json"
          rows={14}
          value={answersJson}
          onChange={(event) => setAnswersJson(event.target.value)}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-mono outline-none transition focus:border-[rgb(var(--accent))]"
        />
      </FormField>

      <Button type="button" onClick={handleSave} disabled={state.status === "saving"}>
        {state.status === "saving" ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}
