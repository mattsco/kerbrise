"use client";

import { useEffect, useState } from "react";
import { User as UserIcon, Mail, ShieldCheck, CalendarDays } from "lucide-react";
import { getFamilyColor, isKnownFamily } from "@/lib/families";
import {
  getFamilyPriority,
  getRelevantSummerYear,
  getYearPriorities,
} from "@/lib/summer-priorities";
import { getPontPriorityFamily } from "@/lib/ponts";
import {
  PROFIL_KEY,
  SNAPSHOT_KEY,
  parseProfil,
  parseSnapshot,
  type OfflineProfil,
} from "@/lib/offline-snapshot";

/**
 * Profil hors ligne (#37).
 *
 * On ne montre que ce qui est VRAI sans réseau. Deux sources, dans cet ordre :
 *   1. le snapshot écrit par `/dashboard/profil` — nom, e-mail, rôles,
 *      compteur de séjours ;
 *   2. à défaut, le nom de famille du snapshot calendrier.
 *
 * D'où la dégradation en escalier : qui a ouvert le profil voit tout, qui n'a
 * ouvert que le calendrier voit sa famille et sa priorité, qui n'a rien ouvert
 * voit l'invitation à se connecter.
 *
 * ⚠️ Ces champs personnels vivent dans le localStorage de l'appareil, JAMAIS
 * dans le HTML précaché : ce dernier est partagé par tous ceux qui ouvrent
 * l'app sur ce téléphone. C'est cette distinction qui les rend acceptables
 * ici. Ils sont purgés à la déconnexion.
 */
export default function OfflineProfil() {
  const state = useProfilState();

  if (state === undefined) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-sm text-slate-400">Lecture du profil…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 text-center space-y-1.5">
        <p className="text-sm font-semibold text-slate-900">
          Profil indisponible
        </p>
        <p className="text-xs text-slate-500">
          Ouvre le calendrier une fois avec du réseau : ta famille sera alors
          connue hors ligne.
        </p>
      </div>
    );
  }

  const { profil, familyName, year, priority, priorities, pontFamily } = state;
  const color = getFamilyColor(familyName);

  const eteSentence =
    priority === 1
      ? "tu choisis ta période en premier."
      : priority === 2
        ? `tu choisis ta période après ${priorities[1]}.`
        : `tu choisis ta période après ${priorities[1]} et ${priorities[2]}.`;

  const pontSentence =
    familyName === pontFamily
      ? `Tu as la priorité pour choisir le pont de mai ${year} (en compensation de ta priorité 3 pour l'été).`
      : `${pontFamily} a la priorité pour choisir le pont de mai ${year} (compensation de sa priorité 3 pour l'été).`;

  return (
    <div className="space-y-3">
      <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
        <h2 className="text-xs uppercase tracking-wide text-slate-400 font-medium">
          Mon compte
        </h2>

        {profil?.displayName && (
          <Row icon={<UserIcon className="w-4 h-4 text-slate-400" />} label="Nom">
            <span className="text-slate-900 font-medium">
              {profil.displayName}
            </span>
          </Row>
        )}

        {profil?.email && (
          <Row icon={<Mail className="w-4 h-4 text-slate-400" />} label="Email">
            <span className="text-slate-700 truncate">{profil.email}</span>
          </Row>
        )}

        <Row
          icon={
            <span
              className="w-4 h-4 rounded-full inline-block"
              style={{ backgroundColor: color }}
            />
          }
          label="Famille"
        >
          <span className="text-slate-900 font-medium">{familyName}</span>
        </Row>

        {profil?.roles?.length ? (
          <Row
            icon={<ShieldCheck className="w-4 h-4 text-slate-400" />}
            label="Rôle"
          >
            <div className="flex flex-wrap gap-1.5">
              {profil.roles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
                >
                  {role}
                </span>
              ))}
            </div>
          </Row>
        ) : null}

        {profil?.sejourCount != null && (
          <Row
            icon={<CalendarDays className="w-4 h-4 text-slate-400" />}
            label="Séjours"
          >
            <span className="text-slate-900 font-medium">
              {profil.sejourCount}
            </span>
          </Row>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌞</span>
          <h2 className="text-base font-semibold text-slate-900">
            Ta priorité été {year}
          </h2>
        </div>

        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: color + "20" }}
        >
          <p className="text-sm text-slate-800 leading-relaxed">
            <strong>Priorité {priority}.</strong> Pour l&apos;été {year},{" "}
            {eteSentence}
          </p>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">
          🌸 {pontSentence}
        </p>

        <a
          href="/hors-ligne/a-propos/regles"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition pt-1"
        >
          Voir les règles
        </a>
      </section>
    </div>
  );
}

/** Ligne de la carte « Mon compte », alignée sur la version en ligne. */
function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-slate-500 w-20 flex-shrink-0">{label}</span>
      {children}
    </div>
  );
}

type ProfilState = {
  profil: OfflineProfil | null;
  familyName: string;
  year: number;
  priority: number;
  priorities: { 1: string; 2: string; 3: string };
  pontFamily: string;
};

/** `undefined` = pas encore lu, `null` = rien d'exploitable. */
function useProfilState(): ProfilState | null | undefined {
  const [state, setState] = useState<ProfilState | null | undefined>(undefined);

  useEffect(() => {
    try {
      const profil = parseProfil(localStorage.getItem(PROFIL_KEY));
      const snapshot = parseSnapshot(localStorage.getItem(SNAPSHOT_KEY));

      // Le profil est plus riche et plus récent quand il existe ; le snapshot
      // calendrier reste le filet pour qui n'a jamais ouvert son profil.
      const familyName = profil?.familyName ?? snapshot?.familyName;
      if (!familyName || !isKnownFamily(familyName)) {
        setState(null);
        return;
      }

      const year = getRelevantSummerYear();
      const priority = getFamilyPriority(year, familyName);
      if (!priority) {
        setState(null);
        return;
      }

      setState({
        profil,
        familyName,
        year,
        priority,
        priorities: getYearPriorities(year),
        pontFamily: getPontPriorityFamily(year),
      });
    } catch {
      setState(null);
    }
  }, []);

  return state;
}
