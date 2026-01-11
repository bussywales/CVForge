import { z } from "zod";

export const generateAutopackSchema = z.object({
  applicationId: z.string().uuid(),
});

export const autopackUpdateSchema = z.object({
  cv_text: z
    .string()
    .trim()
    .min(50, "CV text must be at least 50 characters.")
    .max(20000, "CV text must be 20000 characters or fewer."),
  cover_letter: z
    .string()
    .trim()
    .min(50, "Cover letter must be at least 50 characters.")
    .max(8000, "Cover letter must be 8000 characters or fewer."),
  answers_json: z.union([
    z.string().min(2),
    z.record(z.string(), z.unknown()),
    z.array(z.unknown()),
  ]),
});

export const autopackAiOutputSchema = z.object({
  cv_text: z.string().min(1),
  cover_letter: z.string().min(1),
  answers_json: z.array(
    z.object({
      requirement: z.string().min(1),
      question: z.string().min(1),
      answer: z.string().min(1),
    })
  ),
  change_log: z.array(z.string().min(1)),
  assumptions: z.array(z.string().min(1)).optional(),
});

export type AutopackAiOutput = z.infer<typeof autopackAiOutputSchema>;
