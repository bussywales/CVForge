import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoleFitPack } from "@/lib/role-fit";

type DomainPackRecord = {
  id: string;
  slug: string;
  title: string;
  version: number;
  is_active: boolean;
  pack: unknown;
};

type PackSignal = {
  id: string;
  label: string;
  weight: number;
  aliases: string[];
  gapSuggestions: string[];
  metricSnippets: string[];
};

export async function listActiveDomainPacks(
  supabase: SupabaseClient
): Promise<RoleFitPack[]> {
  const { data, error } = await supabase
    .from("domain_packs")
    .select("id, slug, title, version, is_active, pack")
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((record) => mapDomainPack(record as DomainPackRecord))
    .filter(Boolean) as RoleFitPack[];
}

function mapDomainPack(record: DomainPackRecord): RoleFitPack | null {
  const signals = parseSignals(record.pack);
  if (!signals.length) {
    return null;
  }

  const keywords = extractKeywords(record.pack);

  return {
    id: record.slug,
    label: record.title,
    keywords,
    signals,
  };
}

function parseSignals(pack: unknown): PackSignal[] {
  if (!pack) {
    return [];
  }

  const rawSignals =
    typeof pack === "object" && pack && "signals" in pack
      ? (pack as { signals?: unknown }).signals
      : pack;

  if (!Array.isArray(rawSignals)) {
    return [];
  }

  return rawSignals
    .map((signal) => {
      if (!signal || typeof signal !== "object") {
        return null;
      }
      const s = signal as Partial<PackSignal>;
      if (!s.id || !s.label || !s.aliases || !s.gapSuggestions || !s.metricSnippets) {
        return null;
      }
      return {
        id: String(s.id),
        label: String(s.label),
        weight: Number(s.weight ?? 3),
        aliases: Array.isArray(s.aliases) ? s.aliases.map(String) : [],
        gapSuggestions: Array.isArray(s.gapSuggestions)
          ? s.gapSuggestions.map(String)
          : [],
        metricSnippets: Array.isArray(s.metricSnippets)
          ? s.metricSnippets.map(String)
          : [],
      };
    })
    .filter(Boolean) as PackSignal[];
}

function extractKeywords(pack: unknown) {
  if (!pack || typeof pack !== "object") {
    return [];
  }
  const raw = (pack as { keywords?: unknown }).keywords;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((keyword) => String(keyword));
}
