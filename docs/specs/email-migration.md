# Spec — Migration emails vers Next.js + Resend (#28)

> **Statut** : 📋 Spec à affiner, pas encore implémentée
> **Type** : Gros chantier (multi-sessions)
> **Cible** : Pas avant janvier 2027 (lié au prochain cycle de choix été)
> **Estimation** : ~2-3h réparties sur 2-3 sessions
> **Dernière MAJ** : 28 mai 2026

## Contexte & problème

Aujourd'hui, les emails de Kerbrise partent depuis une **Edge Function Supabase** (avec Resend), déclenchée par un **trigger SQL** sur la table `bookings`. Problèmes constatés :

- Difficile à débugger (code hors du repo, dans le dashboard Supabase)
- Le secret `EMAIL_TEST_MODE` ne fonctionne pas comme attendu (continue à spammer la famille en test)
- Pas de versioning Git sur la logique email
- Tester en local impossible

## Objectif

Rapatrier toute la logique email **dans le repo Next.js**, en utilisant Resend directement depuis des **Server Actions** déclenchées au bon moment (création de demande, approbation, etc.).

Avantages :
- Tout dans GitHub (history, review, CI/CD via Vercel)
- Plus de dashboard Supabase séparé pour débugger
- Tests locaux possibles
- Les modes test cohabitent avec les autres flags dans `lib/config.ts`

## Les 3 modes de test (à coder dans `lib/config.ts`)

Un flag `EMAIL_MODE` avec 3 valeurs possibles :

| Mode | Comportement |
|------|--------------|
| `strong` | **Tous** les emails partent uniquement vers l'admin (rien à la famille). Pour tester sans risque. |
| `debug-cci` | Les emails partent normalement aux destinataires, **mais l'admin est en copie cachée (CCI)** de tous. Pour surveiller en prod. |
| `normal` | Comportement normal, chacun reçoit ses emails, pas de CCI. |

L'adresse admin vient d'une variable d'env Vercel : `ADMIN_EMAIL`.

## Étapes de migration

### Session 1 — Core + 3 modes (~1-1.5h)
- Installer `resend` dans le projet Next.js
- Créer le squelette `lib/emails/` (client Resend + helper `sendEmail` qui applique le mode)
- Implémenter la logique des 3 modes (`strong` / `debug-cci` / `normal`)
- Variable `ADMIN_EMAIL` en env Vercel
- Migrer le **1er email** : nouvelle demande → 3 chefs de famille (le plus utile)

### Session 2 — Emails restants (~1-1.5h)
- Approbation / rejet → auteur de la demande
- Tout autre type d'email que l'Edge Function gère actuellement
- *(Inventaire complet à faire avant de commencer — voir ci-dessous)*

### Session 3 — Cleanup + tests (~1h)
- Désactiver proprement le trigger SQL côté Supabase
- Désactiver / supprimer l'Edge Function
- Tests bout-en-bout des 3 modes

## ⚠️ Inventaire des emails à faire AVANT de commencer

Lister tous les types d'emails que l'Edge Function envoie aujourd'hui. À compléter :

- [ ] Nouvelle demande → notification aux 3 chefs de famille pour validation
- [ ] Approbation d'une demande → notification à l'auteur
- [ ] Rejet d'une demande → notification à l'auteur
- [ ] (?) Email de bienvenue / reset password
- [ ] (?) Autres déclencheurs

> Pour faire l'inventaire : lire le code de l'Edge Function dans le dashboard Supabase et repérer chaque template + chaque condition de déclenchement.

## Templates à migrer

Les templates HTML sont actuellement dans l'Edge Function. À rapatrier dans `lib/emails/templates/`. Garder un style cohérent (header Kerbrise, couleurs des familles si pertinent).

## Architecture proposée

```
lib/emails/
├── client.ts              ← init Resend + helper sendEmail(mode-aware)
├── config.ts              ← (ou dans lib/config.ts) EMAIL_MODE + ADMIN_EMAIL
└── templates/
    ├── new-booking.ts     ← nouvelle demande → chefs
    ├── booking-approved.ts
    ├── booking-rejected.ts
    └── ...
```

Le helper `sendEmail` applique le mode automatiquement :
- En `strong` : remplace tous les destinataires par `ADMIN_EMAIL`
- En `debug-cci` : ajoute `ADMIN_EMAIL` en `bcc`
- En `normal` : envoie tel quel

Les points de déclenchement (création de demande, approbation, etc.) appellent le bon template depuis les Server Actions concernées (~5-10 endroits à brancher).

## Lien avec d'autres features

- **#22b** (notifications email pour les choix de période d'été) se fera **en même temps** que cette migration. Cas d'usage : "X a réservé Période N, à Y de choisir" + "votre famille a la Période Z".
- **#29** (Web Push) viendra **après** cette migration, en complément des emails.

## Points ouverts

- Faut-il garder une trace des emails envoyés (table `email_log`) pour debug ?
- Gestion des erreurs d'envoi (retry ? silencieux ? alerte admin ?)
- Faut-il un email de digest hebdo ou on reste sur du transactionnel pur ?

## Liens

- Provider : [Resend](https://resend.com/emails)
- Edge Functions actuelles : dashboard Supabase → Edge Functions
- Flags de config : `lib/config.ts`
