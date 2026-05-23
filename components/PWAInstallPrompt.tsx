"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

const DISMISS_KEY = "pwa-install-dismissed-until";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// ===============================
// Device Detection
// ===============================

function isIOS(): boolean {
  if (typeof window === "undefined") return false;

  return (
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

function isAndroid(): boolean {
  if (typeof window === "undefined") return false;

  return /Android/i.test(window.navigator.userAgent);
}

function isMobile(): boolean {
  return isIOS() || isAndroid();
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore iOS standalone
    window.navigator.standalone === true
  );
}

// ===============================
// Local Storage Helpers
// ===============================

type DismissCheck = {
  dismissed: boolean;
  until: number | null;
};

function getDismissStatus(): DismissCheck {
  if (typeof window === "undefined") {
    return { dismissed: false, until: null };
  }

  const raw = localStorage.getItem(DISMISS_KEY);

  if (!raw) {
    return { dismissed: false, until: null };
  }

  const until = parseInt(raw, 10);

  if (isNaN(until)) {
    return { dismissed: false, until: null };
  }

  return {
    dismissed: Date.now() < until,
    until,
  };
}

// ===============================
// Component
// ===============================

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const [platform, setPlatform] = useState<
    "ios" | "android" | "other"
  >("other");

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Pas mobile
    if (!isMobile()) return;

    // Déjà installé
    if (isStandalone()) return;

    // Dismiss récent
    if (getDismissStatus().dismissed) return;

    // ===============================
    // iOS
    // ===============================

    if (isIOS()) {
      setPlatform("ios");

      // iOS n'a pas de beforeinstallprompt
      // On affiche directement
      setShow(true);

      return;
    }

    // ===============================
    // Android
    // ===============================

    if (isAndroid()) {
      setPlatform("android");

      const handler = (e: Event) => {
        e.preventDefault();

        const promptEvent = e as BeforeInstallPromptEvent;

        setInstallPrompt(promptEvent);
        setShow(true);
      };

      window.addEventListener("beforeinstallprompt", handler);

      return () => {
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }
  }, []);

  // ===============================
  // Actions
  // ===============================

  function handleDismiss() {
    const until = Date.now() + SEVEN_DAYS_MS;

    localStorage.setItem(DISMISS_KEY, String(until));

    setShow(false);
    setShowIOSGuide(false);
  }

  async function handleInstall() {
    // iOS guide
    if (platform === "ios") {
      setShowIOSGuide(true);
      return;
    }

    // Android native prompt
    if (platform === "android" && installPrompt) {
      await installPrompt.prompt();

      const { outcome } = await installPrompt.userChoice;

      if (outcome === "accepted") {
        setShow(false);
      }
    }
  }

  // ===============================
  // Render Guard
  // ===============================

  if (!show) return null;

  return (
    <>
      {/* ===============================
          Sticky Bottom Banner
      =============================== */}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-6px_30px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-2xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100">
              <Download className="h-5 w-5 text-blue-700" />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">
                📱 Installer Kerbrise
              </p>

              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {platform === "ios"
                  ? "Ajoute Kerbrise à ton écran d’accueil pour un accès plus simple."
                  : "Installe Kerbrise directement sur ton téléphone pour un accès plus rapide."}
              </p>

              {/* Buttons */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleInstall}
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  Installer
                </button>

                <button
                  onClick={handleDismiss}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  Plus tard
                </button>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-slate-400 transition hover:text-slate-700"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ===============================
          iOS Install Guide
      =============================== */}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  📲 Installer sur iPhone
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Quelques étapes simples.
                </p>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 transition hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Steps */}
            <div className="mt-5 space-y-3">
              {/* Step 1 */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    1
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      Ouvre le menu Partager
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Appuie sur l’icône de partage dans Safari.
                    </p>

                    <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                      <Share className="h-3.5 w-3.5 text-blue-600" />
                      Partager
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    2
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      Choisis “Sur l’écran d’accueil”
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Fais défiler la liste puis sélectionne cette option.
                    </p>

                    <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                      <Plus className="h-3.5 w-3.5" />
                      Sur l’écran d’accueil
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                    3
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      Appuie sur “Ajouter”
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Kerbrise apparaîtra ensuite sur ton téléphone comme une application normale.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
              📱 Tu retrouveras ensuite Kerbrise directement sur ton téléphone, comme une application normale.
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.99]"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}