# Spec — Rappel e-mail « bac bleu » à l'occupant (#40)

> **Statut** : ✅ **Livrée et ACTIVE** — 29 août 2026
> **Type** : Notification / confort d'usage
> **Demandé par** : Antoine, 29 août 2026
> **Cible** : premier envoi réel **mardi 8 septembre 2026** — ⚠️ **la donnée qui l'alimente expire le 31/01/2027** (cf. §7)
> **Dernière MAJ** : 29 août 2026

**Livré** : Edge Function `send-bin-reminder`, modules partagés
`_shared/garbage-collection.ts` (déplacé depuis `lib/`) et
`_shared/house-presence.ts`, template `_shared/templates/rappel-poubelle.ts`,
migrations `0014` et `0015` **appliquées**, cron `bin-reminder` actif.

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
| Date de la prochaine collecte recyclables | `_shared/garbage-collection.ts` (`getNextCollections`) |
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

### D1 — Edge Function, et le calendrier devient un module partagé *(révisée)*

> **Première version** : route Next sur Vercel, pour que le calendrier reste
> dans `lib/` et donc couvert par le check santé #33. Implémentée, déployée,
> puis **abandonnée** — voir pourquoi ci-dessous.

Les cinq e-mails existants partent d'Edge Functions Supabase. Le premier
jet de #40 est parti sur une route Next, au motif que le calendrier des
collectes **expire le 31/01/2027** et devait rester visible du check #33 :
une copie en Deno aurait créé une seconde échéance silencieuse.

Le raisonnement était juste, la conclusion non — parce qu'elle chiffrait mal
le coût d'exploitation. Envoyer depuis Vercel, c'est envoyer depuis une autre
machine que Supabase, donc :

| | Route Next | Edge Function |
|---|---|---|
| Secrets à poser | `CRON_SECRET` + `RESEND_API_KEY` + `EMAIL_FROM`, **et un redéploiement** | **aucun** |
| Clé Resend | en double, Supabase *et* Vercel | une seule |
| Cohérence avec les 5 autres e-mails | rompue | conservée |

La clé Resend en double est le vrai défaut : le jour où on la fait tourner, il
faut penser aux deux endroits, et Vercel est celui qu'on oublie.

**La sortie** : le calendrier n'a pas besoin de vivre dans `lib/`, il a besoin
d'exister **une seule fois**. `garbage-collection.ts` n'a aucun import, donc il
peut vivre dans `_shared/` et être lu par les deux runtimes — exactement le
pont qui existait déjà avec `html.ts`, mais dans l'autre sens. Il déménage donc
dans `supabase/functions/_shared/`, l'app Next l'importe de là (carte
« Prochaines collectes » + tests vitest), et l'Edge Function aussi.

Résultat : source unique **et** couverture #33 préservée **et** zéro secret.
La contrainte « sans import » est documentée en piège n°6 et verrouillée par
les tests.

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

### D6 — Le template rejoint les cinq autres *(révisée avec D1)*

Le retour à une Edge Function met `rappel-poubelle.ts` dans
`_shared/templates/`, avec les cinq autres, et il est rendu par le même outil
de preview (`_dev/preview.ts`, `deno run --allow-write --allow-read`). Un seul
endroit pour voir à quoi ressemblent les e-mails de Kerbrise.

Conséquence assumée : le template **perd ses tests vitest** (il importe
désormais avec des extensions `.ts`, illisibles côté Next). C'est le régime des
cinq autres templates, et c'est cohérent avec la philosophie #34 — on teste la
logique pure, on regarde les e-mails. La logique, elle, garde ses tests :
calendrier, présence et garde horaire vivent dans `_shared/` sans import, et
sont couverts depuis `lib/`.

### D7 — Les couleurs des bacs sont relevées sur place *(29 août 2026)*

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
l'origine. Elles vivent maintenant dans `_shared/garbage-collection.ts`
(`Collection.color` + `emoji`), lu par la carte « Prochaines collectes » comme
par le template. Deux tests verrouillent les hex.

Leçon retenue au passage : **quand la demande et le code se contredisent, c'est
la demande qui a vu la maison.**

## Implémentation

### `_shared/garbage-collection.ts` — le calendrier, déplacé

Vient de `lib/`, inchangé au fond, plus `recyclablesCollectionTomorrow(dateISO)`.
Son arithmétique de dates est écrite à la main : le fichier doit rester **sans
import** pour passer les deux runtimes (piège n°6).

### `_shared/house-presence.ts` — qui est là, et à quelle heure envoyer

`occupantOn`, `parisHour`, `SEND_HOUR_PARIS`. Pur, sans import lui aussi.

### `_shared/templates/rappel-poubelle.ts` — l'e-mail

À côté des cinq autres, sur le même `emailShell`, rendu par le même
`_dev/preview.ts`.

### `send-bin-reminder/index.ts` — l'Edge Function

Chaîne de gardes qui répondent tous `200` :

| Garde | Réponse | Fréquence |
|---|---|---|
| mauvaise heure de Paris | `hors fenêtre d'envoi` | 1 passage sur 2 |
| pas de collecte demain | `pas de collecte recyclables demain` | 1 mardi sur 2 |
| maison vide | `personne à Kerbrise ce soir` | la majorité de l'année |
| personne de coché | `aucun destinataire` + `console.error` | jamais, en principe |

`?force=1` contourne **le seul** garde horaire, pour tester hors de 18 h.
Jamais la collecte ni la présence : sinon le test ne prouverait rien.

### Tests — 12 dans `lib/house-presence.test.ts`

Les deux modules `_shared/` sont couverts **depuis `lib/`**, là où vitest
regarde (`include: ["lib/**/*.test.ts"]`). Ces tests jouent aussi le rôle de
garde-fou du piège n°6 : ils importent les modules côté Next, donc la CI casse
si l'un des deux gagne un import Deno.

## §7 — L'échéance qui conditionne tout

`getNextRecyclables()` renvoie `null` après le **31 janvier 2027**
(`RECYCLABLES_END_*` dans `_shared/garbage-collection.ts`). **La dernière collecte
connue est le mercredi 27 janvier 2027.**

Après cette date, la route répondra `{skipped}` chaque mardi, indéfiniment, et
**personne ne le verra** : pas d'erreur, pas d'alerte, juste un rappel qui
n'arrive plus. C'est exactement le mode de panne décrit dans
`docs/specs/data-coverage-health.md` pour les horaires de marée.

**Cette spec n'est pas complète sans une ligne dans le check #33** :

| Donnée | Fichier | Couverture | Expire |
|---|---|---|---|
| Calendrier collectes recyclables | `_shared/garbage-collection.ts` | 03/06/2026 → 31/01/2027 | **31/01/2027** |

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

## §8 — Activation : faite

Aucun secret n'a eu à être posé, c'est tout l'intérêt de D1.

1. `supabase functions deploy send-bin-reminder` — 7 fichiers, dont les modules
   `_shared/` (le bundler suit les imports relatifs, y compris hors du dossier
   de la fonction).
2. Migration `0015` appliquée → job `bin-reminder`, `0 16,17 * * 2`, actif.

## Validation

Testée le 29 août 2026 **par le chemin exact du cron** — `net.http_post` depuis
Postgres, clé lue dans le vault — et non par un curl à la main : c'est ce
chemin-là qui doit marcher mardi.

```sql
select net.http_post(
  url := 'https://<ref>.supabase.co/functions/v1/send-bin-reminder?force=1',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_key' limit 1)
  ),
  body := '{}'::jsonb
);
-- puis : select status_code, content from net._http_response where id = <id>;
```

Résultat : `200`, `{"sent":0,"skipped":"pas de collecte recyclables demain","today":"2026-08-29"}`.

Ce que ça prouve d'un coup : la fonction est déployée, les modules partagés
sont bien bundlés, l'authentification par le vault passe, la date est calculée
en heure de Paris, et le garde « collecte » fonctionne — **sans envoyer un seul
e-mail**, le 30 août n'étant pas une collecte.

Reste le vrai critère, le seul qui compte : **demander à Vincent le 9 septembre
s'il a reçu l'e-mail la veille au soir, et s'il a servi.**
