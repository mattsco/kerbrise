import { readFile } from "fs/promises";
import path from "path";
import ReactMarkdown from "react-markdown";
import BackButton from "@/components/BackButton";
import { requireAuthUser } from "@/lib/supabase/auth";
import FeatureRequestForm from "./FeatureRequestForm";
import { Sparkles, MessageSquarePlus } from "lucide-react";

export const revalidate = 60; // le markdown est rebuild au max toutes les 60s

async function getChangelog(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), "docs", "changelog.md");
    return await readFile(filePath, "utf-8");
  } catch {
    return "Pas encore de notes de version disponibles.";
  }
}

export default async function AboutPage() {
  await requireAuthUser();
  const changelog = await getChangelog();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
        <BackButton />

        <header>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            À propos de cette app
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Les évolutions récentes et un espace pour suggérer des
            améliorations.
          </p>
        </header>

        {/* Section "Quoi de neuf" */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Quoi de neuf
          </h2>
          <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:hidden prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-li:my-0.5 prose-ul:my-2 prose-strong:text-slate-900">
            <ReactMarkdown>{changelog}</ReactMarkdown>
          </div>
        </section>

        {/* Section "Suggérer une amélioration" */}
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2 mb-1">
            <MessageSquarePlus className="w-4 h-4 text-blue-500" />
            Suggérer une amélioration
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Une idée pour rendre Kerbrise plus pratique ? Dis-le ici, ça atterrit
            direct dans la todo.
          </p>
          <FeatureRequestForm />
        </section>
      </div>
    </main>
  );
}