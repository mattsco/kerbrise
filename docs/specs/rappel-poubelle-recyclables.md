# Spec — Rappel e-mail « bac bleu » à l'occupant (#40)

> **Statut** : ✅ **Implémentée le 29 août 2026** — en attente d'activation (cf. §8)
> **Type** : Notification / confort d'usage
> **Demandé par** : Antoine, 29 août 2026
> **Cible** : premier envoi réel **mardi 8 septembre 2026** — ⚠️ **la donnée qui l'alimente expire le 31/01/2027** (cf. §7)
> **Dernière MAJ** : 29 août 2026

**Livré** : `lib/house-alerts.ts` (logique pure, 15 tests), `lib/emails/rappel-poubelle.ts`
(9 tests), `app/api/cron/rappel-poubelle/route.ts`, migrations `0014` (appliquée)
et `0015` (à appliquer après activation), `scripts/preview-rappel-poubelle.ts`.

## Le besoin

> « Envoyer un email à celui qui est en séjour à Kerbrise la veille du ramassage
> de la poubelle bleue (recyclables). On a déjà l'info dans l'app. »

Les **ordures ménagères** passent tous les lundis : c'est un rythme qu'on retient.
Les **recyclables** passent **un mercredi sur deux**, et c'est précisément le
genre de cadence qu'on oublie — surtout quand on arrive pour dix jours et qu'on
n'était pas là au passage précédent. C'est cette collecte-là, et elle seule, qui
mérite un rappel.

L'app connaît déjà les deux informations nécessaires :

| Information | Où elle vit aujourd'hui |
|---|---|
| Date de la prochaine collecte recyclables | `lib/garbage-collection.ts` (`getNextCollections`) |
| Qui est à Kerbrise à une date donnée | `lib/dashboard-banner.ts` (`computeBannerContext`, champ `currentlyAt`) |

Il n'y a donc **aucune donnée nouvelle à produire**. Le travail est un
assemblage : un déclencheur, une sélection de destinataire, un e-mail.

## Ce que ça donne concrètement

Vérifié le 29 août 2026 en croisant `getNextCollections()` avec les séjours
`approved` réellement en base :

| Collecte | E-mail envoyé le | Sur place ce soir-là | Résultat |
|---|---|---|---|
| mer. 9 sept. | mar. 8 sept. | **Vincent** | 📧 |
| mer. 23 sept. | mar. 22 sept. | personne | silence |
| mer. 7 oct. | mar. 6 oct. | **François** | 📧 |
| mer. 21 oct. | mar. 20 oct. | **Antoine** | 📧 |
| mer. 4 nov. → mar. 26 janv. | — | personne | silence |

**Trois e-mails sur les onze collectes restantes**, un par famille. C'est le bon
ordre de grandeur pour calibrer l'effort : cette fonctionnalité doit être
*simple*, pas *robuste à l'échelle*. Tout ce qui ressemble à une file d'attente,
un moteur de règles ou une table de journalisation est hors sujet ici.

## Décisions

### D1 — Le calendrier reste dans `lib/`, l'e-mail part d'une route Next

**C'est la décision structurante.** Les cinq e-mails existants partent d'Edge
Functions Supabase (Deno). Suivre ce modèle imposerait de **réécrire la cadence
« un mercredi sur deux depuis le 3 juin 2026 » en Deno**, à côté de la version
TypeScript qui alimente déjà la page À propos et l'écran TRMNL.

On ne le fait pas, pour une raison précise : ce calendrier **expire le
31/01/2027** (§7). Une copie en Deno serait une seconde échéance silencieuse,
invisible depuis `lib/`, et donc **impossible à couvrir par le check santé
#33** — qui est justement le dispositif prévu pour ce type de péremption.

Donc : **pg_cron appelle une Route Handler Next** (`/api/cron/rappel-poubelle`)
qui importe `lib/garbage-collection.ts` telle quelle.

| | Route Next (retenu) | Edge Function Deno |
|---|---|---|
| Calendrier des collectes | source unique, déjà testée | **dupliqué** |
| Couvrable par le check #33 | oui | non |
| Cohérence avec les 5 e-mails existants | rompue | conservée |
| Nouveau secret à poser | `RESEND_API_KEY` sur Vercel | aucun |

Le coût assumé est l'incohérence : les e-mails ne partiront plus tous du même
endroit. Il est réel, et il est plus petit qu'un calendrier de poubelles en
double exemplaire qui meurt en silence un mardi de janvier.

### D2 — Destinataires : une nouvelle colonne, surtout pas `is_family_head`

Antoine demande « juste à François, Vincent et Antoine, pas toute leur famille ».

Le réflexe serait `is_family_head`. **C'est un piège** : en base, ce drapeau est
vrai pour **cinq** personnes — Antoine, **Claire**, François, Vincent, **Nelly**.
Et il ne signifie pas « représentant de la maison » mais **« a le droit de voter
sur les demandes de séjour »**. Le réutiliser ferait que retirer quelqu'un des
e-mails poubelle lui retirerait son droit de vote. Deux sujets, un seul drapeau :
non.

```sql
alter table users
  add column receives_house_alerts boolean not null default false;

update users set receives_house_alerts = true
  where display_name in ('Antoine', 'Vincent', 'François');
```

Le défaut `false` est délibéré : un nouvel arrivant ne se retrouve pas abonné
sans l'avoir demandé. La colonne est nommée `house_alerts` et non
`bin_reminders` pour couvrir les rappels pratiques à venir (volets, coupure
d'eau…) sans une colonne par sujet — mais **sans construire de système de
préférences** : c'est un booléen, pas un centre de notifications.

**Repli** : si la famille présente n'a personne de coché, on envoie à ses
`is_family_head`, et le check santé le signale. Un rappel qui n'arrive pas est
pire qu'un rappel qui arrive à deux personnes.

### D3 — « Être sur place le mardi soir » = `start_date <= mardi AND end_date > mardi`

La convention de l'app : `nuits = end_date - start_date`, donc **`end_date` est
le jour du départ, pas la dernière nuit**. D'où la borne stricte :

| Séjour | Mardi 8 sept. | E-mail ? | Pourquoi |
|---|---|---|---|
| 1ᵉʳ → 8 sept. | part le matin | non | ne dort pas là le mardi soir |
| 1ᵉʳ → 9 sept. | part le mercredi | **oui** | dort là le mardi, sort le bac avant de partir |
| 8 → 15 sept. | arrive le mardi | **oui** | est là le soir |

Le jour de relais (une famille part, l'autre arrive le même mardi) se résout
donc tout seul : **c'est l'arrivante qui reçoit l'e-mail**, ce qui est correct —
c'est elle qui sera là le soir.

#### La limite du modèle, à assumer explicitement

Une réservation appartient à une **famille**, pas à une personne. L'app sait que
« famille Vincent est à Kerbrise du 31 août au 14 septembre » ; elle ne sait
**pas** si Vincent lui-même y est, ou si ce sont Nelly, Nico et Elisabeth.

L'e-mail part donc au **référent de la famille présente**, qui peut être à
200 km de la maison. C'est acceptable — il transmet, et c'est de toute façon
ainsi que la famille fonctionne déjà — mais il faut que la formulation ne
présuppose rien : dire « la collecte passe demain à Kerbrise », **jamais**
« pensez à sortir *votre* bac ». Le corps d'e-mail du §4 suit cette règle.

Rendre ça exact demanderait de savoir qui dort là, donc une saisie par séjour
que personne n'a demandée. Hors périmètre, et probablement pour toujours.

### D7 — Les couleurs des bacs vivent dans `lib/`, et elles ont été relevées sur place *(29 août 2026)*

Erreur corrigée après coup : la demande initiale disait « poubelle **bleue**
(Recyclables) », mais le code affichait 🟡 pour les recyclables et 🟢 pour les
ordures ménagères, et j'ai suivi le code plutôt que la demande. Antoine, sur
place, a relevé les vraies couleurs :

| Bac | Couleur réelle | Avant (faux) |
|---|---|---|
| Recyclables | **bleu `#08288b`** 🔵 | vert-jaune `#A38800` 🟡 |
| Ordures ménagères | **marron `#97675e`** 🟤 | vert `#1F5C26` 🟢 |

Ces valeurs étaient **codées en dur dans `NextCollections.tsx`**, donc invisibles
depuis l'e-mail — deux endroits pour une même vérité, dont un faux depuis
l'origine. Elles remontent dans `lib/garbage-collection.ts` (`Collection.color`
+ `emoji`), et la carte « Prochaines collectes » comme l'e-mail les lisent
désormais de là. Trois tests verrouillent les hex et interdisent le retour du
🟡 dans l'e-mail.

Leçon retenue au passage : **quand la demande et le code se contredisent, c'est
la demande qui a vu la maison.**

### D4 — Recyclables uniquement

Les ordures ménagères passent **tous les lundis**. Un e-mail hebdomadaire pour
un rythme que tout le monde connaît deviendrait du bruit, et le bruit tue les
notifications utiles. Si la demande vient, ce sera une ligne de plus dans le
même e-mail, pas un second canal.

### D5 — 18 h à Paris, toute l'année *(révisée à l'implémentation)*

> Version initiale : « `0 16 * * 2`, et on assume 18 h l'été / 17 h l'hiver,
> comme le digest ». **Antoine a demandé 18 h**, pas « 17 h ou 18 h selon la
> saison » — et la correction coûte trois lignes.

pg_cron parle UTC ; 18 h à Paris vaut **16 h UTC l'été, 17 h UTC l'hiver**.
Plutôt qu'une conversion de fuseau dans le SQL, le job se déclenche **aux deux
heures** (`0 16,17 * * 2`) et la route laisse passer celle qui vaut réellement
18 h à Paris (`parisHour`, verrouillé par test). Exactement un des deux
passages envoie, changement d'heure compris.

Le test `« exactement une des deux exécutions du cron passe le garde »` boucle
sur quatre mardis de part et d'autre du 25 octobre 2026 : si le garde se
cassait, il enverrait zéro ou deux e-mails, et le test le dit.

### D6 — L'habillage vient du fichier Deno partagé *(ajoutée à l'implémentation)*

Découvert en codant : les cinq e-mails existants partagent
`supabase/functions/_shared/html.ts` (image d'en-tête, pastille, CTA, pied de
page). D1 envoyant celui-ci dans une route Next, le réflexe aurait été de
recopier ce squelette — donc **deux habillages à corriger** au prochain
changement de design, exactement ce que #37 a refusé pour le guide télé.

`html.ts` n'ayant **aucun import**, Next peut l'importer tel quel. Le pont est
fragile (il casse si quelqu'un y ajoute un `import "./x.ts"`), donc un test
rend le template pour de vrai : la CI casse tout de suite plutôt que le
déploiement. Documenté comme **piège n°6** dans `docs/guides/pieges-connus.md`.

## Implémentation

### 1. Logique pure — `lib/house-alerts.ts` (~1 h avec les tests)

Zéro I/O, testé, dans l'esprit #34 :

```ts
/** La famille qui dort à Kerbrise la nuit du `dateISO`, ou null. */
export function occupantOn(
  bookings: { start_date: string; end_date: string; family_id: string }[],
  dateISO: string
): { family_id: string } | null;

/**
 * La collecte recyclables dont `dateISO` est la veille, ou null.
 * S'appuie sur getNextCollections — pas de seconde implémentation du calendrier.
 */
export function recyclablesCollectionTomorrow(dateISO: string): Collection | null;
```

Tests à écrire : jour de relais (départ + arrivée le même jour), départ le
mercredi, arrivée le mercredi, aucun séjour, séjour `pending` ignoré,
**mardi qui n'est pas une veille de collecte** (une semaine sur deux), et le
comportement après le 31/01/2027 (`null`, pas une exception).

### 2. Route Handler — `app/api/cron/rappel-poubelle/route.ts` (~1 h 30)

```
POST /api/cron/rappel-poubelle
Authorization: Bearer <CRON_SECRET>
```

1. Rejette si le secret ne correspond pas → `401`. La route est publique par
   construction ; #35 a supprimé une route publique inutile, on n'en rouvre pas
   une sans verrou.
2. `recyclablesCollectionTomorrow(todayInParis())` → si `null`, `200 {skipped}`.
   **C'est le cas une semaine sur deux**, ce n'est pas une erreur.
3. Séjours `approved` chevauchant aujourd'hui → `occupantOn` → si `null`,
   `200 {skipped: "personne sur place"}`.
4. Destinataires = `users` de cette famille avec `receives_house_alerts`, repli
   sur `is_family_head`, filtrés sur « déjà connecté au moins une fois » (même
   règle que le digest).
5. Envoi Resend. `EMAIL_TEST_MODE` / `TEST_EMAIL` respectés comme les cinq
   fonctions existantes — indispensable pour tester sans écrire à la famille.
6. Réponse JSON explicite (`{sent, recipients, collection}`) pour que le déclenchement
   manuel serve de test.

### 3. Cron — `db/migrations/0014_bin_reminder_cron.sql` (~15 min)

Décalque de `0004_weekly_digest_cron.sql` : `cron.unschedule` défensif, clé lue
depuis `vault.decrypted_secrets`, jamais en dur.

```sql
select cron.schedule('bin-reminder', '0 16 * * 2', $$
  select net.http_post(
    url := 'https://kerbrise.fr/api/cron/rappel-poubelle',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
$$);
```

Le job tourne **tous les mardis** ; c'est la route qui décide s'il y a lieu
d'envoyer. Mettre la cadence « un mardi sur deux » dans l'expression cron
recréerait le calendrier à un troisième endroit (cf. D1).

### 4. L'e-mail (~45 min)

Le lecteur principal a ~80 ans et le lit sur un téléphone. Une information par
ligne, pas de colonne, pas de tableau.

**Texte écrit par Antoine**, repris tel quel à un accord près (*poubelle* est
féminin → « bleue ») :

```
Objet : 🔵 Petit rappel — la poubelle bleue, ce soir

Hello Vincent,

Le camion des recyclables passe demain matin.

N'oublie pas de sortir la poubelle bleue 😉
```

Trois versions ont été écartées avant celle-là, toutes trop bavardes : encadré
avec la date, liste des consignes de tri, rappel du rythme du bac marron. Un
rappel de la veille n'a besoin d'aucun des trois.

- **Pas de date dans le corps.** L'e-mail arrive le mardi soir : « demain
  matin » est sans ambiguïté, et la date reste dans l'objet du cron et la
  réponse JSON pour le débogage.
- **Pas de consignes de tri.** Personne n'apprend à trier dans un rappel.
- **Tutoiement direct assumé** (« n'oublie pas ») — ça revient sur la prudence
  de D3, et c'est le choix d'Antoine : « s'ils ne sont pas à Kerbrise ils
  forwarderont ».

Un test verrouille les trois lignes au mot près et impose un corps sous
220 caractères, pour que la prochaine version ne regrossisse pas en douce.

> ⚠️ **Cet e-mail part à la famille, pas à un serveur.** Toute retouche de la
> copie doit être relue à l'orthographe — l'accord de « bleue » avait sauté au
> premier jet et personne ne l'aurait vu avant Vincent.

Pas de bouton, pas de lien de désabonnement maison : trois destinataires qui se
parlent tous les jours. Le pied de page renvoie vers `kerbrise.fr` comme les
autres e-mails.

## §7 — L'échéance qui conditionne tout

`getNextRecyclables()` renvoie `null` après le **31 janvier 2027**
(`RECYCLABLES_END_*` dans `lib/garbage-collection.ts`). **La dernière collecte
connue est le mercredi 27 janvier 2027.**

Après cette date, la route répondra `{skipped}` chaque mardi, indéfiniment, et
**personne ne le verra** : pas d'erreur, pas d'alerte, juste un rappel qui
n'arrive plus. C'est exactement le mode de panne décrit dans
`docs/specs/data-coverage-health.md` pour les horaires de marée.

**Cette spec n'est pas complète sans une ligne dans le check #33** :

| Donnée | Fichier | Couverture | Expire |
|---|---|---|---|
| Calendrier collectes recyclables | `lib/garbage-collection.ts` | 03/06/2026 → 31/01/2027 | **31/01/2027** |

Le seuil `warn` à 60 jours sonnerait fin novembre 2026 — largement à temps pour
relever le calendrier 2027 sur le site de Saint-Malo Agglo (secteur C). À
défaut, la fonctionnalité meurt cinq mois après sa naissance.

## Ce qu'on ne fait pas

- **Pas de rappel ordures ménagères** (D4).
- **Pas de préférences de notification par utilisateur.** Un booléen, modifiable
  en SQL. Si un jour il en faut trois, ce sera la page `/admin/config` (#25).
- **Pas de table `sent_reminders`.** pg_cron ne réessaie pas un `net.http_post`
  échoué ; le risque de doublon est théorique, et le coût d'un doublon est un
  e-mail en trop chez trois personnes.
- **Pas de SMS ni de push.** #29 a été tranché sur données le 25 août : les
  e-mails suffisent à cette famille.
- **Pas d'accusé de réception** (« bac sorti ✅ »). Personne ne l'a demandé, et
  ça transformerait un rappel en corvée.

## §8 — Activation (ce qui reste à faire)

Le code est déployable en l'état, mais **rien ne partira** tant que ces trois
étapes ne sont pas faites — dans cet ordre :

1. **Déployer** (la route doit répondre avant que le cron ne l'appelle).
2. **Variables d'environnement Vercel** : `CRON_SECRET` (à générer),
   `RESEND_API_KEY`, `EMAIL_FROM`. Pour la recette : `EMAIL_TEST_MODE=true` +
   `TEST_EMAIL`.
3. **Même valeur de `CRON_SECRET` dans le vault Supabase** :
   `select vault.create_secret('<valeur>', 'cron_secret');`
   puis appliquer la migration `0015`.

⏳ **Marge disponible** : la prochaine collecte est le mercredi 9 septembre,
donc le premier envoi réel est le **mardi 8 septembre à 18 h**. Le mardi
1ᵉʳ septembre n'est pas une veille de collecte — un cron activé d'ici là
répondra `{skipped}` sans rien envoyer, ce qui est un bon galop d'essai.

## Validation

Recette en mode test, avec `?force=1` pour contourner **le seul garde horaire**
(jamais la collecte ni la présence — sinon le test ne prouverait rien) :

```bash
curl -X POST "https://kerbrise.fr/api/cron/rappel-poubelle?force=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

| Quand | Réponse attendue |
|---|---|
| Un mardi de collecte, quelqu'un sur place | `{sent:1, recipients:["Vincent"]}` → e-mail sur `TEST_EMAIL` |
| Un mardi **hors** collecte | `{skipped:"pas de collecte recyclables demain"}` |
| Maison vide | `{skipped:"personne à Kerbrise ce soir"}` |
| Sans le header `Authorization` | `401` |
| Sans `?force=1`, hors de 18 h | `{skipped:"hors fenêtre d'envoi", heureParis:…}` |

Puis le vrai critère, le seul qui compte : **demander à Vincent le 9 septembre
s'il a reçu l'e-mail la veille, et s'il a servi.**
