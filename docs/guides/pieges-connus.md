# Pièges connus

> Trucs qui ont déjà coûté du temps, et qui ne se voient pas à la lecture du
> code. À compléter dès qu'un piège se répète.

---

## 1. JSX — l'espace entre une expression et le texte suivant saute

**Symptôme** : `« les 2 semaines qui suiventta période »` en production.

```tsx
// ❌ l'espace après } disparaît au rendu
<p>les 2 semaines {verbe} ta période</p>

// ✅ espace explicite
<p>les 2 semaines {verbe}{" "}ta période</p>
```

Dans ce projet, une expression `{…}` suivie d'un espace puis de texte **sur la
même ligne** perd son espace de séparation. L'inverse (texte, espace, puis
expression) fonctionne. Utiliser `{" "}` à chaque jonction expression→texte.

Repéré le 20 juil. 2026 sur les encarts advisory (#39). Invisible aux tests
unitaires et au typage : **seule la vérification dans le navigateur l'attrape**.

---

## 2. Périodes d'été — deux matchings volontairement différents

Les dates réelles ne collent pas aux dates canoniques : sur l'été 2026,
**2 périodes sur 3** sont saisies à un jour près (P1 le 28 au lieu du 29 juin,
P3 jusqu'au 30 au lieu du 31 août). Ce sont des vacances, personne n'est à un
jour près.

D'où deux comportements assumés :

| Usage | Fonction | Matching |
|---|---|---|
| **Réserver** un placeholder d'été (#22a) | `getSummerSnapshot` (`lib/summer-state.ts`) | dates canoniques **exactes** |
| **Reconnaître** qui occupe une période (règles advisory) | `buildPeriodHolders` (`lib/summer-adjacent.ts`) | **tolérant** : ≥ 50 % des nuits de la période |

Pour *réserver* on veut les dates canoniques ; pour *reconnaître* on veut la
réalité du terrain. Ne pas « harmoniser » les deux sans y réfléchir : passer la
réservation en tolérant casserait l'attribution automatique de la 3ᵉ famille.

Conséquence historique : entre #22d et #39, les lignes juin/septembre de
`PriorityCard` ne se sont **jamais affichées** pour 2026 — silencieusement.

---

## 3. Le bypass de login local est serveur uniquement

`DEV_LOGIN_BYPASS` (cf. `lib/supabase/dev-bypass.ts`) fait passer
`requireAuthUser()` côté serveur, mais **le navigateur n'a aucune session
Supabase** : pas de cookie, pas de token.

Donc en dev local avec le bypass :

- les **composants serveur** lisent les vraies données ✅
- les **requêtes client** (`createClient()` de `@/lib/supabase/client`)
  reviennent **vides**, sans erreur ❌

Les encarts advisory (#38, #39) et `getRelatedBookings` passent par le client :
ils s'affichent donc localement comme si la base était vide — un encart peut
même dire « personne n'a encore choisi » à tort. Ce n'est pas un bug applicatif.

**Pour vérifier une surface client en local** : se connecter normalement via
`/login` (sans le bypass), ou forcer temporairement l'état en dur dans le
composant le temps du contrôle visuel.

---

## 4. Le mode hors ligne ne se teste pas en `next dev`

Le service worker (#37) précache `/hors-ligne` et les assets `/_next/static`
lus dans son HTML. En développement, ce lot contient deux chunks d'outillage
Turbopack — le client HMR et les devtools — et ils rendent le test impossible
**dans les deux sens** :

- **Précachés** : le client HMR perd sa websocket dès que le serveur dev
  s'arrête, et recharge la page en boucle. Impossible d'observer quoi que ce
  soit.
- **Exclus du précache** (ce que fait `app/sw.js/route.ts`) : le runtime
  Turbopack ne s'amorce plus sans son chunk HMR, donc **aucun composant client
  ne s'hydrate**. La page hors ligne s'affiche mais reste figée sur ses états
  de chargement — elle a l'air cassée alors qu'elle ne l'est pas.

Le second cas est particulièrement traître : le journal réseau montre tous les
vrais chunks servis en 200 depuis le cache, et seulement `hmr-client` et
`next-devtools` en échec. Tout *semble* correct.

**Ces deux chunks n'existent pas dans un build de production.** La seule
vérification qui vaut :

```
npm run build && npm run start
```

puis enregistrer le SW, couper le serveur, recharger. En prod, l'hydratation
hors ligne fonctionne — vérifié le 21 juillet 2026.

⚠️ `/hors-ligne` est derrière `requireAuthUser()` et `DEV_LOGIN_BYPASS` ne
fonctionne pas en production (cf. piège n°3) : pour un test local, commenter
l'appel le temps de la vérification, ou tester sur un déploiement de preview.

---

## 5. Le service worker ne se met à jour qu'au rechargement

Réenregistrer le service worker depuis la console (`navigator.serviceWorker
.register`) sur une page déjà contrôlée **ne remplace pas** le worker actif :
le navigateur réutilise celui en place. On croit tester la nouvelle version,
on teste l'ancienne — et un cache vide ou périmé ressemble alors à un bug de
précache.

Pour tester une modification du SW en local :

1. changer `VERCEL_GIT_COMMIT_SHA` au lancement du serveur de prod
   (`VERCEL_GIT_COMMIT_SHA=test2 npm run start -- -p 3001`) — le nom du cache
   change, donc on voit tout de suite si la nouvelle version s'installe ;
2. **recharger la page**, puis `await reg.update()` si besoin ;
3. vérifier que l'ancien cache a disparu (`caches.keys()`).

En production ce piège n'existe pas : le navigateur revalide `/sw.js` à chaque
navigation (`Cache-Control: no-cache`) et installe la nouvelle version tout
seul. C'est purement un piège de test manuel.

⚠️ Corollaire découvert à l'étape 3 de #37 : un `fetch` qui **pend** dans
l'`install` laisse le worker bloqué en `installing` pour toujours — ni
installé, ni en échec, donc jamais réessayé. Toutes les requêtes du SW passent
donc par `fetchWithTimeout`. Si un jour le précache « ne fait rien » sans
erreur, c'est la première piste.

## 6. Deux fichiers de `_shared/` doivent rester SANS IMPORT

`supabase/functions/_shared/garbage-collection.ts` et `house-presence.ts` sont
lus par **les deux runtimes** :

- l'Edge Function `send-bin-reminder` (Deno) les importe avec l'extension
  `.ts`, qu'elle exige ;
- l'app Next les importe **sans** extension — le calendrier alimente la carte
  « Prochaines collectes » (en ligne et hors ligne), et les tests vitest
  couvrent les deux modules.

Deno impose l'extension, TypeScript la refuse. **Un fichier qui n'importe rien
est le seul à satisfaire les deux.** Le jour où l'un de ces deux fichiers gagne
un `import { x } from "./y.ts"`, le build Next casse — et l'erreur ne dira pas
pourquoi.

Le garde-fou existe déjà : `lib/garbage-collection.test.ts` et
`lib/house-presence.test.ts` les importent côté Next. Si la contrainte est
violée, `npm test` et `tsc` échouent en CI, tout de suite.

Deux règles :

- **Si un helper devient nécessaire dans l'un de ces fichiers, l'inliner.**
  L'arithmétique de dates de `recyclablesCollectionTomorrow` est écrite à la
  main pour cette raison, plutôt que d'appeler `lib/dates.ts`.
- Ne pas étendre ce pont aux autres fichiers `_shared/` : `dates.ts`,
  `recipients.ts` et `html.ts` importent avec des extensions `.ts` ou
  dépendent de Deno, et ne passeront pas côté Next.

> Historique : une première version de #40 envoyait l'e-mail depuis une route
> Next, ce qui obligeait l'app à importer `_shared/html.ts` — le pont existait
> alors **dans l'autre sens**. Le retour à une Edge Function l'a inversé, pas
> supprimé : dès qu'un module est partagé entre les deux runtimes, la règle
> « sans import » s'applique.
