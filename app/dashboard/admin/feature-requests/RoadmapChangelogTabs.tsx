"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Map, History } from "lucide-react";

type Tab = "roadmap" | "changelog";

const PROSE =
  "prose prose-sm max-w-none prose-headings:font-semibold prose-h1:hidden prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-h2:text-slate-900 prose-h3:text-sm prose-h3:text-slate-800 prose-p:text-slate-700 prose-li:text-slate-700 prose-li:my-0.5 prose-ul:my-2 prose-strong:text-slate-900 prose-hr:my-4";

/**
 * Deux docs markdown (ROADMAP.md = ce qui reste, CHANGELOG.md = ce qui est
 * livré) derrière un toggle, pour ne pas empiler les deux sur la page.
 * Défaut = roadmap (ce qu'on veut voir en premier).
 */
export default function RoadmapChangelogTabs({
  roadmap,
  changelog,
}: {
  roadmap: string;
  changelog: string;
}) {
  const [tab, setTab] = useState<Tab>("roadmap");

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      {/* Onglets */}
      <div className="flex border-b border-slate-100">
        <TabButton
          active={tab === "roadmap"}
          onClick={() => setTab("roadmap")}
          icon={<Map className="w-4 h-4" />}
          label="Roadmap"
          hint="à faire"
        />
        <TabButton
          active={tab === "changelog"}
          onClick={() => setTab("changelog")}
          icon={<History className="w-4 h-4" />}
          label="Changelog"
          hint="livré"
        />
      </div>

      {/* Contenu */}
      <div className="p-5">
        <div className={PROSE}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {tab === "roadmap" ? roadmap : changelog}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
        active
          ? "border-purple-500 text-purple-700 bg-purple-50/50"
          : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="text-xs text-slate-400 font-normal">· {hint}</span>
    </button>
  );
}
