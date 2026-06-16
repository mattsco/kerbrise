import { createClient } from "@/lib/supabase/server";
import NestCamera from "@/components/NestCamera";
import WebcamTimer from "@/components/WebcamTimer";
import StMaloWebcams from "@/components/StMaloWebcams";
import { requireAuthUser } from "@/lib/supabase/auth";
import BackButton from "@/components/BackButton";

export default async function WebcamPage() {
  await requireAuthUser();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <BackButton />
        <h1 className="text-2xl sm:text-3xl font-bold mt-2 mb-4">
          Webcams Kerbrise 🌊
        </h1>

        {/* Nest Cam en premier, prioritaire */}
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
          <p className="text-sm text-slate-500 mb-4">
            Vue en direct depuis la Nest Cam de Kerbrise.
          </p>
          <NestCamera />
        </div>

        <p className="text-xs text-slate-400 mt-4 mb-6 text-center">
          La caméra peut prendre quelques secondes à se charger.
        </p>

        {/* Autres webcams de Saint-Malo, chargées à la demande */}
        <StMaloWebcams />

        {/* Timer invisible : tracke le temps passé sur la page webcam */}
        <WebcamTimer />
      </div>
    </main>
  );
}
