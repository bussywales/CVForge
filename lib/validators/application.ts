import { z } from "zod";
import { applicationStatusValues } from "@/lib/application-status";

export const applicationStatusSchema = z.enum(applicationStatusValues);

const hasSchemeRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const httpSchemeRegex = /^https?:/i;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHttpUrl(value: string) {
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

function validateHttpUrl(value: string, ctx: z.RefinementCtx) {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  if (!hasSchemeRegex.test(trimmed)) {
    const normalized = normalizeHttpUrl(trimmed);
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
      validateHttpUrl(value ?? "", ctx);
    })
    .transform((value) => normalizeHttpUrl(value ?? ""))
    .transform((value) => (value === "" ? null : value)),
  contact_name: z.string().trim().max(120).optional().or(z.literal("")),
  contact_role: z.string().trim().max(120).optional().or(z.literal("")),
  contact_email: z
    .string()
    .trim()
    .max(160, "Email must be 160 characters or fewer.")
    .optional()
    .or(z.literal(""))
    .superRefine((value, ctx) => {
      const safeValue = (value ?? "").trim();
      if (!safeValue) {
        return;
      }
      if (!emailRegex.test(safeValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid email address.",
        });
      }
    })
    .transform((value) => {
      const trimmed = (value ?? "").trim();
      return trimmed === "" ? null : trimmed;
    }),
  contact_linkedin: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .superRefine((value, ctx) => {
      validateHttpUrl(value ?? "", ctx);
    })
    .transform((value) => normalizeHttpUrl(value ?? ""))
    .transform((value) => (value === "" ? null : value)),
  status: applicationStatusSchema,
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
