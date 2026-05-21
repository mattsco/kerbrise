import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  /** URL de destination (par défaut : /dashboard) */
  href?: string;
  /** Label personnalisé (par défaut : "Tableau de bord") */
  label?: string;
};

export default function BackButton({
  href = "/dashboard",
  label = "Retour",
}: Props) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 -ml-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </Link>
  );
}