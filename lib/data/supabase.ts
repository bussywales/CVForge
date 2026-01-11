import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";

export type SupabaseUserResult = {
  supabase: SupabaseClient;
  user: User | null;
  error?: string;
};

export async function getSupabaseUser(): Promise<SupabaseUserResult> {
  const supabase = createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      user: null,
      error: error?.message ?? "Unauthorized",
    };
  }

  return { supabase, user };
}
