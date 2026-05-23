import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import {
  KeyRound,
  AlertTriangle,
  Crown,
  ShieldCheck,
  Mail,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  getFamilyPriority,
  getRelevantSummerYear,
} from "@/lib/summer-priorities";

export const dynamic = "force-dynamic";

const LAUNCH_DATE = "2026-05-22";

export default async function ProfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "display_name, password_changed, is_family_head, is_admin, is_calendar_admin, families(name, color)"
    )
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // @ts-expect-error nested type
  const familyName: string = profile?.families?.name ?? "?";
  // @ts-expect-error nested type
  const familyColor: string = profile?.families?.color ?? "#888";

  const displayName = profile.display_name ?? user.email?.split("@")[0] ?? "?";

  // Stats : nombre de séjours créés depuis le lancement (hors imports admin)
  const { count: mySejourCount } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user.id)
    .gt("created_at", LAUNCH_DATE)
    .eq("is_admin_created", false);

// Priorité été
  const summerYear = getRelevantSummerYear();
  const summerPriority = familyName
    ? getFamilyPriority(summerYear, familyName)
    : null;

  // Construction du label de rôle
  const roles: string[] = [];
  if (profile.is_admin) roles.push("Admin");
  if (profile.is_family_head) roles.push("Chef de famille");
  if (profile.is_calendar_admin) roles.push("Admin Calendrier");
  if (roles.length === 0) roles.push("Membre");

  const showPasswordBanner = !profile.password_changed;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <header>
          <BackButton />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            👤 Mon profil
          </h1>
        </header>

        {/* Bandeau kerbrise2026 */}
        {showPasswordBanner && (
          <Link
            href="#password"
            className="block bg-amber-50 border border-amber-200 rounded-2xl p-4 hover:bg-amber-100/50 transition"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">
                  Tu utilises encore le mot de passe par défaut
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Touche ici pour le changer maintenant
                </p>
              </div>
              <KeyRound className="w-4 h-4 text-amber-700 flex-shrink-0 mt-1" />
            </div>
          </Link>
        )}

        {/* Section : Mon compte */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-400 font-medium">
            Mon compte
          </h2>

          {/* Nom */}
          <div className="flex items-center gap-3 text-sm">
            <UserIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500 w-20 flex-shrink-0">Nom</span>
            <span className="text-slate-900 font-medium">{displayName}</span>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-500 w-20 flex-shrink-0">Email</span>
            <span className="text-slate-700 truncate">{user.email}</span>
          </div>

          {/* Famille */}
          <div className="flex items-center gap-3 text-sm">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: familyColor }}
            />
            <span className="text-slate-500 w-20 flex-shrink-0">Famille</span>
            <span className="text-slate-900 font-medium">{familyName}</span>
          </div>

          {/* Rôle */}
          <div className="flex items-start gap-3 text-sm">
            <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span className="text-slate-500 w-20 flex-shrink-0">Rôle</span>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <span
                  key={role}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    role === "Admin"
                      ? "bg-purple-100 text-purple-800"
                      : role === "Chef de famille"
                      ? "bg-blue-100 text-blue-800"
                      : role === "Admin Calendrier"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {role === "Chef de famille" && <Crown className="w-3 h-3" />}
                  {role}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Section : Stats */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-slate-400 font-medium">
            Mes stats
          </h2>

          {/* Séjours créés */}
          <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
            <span className="text-2xl">🏖️</span>
            <div className="flex-1">
              <p className="text-xs text-slate-600">
                Séjours créés depuis le lancement
              </p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">
                {mySejourCount ?? 0}
                <span className="text-sm font-normal text-slate-500 ml-1">
                  séjour{(mySejourCount ?? 0) > 1 ? "s" : ""}
                </span>
              </p>
            </div>
          </div>

          {/* Priorité été */}
          {summerPriority && (
            <Link
              href="/dashboard/a-propos/regles"
              className="flex items-center gap-3 bg-amber-50 rounded-xl p-3 hover:bg-amber-100 transition"
            >
              <span className="text-2xl">🌞</span>
              <div className="flex-1">
                <p className="text-xs text-slate-600">
                  Priorité été {summerYear}
                </p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">
                  N°{summerPriority}
                  <span className="text-sm font-normal text-slate-500 ml-1">
                    {summerPriority === 1 && "· tu choisis en premier"}
                    {summerPriority === 2 && "· tu choisis en 2e"}
                    {summerPriority === 3 && "· tu choisis en 3e"}
                  </span>
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </Link>
          )}
        </section>

        {/* Section : Mot de passe */}
        <section id="password" className="scroll-mt-4">
          <ChangePasswordForm />
        </section>
      </div>
    </main>
  );
}