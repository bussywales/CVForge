import { z } from "zod";

export const applicationStatusSchema = z.enum([
  "draft",
  "applied",
  "interview",
  "offer",
  "rejected",
]);

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
  status: applicationStatusSchema,
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
