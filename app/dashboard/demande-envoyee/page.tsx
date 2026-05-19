import Link from "next/link";

export default function DemandeEnvoyeePage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-sm bg-white rounded-2xl shadow p-8 text-center">
        <div className="text-5xl mb-4">✉️</div>
        <h1 className="text-xl font-medium mb-2">Demande envoyée !</h1>
        <p className="text-sm text-slate-600 mb-6">
          Les deux autres familles vont être notifiées. Tu seras prévenu
          dès qu'elles auront pris leur décision.
        </p>
        <div className="grid gap-2">
          <Link
            href="/dashboard/calendrier"
            className="block rounded-lg bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800 transition"
          >
            Voir le calendrier
          </Link>
          <Link
            href="/dashboard"
            className="block rounded-lg border border-slate-200 py-2.5 text-sm font-medium hover:bg-slate-50 transition"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </main>
  );
}