import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import NewBookingForm from "@/components/NewBookingForm";
import BackButton from "@/components/BackButton";

export default async function NouvelleDemandePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("family_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

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
            userId={user.id}
          />
        </div>
      </div>
    </main>
  );
}