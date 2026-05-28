import { readFile, readdir } from "fs/promises";
import path from "path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/supabase/auth";
import BackButton from "@/components/BackButton";
import { MessageSquarePlus, Map, FileText, ArrowRight } from "lucide-react";
import FeatureRequestsAdminList from "./FeatureRequestsAdminList";

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

async function getChangelog(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), "CHANGELOG.md");
    return await readFile(filePath, "utf-8");
  } catch {
    return "_Pas de CHANGELOG.md trouvé à la racine du projet_";
  }
}

/**
 * Liste les specs dispo dans docs/specs/ (tous les .md).
 * Renvoie [{ slug, title }] — le title est le premier titre H1 du fichier,
 * sinon le nom du fichier.
 */
async function getSpecs(): Promise<{ slug: string; title: string }[]> {
  try {
    const dir = path.join(process.cwd(), "docs", "specs");
    const files = await readdir(dir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    const specs = await Promise.all(
      mdFiles.map(async (file) => {
        const slug = file.replace(/\.md$/, "");
        const content = await readFile(path.join(dir, file), "utf-8");
        const h1Match = content.match(/^#\s+(.+)$/m);
        const title = h1Match ? h1Match[1].trim() : slug;
        return { slug, title };
      })
    );

    return specs.sort((a, b) => a.title.localeCompare(b.title));
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

  const changelog = await getChangelog();
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
              {specs.map((spec) => (
                <Link
                  key={spec.slug}
                  href={`/dashboard/admin/specs/${spec.slug}`}
                  className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-sm transition"
                >
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-slate-900">
                    {spec.title}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Section : roadmap & journal de dev */}
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <Map className="w-4 h-4 text-purple-500" />
            Roadmap & journal de dev
          </h2>
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:hidden prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-h2:text-slate-900 prose-h3:text-sm prose-h3:text-slate-800 prose-p:text-slate-700 prose-li:text-slate-700 prose-li:my-0.5 prose-ul:my-2 prose-strong:text-slate-900 prose-hr:my-4">
              <ReactMarkdown>{changelog}</ReactMarkdown>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}