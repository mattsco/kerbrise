import { readFile, readdir } from "fs/promises";
import path from "path";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/supabase/auth";
import BackButton from "@/components/BackButton";
import { MessageSquarePlus, BookOpen, FileText, ArrowRight } from "lucide-react";
import FeatureRequestsAdminList from "./FeatureRequestsAdminList";
import RoadmapChangelogTabs from "./RoadmapChangelogTabs";

export const dynamic = "force-dynamic";

export type FeatureRequestRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "done" | "rejected";
  admin_note: string | null;
  created_at: string;
  user_display_name: string | null;
  user_family_name: string | null;
};

async function getMarkdownFile(
  fileName: string,
  fallback: string
): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), fileName);
    return await readFile(filePath, "utf-8");
  } catch {
    return fallback;
  }
}

type SpecStatus = "done" | "in_progress" | "planned" | "idea" | "unknown";

type Spec = { slug: string; title: string; status: SpecStatus };

/**
 * Config d'affichage par statut de spec.
 * `order` pilote le tri : les chantiers ouverts remontent, les specs
 * implémentées descendent en bas de liste.
 */
const SPEC_STATUS_CONFIG: Record<
  SpecStatus,
  { label: string; classes: string; order: number }
> = {
  in_progress: {
    label: "En cours",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
    order: 0,
  },
  planned: {
    label: "Spec validée",
    classes: "bg-purple-50 text-purple-700 border-purple-200",
    order: 1,
  },
  idea: {
    label: "Embryon",
    classes: "bg-amber-50 text-amber-700 border-amber-200",
    order: 2,
  },
  unknown: {
    label: "Statut ?",
    classes: "bg-slate-50 text-slate-500 border-slate-200",
    order: 3,
  },
  done: {
    label: "Implémentée",
    classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    order: 4,
  },
};

/**
 * Déduit le statut d'une spec à partir de sa ligne `> **Statut** : ...`.
 * Source de vérité = le fichier lui-même (pas de mapping spec↔code).
 */
function parseSpecStatus(content: string): SpecStatus {
  const m = content.match(/^>\s*\*\*Statut\*\*\s*:\s*(.+)$/m);
  const line = m ? m[1] : "";
  if (/✅|Implémentée|Implémenté|Livré/i.test(line)) return "done";
  if (/🚧|Draft|En cours/i.test(line)) return "in_progress";
  if (/📋|Spec validée/i.test(line)) return "planned";
  if (/🌱|embryon/i.test(line)) return "idea";
  return "unknown";
}

/**
 * Liste les specs dispo dans docs/specs/ (tous les .md).
 * Renvoie [{ slug, title, status }] — le title est le premier titre H1 du
 * fichier (sinon le nom du fichier), le status vient de la ligne `> **Statut**`.
 * Tri : chantiers ouverts en haut, implémentées en bas ; titre en départage.
 */
async function getSpecs(): Promise<Spec[]> {
  try {
    const dir = path.join(process.cwd(), "docs", "specs");
    const files = await readdir(dir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    const specs = await Promise.all(
      mdFiles.map(async (file): Promise<Spec> => {
        const slug = file.replace(/\.md$/, "");
        const content = await readFile(path.join(dir, file), "utf-8");
        const h1Match = content.match(/^#\s+(.+)$/m);
        const title = h1Match ? h1Match[1].trim() : slug;
        return { slug, title, status: parseSpecStatus(content) };
      })
    );

    return specs.sort((a, b) => {
      const orderDiff =
        SPEC_STATUS_CONFIG[a.status].order - SPEC_STATUS_CONFIG[b.status].order;
      return orderDiff !== 0 ? orderDiff : a.title.localeCompare(b.title);
    });
  } catch {
    return [];
  }
}

export default async function FeatureRequestsAdminPage() {
  const user = await requireAuthUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  const { data: requests } = await supabase
    .from("feature_requests")
    .select(
      `
      id, user_id, title, description, status, admin_note, created_at,
      users(display_name, families(name))
    `
    )
    .order("created_at", { ascending: false });

  const rows: FeatureRequestRow[] = (requests ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    description: r.description,
    status: r.status,
    admin_note: r.admin_note,
    created_at: r.created_at,
    user_display_name: r.users?.display_name ?? null,
    user_family_name: r.users?.families?.name ?? null,
  }));

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const inProgressCount = rows.filter((r) => r.status === "in_progress").length;

  const [roadmap, changelog] = await Promise.all([
    getMarkdownFile("ROADMAP.md", "_Pas de ROADMAP.md trouvé à la racine du projet_"),
    getMarkdownFile("CHANGELOG.md", "_Pas de CHANGELOG.md trouvé à la racine du projet_"),
  ]);
  const specs = await getSpecs();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <BackButton href="/dashboard/admin" label="Retour admin" />

        <header>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <MessageSquarePlus className="w-6 h-6 text-blue-500" />
            Product
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Roadmap, specs, journal de dev et suggestions des users.
          </p>
        </header>

        {/* Section : suggestions des users */}
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2">
            Suggestions ({rows.length})
            {pendingCount > 0 && (
              <span className="ml-2 text-sm font-normal text-amber-700">
                · {pendingCount} en attente
              </span>
            )}
            {inProgressCount > 0 && (
              <span className="ml-2 text-sm font-normal text-blue-700">
                · {inProgressCount} en cours
              </span>
            )}
          </h2>

          {rows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
              <p className="text-sm text-slate-500">
                Aucune suggestion pour l&apos;instant.
              </p>
            </div>
          ) : (
            <FeatureRequestsAdminList rows={rows} />
          )}
        </section>

        {/* Section : specs détaillées */}
        {specs.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              Specs détaillées
            </h2>
            <div className="space-y-2">
              {specs.map((spec) => {
                const statusConfig = SPEC_STATUS_CONFIG[spec.status];
                return (
                  <Link
                    key={spec.slug}
                    href={`/dashboard/admin/specs/${spec.slug}`}
                    className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-sm transition"
                  >
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-slate-900">
                      {spec.title}
                    </span>
                    <span
                      className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusConfig.classes}`}
                    >
                      {statusConfig.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Section : roadmap & changelog (toggle) */}
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-500" />
            Roadmap & Changelog
          </h2>
          <RoadmapChangelogTabs roadmap={roadmap} changelog={changelog} />
        </section>
      </div>
    </main>
  );
}