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
 */

const FREEBOX_API_BASE = process.env.FREEBOX_API_BASE;
const TIMEOUT_MS = 5000;

type StatusPayload = {
  online: boolean | null; // null = non configuré / indéterminé
  checkedAt: string;
  boxModel?: string;
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
    return json({ online: null, checkedAt }, false);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${FREEBOX_API_BASE}/api_version`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    // La Freebox renvoie un JSON contenant api_version / box_model_name.
    const data = (await res.json().catch(() => null)) as
      | { api_version?: string; box_model_name?: string }
      | null;

    const online = res.ok && typeof data?.api_version === "string";

    return json({
      online,
      checkedAt,
      boxModel: data?.box_model_name,
    });
  } catch {
    // AbortError (timeout) ou erreur réseau/DNS/TLS -> box considérée hors ligne.
    return json({ online: false, checkedAt });
  } finally {
    clearTimeout(timer);
  }
}
