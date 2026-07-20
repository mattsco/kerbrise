"use client";

// Encart advisory « ponts de mai » (#38) — purement informatif, JAMAIS bloquant.
// Réutilisé par NewBookingForm (vue demandeur, cas A/B/C) et BookingDetailModal
// (vue validateur, faits bruts). Style ambre, aligné sur l'encart période d'été.

import type {
  DemanderPontAdvisory,
  ValidatorPontAdvisory,
} from "@/lib/ponts";

/** Joint des libellés à la française : "a", "a et b", "a, b et c". */
function joinFr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

function pontNames(ponts: { label: string }[]): string {
  return joinFr(ponts.map((p) => p.label));
}

const cardClass =
  "bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5 text-xs text-amber-900";

/** Vue demandeur — cas A (priorité), B (équité), C (positif) cumulables. */
export function PontAdvisoryForm({
  advisory,
}: {
  advisory: DemanderPontAdvisory | null;
}) {
  if (!advisory) return null;
  const { ponts, priorityFamily, priorityPendingLabel, caseA, caseB, caseC } =
    advisory;
  if (!caseA && !caseB && !caseC) return null;

  const couvre = `Ces dates couvrent le ${pontNames(ponts)}`;

  return (
    <div className={cardClass}>
      {caseA && (
        <p className="leading-relaxed">
          🌸 {couvre}. Cette année c&apos;est <strong>{priorityFamily}</strong> qui
          choisit son pont en premier (compensation de sa priorité 3 cet été)
          {priorityPendingLabel ? (
            <>
              {" "}
              — {priorityFamily} a demandé le {priorityPendingLabel}, en attente
              de validation.
            </>
          ) : (
            <> et n&apos;a pas encore choisi.</>
          )}{" "}
          Ta demande reste possible — elle sera soumise à validation comme
          d&apos;habitude.
        </p>
      )}

      {caseC && (
        <p className="leading-relaxed">
          🌸 {caseA ? "" : `${couvre}. `}Tu es prioritaire pour choisir ton pont
          ce printemps — c&apos;est ton tour.
        </p>
      )}

      {caseB && (
        <p className="leading-relaxed">
          ⚖️{" "}
          {caseB.alreadyApproved ? (
            <>
              Ta famille a déjà le {joinFr(caseB.heldLabels)} ce printemps.
            </>
          ) : (
            <>Cette demande te donnerait le {joinFr(caseB.heldLabels)}.</>
          )}{" "}
          Les ponts sont partagés équitablement —{" "}
          <strong>{joinFr(caseB.deprived)}</strong>{" "}
          {caseB.deprived.length > 1 ? "n'en ont" : "n'en a"} encore aucun.
        </p>
      )}
    </div>
  );
}

/** Vue validateur — faits bruts, aucune reco d'accepter/refuser. */
export function PontAdvisoryValidator({
  advisory,
}: {
  advisory: ValidatorPontAdvisory | null;
}) {
  if (!advisory) return null;
  const { ponts, priorityFamily, priorityChosen, priorityPendingLabel, takenPonts } =
    advisory;

  return (
    <div className={cardClass}>
      <p className="leading-relaxed">
        🌸 Ce séjour couvre le <strong>{pontNames(ponts)}</strong>. Prioritaire
        ce printemps : <strong>{priorityFamily}</strong>{" "}
        {priorityChosen ? (
          <>(a déjà choisi son pont)</>
        ) : priorityPendingLabel ? (
          <>(a demandé le {priorityPendingLabel}, en attente)</>
        ) : (
          <>(n&apos;a pas encore choisi son pont)</>
        )}
        .
      </p>
      {takenPonts.length > 0 && (
        <p className="leading-relaxed">
          Ponts déjà pris :{" "}
          {joinFr(takenPonts.map((t) => `${t.label} → ${t.family}`))}.
        </p>
      )}
    </div>
  );
}
