import { createClient } from "@/lib/supabase/server";

/**
 * Intégration Oura (usage personnel).
 *
 * Flux OAuth2 server-side :
 *   /api/oura/authorize  → redirige vers Oura (avec un `state` anti-CSRF)
 *   /api/oura/callback   → échange le `code` contre un token, stocke en base
 *
 * Le refresh token Oura est à USAGE UNIQUE : il change à chaque rafraîchissement.
 * On stocke donc access_token + refresh_token + expires_at dans `oura_tokens`
 * (une ligne par user, protégée par RLS). `getValidAccessToken()` rafraîchit
 * automatiquement quand le token a expiré.
 *
 * Doc : https://cloud.ouraring.com/docs/authentication
 */

const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const OURA_API_BASE = "https://api.ouraring.com";

/**
 * Scopes demandés. À éditer selon tes besoins — garde-les minimaux et alignés
 * avec ce qui est déclaré dans /privacy. Scopes disponibles : email, personal,
 * daily, heartrate, workout, tag, session, spo2.
 */
export const OURA_SCOPES = ["personal", "daily", "heartrate"] as const;

function config() {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  const redirectUri = process.env.OURA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Config Oura manquante : OURA_CLIENT_ID / OURA_CLIENT_SECRET / OURA_REDIRECT_URI"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: OURA_SCOPES.join(" "),
    state,
  });
  return `${OURA_AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope?: string;
};

async function postToken(
  body: Record<string, string>
): Promise<TokenResponse> {
  const { clientId, clientSecret } = config();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Oura token endpoint ${res.status}: ${await res.text()}`
    );
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const { redirectUri } = config();
  return postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

/** ISO timestamp d'expiration avec une marge de 60s. */
function expiresAtFrom(expiresIn: number): string {
  return new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();
}

export async function saveTokens(
  userId: string,
  t: TokenResponse
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("oura_tokens").upsert({
    user_id: userId,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: expiresAtFrom(t.expires_in),
    scope: t.scope ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`Supabase upsert oura_tokens: ${error.message}`);
  }
}

/**
 * Retourne un access token valide pour l'utilisateur, en rafraîchissant
 * automatiquement s'il a expiré. Renvoie `null` si l'utilisateur n'a pas
 * encore connecté son compte Oura.
 */
export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("oura_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase select oura_tokens: ${error.message}`);
  }
  if (!data) return null;

  const expired = new Date(data.expires_at).getTime() <= Date.now();
  if (!expired) return data.access_token;

  const refreshed = await refreshAccessToken(data.refresh_token);
  await saveTokens(userId, refreshed);
  return refreshed.access_token;
}

/**
 * Appelle l'API Oura v2 pour un utilisateur donné (token géré + rafraîchi
 * automatiquement). Ex : ouraFetch(userId, "/v2/usercollection/daily_sleep").
 */
export async function ouraFetch<T = unknown>(
  userId: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = await getValidAccessToken(userId);
  if (!token) {
    throw new Error("Compte Oura non connecté");
  }
  const res = await fetch(`${OURA_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Oura API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}
