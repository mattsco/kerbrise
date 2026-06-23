import Link from "next/link";
import { CheckCircle, XCircle, Info } from "lucide-react";

/**
 * Bandeau de feedback partagé par les pages admin (hub, lab, data...).
 * Le `status` + `message` viennent des searchParams après un redirect de
 * server action. `backHref` = page courante (le lien "OK" recharge sans les
 * params).
 */
export default function AdminFeedbackBanner({
  status,
  message,
  backHref,
}: {
  status: string;
  message: string;
  backHref: string;
}) {
  const config: Record<
    string,
    { wrap: string; text: string; icon: React.ReactNode }
  > = {
    success: {
      wrap: "bg-emerald-50 border-emerald-200 text-emerald-900",
      text: "text-emerald-700",
      icon: <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />,
    },
    error: {
      wrap: "bg-red-50 border-red-200 text-red-900",
      text: "text-red-700",
      icon: <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />,
    },
    info: {
      wrap: "bg-blue-50 border-blue-200 text-blue-900",
      text: "text-blue-700",
      icon: <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />,
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <div className={`border rounded-2xl p-4 flex items-start gap-3 ${c.wrap}`}>
      {c.icon}
      <div className="flex-1 text-sm font-medium">{message}</div>
      <Link
        href={backHref}
        className={`text-xs hover:underline flex-shrink-0 ${c.text}`}
      >
        OK
      </Link>
    </div>
  );
}
