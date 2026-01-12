import { z } from "zod";
import { applicationStatusValues } from "@/lib/application-status";

export const trackingStatusSchema = z.enum(applicationStatusValues);

export const applicationTrackingSchema = z.object({
  id: z.string().uuid(),
  status: trackingStatusSchema,
  applied_at: z.string().optional().or(z.literal("")),
  next_followup_at: z.string().optional().or(z.literal("")),
  contact_name: z.string().trim().max(120).optional().or(z.literal("")),
  contact_email: z.string().trim().max(160).optional().or(z.literal("")),
  company_name: z.string().trim().max(120).optional().or(z.literal("")),
  source: z.string().trim().max(120).optional().or(z.literal("")),
});

export const activityTypeSchema = z.enum([
  "note",
  "applied",
  "followup",
  "call",
  "interview",
  "rejection",
  "offer",
]);

export const activityChannelSchema = z.enum([
  "email",
  "phone",
  "portal",
  "linkedin",
  "in_person",
]);

export const applicationActivitySchema = z.object({
  application_id: z.string().uuid(),
  type: activityTypeSchema,
  channel: activityChannelSchema.optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  body: z.string().trim().max(2000).optional().or(z.literal("")),
  occurred_at: z.string().optional().or(z.literal("")),
});
