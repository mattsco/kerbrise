"use client";

import { useEffect, useState } from "react";
import { Wifi } from "lucide-react";
import { WIFI_PASSWORD } from "@/lib/config";

type Status = {
  online: boolean | null;
  checkedAt: string;
  boxModel?: string;
};

export default function MaisonStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/maison-status")
      .then((r) => r.json())
      .then((data: Status) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function copyWifiPassword() {
    try {
      await navigator.clipboard.writeText(WIFI_PASSWORD);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = WIFI_PASSWORD;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const online = status?.online;
  const dot =
    online === true
      ? "#16a34a" // vert
      : online === false
        ? "#dc2626" // rouge
        : "#94a3b8"; // slate (inconnu / chargement)

  const state =
    loading || status == null
      ? "…"
      : online === true
        ? "online"
        : online === false
          ? "offline"
          : "—";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          {online === true && (
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
              style={{ backgroundColor: dot }}
            />
          )}
          <span
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: dot }}
          />
        </span>
        <span className="text-sm font-semibold text-slate-900">Freebox</span>
        <span
          className="text-xs font-medium font-mono lowercase"
          style={{ color: dot }}
        >
          {state}
        </span>
      </div>

      <button
        onClick={copyWifiPassword}
        className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition"
      >
        <Wifi className="w-3.5 h-3.5" />
        {copied ? "Mdp copié ✓" : "Copier le mdp"}
      </button>
    </div>
  );
}
