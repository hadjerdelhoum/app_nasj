# NASJ – Backend (API + base de données)

Serveur **Node.js + Express + TypeScript**, base **SQL (SQLite via `node:sqlite`)**, API REST, authentification par jeton, progression et récompenses calculées **côté serveur**.

## Lancer

```bash
cd server
npm install
cp .env.example .env        # puis adapter si besoin
npm run dev                 # http://localhost:4000  (crée la base, applique les migrations, charge le contenu)
```
Prérequis : **Node.js 22.13+** (SQLite intégré, aucune base à installer).

Frontend branché sur ce serveur (autre terminal, à la racine du projet) :
```bash
cp .env.example .env        # VITE_API_URL=http://localhost:4000
npm install && npm run dev  # http://localhost:5173
```
Sans `VITE_API_URL`, le frontend reste en **mode démo local** (données dans le navigateur uniquement).

| Commande (dans `server/`) | Rôle |
|---|---|
| `npm run dev` / `npm start` | démarre l'API (migrations + contenu appliqués au démarrage) |
| `npm run migrate` | applique les migrations seulement |
| `npm run seed` | recharge le contenu (parcours, niveaux, activités) ; compte de dev si `SEED_DEV_ACCOUNTS=1` |
| `npm test` / `npm run typecheck` | tests et vérification TypeScript |

## Base de données
Fichier SQLite : `DATABASE_PATH` (défaut `./data/nasj.db`, ignoré par git). Schéma : `migrations/001_init.sql`, puis `002_account.sql` (colonnes ajoutées sans rien supprimer : les comptes existants sont conservés).

`users` (+ `display_name`, `recovery_hash`) · `sessions` · `learning_paths` · `children` · `levels` · `level_age_groups` · `activities` · `child_level_progress` · `activity_attempts` (historique) · `star_ledger` (journal des étoiles) · `rewards` · `ai_adventures`.
Les contraintes (clés étrangères, `UNIQUE`, `CHECK`) sont dans la base elle-même : un doublon de récompense est impossible même si le code a un bug.

**Seed** : `seedReference` (parcours/niveaux/activités) est idempotent et ne touche jamais aux comptes ni à la progression. Le compte de développement n'est créé que si `SEED_DEV_ACCOUNTS=1`, hors production, avec `DEV_SEED_PASSWORD` fourni par l'environnement, et jamais écrasé s'il existe.

> Utiliser PostgreSQL plus tard : le SQL est volontairement simple, mais il faudra remplacer `src/db.ts` et quelques fonctions SQLite (`strftime`, `INSERT OR IGNORE`, `BEGIN IMMEDIATE`). Ce n'est **pas** fait ni testé ici.

## Règles métier (appliquées par le serveur)
- **Tranches d'âge 3–5 / 5–10.** L'âge 5 appartient aux deux : un groupe explicite compatible est toujours accepté ; avec seulement `age: 5`, le groupe est `AGE_FIVE_GROUP` (défaut `3-5`) ; un âge incompatible avec le groupe → `422 AGE_GROUP_MISMATCH` (jamais de réaffectation silencieuse). Changer de groupe ne supprime rien : progression, étoiles et récompenses sont liées à l'enfant et au niveau, pas au groupe.
- **Niveaux** : le niveau 1 est disponible ; le suivant se débloque quand le précédent est `completed`. Démarrer un niveau verrouillé → `403 LEVEL_LOCKED`, même par appel direct.
- **Étoiles** : 3 / 2 / 1 selon les erreurs (quiz) ou les essais (mémoire) ; tissage = 3. Seule l'**amélioration** du meilleur score ajoute des étoiles ; +1 étoile bonus par jour (défi du jour). Le client ne peut envoyer ni étoiles, ni score, ni récompense (schémas stricts → `400`).
- **Réponses** : les bonnes réponses restent dans la base. `POST /attempts/:id/answer` répond seulement `correct: true/false`.
- **Transaction + idempotence** : fin d'activité, progression, étoiles, déblocage et badges sont écrits dans **une seule transaction** ; renvoyer la même requête (ou deux en parallèle) ne crée ni étoile ni badge en double.

## API (`/api`, JSON, `Authorization: Bearer <token>`)
Erreurs : `{ "error": { "code": "…", "message": "…" } }`.

| Méthode & chemin | Rôle |
|---|---|
| `POST /auth/register` `{email,password≥8,displayName?}` → `201 {token,user,recoveryCode}` | créer un compte parent |
| `POST /auth/login` → `{token,user}` · `POST /auth/logout` → 204 | |
| `GET /auth/me` → `{user,children}` · `PATCH /auth/me` `{displayName}` | profil du compte parent |
| `POST /auth/change-password` `{currentPassword,newPassword}` → 204 | change le mot de passe (les autres appareils sont déconnectés) |
| `POST /auth/recover/reset` `{email,recoveryCode,newPassword}` → `{ok,recoveryCode}` | **mot de passe oublié** : voir ci-dessous |
| `POST /auth/recovery-code` `{password}` → `{recoveryCode}` | (re)génère le code de récupération (connecté + mot de passe) |
| `DELETE /auth/me` `{password}` → 204 | suppression du compte et de toutes les données (mot de passe exigé) |
| `GET/POST /children` · `GET/PATCH/DELETE /children/:childId` | profils enfants (`displayName`, `ageGroup` ou `age`, `avatar`, `preferences{explored,language}`) |
| `GET /learning-paths` · `GET /learning-paths/:pathId` · `GET /children/:id/learning-path` | parcours 3–5 et 5–10 |
| `GET /children/:id/activities` | toutes les activités du groupe de l'enfant avec leur état (verrouillée / terminée / étoiles) |
| `GET /children/:id/levels` · `GET /children/:id/levels/:levelId` · `GET /levels/:levelId` | états des niveaux (`locked/available/in_progress/completed`) |
| `GET /levels/:levelId/activities?ageGroup=` · `GET /activities/:activityId` | activités (sans réponses) |
| `POST /children/:id/activities/:activityId/start` → `{attemptId,questions\|config}` | démarre une tentative (403 si niveau verrouillé) |
| `POST /attempts/:attemptId/answer` `{questionId,optionId}` → `{correct,solved}` | vérifie une réponse |
| `POST /activities/:activityId/submit` `{attemptId,moves?,cells?}` → `{stars,deltaStars,dailyBonus,totalStars,levelCompleted,unlockedLevelId,newRewards,duplicate}` | termine la tentative |
| `GET /children/:id/progress` · `/progress/summary` · `/history` | progression complète, résumé, historique |
| `GET /children/:id/rewards` · `/stars` | récompenses et journal d'étoiles |
| `GET /ai/status` · `POST /children/:id/loom/adventures` · `GET …/loom/adventures` · `GET /adventures/:id/hint/:index` · `POST /adventures/:id/submit` | Métier à Tisser Magique |

`GET /health` (sans authentification) pour la supervision.

## Récupération du mot de passe (sans service e-mail)
Aucun serveur d'e-mail n'est configuré, et les « questions de sécurité » sont une méthode faible (réponses devinables). À la place :
- à l'inscription, le serveur génère un **code de récupération** aléatoire (16 caractères, ~80 bits), l'affiche **une seule fois** et ne garde que son hash scrypt ;
- `POST /auth/recover/reset` exige l'e-mail **et** le code ; les erreurs sont génériques (un compte inconnu et un mauvais code reçoivent la même réponse) ;
- **5 mauvais codes verrouillent la récupération de ce compte pendant 15 minutes** (la connexion normale n'est pas affectée) ;
- un succès change le mot de passe, **remplace le code par un nouveau**, et déconnecte tous les appareils, en une seule transaction ;
- les anciens comptes sans code peuvent en générer un connectés (Réglages), avec leur mot de passe.
Pour une vraie réinitialisation par e-mail, il faudra brancher un service d'envoi (SMTP) : non fait ici.

## Sécurité
Mots de passe : **scrypt** + sel (paramètres stockés). Jetons : 256 bits aléatoires, **seul le hash SHA-256 est stocké**, expiration `SESSION_DAYS`, révoqués à la déconnexion. Connexion sans énumération de comptes. Un parent n'accède qu'à ses enfants (les autres reçoivent `404`). Validation `zod` stricte (champs inconnus refusés), requêtes SQL paramétrées, limite de débit (10 tentatives/min sur l'authentification, 300/min sur l'API), CORS limité à `CORS_ORIGINS`, corps limité à 20 Ko, en-têtes de sécurité, erreurs sans trace ni détail interne, journal sans corps de requête ni en-têtes. Données minimales : prénom/surnom et tranche d'âge ; suppression d'un profil = suppression de **toutes** ses données (cascade).

## Métier à Tisser Magique (IA, optionnel)
Désactivé tant que `ANTHROPIC_API_KEY` est vide : `POST …/loom/adventures` répond alors `503 AI_NOT_CONFIGURED` (rien n'est simulé). Avec une clé, **seul le serveur** appelle le fournisseur (`AI_MODEL`, `AI_TIMEOUT_MS`). La réponse est validée (structure, longueur, vocabulaire inadapté, liens, langue FR/AR) ; si le fournisseur est indisponible ou la sortie invalide/dangereuse, une aventure pré-écrite sûre est servie (`source: "fallback"`). Les réponses attendues et explications ne sont envoyées qu'après la soumission ; le score est calculé par le serveur ; le badge « Tisseur magique » n'est donné qu'une fois.
**Il n'existe pas encore d'écran pour cette fonction dans le frontend** : l'API est prête et testée, l'interface reste à créer.

## Limites connues
Réinitialisation du mot de passe par e-mail non implémentée ; limite de débit en mémoire (un seul processus) ; HTTPS à assurer devant le serveur (proxy) en production ; PostgreSQL non utilisé.
