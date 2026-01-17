import Link from "next/link";
import Section from "@/components/Section";
import type { AutopackRecord } from "@/lib/data/autopacks";
import AutopackGenerateButton from "./autopack-generate-button";

type AutopacksSectionProps = {
  applicationId: string;
  autopacks: AutopackRecord[];
  balance: number;
  returnTo?: string;
  recommendedPlanKey?: "monthly_30" | "monthly_80" | null;
  hasSubscription?: boolean;
  recommendedPackKey?: string | null;
  packAvailability?: Partial<Record<"starter" | "pro" | "power", boolean>>;
  planAvailability?: { monthly_30?: boolean; monthly_80?: boolean };
  currentPlanKey?: "monthly_30" | "monthly_80" | null;
  upgradeSuggested?: boolean;
};

export default function AutopacksSection({
  applicationId,
  autopacks,
  balance,
  returnTo,
  recommendedPlanKey,
  hasSubscription,
  recommendedPackKey,
  packAvailability,
  planAvailability,
  currentPlanKey,
  upgradeSuggested,
}: AutopacksSectionProps) {
  return (
    <Section
      id="apply-autopacks"
      title="Autopacks"
      description="Generate tailored CVs, cover letters, and STAR answers."
      action={
        <AutopackGenerateButton
          applicationId={applicationId}
          balance={balance}
          returnTo={returnTo}
          recommendedPlanKey={recommendedPlanKey}
          hasSubscription={hasSubscription}
          recommendedPackKey={recommendedPackKey}
          packAvailability={packAvailability}
          planAvailability={planAvailability}
          currentPlanKey={currentPlanKey}
          upgradeSuggested={upgradeSuggested}
        />
      }
    >
      {autopacks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-[rgb(var(--muted))]">
          No autopacks yet. Generate your first tailored pack for this role.
        </div>
      ) : (
        <div className="space-y-3">
          {autopacks.map((autopack) => (
            <div
              key={autopack.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                  Version {autopack.version}
                </p>
                <p className="text-xs text-[rgb(var(--muted))]">
                  {new Date(autopack.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <Link
                href={`/app/applications/${applicationId}/autopacks/${autopack.id}`}
                className="rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Open editor
              </Link>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
