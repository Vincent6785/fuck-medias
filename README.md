# Trouve ton député

Application web ultra-simple : tape le nom de ton député, choisis-le dans la liste,
et sa page de bilan de votes s'ouvre sur [civix.fr](https://www.civix.fr).

## Fonctionnement

- Recherche en direct via l'API publique CIVIX (`/api/v1/search`), sans backend
  (le CORS de l'API est ouvert, l'appel se fait directement depuis le navigateur).
- Chaque résultat renvoie un `slug` qui construit l'URL finale :
  `https://www.civix.fr/deputes/{slug}?tab=votes-vedettes`.
- Données publiques de l'Assemblée nationale, présentées par CIVIX.fr.

## Développement

```bash
npm install
npm run dev      # serveur local Vite
npm run build    # build de production dans dist/
npm run preview  # prévisualise le build
```

## Déploiement

Le push sur `main` déclenche le workflow GitHub Actions
(`.github/workflows/deploy.yml`) qui build et publie sur GitHub Pages :

➡️ https://vincent6785.github.io/fuck-medias/

> Activer une fois dans **Settings → Pages → Build and deployment → Source : GitHub Actions**.

## Branches

- `main` — production (déployée sur Pages)
- `pre-prod` — pré-production / validation
- `dev` — développement
