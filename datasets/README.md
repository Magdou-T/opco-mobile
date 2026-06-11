# `datasets/` — dataset publié & consommé par l'app

Ce dossier contient le **dataset OPCO versionné** que l'application mobile télécharge au démarrage. C'est ici un **exemple/seed** généré depuis les données embarquées (`packages/core/data/opcos/`) ; en production, le **backend** (`backend/`) régénère ces fichiers automatiquement (même format) à chaque exécution du cron.

## Fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | Métadonnées légères lues **en premier** par l'app pour décider s'il faut télécharger. |
| `latest.json` | Le dataset complet le plus récent (ce que l'app télécharge si une nouvelle version existe). |
| `v1.json`, `v2.json`, … | Archives immuables par version (traçabilité). `latest.json` = copie de la dernière. |

## Format du dataset (`latest.json` / `vN.json`)

```json
{
  "version": 1,
  "generatedAt": "2026-06-10T19:25:44.595Z",
  "opcos": [ /* 11 objets OpcoData (cf. packages/core/src/types.ts) */ ]
}
```

## Format du manifest (`manifest.json`)

```json
{
  "version": 1,
  "generatedAt": "2026-06-10T19:25:44.595Z",
  "sha256": "b2a8d3…",
  "opcoCount": 11,
  "changelog": ["Dataset initial (seed) généré depuis les données embarquées"]
}
```

## Contrôle d'intégrité

Le champ `manifest.sha256` est le **SHA-256 hex du contenu exact de `latest.json`**. Après téléchargement, l'app :
1. compare `manifest.version` à la version en cache (télécharge seulement si plus récent) ;
2. recalcule le SHA-256 du `latest.json` reçu et le compare à `manifest.sha256` ;
3. valide la structure via `validateDataset()` de `@opco/core` (schéma Zod + bornes + présence des 11 OPCO) ;
4. en cas d'échec à l'une de ces étapes, **conserve le cache courant** (jamais d'état corrompu).

## Régénérer l'exemple

```bash
node scripts/build-example-dataset.mjs
```

## Servir localement pour tester l'app

```bash
npx serve datasets   # puis pointer expo.extra.datasetBaseUrl sur http://<IP-machine>:3000
```
