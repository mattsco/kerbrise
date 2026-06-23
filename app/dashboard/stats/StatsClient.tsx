"use client";

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Compteur qui monte de 0 → `value` (easeOutCubic) au montage.
 * Remonte tout seul quand on change d'année car le parent est keyé par année.
 * Respecte prefers-reduced-motion (affiche la valeur finale directement).
 */
export function CountUp({
  value,
  suffix = "",
  duration = 900,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || value === 0) {
      setDisplay(value);
      return;
    }

    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}

export type BarSegment = {
  key: string;
  pct: number;
  color: string;
  title?: string;
};

/**
 * Barre segmentée dont chaque segment pousse de 0 → sa largeur cible via une
 * transition CSS. `delay` permet d'échelonner plusieurs barres (effet cascade).
 */
export function GrowBar({
  segments,
  delay = 0,
}: {
  segments: BarSegment[];
  delay?: number;
}) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setGrown(true);
      return;
    }
    const t = setTimeout(() => setGrown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="h-full flex">
      {segments.map((s) =>
        s.pct > 0 ? (
          <div
            key={s.key}
            title={s.title}
            style={{
              width: grown ? `${s.pct}%` : "0%",
              backgroundColor: s.color,
              transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        ) : null
      )}
    </div>
  );
}
