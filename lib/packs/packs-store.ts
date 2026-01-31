import type { SupabaseClient } from "@supabase/supabase-js";
import { coercePackRecord, coercePackVersionRecord, type PackRecord, type PackStatus, type PackVersionRecord } from "@/lib/packs/packs-model";

const PACK_SELECT = "id,user_id,title,company,role_title,status,source,created_at,updated_at";
const VERSION_SELECT = "id,pack_id,user_id,job_description,inputs_masked,outputs,model_meta,created_at";

export async function createApplicationPack({
  supabase,
  userId,
  title,
  company,
  roleTitle,
  source,
}: {
  supabase: SupabaseClient;
  userId: string;
  title: string;
  company?: string | null;
  roleTitle?: string | null;
  source?: string | null;
}) {
  const { data, error } = await supabase
    .from("application_packs")
    .insert({
      user_id: userId,
      title,
      company: company ?? null,
      role_title: roleTitle ?? null,
      source: source ?? null,
      status: "draft",
    })
    .select(PACK_SELECT)
    .single();
  if (error || !data) {
    throw error ?? new Error("Unable to create pack");
  }
  return coercePackRecord(data);
}

export async function listApplicationPacks({
  supabase,
  userId,
  limit = 24,
  cursor,
}: {
  supabase: SupabaseClient;
  userId: string;
  limit?: number;
  cursor?: string | null;
}): Promise<PackRecord[]> {
  let query = supabase
    .from("application_packs")
    .select(PACK_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (cursor) {
    query = query.lt("updated_at", cursor);
  }
  const { data, error } = await query;
  if (error) throw error;
  const packs = (data ?? []).map(coercePackRecord);
  if (!packs.length) return [];

  const packIds = packs.map((pack) => pack.id);
  const { data: versionRows, error: versionError } = await supabase
    .from("application_pack_versions")
    .select("id,pack_id,created_at")
    .in("pack_id", packIds)
    .order("created_at", { ascending: false });
  if (versionError) throw versionError;
  const latestMap = new Map<string, { id: string; createdAt: string }>();
  (versionRows ?? []).forEach((row: any) => {
    if (!row?.pack_id || latestMap.has(row.pack_id)) return;
    latestMap.set(row.pack_id, { id: row.id, createdAt: row.created_at });
  });

  return packs.map((pack) => {
    const latest = latestMap.get(pack.id);
    return {
      ...pack,
      latestVersionId: latest?.id ?? null,
      latestVersionCreatedAt: latest?.createdAt ?? null,
    };
  });
}

export async function fetchApplicationPack({
  supabase,
  userId,
  packId,
}: {
  supabase: SupabaseClient;
  userId: string;
  packId: string;
}): Promise<PackRecord | null> {
  const { data, error } = await supabase
    .from("application_packs")
    .select(PACK_SELECT)
    .eq("id", packId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return coercePackRecord(data);
}

export async function listPackVersions({
  supabase,
  userId,
  packId,
  limit = 10,
}: {
  supabase: SupabaseClient;
  userId: string;
  packId: string;
  limit?: number;
}): Promise<PackVersionRecord[]> {
  const { data, error } = await supabase
    .from("application_pack_versions")
    .select(VERSION_SELECT)
    .eq("pack_id", packId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(coercePackVersionRecord);
}

export async function createPackVersion({
  supabase,
  userId,
  packId,
  jobDescription,
  inputsMasked,
  outputs,
  modelMeta,
}: {
  supabase: SupabaseClient;
  userId: string;
  packId: string;
  jobDescription: string;
  inputsMasked: Record<string, any>;
  outputs: Record<string, any>;
  modelMeta?: Record<string, any> | null;
}): Promise<PackVersionRecord> {
  const { data, error } = await supabase
    .from("application_pack_versions")
    .insert({
      pack_id: packId,
      user_id: userId,
      job_description: jobDescription,
      inputs_masked: inputsMasked,
      outputs,
      model_meta: modelMeta ?? null,
    })
    .select(VERSION_SELECT)
    .single();
  if (error || !data) {
    throw error ?? new Error("Unable to create pack version");
  }
  return coercePackVersionRecord(data);
}

export async function updatePackStatus({
  supabase,
  userId,
  packId,
  status,
}: {
  supabase: SupabaseClient;
  userId: string;
  packId: string;
  status: PackStatus;
}): Promise<PackRecord> {
  const { data, error } = await supabase
    .from("application_packs")
    .update({ status })
    .eq("id", packId)
    .eq("user_id", userId)
    .select(PACK_SELECT)
    .single();
  if (error || !data) {
    throw error ?? new Error("Unable to update pack");
  }
  return coercePackRecord(data);
}
