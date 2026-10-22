# NASJ – application d'apprentissage (React + TypeScript + Tailwind + API Express)

**Écrans** : accueil · onboarding (3 écrans, facultatif, une seule fois) · connexion · inscription (nom, e-mail, mot de passe + confirmation) · mot de passe oublié (3 étapes) · prénom de l'enfant · choix du parcours 3–5 / 5–10 · accueil (reprendre mon parcours, dernière activité, accès rapides) · Parcours tissé (5 niveaux, fiche détaillée) · activités · jeux (images, calcul, mémoire, tissage) · résultats · récompenses · profil · réglages · aide & FAQ.
**Système de design** : couleurs, rayons, ombres dans `tailwind.config.js` ; composants réutilisables dans `src/components/ui.tsx` (Button, Field, PasswordField, ScreenHeader, StateCard, ConfirmDialog, Mascot, MainScreen/BottomNav, YarnHills) et `Weave.tsx` (fils tressés, médaillons, nœuds).


## Lancer toute l'application (frontend + backend)
```bash
npm run server:install            # une fois : dépendances du serveur
npm run server:dev                # terminal 1 -> API http://localhost:4000 (voir server/README.md)
cp .env.example .env              # VITE_API_URL=http://localhost:4000
npm install && npm run dev        # terminal 2 -> http://localhost:5173
```
Sans `.env` (ou `VITE_API_URL` vide) le frontend fonctionne en **mode démo local** (sans serveur). `npm test` lance les tests du frontend, dont l'intégration avec le vrai serveur ; `npm run server:test` lance ceux du serveur.
Pour l'APK : `VITE_API_URL=https://ton-api npm run android:sync` (l'API doit être en HTTPS et ton domaine d'app, ex. `https://localhost`, dans `CORS_ORIGINS`).

## Lancer
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # un seul fichier : dist/index.html
npm test         # parcours complet + mini-jeux
```

## Navigation
Accueil initial → Commencer → connexion (démo) → prénom → **Choisis ton parcours !** (3–5 ans / 5–10 ans) → **Parcours** (5 niveaux) → Accueil / Parcours / Récompenses.
Menu (icône ☰ sur Accueil) : *Retour à l'accueil initial*, *Changer mon parcours*, *Changer de profil* – la progression est toujours conservée.
L'âge 5 appartient aux deux tranches : l'enfant choisit ; un ancien profil « 5 ans » ou moins est migré vers 3–5.

## Assets (extraits de tes images de référence)
- `src/assets/logo.png` – logo NASJ (image « Weaving knowledge »), fond crème rendu transparent
- `src/assets/mascot/*.png` – le même personnage, 7 expressions détourées : joyeux, encourageant, curieux, motive, bravo, concentre (planche « Ses expressions ») + hello (écran d'accueil)
- `src/assets/welcome-hero.jpg` – illustration d'accueil d'origine (ciel, collines, logo, personnage)

## Structure
`src/screens` (Welcome, Auth, Profile, Dashboard, LearningMap, Activity, Progress) · `src/games` (Quiz, Memory, Paint) · `src/store.tsx` (état + localStorage) · `src/data.ts` (niveaux, badges, contenus par âge)

## Android (Capacitor) – obtenir un APK
Le dossier `android/` est déjà généré (icône NASJ, orientation portrait).

**A. Avec Android Studio (le plus simple)**
1. Installe Android Studio : https://developer.android.com/studio
2. `npm install` puis `npm run android:sync`
3. `npm run android:open` → dans Android Studio : *Build ▸ Build Bundle(s) / APK(s) ▸ Build APK(s)*
4. L'APK est dans `android/app/build/outputs/apk/debug/app-debug.apk`

**B. En ligne de commande** (JDK 17+ et Android SDK installés) : `npm run android:apk`

**C. Sans rien installer** : mets le projet sur GitHub, onglet *Actions ▸ Build Android APK ▸ Run workflow*, puis télécharge `nasj-debug-apk`.

Après chaque modification du code web : `npm run android:sync`.
