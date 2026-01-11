"use server";

import { revalidatePath } from "next/cache";
import { getFormString, toNullable } from "@/lib/actions/form";
import type { ActionState } from "@/lib/actions/types";
import {
  createAchievement,
  deleteAchievement,
  updateAchievement,
} from "@/lib/data/achievements";
import { upsertProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import { achievementSchema } from "@/lib/validators/achievement";
import { profileSchema } from "@/lib/validators/profile";
import { getFieldErrors } from "@/lib/validators/utils";

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
