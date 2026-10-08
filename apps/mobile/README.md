# Financement OPCO : application mobile (Expo, React Native)

Application Android du calculateur de financement OPCO. Toute la logique métier
(calcul, schémas, données embarquées) vient du paquet partagé `@opco/core`
(`packages/core`) : l'application ne réimplémente aucun calcul.

> **Aucune nouvelle build de l'application avant d'avoir lu `datasets/README.md`,
> section « Compatibilité avec le cœur actuel ».** Le jeu de données v3 publié dans
> `datasets/` est refusé par le schéma actuel du cœur : une application reconstruite
> travaillerait sur ses données embarquées et rejetterait ce jeu à chaque
> « Vérifier les mises à jour ». Les APK 1.2.0 déjà installés continuent avec leur
> copie. Aucun jeu de données v4 n'est publié par la branche « aides et
> financements » (décision du 08/10/2026).

Sur la branche « aides et financements », le code de l'application n'a changé que
pour la configuration de Metro (`metro.config.js` n'explore plus les dossiers
générés du site) et la typographie : tirets cadratins retirés des commentaires et
des textes, dont trois tirets affichés seuls devenus des mots, « Aucun » pour un
reste à charge nul (`FundingBreakdown`, par ligne et au total) et « Non renseigné »
pour une réponse vide du récapitulatif (`StepRecap`).

## Développement

```bash
# À la racine du monorepo (non testée ici)
npm install

# Lancer le serveur de développement (non testée ici)
npm run start --workspace mobile
# puis scanner le QR code avec Expo Go (Android)
```

Vérifications :

```bash
npm run typecheck --workspace mobile          # tsc --noEmit
npm run export:android --workspace mobile     # bundle JS Android, sans appareil (non testée ici)
```

## Données et hors ligne

- **Premier lancement** : l'application utilise `EMBEDDED_OPCOS` (11 OPCO embarqués
  dans `@opco/core`). La date affichée vient de `EMBEDDED_DATASET_DATE` et la version
  de `EMBEDDED_DATASET_VERSION` (`src/lib/dataset-sync.ts`), à mettre à jour avec
  les données avant une nouvelle build (marche à suivre de `datasets/README.md`).
- **Mise à jour** : le bouton « Vérifier les mises à jour » appelle `syncDataset()` :
  1. GET `<datasetBaseUrl>/manifest.json` (validé par `DatasetManifestSchema`) ;
  2. si `manifest.version` est supérieure à la version active, GET `<datasetBaseUrl>/latest.json` ;
  3. vérification du **SHA-256** annoncé par le manifest (expo-crypto) ;
  4. validation de la structure par `validateDataset()` (`@opco/core`) ;
  5. stockage dans AsyncStorage. Tout échec (réseau, empreinte, schéma) conserve le
     jeu de données courant : jamais d'état cassé.
- `datasetBaseUrl` se règle dans `app.json`, champ `expo.extra.datasetBaseUrl`. Il vaut
  `https://raw.githubusercontent.com/Magdou-T/opco-mobile/main/datasets`, le dossier
  `datasets/` de la branche `main` sur GitHub (si le champ manque, le code retombe sur
  l'adresse factice `https://example.invalid/opco-dataset`). Pour tester en local
  (non testé ici) : servir `opco-mobile/datasets/` (par exemple `npx serve datasets`)
  et pointer `datasetBaseUrl` sur `http://<ip-de-votre-machine>:3000` (le téléphone
  doit être sur le même réseau).

## Recherche SIREN

`src/lib/siren-client.ts` appelle directement
`https://recherche-entreprises.api.gouv.fr/search` (pas de route serveur) et
reproduit la logique d'extraction IDCC de la V1 web (`complements.liste_idcc`,
repli sur `siege` puis `matching_etablissements`, exclusion de `0000`), puis
`resolveIdccToOpco()` détermine l'OPCO. Hors connexion, l'utilisateur peut
toujours choisir son OPCO à la main.

## Build APK (EAS)

Lire d'abord l'avertissement en tête de ce fichier. Le profil `preview` de
`eas.json` produit un **APK** installable (commandes non testées ici) :

```bash
npx eas-cli login            # nécessite un compte Expo (gratuit)
npx eas-cli build -p android --profile preview
```

> Note : `eas build` nécessite un compte Expo connecté (`eas login`). Aucune
> clé d'API n'est embarquée dans le projet. L'APK généré se télécharge
> depuis le tableau de bord d'Expo à la fin du build.

## Structure

```
src/
  app/            # expo-router : _layout, index (accueil), wizard
  components/
    wizard/       # 5 étapes et WizardContainer
    results/      # FundingBreakdown
    ui/           # ProgressBar, ConfidenceBadge, SourceBadge, champs de formulaire
  hooks/          # useWizard (état et persistance), useSirenLookup, useActiveOpcos
  lib/            # dataset-sync, siren-client, wizard-storage
```
