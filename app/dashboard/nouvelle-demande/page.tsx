import Link from "next/link";
import NewBookingForm from "@/components/NewBookingForm";
import BackButton from "@/components/BackButton";
import { requireAuthUser } from "@/lib/supabase/auth";
import { requireProfile } from "@/lib/data/profile";

export default async function NouvelleDemandePage() {
  const user = await requireAuthUser();
  const profile = await requireProfile();

  const familyName = profile.family_name;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto p-4 sm:p-6">
        <BackButton />
        <h1 className="text-2xl sm:text-3xl font-bold mt-2 mb-6">
          Nouvelle demande
        </h1>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <NewBookingForm
            familyId={profile.family_id}
            familyName={familyName}
            userId={user.id}
          />
        </div>
      </div>
    </main>
  );
}