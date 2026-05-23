import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import {
  getYearPriorities,
  getFamilyPriority,
  getRelevantSummerYear,
  SUMMER_PERIODS,
  FAMILY_ROTATION,
} from "@/lib/summer-priorities";

export const dynamic = "force-dynamic";

const FAMILY_COLORS: Record<string, string> = {
  Antoine: "#3b82f6",
  Vincent: "#f59e0b",
  François: "#10b981",
};

export default async function ReglesOccupationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("families(name)")
    .eq("id", user.id)
    .single();

  // @ts-expect-error nested type
  const userFamily: string | null = profile?.families?.name ?? null;

  // Année de référence pour l'utilisateur
  const relevantYear = getRelevantSummerYear();
  const userPriority = userFamily
    ? getFamilyPriority(relevantYear, userFamily)
    : null;

  // Générer le tableau pour 3 années (année courante + 2 suivantes)
  const tableYears = [relevantYear, relevantYear + 1, relevantYear + 2];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <div>
          <BackButton label="Retour à À propos" href="/dashboard/a-propos" />
          <h1 className="text-2xl sm:text-3xl font-bold mt-2 flex items-center gap-2">
            📜 Règles d'occupation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Adaptées à l'application Kerbrise (basées sur les règles familiales
            de 2024).
          </p>
        </div>

        {/* Badge perso si applicable */}
        {userPriority && (
          <div
            className="rounded-2xl p-4 text-white"
            style={{ backgroundColor: FAMILY_COLORS[userFamily!] }}
          >
            <p className="text-xs font-medium opacity-90">
              Votre famille pour l'été {relevantYear}
            </p>
            <p className="text-xl font-bold mt-1">
              {userFamily} · Priorité {userPriority}
            </p>
            <p className="text-xs opacity-90 mt-1">
              {userPriority === 1 &&
                "À vous de choisir votre période en premier."}
              {userPriority === 2 &&
                "Vous choisissez après la priorité 1."}
              {userPriority === 3 &&
                "Vous choisissez la période restante."}
            </p>
          </div>
        )}

        {/* Section : Règle générale */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            📋 Règle générale
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Toute demande de réservation doit être validée par les{" "}
            <strong>2 autres familles</strong>. Cette validation se fait
            directement dans l'application — les chefs des familles reçoivent un
            email à chaque nouvelle demande.
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            Pour permettre à chacun d'anticiper ses congés, les demandes doivent
            être faites <strong>le plus en amont possible</strong>. Le
            calendrier juillet/août devrait être défini au plus tard en{" "}
            <strong>janvier</strong>.
          </p>
        </section>

        {/* Section : Été (juillet/août) */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            🌞 Été (juillet/août)
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            La période juillet/août est divisée en{" "}
            <strong>3 périodes fixes</strong> de 3 semaines, chaque famille
            occupant une période :
          </p>

          <div className="space-y-2 mt-3">
            {SUMMER_PERIODS.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-slate-50 rounded-xl p-3"
              >
                <span className="font-semibold text-slate-900 text-sm w-20 flex-shrink-0">
                  {p.label}
                </span>
                <span className="text-sm text-slate-600">{p.description}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-slate-700 leading-relaxed mt-3">
            La famille en <strong>priorité 1</strong> choisit en premier sa
            période préférée, puis la <strong>priorité 2</strong>, puis la{" "}
            <strong>priorité 3</strong>. Ces réservations ne nécessitent pas la
            validation des autres familles (chacune est prioritaire sur son
            tour).
          </p>
        </section>

        {/* Section : Tableau des priorités */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">
            📅 Tableau des priorités
          </h2>
          <p className="text-xs text-slate-500">
            Rotation automatique sur 3 ans.
          </p>

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-xs uppercase text-slate-500 border-b border-slate-100">
                  <th className="text-left py-2 px-1 font-medium">Année</th>
                  <th className="text-center py-2 px-1 font-medium">P1</th>
                  <th className="text-center py-2 px-1 font-medium">P2</th>
                  <th className="text-center py-2 px-1 font-medium">P3</th>
                </tr>
              </thead>
              <tbody>
                {tableYears.map((year) => {
                  const prios = getYearPriorities(year);
                  return (
                    <tr
                      key={year}
                      className={
                        year === relevantYear
                          ? "bg-blue-50 font-semibold"
                          : "border-t border-slate-50"
                      }
                    >
                      <td className="py-3 px-1 text-slate-900">
                        {year}
                        {year === relevantYear && (
                          <span className="ml-1 text-[10px] font-normal text-blue-600">
                            (actuelle)
                          </span>
                        )}
                      </td>
                      {[1, 2, 3].map((p) => {
                        const famName = prios[p as 1 | 2 | 3];
                        const isUserFam = famName === userFamily;
                        return (
                          <td key={p} className="py-3 px-1 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                isUserFam
                                  ? "ring-2 ring-offset-1 ring-slate-900"
                                  : ""
                              }`}
                              style={{
                                backgroundColor: FAMILY_COLORS[famName] + "20",
                                color: FAMILY_COLORS[famName],
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  backgroundColor: FAMILY_COLORS[famName],
                                }}
                              />
                              {famName}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section : Ponts du printemps */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            🌸 Ponts du printemps
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Les week-ends prolongés (Ascension, Pentecôte, etc.) sont partagés
            équitablement. La famille en <strong>priorité 3 l'été</strong> est
            en <strong>priorité 1</strong> pour choisir son pont préféré du
            printemps suivant.
          </p>
        </section>

        {/* Section : Juin et septembre */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            🌷 Juin et septembre
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Partagés par tranches de 2 semaines. La famille qui occupe la{" "}
            <strong>Période 1</strong> (début juillet) n'est pas prioritaire
            pour la deuxième quinzaine de juin. Idem, la famille qui occupe la{" "}
            <strong>Période 3</strong> (fin août) n'est pas prioritaire pour la
            première quinzaine de septembre.
          </p>
        </section>

        {/* Section : Vocation */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2">
          <h2 className="text-base font-semibold text-slate-900">
            🏡 Vocation
          </h2>
          <p className="text-sm text-slate-700 leading-relaxed">
            Kerbrise a vocation à être habitée le plus souvent possible. Si une
            famille n'utilise pas sa période prioritaire, une autre famille peut
            en profiter selon le principe général (demande + validation).
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            Le nombre de jours passés par une famille à Kerbrise n'est{" "}
            <strong>pas un critère</strong> de priorité — seules les règles
            ci-dessus s'appliquent.
          </p>
        </section>

        <p className="text-xs text-slate-400 text-center pt-2 pb-6">
          Règles initialement rédigées par Antoine Scordia (13 février 2024) et
          Vincent Scordia (18 février 2024).
          <br />
          Adaptées à l'application Kerbrise en mai 2026.
        </p>
      </div>
    </main>
  );
}