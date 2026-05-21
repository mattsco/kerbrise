import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import BackButton from "@/components/BackButton";
export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, families(name, color)")
    .eq("id", user.id)
    .single();

  // @ts-expect-error nested type
  const familyName: string = profile?.families?.name ?? "?";
  // @ts-expect-error
  const familyColor: string = profile?.families?.color ?? "#888";

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-md mx-auto">
        <header className="mb-6">
          <BackButton />
          <h1 className="text-2xl font-light mt-1">Mon profil</h1>
        </header>

        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-400 mb-3">
            Informations
          </h2>
          <p className="text-base font-medium">
            {profile?.display_name ?? user.email}
          </p>
          <p className="text-sm text-slate-500 mt-1">{user.email}</p>
          <p className="mt-3 flex items-center gap-2 text-sm">
            <span>Famille</span>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-white text-xs"
              style={{ backgroundColor: familyColor }}
            >
              {familyName}
            </span>
          </p>
        </div>

        <ChangePasswordForm />
      </div>
    </main>
  );
}