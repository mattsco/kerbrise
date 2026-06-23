"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getHealthStatus, type HealthReport } from "./actions";

export default function HealthDisplay() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleLines, setVisibleLines] = useState(0);

  async function runChecks() {
    setLoading(true);
    setReport(null);
    setVisibleLines(0);
    const result = await getHealthStatus();
    setReport(result);
    setLoading(false);
  }

  useEffect(() => {
    runChecks();
  }, []);

  // Animation : afficher les lignes une par une
  useEffect(() => {
    if (!report) return;
    setVisibleLines(0);
    const interval = setInterval(() => {
      setVisibleLines((v) => {
        if (v >= report.results.length) {
          clearInterval(interval);
          return v;
        }
        return v + 1;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [report]);

  const hasFail = report?.results.some((r) => r.status === "fail");
  const hasWarn = report?.results.some((r) => r.status === "warn");
  const skipped = report?.results.filter((r) => r.status === "skip").length ?? 0;
  // `skip` est neutre : tout vert si rien n'est en fail/warn (skips tolérés).
  const allClear = report ? !hasFail && !hasWarn : false;

  return (
    <main className="min-h-screen bg-black text-emerald-400 font-mono p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Back link */}
        <Link
          href="/dashboard/admin"
          className="inline-block text-emerald-500 hover:text-emerald-300 text-xs mb-4 transition"
        >
          ← back
        </Link>

        {/* Header */}
        <div className="border border-emerald-700 rounded p-4 mb-6">
          <pre className="text-emerald-300 text-[10px] sm:text-xs leading-tight overflow-x-auto">
{`▓▒░ KERBRISE SYSTEM HEALTH ░▒▓
================================`}
          </pre>
          <p className="text-emerald-600 text-xs mt-2">
            real-time infrastructure diagnostics
          </p>
        </div>

        {/* Status overview */}
        {report && (
          <div
            className={`border rounded p-3 mb-6 ${
              hasFail
                ? "border-red-500 bg-red-950/30 text-red-300"
                : allClear
                ? "border-emerald-700 bg-emerald-950/30"
                : "border-amber-500 bg-amber-950/30 text-amber-300"
            }`}
          >
            <p className="text-sm font-bold">
              {hasFail
                ? "⚠ SYSTEM DEGRADED"
                : allClear
                ? "✓ ALL SYSTEMS OPERATIONAL"
                : "⚠ WARNINGS DETECTED"}
            </p>
            {skipped > 0 && (
              <p className="text-xs mt-1 text-zinc-500">
                {skipped} check{skipped > 1 ? "s" : ""} skipped (RPC diag non
                installé)
              </p>
            )}
          </div>
        )}

        {/* Diagnostics */}
        <div className="border border-emerald-800 rounded p-4 mb-6 bg-black/50 min-h-[300px]">
          {loading && (
            <div className="text-emerald-500 text-sm">
              <span className="animate-pulse">▓</span> RUNNING DIAGNOSTICS...
            </div>
          )}

          {report && (
            <div className="space-y-1.5 text-xs sm:text-sm">
              {report.results.slice(0, visibleLines).map((r, i) => {
                const statusLabel =
                  r.status === "ok"
                    ? "OK"
                    : r.status === "warn"
                    ? "WARN"
                    : r.status === "skip"
                    ? "SKIP"
                    : "FAIL";
                const statusColor =
                  r.status === "ok"
                    ? "text-emerald-400"
                    : r.status === "warn"
                    ? "text-amber-400"
                    : r.status === "skip"
                    ? "text-zinc-500"
                    : "text-red-400";
                const bracketColor =
                  r.status === "ok"
                    ? "text-emerald-600"
                    : r.status === "warn"
                    ? "text-amber-600"
                    : r.status === "skip"
                    ? "text-zinc-600"
                    : "text-red-600";

                return (
                  <div
                    key={i}
                    className="flex flex-wrap items-baseline gap-x-2 font-mono"
                  >
                    <span className={bracketColor}>[</span>
                    <span className={`${statusColor} font-bold`}>
                      {statusLabel.padEnd(4)}
                    </span>
                    <span className={bracketColor}>]</span>
                    <span className="text-emerald-300">{r.name}</span>
                    <span className="text-emerald-700 flex-1 hidden sm:inline">
                      {".".repeat(Math.max(2, 50 - r.name.length))}
                    </span>
                    <span className="text-emerald-500 break-all">
                      {r.detail}
                    </span>
                  </div>
                );
              })}

              {visibleLines < report.results.length && (
                <div className="text-emerald-600 animate-pulse">▓</div>
              )}

              {visibleLines >= report.results.length && (
                <div className="text-emerald-600 mt-4">
                  &gt; diagnostics complete
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        {report && visibleLines >= report.results.length && (
          <div className="border border-emerald-800 rounded p-3 text-xs space-y-1 text-emerald-600">
            <div>
              <span className="text-emerald-700">last_check</span>
              <span className="text-emerald-700">: </span>
              <span className="text-emerald-400">{report.timestamp}</span>
            </div>
            <div>
              <span className="text-emerald-700">version.commit</span>
              <span className="text-emerald-700">: </span>
              <span className="text-emerald-400">{report.version.commit}</span>
            </div>
            <div>
              <span className="text-emerald-700">env</span>
              <span className="text-emerald-700">: </span>
              <span className="text-emerald-400">
                {process.env.NODE_ENV ?? "production"}
              </span>
            </div>
          </div>
        )}

        {/* Refresh button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={runChecks}
            disabled={loading}
            className="px-4 py-2 border border-emerald-500 text-emerald-400 hover:bg-emerald-950 transition font-mono text-sm rounded disabled:opacity-50"
          >
            {loading ? "[ running... ]" : "[ refresh ]"}
          </button>
        </div>
      </div>
    </main>
  );
}