"use server";

import { revalidatePath } from "next/cache";
import { getFormString, toNullable } from "@/lib/actions/form";
import type { ActionState } from "@/lib/actions/types";
import {
  createApplication,
  deleteApplication,
  updateApplication,
} from "@/lib/data/applications";
import { getSupabaseUser } from "@/lib/data/supabase";
import { applicationSchema } from "@/lib/validators/application";
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
      job_description: parsed.data.job_description,
      status: parsed.data.status,
    });

    revalidatePath("/app/applications");

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
      job_description: parsed.data.job_description,
      status: parsed.data.status,
    });

    revalidatePath("/app/applications");
    revalidatePath(`/app/applications/${id}`);

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
    return { status: "success", message: "Application deleted." };
  } catch (error) {
    console.error("[deleteApplicationAction]", error);
    return {
      status: "error",
      message: "Unable to delete the application right now.",
    };
  }
}
