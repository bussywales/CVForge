import Section from "@/components/Section";
import { listAchievements } from "@/lib/data/achievements";
import { ensureProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import {
  createAchievementAction,
  deleteAchievementAction,
  updateAchievementAction,
  updateProfileAction,
  updateTelemetryAction,
} from "./actions";
import AchievementsSection from "./achievements-section";
import CvImportModal from "./cv-import-modal";
import ProfileForm from "./profile-form";

function calculateCompleteness(
  profile: { full_name: string | null; headline: string | null; location: string | null },
  achievementCount: number
) {
  const checks = [
    profile.full_name && profile.full_name.trim().length >= 2,
    profile.headline && profile.headline.trim().length > 0,
    profile.location && profile.location.trim().length > 0,
    achievementCount >= 3,
  ];

  const score = checks.filter(Boolean).length;
  return Math.round((score / checks.length) * 100);
}

export default async function ProfilePage() {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const profile = await ensureProfile(supabase, user.id);
  const achievements = await listAchievements(supabase, user.id);
  const completeness = calculateCompleteness(profile, achievements.length);

  return (
    <div className="space-y-8">
      <Section
        title="Profile"
        description="Keep your core story consistent across every CV and application."
        action={<CvImportModal />}
      >
        <ProfileForm
          profile={profile}
          achievementCount={achievements.length}
          completeness={completeness}
          updateAction={updateProfileAction}
        />
      </Section>

      <Section
        title="Privacy & improvement"
        description="Control whether anonymised job advert signals are used to improve Role Fit packs."
      >
        <form
          id="privacy"
          action={updateTelemetryAction}
          className="space-y-3 text-sm text-[rgb(var(--ink))]"
        >
          <label className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/70 p-4">
            <input
              type="checkbox"
              name="telemetry_opt_in"
              defaultChecked={Boolean(profile.telemetry_opt_in)}
            />
            <span>
              Help improve CVForge by contributing anonymised job advert signals
              (job adverts only; no CV/profile content).
            </span>
          </label>
          <p className="text-xs text-[rgb(var(--muted))]">
            We store terms/phrases only, with PII redacted. You can opt out at
            any time.
          </p>
          <div>
            <button
              type="submit"
              className="rounded-2xl border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
            >
              Save preference
            </button>
          </div>
        </form>
      </Section>

      <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
        <AchievementsSection
          achievements={achievements}
          createAction={createAchievementAction}
          updateAction={updateAchievementAction}
          deleteAction={deleteAchievementAction}
        />
      </div>
    </div>
  );
}
