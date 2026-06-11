# Financement OPCO — app mobile (Expo / React Native)

Application Android du calculateur de financement OPCO. Toute la logique métier
(calcul, schémas, données embarquées) vient du package partagé `@opco/core`
(`packages/core`) — l'app ne réimplémente aucun calcul.

## Développement

```bash
# À la racine du monorepo
npm install

# Lancer le serveur de dev (depuis apps/mobile)
npm run start --workspace mobile
# puis scanner le QR code avec Expo Go (Android)
```

Vérifications :

```bash
npm run typecheck --workspace mobile          # tsc --noEmit
npm run export:android --workspace mobile     # bundle JS Android (sans device)
```

## Données et hors-ligne

- **Premier lancement** : l'app utilise `EMBEDDED_OPCOS` (11 OPCO embarqués dans
  `@opco/core`). La date affichée vient de `EMBEDDED_DATASET_DATE`
  (`src/lib/dataset-sync.ts`).
- **Mise à jour** : le bouton « Vérifier les mises à jour » appelle `syncDataset()` :
  1. GET `<datasetBaseUrl>/manifest.json` (validé par `DatasetManifestSchema`) ;
  2. si `manifest.version` > version active → GET `<datasetBaseUrl>/latest.json` ;
  3. vérification du **SHA-256** annoncé par le manifest (expo-crypto) ;
  4. validation structurelle via `validateDataset()` (`@opco/core`) ;
  5. stockage AsyncStorage. Tout échec (réseau / hash / schéma) conserve le
     dataset courant — jamais d'état cassé.
- `datasetBaseUrl` se configure dans `app.json` → `expo.extra.datasetBaseUrl`
  (placeholder par défaut). Pour tester en local : servir `opco-mobile/datasets/`
  (ex. `npx serve datasets`) et pointer `datasetBaseUrl` sur
  `http://<ip-de-votre-machine>:3000` (le téléphone doit être sur le même réseau).

## Recherche SIREN

`src/lib/siren-client.ts` appelle directement
`https://recherche-entreprises.api.gouv.fr/search` (pas de route serveur) et
reproduit la logique d'extraction IDCC de la V1 web (`complements.liste_idcc`,
fallback `siege` / `matching_etablissements`, exclusion de `0000`), puis
`resolveIdccToOpco()` détermine l'OPCO. Hors connexion, l'utilisateur peut
toujours sélectionner son OPCO manuellement.

## Build APK (EAS)

Le profil `preview` de `eas.json` produit un **APK** installable :

```bash
npx eas-cli login            # nécessite un compte Expo (gratuit)
npx eas-cli build -p android --profile preview
```

> Note : `eas build` nécessite un compte Expo connecté (`eas login`). Aucune
> clé API n'est embarquée dans le projet. L'APK généré est téléchargeable
> depuis le dashboard Expo à la fin du build.

## Structure

```
src/
  app/            # expo-router : _layout, index (accueil), wizard
  components/
    wizard/       # 5 étapes + WizardContainer
    results/      # FundingBreakdown
    ui/           # ProgressBar, ConfidenceBadge, SourceBadge, widgets de formulaire
  hooks/          # useWizard (état + persistance), useSirenLookup, useActiveOpcos
  lib/            # dataset-sync, siren-client, wizard-storage
```
