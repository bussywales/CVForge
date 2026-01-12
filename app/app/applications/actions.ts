"use server";

import { revalidatePath } from "next/cache";
import { getFormString, toNullable } from "@/lib/actions/form";
import type { ActionState } from "@/lib/actions/types";
import {
  createApplication,
  deleteApplication,
  updateApplication,
} from "@/lib/data/applications";
import {
  createApplicationActivity,
  deleteApplicationActivity,
} from "@/lib/data/application-activities";
import { getSupabaseUser } from "@/lib/data/supabase";
import { applicationSchema } from "@/lib/validators/application";
import {
  applicationActivitySchema,
  applicationTrackingSchema,
} from "@/lib/validators/application-tracking";
import { getFieldErrors } from "@/lib/validators/utils";

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
    const created = await createApplication(supabase, user.id, {
      job_title: parsed.data.job_title,
      company: toNullable(parsed.data.company ?? ""),
      company_name: toNullable(parsed.data.company ?? ""),
      job_url: parsed.data.job_url ?? null,
      job_description: parsed.data.job_description,
      status: parsed.data.status,
    });

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
    await updateApplication(supabase, user.id, id, {
      job_title: parsed.data.job_title,
      company: toNullable(parsed.data.company ?? ""),
      job_url: parsed.data.job_url ?? null,
      job_description: parsed.data.job_description,
      status: parsed.data.status,
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
    contact_email: getFormString(formData, "contact_email"),
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
    contact_email: toNullable(parsed.data.contact_email ?? ""),
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
    });

    revalidatePath(`/app/applications/${applicationId}`);
    revalidatePath("/app/pipeline");

    return { status: "success", message: "Follow-up logged." };
  } catch (error) {
    console.error("[logFollowupAction]", error);
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
      next_followup_at: nextFollowup.toISOString(),
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
