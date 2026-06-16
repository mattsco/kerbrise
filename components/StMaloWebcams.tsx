"use client";

import { useState } from "react";

type Webcam = {
  id: string;
  label: string;
  src: string;
};

// Ajoute / retire des cams ici. Chaque src DOIT être embeddable
// (pas de header X-Frame-Options: DENY côté serveur distant).
const WEBCAMS: Webcam[] = [
  {
    id: "stmalo-40",
    label: "Saint-Malo — Plage du Sillon",
    src: "https://www.vision-environnement.com/live/player/stmalo40.php",
  },
  // {
  //   id: "stmalo-xx",
  //   label: "Saint-Malo — Remparts",
  //   src: "https://...",
  // },
  // {
  //   id: "stmalo-yy",
  //   label: "Saint-Malo — Port",
  //   src: "https://...",
  // },
];

export default function StMaloWebcams() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {WEBCAMS.map((cam) => {
        const isActive = activeId === cam.id;
        return (
          <div
            key={cam.id}
            className="bg-white rounded-2xl shadow-sm p-4 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-slate-800">
                {cam.label}
              </h2>
              {isActive && (
                <button
                  onClick={() => setActiveId(null)}
                  className="text-xs text-slate-500 hover:text-slate-700 shrink-0"
                >
                  Arrêter
                </button>
              )}
            </div>

            {isActive ? (
              // Wrapper ratio 16:9 : indispensable pour une iframe
              // en position absolute + width/height 100%.
              <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  src={cam.src}
                  title={cam.label}
                  allowFullScreen
                  scrolling="no"
                  className="absolute inset-0 w-full h-full border-0"
                />
              </div>
            ) : (
              <button
                onClick={() => setActiveId(cam.id)}
                className="relative w-full overflow-hidden rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors flex flex-col items-center justify-center gap-2 text-slate-500"
                style={{ paddingBottom: "0", height: "140px" }}
              >
                <span className="text-3xl">📹</span>
                <span className="text-sm font-medium">Voir en direct</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
