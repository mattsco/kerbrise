import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Vérifie si la box de la maison (Freebox de Saint-Malo) est joignable.
 *
 * Principe : on interroge l'endpoint public et NON authentifié `/api_version`
 * de Freebox OS via son accès distant HTTPS (domaine stable freeboxos.fr +
 * certificat Let's Encrypt). Si la box répond un JSON valide -> en ligne.
 * Timeout / erreur réseau -> hors ligne.
 *
 * On ne fait PAS de ping ICMP (impossible en serverless) et on ne dépend pas
 * de l'IP publique (dynamique) : le domaine freeboxos.fr est stable.
 *
 * Config : FREEBOX_API_BASE = "https://kerbrise.freeboxos.fr:62089"
 *   ⚠️ À définir AUSSI dans les env vars Vercel (.env.local n'est pas déployé),
 *   sinon prod -> reason "no-env" (point gris).
 *
 * ⚠️ DÉPENDANCE BOX (fragile) : le port HTTPS direct n'est ouvert que si, dans
 * Freebox OS > Gestion des accès > Paramètres, la case « Activer
 * l'authentification par mot de passe » est cochée. Le firmware récent n'a PAS
 * d'interrupteur on/off d'accès distant. Si cette case se décoche (ex. reset
 * d'autorisations après changement de mdp admin), le port se ferme -> reason
 * "fetch-error" / "timeout" et le voyant repasse rouge. La solution robuste
 * reste #14 (heartbeat sortant depuis la maison), pas cette sonde entrante.
 */

const FREEBOX_API_BASE = process.env.FREEBOX_API_BASE;
const TIMEOUT_MS = 5000;

type StatusPayload = {
  online: boolean | null; // null = non configuré / indéterminé
  checkedAt: string;
  boxModel?: string;
  /**
   * Pourquoi ce statut. Permet de distinguer une box réellement éteinte d'une
   * mauvaise config (DNS/TLS/port). Sans ça, tout échec s'écrase en "offline"
   * et le voyant est indébogable. Valeurs : "ok" | "no-env" | "timeout" |
   * "dns" | "tls" | "http-<code>" | "no-api-version" | "fetch-error".
   */
  reason?: string;
  /** Message d'erreur brut (diagnostic uniquement). */
  detail?: string;
};

function json(payload: StatusPayload, cache = true) {
  return NextResponse.json(payload, {
    headers: cache
      ? { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" }
      : { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const checkedAt = new Date().toISOString();

  if (!FREEBOX_API_BASE) {
    // Variable d'env absente : on renvoie "indéterminé" sans casser la page.
    // ⚠️ Cas classique en prod : .env.local n'est PAS déployé sur Vercel.
    return json({ online: null, checkedAt, reason: "no-env" }, false);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${FREEBOX_API_BASE}/api_version`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return json({ online: false, checkedAt, reason: `http-${res.status}` });
    }

    // La Freebox renvoie un JSON contenant api_version / box_model_name.
    const data = (await res.json().catch(() => null)) as
      | { api_version?: string; box_model_name?: string }
      | null;

    if (typeof data?.api_version !== "string") {
      return json({ online: false, checkedAt, reason: "no-api-version" });
    }

    return json({
      online: true,
      checkedAt,
      boxModel: data.box_model_name,
      reason: "ok",
    });
  } catch (err) {
    // Distingue les modes d'échec au lieu de tout écraser en "offline".
    const e = err as Error & { cause?: { code?: string } };
    const msg = e?.message ?? String(err);
    const code = e?.cause?.code ?? "";
    let reason = "fetch-error";
    if (e?.name === "AbortError" || e?.name === "TimeoutError")
      reason = "timeout";
    else if (code === "ENOTFOUND" || /getaddrinfo|ENOTFOUND/.test(msg))
      reason = "dns";
    else if (/certificate|TLS|SSL|ERR_TLS|self-signed|unable to verify/i.test(msg))
      reason = "tls";
    return json({ online: false, checkedAt, reason, detail: msg });
  } finally {
    clearTimeout(timer);
  }
}
