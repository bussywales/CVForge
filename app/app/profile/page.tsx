import Section from "@/components/Section";
import { listAchievements } from "@/lib/data/achievements";
import { ensureProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import {
  createAchievementAction,
  deleteAchievementAction,
  updateAchievementAction,
  updateProfileAction,
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
