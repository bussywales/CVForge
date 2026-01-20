"use server";

import { revalidatePath } from "next/cache";
import { getFormString, toNullable } from "@/lib/actions/form";
import type { ActionState } from "@/lib/actions/types";
import {
  createApplication,
  deleteApplication,
  fetchApplication,
  updateApplication,
} from "@/lib/data/applications";
import {
  createApplicationActivity,
  deleteApplicationActivity,
} from "@/lib/data/application-activities";
import { getSupabaseUser } from "@/lib/data/supabase";
import { markApplyChecklist } from "@/lib/apply-checklist";
import { applicationSchema } from "@/lib/validators/application";
import {
  applicationActivitySchema,
  applicationTrackingSchema,
  nextActionSchema,
} from "@/lib/validators/application-tracking";
import { outreachLogSchema } from "@/lib/validators/outreach";
import { getFieldErrors } from "@/lib/validators/utils";
import type { ApplicationStatusValue } from "@/lib/application-status";
import { getNextOutreachStep, getOutreachSteps } from "@/lib/outreach-templates";
import { logMonetisationEvent } from "@/lib/monetisation";

async function logActivationMilestone(
  supabase: any,
  userId: string,
  applicationId: string,
  event:
    | "activation_first_application"
    | "activation_first_outreach"
    | "activation_first_followup"
    | "activation_first_outcome"
) {
  try {
    await logMonetisationEvent(supabase, userId, event, { applicationId });
  } catch (error) {
    console.error(`[activation-milestone:${event}]`, error);
  }
}
export async function createApplicationAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to create an application.",
    };
  }

  const values = {
    job_title: getFormString(formData, "job_title"),
    company: getFormString(formData, "company"),
    job_url: getFormString(formData, "job_url"),
    job_description: getFormString(formData, "job_description"),
    status: getFormString(formData, "status"),
    contact_name: getFormString(formData, "contact_name"),
    contact_role: getFormString(formData, "contact_role"),
    contact_email: getFormString(formData, "contact_email"),
    contact_linkedin: getFormString(formData, "contact_linkedin"),
  };

  const parsed = applicationSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  try {
    const jobText = parsed.data.job_description.trim();
    const created = await createApplication(supabase, user.id, {
      job_title: parsed.data.job_title,
      company: toNullable(parsed.data.company ?? ""),
      company_name: toNullable(parsed.data.company ?? ""),
      job_url: parsed.data.job_url ?? null,
      job_description: parsed.data.job_description,
      job_text: jobText || null,
      job_text_source: jobText ? "pasted" : null,
      status: parsed.data.status,
      contact_name: toNullable(parsed.data.contact_name ?? ""),
      contact_role: toNullable(parsed.data.contact_role ?? ""),
      contact_email: toNullable(parsed.data.contact_email ?? ""),
      contact_linkedin: toNullable(parsed.data.contact_linkedin ?? ""),
    });
    await logActivationMilestone(supabase, user.id, created.id, "activation_first_application");

    revalidatePath("/app/applications");
    revalidatePath("/app/pipeline");

    return {
      status: "success",
      message: "Application created.",
      id: created.id,
    };
  } catch (error) {
    console.error("[createApplicationAction]", error);
    return {
      status: "error",
      message: "Unable to create the application right now.",
    };
  }
}

export async function updateApplicationAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update the application.",
    };
  }

  const id = getFormString(formData, "id");

  if (!id) {
    return { status: "error", message: "Missing application id." };
  }

  const values = {
    job_title: getFormString(formData, "job_title"),
    company: getFormString(formData, "company"),
    job_url: getFormString(formData, "job_url"),
    job_description: getFormString(formData, "job_description"),
    status: getFormString(formData, "status"),
    contact_name: getFormString(formData, "contact_name"),
    contact_role: getFormString(formData, "contact_role"),
    contact_email: getFormString(formData, "contact_email"),
    contact_linkedin: getFormString(formData, "contact_linkedin"),
  };

  const parsed = applicationSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  try {
    const existing = await fetchApplication(supabase, user.id, id);
    const jobText = parsed.data.job_description.trim();
    const shouldOverwriteJobText =
      !existing ||
      existing.job_text_source !== "fetched" ||
      jobText !== (existing.job_description ?? "");

    const jobTextUpdates = shouldOverwriteJobText
      ? {
          job_text: jobText || null,
          job_text_source: jobText ? "pasted" : null,
          job_fetch_status: null,
          job_fetch_error: null,
          job_fetched_at: null,
          job_text_hash: null,
        }
      : {};

    await updateApplication(supabase, user.id, id, {
      job_title: parsed.data.job_title,
      company: toNullable(parsed.data.company ?? ""),
      job_url: parsed.data.job_url ?? null,
      job_description: parsed.data.job_description,
      ...jobTextUpdates,
      status: parsed.data.status,
      contact_name: toNullable(parsed.data.contact_name ?? ""),
      contact_role: toNullable(parsed.data.contact_role ?? ""),
      contact_email: toNullable(parsed.data.contact_email ?? ""),
      contact_linkedin: toNullable(parsed.data.contact_linkedin ?? ""),
    });

    revalidatePath("/app/applications");
    revalidatePath(`/app/applications/${id}`);
    revalidatePath("/app/pipeline");

    return {
      status: "success",
      message: "Application updated.",
    };
  } catch (error) {
    console.error("[updateApplicationAction]", error);
    return {
      status: "error",
      message: "Unable to update the application right now.",
    };
  }
}

export async function deleteApplicationAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to delete the application.",
    };
  }

  const id = getFormString(formData, "id");

  if (!id) {
    return { status: "error", message: "Missing application id." };
  }

  try {
    await deleteApplication(supabase, user.id, id);
    revalidatePath("/app/applications");
    revalidatePath("/app/pipeline");
    return { status: "success", message: "Application deleted." };
  } catch (error) {
    console.error("[deleteApplicationAction]", error);
    return {
      status: "error",
      message: "Unable to delete the application right now.",
    };
  }
}

export async function updateTrackingAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update tracking fields.",
    };
  }

  const values = {
    id: getFormString(formData, "id"),
    status: getFormString(formData, "status"),
    applied_at: getFormString(formData, "applied_at"),
    next_followup_at: getFormString(formData, "next_followup_at"),
    contact_name: getFormString(formData, "contact_name"),
    contact_role: getFormString(formData, "contact_role"),
    contact_email: getFormString(formData, "contact_email"),
    contact_linkedin: getFormString(formData, "contact_linkedin"),
    company_name: getFormString(formData, "company_name"),
    source: getFormString(formData, "source"),
  };

  const parsed = applicationTrackingSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  if (parsed.data.contact_email) {
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      parsed.data.contact_email
    );
    if (!isEmailValid) {
      return {
        status: "error",
        message: "Fix the highlighted fields to continue.",
        fieldErrors: { contact_email: "Enter a valid email address." },
      };
    }
  }

  if (parsed.data.contact_linkedin) {
    const linkedIn = parsed.data.contact_linkedin.trim();
    if (!/^https?:/i.test(linkedIn)) {
      return {
        status: "error",
        message: "Fix the highlighted fields to continue.",
        fieldErrors: { contact_linkedin: "Only http:// or https:// links are allowed." },
      };
    }
    try {
      // eslint-disable-next-line no-new
      new URL(linkedIn);
    } catch {
      return {
        status: "error",
        message: "Fix the highlighted fields to continue.",
        fieldErrors: {
          contact_linkedin: "Enter a valid web link (e.g., https://linkedin.com/in/you).",
        },
      };
    }
  }

  const appliedAt = parseDateInput(parsed.data.applied_at);
  const nextFollowupAt = parseDateInput(parsed.data.next_followup_at);

  if (parsed.data.applied_at && !appliedAt) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: { applied_at: "Enter a valid date." },
    };
  }

  if (parsed.data.next_followup_at && !nextFollowupAt) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: { next_followup_at: "Enter a valid date." },
    };
  }

  const updatePayload = {
    status: parsed.data.status,
    applied_at: appliedAt,
    next_followup_at: nextFollowupAt,
    contact_name: toNullable(parsed.data.contact_name ?? ""),
    contact_role: toNullable(parsed.data.contact_role ?? ""),
    contact_email: toNullable(parsed.data.contact_email ?? ""),
    contact_linkedin: toNullable(parsed.data.contact_linkedin ?? ""),
    company_name: toNullable(parsed.data.company_name ?? ""),
    source: toNullable(parsed.data.source ?? ""),
  };

  if (parsed.data.status === "applied" && !appliedAt) {
    updatePayload.applied_at = new Date().toISOString();
  }

  try {
    await updateApplication(supabase, user.id, parsed.data.id, updatePayload);
    revalidatePath(`/app/applications/${parsed.data.id}`);
    revalidatePath("/app/pipeline");
    return { status: "success", message: "Tracking updated." };
  } catch (error) {
    console.error("[updateTrackingAction]", error);
    return {
      status: "error",
      message: "Unable to update tracking fields right now.",
    };
  }
}

export async function createActivityAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to log an activity.",
    };
  }

  const values = {
    application_id: getFormString(formData, "application_id"),
    type: getFormString(formData, "type"),
    channel: getFormString(formData, "channel"),
    subject: getFormString(formData, "subject"),
    body: getFormString(formData, "body"),
    occurred_at: getFormString(formData, "occurred_at"),
  };

  const parsed = applicationActivitySchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  const occurredAt =
    parseDateInput(parsed.data.occurred_at) ?? new Date().toISOString();

  try {
    await createApplicationActivity(supabase, user.id, {
      application_id: parsed.data.application_id,
      type: parsed.data.type,
      channel: toNullable(parsed.data.channel ?? ""),
      subject: toNullable(parsed.data.subject ?? ""),
      body: toNullable(parsed.data.body ?? ""),
      occurred_at: occurredAt,
    });

    await updateApplication(supabase, user.id, parsed.data.application_id, {
      last_touch_at: occurredAt,
      last_activity_at: occurredAt,
    });

    revalidatePath(`/app/applications/${parsed.data.application_id}`);
    revalidatePath("/app/pipeline");

    return { status: "success", message: "Activity logged." };
  } catch (error) {
    console.error("[createActivityAction]", error);
    return {
      status: "error",
      message: "Unable to log the activity right now.",
    };
  }
}

export async function deleteActivityAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to delete an activity.",
    };
  }

  const id = getFormString(formData, "id");
  const applicationId = getFormString(formData, "application_id");

  if (!id || !applicationId) {
    return { status: "error", message: "Missing activity id." };
  }

  try {
    await deleteApplicationActivity(supabase, user.id, id);
    revalidatePath(`/app/applications/${applicationId}`);
    return { status: "success", message: "Activity deleted." };
  } catch (error) {
    console.error("[deleteActivityAction]", error);
    return {
      status: "error",
      message: "Unable to delete the activity right now.",
    };
  }
}

export async function logAppliedAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to log the application.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  const now = new Date().toISOString();

  try {
    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type: "applied",
      channel: null,
      subject: "Application sent",
      body: null,
      occurred_at: now,
    });

    await updateApplication(supabase, user.id, applicationId, {
      status: "applied",
      applied_at: now,
      last_touch_at: now,
      last_activity_at: now,
    });

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");

    return { status: "success", message: "Application logged as applied." };
  } catch (error) {
    console.error("[logAppliedAction]", error);
    return {
      status: "error",
      message: "Unable to log the application right now.",
    };
  }
}

export async function logFollowupAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to log a follow-up.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  const now = new Date().toISOString();

  try {
    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type: "followup",
      channel: "email",
      subject: "Follow-up sent",
      body: null,
      occurred_at: now,
    });

    await updateApplication(supabase, user.id, applicationId, {
      last_touch_at: now,
      last_activity_at: now,
    });

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");

    await logActivationMilestone(supabase, user.id, applicationId, "activation_first_followup");

    return { status: "success", message: "Follow-up logged." };
  } catch (error) {
    console.error("[logFollowupAction]", error);
    return {
      status: "error",
      message: "Unable to log the follow-up right now.",
    };
  }
}

export async function logFollowupCadenceAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to log a follow-up.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  const channel = getFormString(formData, "channel") ?? "email";
  const templateId = getFormString(formData, "template_id") ?? "post-apply";
  const nextDueRaw = getFormString(formData, "next_due");
  const parsedNextDue =
    nextDueRaw && /^\d{4}-\d{2}-\d{2}$/.test(nextDueRaw)
      ? new Date(`${nextDueRaw}T12:00:00Z`)
      : null;
  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  const now = new Date();
  const nextActionDate =
    parsedNextDue ?? addBusinessDays(now, 5);

  try {
    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type: "followup",
      channel,
      subject: "Follow-up logged",
      body: JSON.stringify({ templateId }),
      occurred_at: now.toISOString(),
    });

    await updateApplication(supabase, user.id, applicationId, {
      last_touch_at: now.toISOString(),
      last_activity_at: now.toISOString(),
      next_action_due: nextActionDate.toISOString().slice(0, 10),
      next_action_type: "follow_up",
    });

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");

    await logActivationMilestone(supabase, user.id, applicationId, "activation_first_followup");

    return { status: "success", message: "Follow-up logged." };
  } catch (error) {
    console.error("[logFollowupCadenceAction]", error);
    return {
      status: "error",
      message: "Unable to log the follow-up right now.",
    };
  }
}

export async function createFollowupFromTemplateAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to log a follow-up.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  const subject = getFormString(formData, "subject");
  const body = getFormString(formData, "body");

  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  const now = new Date();
  const nextFollowup = new Date(now);
  nextFollowup.setDate(now.getDate() + 7);
  const nextFollowupDate = nextFollowup.toISOString().slice(0, 10);

  try {
    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type: "followup",
      channel: "email",
      subject: subject || "Follow-up sent",
      body: body || null,
      occurred_at: now.toISOString(),
    });

    await updateApplication(supabase, user.id, applicationId, {
      last_touch_at: now.toISOString(),
      last_activity_at: now.toISOString(),
      next_followup_at: nextFollowup.toISOString(),
      next_action_type: "follow_up",
      next_action_due: nextFollowupDate,
    });

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");

    return { status: "success", message: "Follow-up logged." };
  } catch (error) {
    console.error("[createFollowupFromTemplateAction]", error);
    return {
      status: "error",
      message: "Unable to log the follow-up right now.",
    };
  }
}

export async function updateNextActionAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update the next action.",
    };
  }

  const values = {
    id: getFormString(formData, "id"),
    next_action_type: getFormString(formData, "next_action_type"),
    next_action_due: getFormString(formData, "next_action_due"),
  };

  const parsed = nextActionSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  const nextActionDue = parseDateOnly(parsed.data.next_action_due);
  if (parsed.data.next_action_due && !nextActionDue) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: { next_action_due: "Enter a valid date." },
    };
  }

  try {
    await updateApplication(supabase, user.id, parsed.data.id, {
      next_action_type: toNullable(parsed.data.next_action_type ?? ""),
      next_action_due: nextActionDue,
    });

    revalidatePath(`/app/applications/${parsed.data.id}`);
    revalidatePath("/app/pipeline");

    return { status: "success", message: "Next action updated." };
  } catch (error) {
    console.error("[updateNextActionAction]", error);
    return {
      status: "error",
      message: "Unable to update the next action right now.",
    };
  }
}

export async function logPipelineActivityAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to log an activity.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  const type = getFormString(formData, "type");

  if (!applicationId || !type) {
    return { status: "error", message: "Missing activity details." };
  }

  const allowedTypes = new Set([
    "applied",
    "followup",
    "call",
    "interview",
    "rejection",
    "offer",
  ]);

  if (!allowedTypes.has(type)) {
    return { status: "error", message: "Unsupported activity type." };
  }

  const now = new Date().toISOString();
  const statusMap: Record<string, ApplicationStatusValue | null> = {
    applied: "applied",
    followup: null,
    call: null,
    interview: "interviewing",
    rejection: "rejected",
    offer: "offer",
  };
  const channelMap: Record<string, string | null> = {
    applied: "portal",
    followup: "email",
    call: "phone",
    interview: null,
    rejection: "email",
    offer: "email",
  };

  try {
    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type,
      channel: channelMap[type],
      subject: null,
      body: null,
      occurred_at: now,
    });

    const updatePayload: {
      status?: ApplicationStatusValue;
      applied_at?: string;
      last_touch_at: string;
      last_activity_at: string;
    } = {
      last_touch_at: now,
      last_activity_at: now,
    };

    if (statusMap[type]) {
      updatePayload.status = statusMap[type] as ApplicationStatusValue;
    }
    if (type === "applied") {
      updatePayload.applied_at = now;
    }

    await updateApplication(supabase, user.id, applicationId, updatePayload);

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");

    return { status: "success", message: "Activity logged." };
  } catch (error) {
    console.error("[logPipelineActivityAction]", error);
    return {
      status: "error",
      message: "Unable to log the activity right now.",
    };
  }
}

export async function logOutreachStepAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to log outreach.",
    };
  }

  const values = {
    application_id: getFormString(formData, "application_id"),
    step_id: getFormString(formData, "step_id"),
    channel: getFormString(formData, "channel"),
    subject: getFormString(formData, "subject"),
    body: getFormString(formData, "body"),
  };

  const parsed = outreachLogSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  const steps = getOutreachSteps();
  const step = steps.find((item) => item.id === parsed.data.step_id);
  if (!step) {
    return { status: "error", message: "Outreach step not found." };
  }

  try {
    const application = await fetchApplication(
      supabase,
      user.id,
      parsed.data.application_id
    );
    if (!application) {
      return { status: "error", message: "Application not found." };
    }

    if (application.outreach_stage === "replied" || application.outreach_stage === "closed") {
      return {
        status: "error",
        message: "Outreach is already marked as replied or closed.",
      };
    }

    const now = new Date();
    const nextStep = getNextOutreachStep(step.stage);
    const nextDue = nextStep
      ? new Date(now.getTime() + nextStep.offsetDays * 24 * 60 * 60 * 1000)
      : null;
    const nextActionDue = nextDue ? nextDue.toISOString().slice(0, 10) : null;

    const subject =
      parsed.data.subject ||
      `Outreach: ${step.label}`;
    const bodySnippet = parsed.data.body
      ? parsed.data.body.slice(0, 2000)
      : "";

    await createApplicationActivity(supabase, user.id, {
      application_id: parsed.data.application_id,
      type: "outreach",
      channel: parsed.data.channel,
      subject,
      body: bodySnippet || null,
      occurred_at: now.toISOString(),
    });

    await updateApplication(supabase, user.id, parsed.data.application_id, {
      outreach_stage: step.stage,
      outreach_last_sent_at: now.toISOString(),
      outreach_next_due_at: nextDue ? nextDue.toISOString() : null,
      outreach_channel_pref: parsed.data.channel,
      next_action_type: nextActionDue ? "follow_up" : null,
      next_action_due: nextActionDue,
      last_touch_at: now.toISOString(),
      last_activity_at: now.toISOString(),
    });

    try {
      await markApplyChecklist(supabase, user.id, parsed.data.application_id, {
        outreach_step1_logged_at: now.toISOString(),
      });
    } catch (checklistError) {
      console.error("[logOutreachStepAction.checklist]", checklistError);
    }

    revalidatePath(`/app/applications/${parsed.data.application_id}`);
    revalidatePath("/app/pipeline");

    await logActivationMilestone(supabase, user.id, parsed.data.application_id, "activation_first_outreach");

    return {
      status: "success",
      message: "Outreach logged.",
    };
  } catch (error) {
    console.error("[logOutreachStepAction]", error);
    return {
      status: "error",
      message: "Unable to log outreach right now.",
    };
  }
}

export async function markOutreachRepliedAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update outreach.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  try {
    await updateApplication(supabase, user.id, applicationId, {
      outreach_stage: "replied",
      outreach_next_due_at: null,
      next_action_due: null,
    });
    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");
    return { status: "success", message: "Outreach marked as replied." };
  } catch (error) {
    console.error("[markOutreachRepliedAction]", error);
    return {
      status: "error",
      message: "Unable to update outreach right now.",
    };
  }
}

export async function closeOutreachAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update outreach.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  try {
    await updateApplication(supabase, user.id, applicationId, {
      outreach_stage: "closed",
      outreach_next_due_at: null,
      next_action_due: null,
    });
    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");
    return { status: "success", message: "Outreach closed." };
  } catch (error) {
    console.error("[closeOutreachAction]", error);
    return {
      status: "error",
      message: "Unable to update outreach right now.",
    };
  }
}

export async function logOutreachTriageAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update outreach.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  const status = getFormString(formData, "triage_status");
  const notes = getFormString(formData, "notes");
  if (!applicationId || !status) {
    return { status: "error", message: "Missing outreach triage details." };
  }

  const allowed = new Set(["interested", "not_now", "rejected", "no_response"]);
  if (!allowed.has(status)) {
    return { status: "error", message: "Invalid triage value." };
  }

  const now = new Date();
  const triageStage = `triage_${status}`;
  const nextDue =
    status === "not_now"
      ? addBusinessDays(now, 5)
      : status === "no_response"
        ? addBusinessDays(now, 3)
        : null;

  try {
    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type: "outreach.triage",
      channel: null,
      subject: status,
      body: notes ?? null,
      occurred_at: now.toISOString(),
    });

    await updateApplication(supabase, user.id, applicationId, {
      outreach_stage: triageStage,
      outreach_next_due_at: nextDue ? nextDue.toISOString() : null,
      next_action_due: nextDue ? nextDue.toISOString().slice(0, 10) : null,
      last_touch_at: now.toISOString(),
      last_activity_at: now.toISOString(),
    });

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");
    return { status: "success", message: "Triage saved." };
  } catch (error) {
    console.error("[logOutreachTriageAction]", error);
    return {
      status: "error",
      message: "Unable to update outreach triage right now.",
    };
  }
}

export async function updateClosingDateAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update the closing date.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  const closingDateInput = getFormString(formData, "closing_date");

  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  const closingDate = parseDateOnly(closingDateInput);

  if (closingDateInput && !closingDate) {
    return {
      status: "error",
      message: "Enter a valid closing date.",
    };
  }

  try {
    await updateApplication(supabase, user.id, applicationId, {
      closing_date: closingDate,
    });
    await markApplyChecklist(supabase, user.id, applicationId, {});
    revalidatePath(`/app/applications/${applicationId}`);
    return { status: "success", message: "Closing date updated." };
  } catch (error) {
    console.error("[updateClosingDateAction]", error);
    return {
      status: "error",
      message: "Unable to update the closing date right now.",
    };
  }
}

export async function updateSourcePlatformAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update the source platform.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  const sourcePlatform = getFormString(formData, "source_platform");

  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  try {
    await updateApplication(supabase, user.id, applicationId, {
      source_platform: toNullable(sourcePlatform ?? ""),
    });
    await markApplyChecklist(supabase, user.id, applicationId, {});
    revalidatePath(`/app/applications/${applicationId}`);
    return { status: "success", message: "Source platform updated." };
  } catch (error) {
    console.error("[updateSourcePlatformAction]", error);
    return {
      status: "error",
      message: "Unable to update the source platform right now.",
    };
  }
}

export async function setSubmittedAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update submission status.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  const submittedValue = getFormString(formData, "submitted");
  const shouldSubmit = submittedValue === "true";

  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  const now = new Date().toISOString();

  try {
    await updateApplication(supabase, user.id, applicationId, {
      submitted_at: shouldSubmit ? now : null,
    });
    await markApplyChecklist(supabase, user.id, applicationId, {
      submitted_logged_at: shouldSubmit ? now : null,
    });

    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type: shouldSubmit ? "application.submitted" : "application.unsubmitted",
      channel: null,
      subject: shouldSubmit
        ? "Application submitted"
        : "Submission cleared",
      body: null,
      occurred_at: now,
    });

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");

    return {
      status: "success",
      message: shouldSubmit ? "Marked as submitted." : "Submission cleared.",
    };
  } catch (error) {
    console.error("[setSubmittedAction]", error);
    return {
      status: "error",
      message: "Unable to update submission status right now.",
    };
  }
}

export async function scheduleFollowupAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to schedule a follow-up.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  const now = new Date();
  const dueDate = addBusinessDays(now, 3);
  const dateOnly = dueDate.toISOString().slice(0, 10);

  try {
    await updateApplication(supabase, user.id, applicationId, {
      next_action_type: "follow_up",
      next_action_due: dateOnly,
      last_touch_at: now.toISOString(),
      last_activity_at: now.toISOString(),
    });

    await markApplyChecklist(supabase, user.id, applicationId, {
      followup_scheduled_at: now.toISOString(),
    });

    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type: "followup.scheduled",
      channel: null,
      subject: "Follow-up scheduled",
      body: JSON.stringify({ due: dateOnly }),
      occurred_at: now.toISOString(),
    });

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");

    await logActivationMilestone(supabase, user.id, applicationId, "activation_first_followup");

    return { status: "success", message: "Follow-up scheduled." };
  } catch (error) {
    console.error("[scheduleFollowupAction]", error);
    return {
      status: "error",
      message: "Unable to schedule the follow-up right now.",
    };
  }
}

export async function setOutcomeAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update the outcome.",
    };
  }

  const applicationId = getFormString(formData, "application_id");
  const outcomeStatus = getFormString(formData, "outcome_status");
  const outcomeNote = getFormString(formData, "outcome_note");

  if (!applicationId) {
    return { status: "error", message: "Missing application id." };
  }

  const now = new Date().toISOString();

  try {
    await updateApplication(supabase, user.id, applicationId, {
      outcome_status: toNullable(outcomeStatus ?? ""),
      outcome_note: toNullable(outcomeNote ?? ""),
      outcome_at: outcomeStatus ? now : null,
    });

    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type: "application.outcome",
      channel: null,
      subject: outcomeStatus ?? "Outcome updated",
      body: outcomeNote ?? null,
      occurred_at: now,
    });

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");

    if (outcomeStatus) {
      await logActivationMilestone(supabase, user.id, applicationId, "activation_first_outcome");
    }

    return { status: "success", message: "Outcome saved." };
  } catch (error) {
    console.error("[setOutcomeAction]", error);
    return {
      status: "error",
      message: "Unable to save outcome right now.",
    };
  }
}

function parseDateInput(value?: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  const base = trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00`;
  const parsed = new Date(base);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function parseDateOnly(value?: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const parsed = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return trimmed;
}

function addBusinessDays(date: Date, days: number) {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return result;
}
