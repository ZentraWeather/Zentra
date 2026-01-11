# Météo IA Belgique — PWA (Vite + React)

Objectif : une app **toujours en développement** qui se partage par **lien** et s'installe comme une app (PWA).

## Lancer en local (optionnel)
```bash
npm install
npm run dev
```

## Build (pour hébergement)
```bash
npm run build
```
Le dossier `dist/` est statique et peut être hébergé partout.

## Déploiement recommandé (zéro friction)
### Vercel
- Push ce projet sur GitHub
- Import sur Vercel
- Build command: `npm run build`
- Output: `dist`

### Netlify
- Import GitHub
- Build command: `npm run build`
- Publish directory: `dist`

## PWA / mises à jour
- Service Worker en `autoUpdate`
- Si une nouvelle version est dispo, l'app affiche une bannière **« Mise à jour disponible »** → bouton **Recharger**

## Données météo
- Live: Open-Meteo (appel direct depuis le navigateur)
- Fallback: données de démonstration réalistes si le live est indisponible
