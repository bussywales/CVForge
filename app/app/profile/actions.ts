"use server";

import { revalidatePath } from "next/cache";
import { getFormString, toNullable } from "@/lib/actions/form";
import type { ActionState } from "@/lib/actions/types";
import {
  createAchievement,
  deleteAchievement,
  updateAchievement,
} from "@/lib/data/achievements";
import {
  createWorkHistory,
  deleteWorkHistory,
  updateWorkHistory,
} from "@/lib/data/work-history";
import { ensureProfile, upsertProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import { achievementSchema } from "@/lib/validators/achievement";
import { profileSchema } from "@/lib/validators/profile";
import { getFieldErrors } from "@/lib/validators/utils";
import { workHistorySchema } from "@/lib/validators/work-history";

export async function updateProfileAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update your profile.",
    };
  }

  const values = {
    full_name: getFormString(formData, "full_name"),
    headline: getFormString(formData, "headline"),
    location: getFormString(formData, "location"),
  };

  const parsed = profileSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  try {
    await upsertProfile(supabase, user.id, {
      full_name: parsed.data.full_name,
      headline: toNullable(parsed.data.headline ?? ""),
      location: toNullable(parsed.data.location ?? ""),
    });

    revalidatePath("/app/profile");

    return { status: "success", message: "Profile updated." };
  } catch (error) {
    console.error("[updateProfileAction]", error);
    return {
      status: "error",
      message: "Unable to update your profile right now.",
    };
  }
}

export async function createAchievementAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to add an achievement.",
    };
  }

  const values = {
    title: getFormString(formData, "title"),
    situation: getFormString(formData, "situation"),
    task: getFormString(formData, "task"),
    action: getFormString(formData, "action"),
    result: getFormString(formData, "result"),
    metrics: getFormString(formData, "metrics"),
  };

  const parsed = achievementSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  try {
    await createAchievement(supabase, user.id, {
      title: parsed.data.title,
      situation: toNullable(parsed.data.situation ?? ""),
      task: toNullable(parsed.data.task ?? ""),
      action: parsed.data.action,
      result: parsed.data.result,
      metrics: toNullable(parsed.data.metrics ?? ""),
    });

    revalidatePath("/app/profile");

    return { status: "success", message: "Achievement added." };
  } catch (error) {
    console.error("[createAchievementAction]", error);
    return {
      status: "error",
      message: "Unable to add the achievement right now.",
    };
  }
}

export async function updateAchievementAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update an achievement.",
    };
  }

  const id = getFormString(formData, "id");

  if (!id) {
    return { status: "error", message: "Missing achievement id." };
  }

  const values = {
    title: getFormString(formData, "title"),
    situation: getFormString(formData, "situation"),
    task: getFormString(formData, "task"),
    action: getFormString(formData, "action"),
    result: getFormString(formData, "result"),
    metrics: getFormString(formData, "metrics"),
  };

  const parsed = achievementSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields to continue.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  try {
    await updateAchievement(supabase, user.id, id, {
      title: parsed.data.title,
      situation: toNullable(parsed.data.situation ?? ""),
      task: toNullable(parsed.data.task ?? ""),
      action: parsed.data.action,
      result: parsed.data.result,
      metrics: toNullable(parsed.data.metrics ?? ""),
    });

    revalidatePath("/app/profile");

    return { status: "success", message: "Achievement updated." };
  } catch (error) {
    console.error("[updateAchievementAction]", error);
    return {
      status: "error",
      message: "Unable to update the achievement right now.",
    };
  }
}

export async function deleteAchievementAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to delete an achievement.",
    };
  }

  const id = getFormString(formData, "id");

  if (!id) {
    return { status: "error", message: "Missing achievement id." };
  }

  try {
    await deleteAchievement(supabase, user.id, id);
    revalidatePath("/app/profile");
    return { status: "success", message: "Achievement removed." };
  } catch (error) {
    console.error("[deleteAchievementAction]", error);
    return {
      status: "error",
      message: "Unable to remove the achievement right now.",
    };
  }
}

export async function createWorkHistoryAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to add work history.",
    };
  }

  const parsed = parseWorkHistoryForm(formData);
  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await createWorkHistory(supabase, user.id, {
      job_title: parsed.data.job_title,
      company: parsed.data.company,
      location: toNullable(parsed.data.location ?? ""),
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date || null,
      is_current: parsed.data.is_current,
      summary: toNullable(parsed.data.summary ?? ""),
      bullets: parsed.data.bullets,
    });

    revalidatePath("/app/profile");
    return { status: "success", message: "Work history added." };
  } catch (error) {
    console.error("[createWorkHistoryAction]", error);
    return {
      status: "error",
      message: "Unable to add work history right now.",
    };
  }
}

export async function updateWorkHistoryAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update work history.",
    };
  }

  const id = getFormString(formData, "id");
  if (!id) {
    return { status: "error", message: "Missing work history id." };
  }

  const parsed = parseWorkHistoryForm(formData);
  if (!parsed.success) {
    return parsed.error;
  }

  try {
    await updateWorkHistory(supabase, user.id, id, {
      job_title: parsed.data.job_title,
      company: parsed.data.company,
      location: toNullable(parsed.data.location ?? ""),
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date || null,
      is_current: parsed.data.is_current,
      summary: toNullable(parsed.data.summary ?? ""),
      bullets: parsed.data.bullets,
    });

    revalidatePath("/app/profile");
    return { status: "success", message: "Work history updated." };
  } catch (error) {
    console.error("[updateWorkHistoryAction]", error);
    return {
      status: "error",
      message: "Unable to update work history right now.",
    };
  }
}

export async function deleteWorkHistoryAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to delete work history.",
    };
  }

  const id = getFormString(formData, "id");
  if (!id) {
    return { status: "error", message: "Missing work history id." };
  }

  try {
    await deleteWorkHistory(supabase, user.id, id);
    revalidatePath("/app/profile");
    return { status: "success", message: "Work history removed." };
  } catch (error) {
    console.error("[deleteWorkHistoryAction]", error);
    return {
      status: "error",
      message: "Unable to remove work history right now.",
    };
  }
}

export async function updateTelemetryAction(
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return {
      status: "error",
      message: "Please sign in again to update your preferences.",
    };
  }

  const telemetryOptIn = formData.get("telemetry_opt_in") === "on";

  try {
    await ensureProfile(supabase, user.id);
    const { error } = await supabase
      .from("profiles")
      .update({ telemetry_opt_in: telemetryOptIn })
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    revalidatePath("/app/profile");
    revalidatePath("/app");

    return {
      status: "success",
      message: telemetryOptIn
        ? "Thanks for contributing anonymised signals."
        : "Telemetry preference updated.",
    };
  } catch (error) {
    console.error("[updateTelemetryAction]", error);
    return {
      status: "error",
      message: "Unable to update your preference right now.",
    };
  }
}

type ParseResult =
  | { success: true; data: ReturnType<typeof workHistorySchema.parse> }
  | { success: false; error: ActionState };

function parseWorkHistoryForm(formData: FormData): ParseResult {
  const startMonth = getFormString(formData, "start_month");
  const endMonth = getFormString(formData, "end_month");
  const isCurrent = formData.get("is_current") === "on";

  const startDate = parseMonthToDate(startMonth);
  if (!startDate) {
    return {
      success: false,
      error: {
        status: "error",
        message: "Fix the highlighted fields to continue.",
        fieldErrors: { start_month: "Enter a valid start month." },
      },
    };
  }

  const endDate = isCurrent ? "" : parseMonthToDate(endMonth);
  if (!isCurrent && endMonth && !endDate) {
    return {
      success: false,
      error: {
        status: "error",
        message: "Fix the highlighted fields to continue.",
        fieldErrors: { end_month: "Enter a valid end month." },
      },
    };
  }

  const bullets = formData
    .getAll("bullets")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);

  const values = {
    job_title: getFormString(formData, "job_title"),
    company: getFormString(formData, "company"),
    location: getFormString(formData, "location"),
    start_date: startDate,
    end_date: endDate ?? "",
    is_current: isCurrent,
    summary: getFormString(formData, "summary"),
    bullets,
  };

  const parsed = workHistorySchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors = getFieldErrors(parsed.error);
    if (fieldErrors.start_date) {
      fieldErrors.start_month = fieldErrors.start_date;
      delete fieldErrors.start_date;
    }
    if (fieldErrors.end_date) {
      fieldErrors.end_month = fieldErrors.end_date;
      delete fieldErrors.end_date;
    }

    return {
      success: false,
      error: {
        status: "error",
        message: "Fix the highlighted fields to continue.",
        fieldErrors,
      },
    };
  }

  return { success: true, data: parsed.data };
}

function parseMonthToDate(value: string) {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    return "";
  }
  return `${trimmed}-01`;
}
