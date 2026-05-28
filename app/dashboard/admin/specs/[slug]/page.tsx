import { readFile } from "fs/promises";
import path from "path";
import ReactMarkdown from "react-markdown";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/lib/supabase/auth";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default async function SpecPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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

  // Sécurité : empêche le path traversal (../, /, etc.)
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    notFound();
  }

  let content: string;
  try {
    const filePath = path.join(process.cwd(), "docs", "specs", `${slug}.md`);
    content = await readFile(filePath, "utf-8");
  } catch {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <BackButton href="/dashboard/admin/feature-requests" label="Retour Product" />

        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6">
          <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h1:mb-3 prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-slate-900 prose-h3:text-sm prose-h3:text-slate-800 prose-p:text-slate-700 prose-li:text-slate-700 prose-li:my-0.5 prose-ul:my-2 prose-strong:text-slate-900 prose-hr:my-4 prose-code:text-xs prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-900 prose-pre:text-xs prose-table:text-xs prose-blockquote:border-l-slate-300 prose-blockquote:text-slate-600">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </main>
  );
}