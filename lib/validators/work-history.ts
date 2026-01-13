import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateSchema = z.string().refine((value) => dateRegex.test(value), {
  message: "Enter a valid date.",
});

const optionalDateSchema = z
  .string()
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || value === "" || dateRegex.test(value), {
    message: "Enter a valid date.",
  });

export const workHistorySchema = z
  .object({
    job_title: z
      .string()
      .trim()
      .min(2, "Job title must be at least 2 characters.")
      .max(120, "Job title must be 120 characters or fewer."),
    company: z
      .string()
      .trim()
      .min(2, "Company must be at least 2 characters.")
      .max(120, "Company must be 120 characters or fewer."),
    location: z.string().trim().max(80).optional().or(z.literal("")),
    start_date: dateSchema,
    end_date: optionalDateSchema,
    is_current: z.boolean(),
    summary: z.string().trim().max(300).optional().or(z.literal("")),
    bullets: z
      .array(z.string().trim().min(3).max(200))
      .max(6, "Add up to 6 bullet points."),
  })
  .superRefine((data, ctx) => {
    if (data.is_current && data.end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "End date must be empty when role is marked current.",
      });
      return;
    }

    if (data.end_date) {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        if (end.getTime() < start.getTime()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["end_date"],
            message: "End date must be after start date.",
          });
        }
      }
    }
  });

export type WorkHistoryInput = z.infer<typeof workHistorySchema>;
