import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/config";

/**
 * Service worker de Kerbrise — servi par une route, pas depuis public/.
 *
 * Pourquoi une route plutôt qu'un fichier statique : le nom du cache doit
 * changer à chaque déploiement (cf. spec #37, décision 7). Un fichier statique
 * obligerait à bumper une constante à la main — donc à l'oublier un jour, et
 * à servir un cache périmé sans s'en rendre compte. Ici la version vient du
 * commit Vercel, elle ne peut pas diverger du build.
 *
 * Le script est servi à la racine (/sw.js) : c'est ce qui donne au SW un scope
 * racine, nécessaire pour intercepter toutes les navigations.
 *
 * Périmètre volontairement minuscule (spec #37) : ce SW ne met JAMAIS en cache
 * une page vivante de l'app. Il ne connaît que /hors-ligne. Toute navigation
 * part sur le réseau ; le cache n'est touché que si le réseau échoue. C'est ce
 * qui rend le scénario « la famille voit un vieux dashboard » impossible, et
 * c'est pour ça qu'on peut se passer d'un prompt de mise à jour.
 */

// VERCEL_GIT_COMMIT_SHA n'existe qu'en déploiement. En local, la version du
// package suffit : on redéploie rarement une machine de dev.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? APP_VERSION;

const SW_SOURCE = `
const CACHE = "kerbrise-offline-${BUILD_ID}";
const OFFLINE_URL = "/hors-ligne";

// Les pages hors ligne, calquées sur l'architecture en ligne. OFFLINE_URL en
// tête : c'est le hub, et le secours quand l'URL demandée n'est pas en cache.
const OFFLINE_PAGES = [
  OFFLINE_URL,
  "/hors-ligne/a-propos",
  "/hors-ligne/a-propos/regles",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      // On ne fait PAS cache.addAll : il met en cache tout ce qui répond 200,
      // y compris une redirection suivie vers /login si la session a expiré
      // entre le login et l'install. On vérifierait alors "hors ligne" en
      // affichant un écran de connexion. On contrôle la réponse à la main.
      //
      // Le hub est obligatoire (son échec fait échouer l'install) ; les autres
      // pages sont best effort, pour qu'une section cassée ne prive pas
      // l'appareil de tout l'offline.
      const pages = await Promise.all(
        OFFLINE_PAGES.map(async (url) => {
          const res = await fetch(url, { credentials: "same-origin" });
          if (!res.ok || res.redirected) {
            if (url === OFFLINE_URL) {
              throw new Error("précache refusé : réponse " + res.status);
            }
            return null;
          }
          return { url, res };
        })
      );

      // Le HTML seul ne suffit pas : sans le CSS, la page hors ligne s'affiche
      // en Times New Roman brut. Les noms de fichiers sont hachés par build et
      // inconnus d'ici — on les lit donc dans le HTML qu'on vient de récupérer,
      // ce qui reste juste à chaque déploiement sans liste à maintenir.
      //
      // Les pages partagent l'essentiel de leurs chunks : le Set dédoublonne,
      // donc ajouter une section ne coûte que son HTML.
      let html = "";
      for (const page of pages) {
        if (!page) continue;
        html += await page.res.clone().text();
      }
      // Liste des caractères AUTORISÉS plutôt que des délimiteurs interdits :
      // le HTML contient ces URLs aussi dans des chaînes JSON échappées, et
      // une classe négative y ramassait le backslash de fin — d'où une seconde
      // entrée « …jpg\\ » qui précachait la photo en double.
      const assets = [...new Set(html.match(/\\/_next\\/static\\/[A-Za-z0-9._~%\\/-]+/g) ?? [])]
        // Outillage de dev uniquement (absent des builds de prod, donc filtre
        // sans effet en ligne). Précaché, le client HMR recharge la page en
        // boucle dès qu'il perd le serveur — c'est-à-dire précisément quand on
        // teste le mode hors ligne.
        .filter((url) => !url.includes("hmr-client") && !url.includes("devtools"));

      for (const page of pages) {
        if (page) await cache.put(page.url, page.res);
      }

      // Best effort : un asset manquant ne doit pas faire échouer l'install
      // entière et laisser l'appareil sans offline du tout.
      await Promise.allSettled(
        assets.map(async (url) => {
          const res = await fetch(url, { credentials: "same-origin" });
          if (res.ok) await cache.put(url, res);
        })
      );
    })()
  );

  // Pas de prompt de mise à jour : rien de vivant n'est en cache, donc aucun
  // risque de mélanger vieux HTML et nouveaux assets.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("kerbrise-offline-") && k !== CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Navigations : réseau d'abord, page hors ligne en secours.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          // La page DEMANDÉE si on l'a — c'est ce qui fait marcher la
          // navigation entre sections hors ligne. Sinon le hub : on préfère
          // montrer le point d'entrée plutôt qu'une erreur, quelle que soit
          // l'URL sur laquelle la PWA s'est ouverte.
          const url = new URL(request.url);
          const exact =
            url.origin === self.location.origin
              ? await caches.match(url.pathname, { cacheName: CACHE })
              : null;
          if (exact) return exact;

          const hub = await caches.match(OFFLINE_URL, { cacheName: CACHE });
          // Sans entrée en cache (précache échoué, éviction iOS), on laisse le
          // navigateur afficher sa propre erreur réseau : mieux qu'une page
          // blanche servie par nous.
          return hub ?? Response.error();
        }
      })()
    );
    return;
  }

  // Assets du build : réseau d'abord aussi, cache en secours. Sans ça, la page
  // hors ligne s'afficherait sans CSS. On ne touche QUE /_next/static — ni les
  // appels Supabase, ni aucune autre requête : un cache HTTP de réponses API
  // est explicitement hors périmètre (#37).
  if (request.url.includes("/_next/static/")) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(request, { cacheName: CACHE });
          return cached ?? Response.error();
        }
      })()
    );
  }
});
`.trim();

export function GET() {
  return new NextResponse(SW_SOURCE, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // Le navigateur doit revalider le script à chaque visite, sinon il
      // garderait l'ancien SW (et donc l'ancien nom de cache) jusqu'à 24 h.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
