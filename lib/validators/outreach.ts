import { z } from "zod";
import { outreachChannelValues, outreachStageValues } from "@/lib/outreach-templates";

export const outreachStageSchema = z.enum(outreachStageValues);
export const outreachChannelSchema = z.enum(outreachChannelValues);

export const outreachLogSchema = z.object({
  application_id: z.string().uuid(),
  step_id: z.string().min(1),
  channel: outreachChannelSchema,
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  body: z.string().trim().max(2000).optional().or(z.literal("")),
});
