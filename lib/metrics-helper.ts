type MetricTemplateInput = {
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
};

export type MetricTemplate = {
  id: string;
  label: string;
  inputs: MetricTemplateInput[];
  format: (values: Record<string, string>) => string;
};

export const metricTemplates: MetricTemplate[] = [
  {
    id: "percent-improvement",
    label: "Percentage improvement",
    inputs: [
      { id: "metric", label: "Metric", placeholder: "incident resolution time" },
      { id: "percent", label: "% Improvement", placeholder: "25" },
      { id: "period", label: "Period", placeholder: "6 months", required: false },
    ],
    format: (values) => {
      const period = values.period ? ` over ${values.period}` : "";
      return `Improved ${values.metric} by ${values.percent}%${period}.`;
    },
  },
  {
    id: "time-saved",
    label: "Time saved",
    inputs: [
      { id: "time", label: "Time saved", placeholder: "120" },
      { id: "unit", label: "Unit", placeholder: "hours" },
      { id: "period", label: "Period", placeholder: "month" },
      { id: "activity", label: "Activity", placeholder: "streamlining onboarding", required: false },
    ],
    format: (values) => {
      const activity = values.activity ? ` by ${values.activity}` : "";
      return `Saved ${values.time} ${values.unit} per ${values.period}${activity}.`;
    },
  },
  {
    id: "volume-handled",
    label: "Volume handled",
    inputs: [
      { id: "volume", label: "Volume", placeholder: "350" },
      { id: "unit", label: "Unit", placeholder: "tickets" },
      { id: "period", label: "Period", placeholder: "week" },
      { id: "quality", label: "Quality note", placeholder: "while meeting SLAs", required: false },
    ],
    format: (values) => {
      const quality = values.quality ? ` ${values.quality}` : "";
      return `Handled ${values.volume} ${values.unit} per ${values.period}${quality}.`;
    },
  },
  {
    id: "sla-improvement",
    label: "SLA improvement",
    inputs: [
      { id: "from", label: "From %", placeholder: "82" },
      { id: "to", label: "To %", placeholder: "96" },
      { id: "period", label: "Period", placeholder: "quarter" },
    ],
    format: (values) => {
      return `Improved SLA compliance from ${values.from}% to ${values.to}% over ${values.period}.`;
    },
  },
  {
    id: "cost-reduction",
    label: "Cost reduction",
    inputs: [
      { id: "amount", label: "Amount", placeholder: "45k" },
      { id: "period", label: "Period", placeholder: "year" },
      { id: "area", label: "Area", placeholder: "infrastructure", required: false },
    ],
    format: (values) => {
      const area = values.area ? ` in ${values.area}` : "";
      return `Reduced costs by £${values.amount} per ${values.period}${area}.`;
    },
  },
];

export function buildMetricSnippet(
  templateId: string,
  rawValues: Record<string, string>
) {
  const template = metricTemplates.find((entry) => entry.id === templateId);
  if (!template) {
    return "";
  }

  const values: Record<string, string> = {};
  template.inputs.forEach((input) => {
    values[input.id] = (rawValues[input.id] ?? "").trim();
  });

  const missingRequired = template.inputs.some(
    (input) => input.required !== false && !values[input.id]
  );
  if (missingRequired) {
    return "";
  }

  const output = template.format(values);
  return normaliseMetric(output);
}

export function isMetricWithinLimit(value: string, limit = 120) {
  return value.trim().length > 0 && value.trim().length <= limit;
}

function normaliseMetric(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+\.$/, ".")
    .trim();
}
