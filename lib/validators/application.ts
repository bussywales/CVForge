import { z } from "zod";

export const applicationStatusSchema = z.enum([
  "draft",
  "applied",
  "interview",
  "offer",
  "rejected",
]);

const hasSchemeRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

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
    .min(200, "Job description must be at least 200 characters.")
    .max(5000, "Job description must be 5000 characters or fewer."),
  job_url: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => normalizeJobUrl(value ?? ""))
    .refine((value) => value === "" || isValidHttpUrl(value), {
      message: "Job advert link must be a valid URL.",
    })
    .transform((value) => (value === "" ? null : value)),
  status: applicationStatusSchema,
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
