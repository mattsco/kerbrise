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
