import { z } from "zod";

const optionalLongText = z.string().trim().max(1000).optional().or(z.literal(""));

export const achievementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title must be 120 characters or fewer."),
  situation: optionalLongText,
  task: optionalLongText,
  action: z
    .string()
    .trim()
    .min(20, "Action must be at least 20 characters.")
    .max(1000, "Action must be 1000 characters or fewer."),
  result: z
    .string()
    .trim()
    .min(20, "Result must be at least 20 characters.")
    .max(1000, "Result must be 1000 characters or fewer."),
  metrics: z
    .string()
    .trim()
    .max(120, "Metrics must be 120 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export type AchievementInput = z.infer<typeof achievementSchema>;
