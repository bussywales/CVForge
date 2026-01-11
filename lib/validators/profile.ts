import { z } from "zod";

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters."),
  headline: z
    .string()
    .trim()
    .max(120, "Headline must be 120 characters or fewer.")
    .optional()
    .or(z.literal("")),
  location: z
    .string()
    .trim()
    .max(120, "Location must be 120 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export type ProfileInput = z.infer<typeof profileSchema>;
