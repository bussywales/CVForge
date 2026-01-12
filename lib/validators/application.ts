import { z } from "zod";

export const applicationStatusSchema = z.enum([
  "draft",
  "applied",
  "interview",
  "offer",
  "rejected",
]);

const hasSchemeRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const httpSchemeRegex = /^https?:/i;

function normalizeJobUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (!hasSchemeRegex.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateJobUrl(value: string, ctx: z.RefinementCtx) {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  if (!hasSchemeRegex.test(trimmed)) {
    const normalized = normalizeJobUrl(trimmed);
    if (isValidHttpUrl(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add https:// (we'll accept http:// too).",
      });
      return;
    }
    if (!isValidHttpUrl(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid web link (e.g., https://example.com).",
      });
    }
    return;
  }

  if (!httpSchemeRegex.test(trimmed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only http:// or https:// links are allowed.",
    });
    return;
  }

  if (!isValidHttpUrl(trimmed)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid web link (e.g., https://example.com).",
    });
  }
}

export const applicationSchema = z.object({
  job_title: z
    .string()
    .trim()
    .min(2, "Job title must be at least 2 characters.")
    .max(120, "Job title must be 120 characters or fewer."),
  company: z
    .string()
    .trim()
    .max(120, "Company must be 120 characters or fewer.")
    .optional()
    .or(z.literal("")),
  job_description: z
    .string()
    .trim()
    .min(200, "Job description must be at least 200 characters."),
  job_url: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .superRefine((value, ctx) => {
      validateJobUrl(value ?? "", ctx);
    })
    .transform((value) => normalizeJobUrl(value ?? ""))
    .transform((value) => (value === "" ? null : value)),
  status: applicationStatusSchema,
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
