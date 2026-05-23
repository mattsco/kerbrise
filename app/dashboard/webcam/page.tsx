import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NestCamera from "@/components/NestCamera";
import WebcamTimer from "@/components/WebcamTimer";
import BackButton from "@/components/BackButton";

export default async function WebcamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <BackButton />
        <h1 className="text-2xl sm:text-3xl font-bold mt-2 mb-4">
          Webcam Kerbrise 🌊
        </h1>

        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
          <p className="text-sm text-slate-500 mb-4">
            Vue en direct depuis la Nest Cam de Kerbrise.
          </p>
          <NestCamera />
        </div>

        <p className="text-xs text-slate-400 mt-4 text-center">
          La caméra peut prendre quelques secondes à se charger.
        </p>

        {/* Timer invisible : tracke le temps passé sur la page webcam */}
        <WebcamTimer />
      </div>
    </main>
  );
}