import type { SupabaseClient } from "@supabase/supabase-js";

export type MonetisationEvent = {
  type: string;
  application_id: string;
  occurred_at: string;
  body: string | null;
};

export type FunnelStageCounts = {
  gate_shown: number;
  billing_clicked: number;
  checkout_started: number;
  checkout_success: number;
  checkout_redirect_failed: number;
  action_completed: number;
  resume_clicked: number;
  autopack_generated: number;
};

export type FunnelSummary = {
  last7: FunnelStageCounts & { conversions: Record<string, number> };
  last30: FunnelStageCounts & { conversions: Record<string, number> };
  surfaces: {
    gate_shown: Record<string, number>;
    billing_clicked: Record<string, number>;
  };
  recovery: {
    last7: { started: number; returned: number; completed: number; conversions: Record<string, number> };
    last30: { started: number; returned: number; completed: number; conversions: Record<string, number> };
  };
};

export function computeFunnel(events: MonetisationEvent[]): FunnelSummary {
  const now = Date.now();
  const windowed = (days: number) =>
    events.filter(
      (evt) => now - new Date(evt.occurred_at).getTime() <= days * 24 * 60 * 60 * 1000
    );

  const reduceStages = (list: MonetisationEvent[]) => {
    const counts: FunnelStageCounts = {
      gate_shown: 0,
      billing_clicked: 0,
      checkout_started: 0,
      checkout_success: 0,
      checkout_redirect_failed: 0,
      action_completed: 0,
      resume_clicked: 0,
      autopack_generated: 0,
    };
    const surfaces = {
      gate_shown: {} as Record<string, number>,
      billing_clicked: {} as Record<string, number>,
    };
    list.forEach((evt) => {
      const name = evt.type.replace("monetisation.", "");
      if (name in counts) {
        // @ts-expect-error dynamic index
        counts[name] += 1;
        if (name === "gate_shown" || name === "billing_clicked") {
          try {
            const meta = evt.body ? JSON.parse(evt.body) : {};
            const surface = meta?.surface ?? "unknown";
            const bucket = surfaces[name as keyof typeof surfaces];
            bucket[surface] = (bucket[surface] ?? 0) + 1;
          } catch {
            /* ignore */
          }
        }
      } else if (
        name === "autopack_generate_completed" ||
        name === "interview_pack_export_completed" ||
        name === "application_kit_download_completed" ||
        name === "answer_pack_generate_completed"
      ) {
        counts.action_completed += 1;
      }
    });
    const conversions: Record<string, number> = {};
    const stageOrder = [
      "gate_shown",
      "billing_clicked",
      "checkout_started",
      "checkout_success",
      "action_completed",
    ];
    for (let i = 0; i < stageOrder.length - 1; i++) {
      const from = stageOrder[i] as keyof FunnelStageCounts;
      const to = stageOrder[i + 1] as keyof FunnelStageCounts;
      const fromCount = counts[from];
      const toCount = counts[to];
      conversions[`${from}->${to}`] = fromCount === 0 ? 0 : Math.round((toCount / fromCount) * 100);
    }
    return { counts, surfaces, conversions };
  };

  const last7 = reduceStages(windowed(7));
  const last30 = reduceStages(windowed(30));

  const buildRecovery = (counts: FunnelStageCounts) => {
    const conversions: Record<string, number> = {};
    const started = counts.checkout_started;
    const returned = counts.checkout_success;
    const completed = counts.action_completed;
    conversions["started->returned"] =
      started === 0 ? 0 : Math.round((returned / started) * 100);
    conversions["returned->completed"] =
      returned === 0 ? 0 : Math.round((completed / returned) * 100);
    return { started, returned, completed, conversions };
  };

  return {
    last7: { ...last7.counts, conversions: last7.conversions },
    last30: { ...last30.counts, conversions: last30.conversions },
    surfaces: {
      gate_shown: last30.surfaces.gate_shown,
      billing_clicked: last30.surfaces.billing_clicked,
    },
    recovery: {
      last7: buildRecovery(last7.counts),
      last30: buildRecovery(last30.counts),
    },
  };
}

export async function getMonetisationSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<FunnelSummary> {
  const { data } = await supabase
    .from("application_activities")
    .select("type, application_id, occurred_at, body")
    .eq("user_id", userId)
    .ilike("type", "monetisation.%")
    .gte("occurred_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const events: MonetisationEvent[] = (data ?? []) as MonetisationEvent[];
  return computeFunnel(events);
}
