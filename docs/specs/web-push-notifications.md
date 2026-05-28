# Spec — Web Push notifications (#29)

> **Statut** : 🌱 Spec embryonnaire (à étoffer avant implémentation)
> **Type** : Gros chantier (multi-sessions)
> **Dépendance** : À faire **APRÈS** la migration emails (#28)
> **Estimation** : ~4-6h
> **Dernière MAJ** : 28 mai 2026

## Objectif

Permettre à Kerbrise d'envoyer des **notifications push** sur les téléphones des membres de la famille (via l'app installée en PWA), en complément des emails. Plus immédiat qu'un email pour les actions importantes.

## Cas d'usage envisagés

- ✅ "Ta demande de séjour a été validée"
- 🌞 "À toi de choisir ta période d'été" (rotation été)
- 🌞 "Ta famille a réservé la Période X"
- (?) "Une nouvelle demande attend ta validation" (pour les chefs de famille)

## Briques techniques nécessaires

1. **Clés VAPID** : générer une paire de clés (publique/privée) pour signer les push. Stockées en env Vercel.
2. **Service worker** : fichier `sw.js` (ou via le SW de la PWA existante) qui écoute les events `push` et affiche la notification.
3. **Table `push_subscriptions`** : stocke les abonnements push de chaque user (endpoint, clés p256dh/auth, user_id).
4. **UI opt-in** : dans le profil, un toggle "Activer les notifications push" qui demande la permission navigateur et enregistre la subscription.
5. **Endpoint d'envoi** : une fonction serveur qui prend un user_id + un message et envoie le push à toutes ses subscriptions (via la lib `web-push`).

## Architecture pressentie (à confirmer)

```
public/
└── sw.js                       ← service worker (écoute push)

lib/push/
├── client.ts                   ← helpers côté browser (subscribe/unsubscribe)
└── server.ts                   ← envoi push via web-push + VAPID

app/api/push/
├── subscribe/route.ts          ← enregistre une subscription
└── unsubscribe/route.ts        ← retire une subscription

app/dashboard/profil/
└── (toggle opt-in notifications)
```

Table Supabase :
```sql
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
```

## ⚠️ Points d'attention importants

### iOS / Safari PWA
Le Web Push sur iOS n'est supporté **que pour les PWA installées sur l'écran d'accueil** (depuis iOS 16.4), pas dans Safari classique. Vu que Kerbrise est une PWA installable, ça devrait marcher, **mais à tester en priorité** car c'est le cas le plus fragile. Plusieurs membres de la famille sont probablement sur iPhone.

### Permissions
La demande de permission navigateur ne doit se déclencher que sur **action explicite de l'utilisateur** (clic sur le toggle), jamais au chargement de la page — sinon mauvaise UX et risque de refus définitif.

### Doublon avec les emails
Question à trancher : push + email pour le même événement = redondant ?
Pistes :
- Push pour l'immédiat (validation, à toi de jouer), email pour la trace écrite
- Ou centre de préférences où chacun choisit son canal par type d'événement
- En V1, garder simple : push en complément, pas de granularité

## Étapes d'implémentation (estimation)

| Étape | Contenu | Effort |
|-------|---------|--------|
| 1 | Clés VAPID + table `push_subscriptions` + lib `web-push` | ~1h |
| 2 | Service worker + helpers client (subscribe/unsubscribe) | ~1.5h |
| 3 | UI opt-in dans le profil + API routes subscribe/unsubscribe | ~1.5h |
| 4 | Endpoint d'envoi + branchement sur les événements | ~1h |
| 5 | Tests multi-device (priorité iOS PWA) | ~1h |

**Total estimé** : ~4-6h.

## Questions ouvertes (à trancher avant de coder)

- Push + email : complémentaires ou exclusifs ? Centre de préférences ?
- Quels événements exactement déclenchent un push (liste définitive) ?
- Comportement si le user a refusé la permission navigateur (relance ? message ?)
- Faut-il un historique des notifications dans l'app (centre de notifs in-app) ?
- Nettoyage des subscriptions mortes (endpoints expirés renvoient une erreur 410)

## Lien avec d'autres features

- **#28** (migration emails) : prérequis. Les notifications push réutiliseront les mêmes points de déclenchement que les emails.
- **#22b** (notifs été) : un des principaux cas d'usage du push.

## Liens

- Lib serveur : [`web-push`](https://github.com/web-push-libs/web-push)
- Doc Web Push iOS : Apple a activé le support PWA depuis iOS 16.4
