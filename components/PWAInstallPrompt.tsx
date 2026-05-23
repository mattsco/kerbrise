"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "pwa-install-dismissed-until";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Détection iOS
function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

// Détection si déjà installé (PWA standalone)
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore - iOS specific
    window.navigator.standalone === true
  );
}

// Détection mobile
function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/.test(window.navigator.userAgent);
}

type DismissCheck = {
  dismissed: boolean;
  until: number | null;
};

function getDismissStatus(): DismissCheck {
  if (typeof window === "undefined") return { dismissed: false, until: null };
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return { dismissed: false, until: null };
  const until = parseInt(raw, 10);
  if (isNaN(until)) return { dismissed: false, until: null };
  return { dismissed: Date.now() < until, until };
}

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    // Conditions pour afficher le bandeau
    if (!isMobile()) return; // pas sur desktop
    if (isStandalone()) return; // déjà installé
    if (getDismissStatus().dismissed) return; // a été dismiss récemment

    // Détecte la plateforme
    if (isIOS()) {
      setPlatform("ios");
      setShow(true); // iOS = on affiche direct (pas d'event natif)
    } else {
      setPlatform("android");
      // Pour Android, on attend l'event beforeinstallprompt
      const handler = (e: any) => {
        e.preventDefault();
        setInstallPrompt(e);
        setShow(true);
      };
      window.addEventListener("beforeinstallprompt", handler);

      // Cleanup
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  function handleDismiss() {
    const until = Date.now() + SEVEN_DAYS_MS;
    localStorage.setItem(DISMISS_KEY, String(until));
    setShow(false);
  }

  async function handleInstall() {
    if (platform === "ios") {
      // Ouvrir la mini-modal avec le tuto
      setShowIOSGuide(true);
      return;
    }

    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      }
    }
  }

  if (!show) return null;

  return (
    <>
      {/* Bandeau sticky en bas */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] p-4 sm:p-5">
        <div className="max-w-2xl mx-auto flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-blue-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm">
              📱 Installer Kerbrise sur ton téléphone
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Tu auras une vraie app, plus rapide et sans Safari.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="flex-1 rounded-lg bg-slate-900 text-white text-sm font-medium py-2 px-4 hover:bg-slate-800"
              >
                Installer
              </button>
              <button
                onClick={handleDismiss}
                className="rounded-lg border border-slate-300 text-slate-700 text-sm font-medium py-2 px-4 hover:bg-slate-50"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-700 flex-shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal iOS guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                📱 Installer sur iPhone
              </h2>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              En 3 étapes simples :
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div className="flex-1 text-sm">
                  <p className="text-slate-900">
                    Touche l'icône <strong>Partager</strong> en bas de Safari
                  </p>
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs">
                    <span className="text-blue-600">📤</span>
                    <span className="text-slate-600">Partager</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div className="flex-1 text-sm">
                  <p className="text-slate-900">
                    Fais défiler et choisis{" "}
                    <strong>"Sur l'écran d'accueil"</strong>
                  </p>
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs">
                    <span>➕</span>
                    <span className="text-slate-600">Sur l'écran d'accueil</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div className="flex-1 text-sm">
                  <p className="text-slate-900">
                    Touche <strong>"Ajouter"</strong> en haut à droite
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900">
              💡 Kerbrise apparaîtra sur ton écran d'accueil comme une vraie app !
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium hover:bg-slate-800"
            >
              Compris !
            </button>
          </div>
        </div>
      )}
    </>
  );
}