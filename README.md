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
npm test         # tests fonctionnels (Vitest + Testing Library)
```

## Sécurité

- Rendu 100 % via échappement JSX (aucun `dangerouslySetInnerHTML`), API en
  HTTPS, requête `encodeURIComponent` **bornée à 100 caractères**, slug encodé,
  réponse API garde-typée, liens externes en `noopener,noreferrer`.
- `index.html` fixe une **Content-Security-Policy** stricte (`default-src 'self'`,
  `connect-src` limité à `https://www.civix.fr`, `object-src 'none'`, sans
  `'unsafe-inline'`) et `referrer: no-referrer` via `<meta>`. Si l'API change de
  domaine, mettre à jour `connect-src`.
- **CI durcie** : permissions au moindre privilège par job (le `build` n'a que
  `contents: read` ; `pages`/`id-token` réservés au `deploy`) et actions
  GitHub épinglées à des **SHAs de commit** (anti-repointage de tag).
- **`npm audit` = 0** (runtime et dev) après mise à niveau Vite 7 / Vitest 3.
- **Limites de plateforme (risque accepté)** : `X-Frame-Options`,
  `X-Content-Type-Options`, `Permissions-Policy`, COOP/COEP et CSP
  `frame-ancestors` sont des **en-têtes de réponse** (ou ignorés en `<meta>`) et
  ne peuvent pas être posés par un GitHub Pages statique. Ils nécessiteraient un
  proxy/CDN en frontal (ex. Cloudflare). Impact faible ici (seule action :
  ouvrir un onglet externe).

## Déploiement

Le push sur `main` déclenche le workflow GitHub Actions
(`.github/workflows/deploy.yml`) qui build et publie sur GitHub Pages :

➡️ https://vincent6785.github.io/fuck-medias/

> Activer une fois dans **Settings → Pages → Build and deployment → Source : GitHub Actions**.

## Branches

- `main` — production (déployée sur Pages)
- `pre-prod` — pré-production / validation
- `dev` — développement
