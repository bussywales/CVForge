"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import {
  buildMetricSnippet,
  isMetricWithinLimit,
  metricTemplates,
} from "@/lib/metrics-helper";

const emptyValues: Record<string, string> = {};

type MetricsHelperModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (value: string) => void;
  initialTemplateId?: string;
};

export default function MetricsHelperModal({
  isOpen,
  onClose,
  onApply,
  initialTemplateId,
}: MetricsHelperModalProps) {
  const [templateId, setTemplateId] = useState(
    metricTemplates[0]?.id ?? ""
  );
  const [values, setValues] = useState<Record<string, string>>(emptyValues);

  useEffect(() => {
    if (isOpen) {
      const initial =
        metricTemplates.find((entry) => entry.id === initialTemplateId)?.id ??
        metricTemplates[0]?.id ??
        "";
      setTemplateId(initial);
      setValues(emptyValues);
    }
  }, [isOpen, initialTemplateId]);

  const template = useMemo(
    () => metricTemplates.find((entry) => entry.id === templateId),
    [templateId]
  );

  const preview = useMemo(
    () => (template ? buildMetricSnippet(template.id, values) : ""),
    [template, values]
  );

  const length = preview.length;
  const overLimit = length > 120;
  const counterClass =
    length > 120
      ? "text-red-600"
      : length >= 100
        ? "text-amber-600"
        : "text-[rgb(var(--muted))]";

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40"
        role="presentation"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl rounded-3xl border border-black/10 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-[rgb(var(--ink))]">
              Metrics helper
            </p>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              Build a crisp metric statement under 120 characters.
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

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-[rgb(var(--ink))]">
            Metric template
            <select
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value);
                setValues(emptyValues);
              }}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              {metricTemplates.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          {template ? (
            <div className="grid gap-3 md:grid-cols-2">
              {template.inputs.map((input) => (
                <label
                  key={input.id}
                  className="block text-xs font-medium text-[rgb(var(--muted))]"
                >
                  {input.label}
                  <input
                    value={values[input.id] ?? ""}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [input.id]: event.target.value,
                      }))
                    }
                    placeholder={input.placeholder}
                    className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-[rgb(var(--ink))]"
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Preview
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--ink))]">
              {preview || "Fill in the fields to generate a metric snippet."}
            </p>
            <div className={`mt-2 text-right text-xs ${counterClass}`}>
              {length} / 120
            </div>
          </div>

          {overLimit ? (
            <p className="text-xs text-red-600">
              Keep the metric under 120 characters.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onApply(preview)}
              disabled={!isMetricWithinLimit(preview)}
            >
              Use metric
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
