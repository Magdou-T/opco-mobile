# `datasets/` : dataset publié & consommé par l'app

> **Avant toute nouvelle build de l'application mobile, publier un jeu de données v4.** Le jeu publié ici (`latest.json`, version 3, juin 2026) est rejeté par le schéma actuel du cœur : une application reconstruite depuis cette branche l'écarte, travaille sur ses données embarquées et, à chaque « Vérifier les mises à jour », le retélécharge pour le refuser. Les APK 1.2.0 déjà installés ne sont pas touchés tant que rien n'est publié ; une publication à cette adresse les toucherait. Détail, mesures et marche à suivre : « Compatibilité avec le cœur actuel », plus bas.

Ce dossier contient le **dataset OPCO versionné** que l'application mobile télécharge quand l'utilisateur touche « Vérifier les mises à jour » (adresse `expo.extra.datasetBaseUrl` de `apps/mobile/app.json` : ce dossier, sur la branche `main` de GitHub). Les versions 1 à 3 (juin 2026) ont été générées par `scripts/build-example-dataset.mjs` depuis les barèmes embarqués de l'époque (`packages/core/data/opcos/`). Le **backend** (`backend/`) peut régénérer ces fichiers (même format) avec son pipeline IA, désactivé par défaut : voir `docs/donnees-aides.md`, section « Mise à jour automatique ». Le site web ne lit pas ce dossier.

## Fichiers

| Fichier | Rôle |
|---|---|
| `manifest.json` | Métadonnées légères lues **en premier** par l'app pour décider s'il faut télécharger. |
| `latest.json` | Le dataset complet le plus récent (ce que l'app télécharge si une nouvelle version existe). |
| `v1.json`, `v2.json`, … | Archives immuables par version (traçabilité). `latest.json` = copie de la dernière. |

## Format du dataset (`latest.json` / `vN.json`)

```json
{
  "version": 3,
  "generatedAt": "2026-06-11T16:15:32.425Z",
  "opcos": [ /* 11 objets OpcoData (cf. packages/core/src/types.ts) */ ]
}
```

Le schéma du cœur (`DatasetSchema`, `packages/core/src/schema.ts`) accepte aussi quatre sections facultatives, `aides`, `idcc`, `naf` et `portails`. Aucun script ne les produit aujourd'hui (voir « Publier un v4 à sections »).

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

Le champ `manifest.sha256` est le **SHA-256 hex du contenu exact de `latest.json`**. Quand l'utilisateur touche « Vérifier les mises à jour », l'app :
1. compare `manifest.version` à la version active (télécharge seulement si elle est plus récente ; pour les données embarquées, la version active est `EMBEDDED_DATASET_VERSION` de `apps/mobile/src/lib/dataset-sync.ts`) ;
2. recalcule le SHA-256 du `latest.json` reçu et le compare à `manifest.sha256` ;
3. valide la structure via `validateDataset()` de `@opco/core` (schéma Zod + bornes + présence des 11 OPCO) ;
4. en cas d'échec à l'une de ces étapes, **conserve le dataset actif** (jamais d'état corrompu).

L'app revalide aussi le dataset en cache **à chaque lecture** : un cache que son cœur refuse est ignoré, et l'app revient à ses données embarquées.

## Compatibilité avec le cœur actuel (mesures du 08/10/2026)

### Le jeu publié est rejeté

`validateDataset()` du cœur de la branche `feature/aides-financements`, lancé sur les fichiers publiés :

| Fichier | Résultat |
|---|---|
| `v1.json`, `v2.json`, `v3.json`, `latest.json` | Rejetés, pour deux raisons seulement : `opcos.3.plafonds_par_taille : taille en double (less_11)` et `taille en double (11_49)`. |

Cause : Constructys (`opcos[3]`) y publie six plafonds par taille, `less_11, less_11, 11_49, 11_49, 50_299, 300_plus` (bâtiment et travaux publics séparés). Le cœur actuel refuse une taille en double (`PlafondsParTailleSchema`), parce que le calcul ne retiendrait que la première entrée. Les données embarquées actuelles n'ont qu'une entrée par taille.

Conséquences pour une application reconstruite depuis cette branche :
- un v3 déjà en cache est écarté à la lecture : l'application travaille sur ses données embarquées (octobre 2026, valides et plus récentes que le v3), étiquetées « version 1 » ;
- `manifest.version` (3) restant supérieur à `EMBEDDED_DATASET_VERSION` (1), chaque « Vérifier les mises à jour » retélécharge `latest.json` (117 Ko) puis affiche « Le dataset téléchargé est invalide et a été rejeté. Les données actuelles restent utilisées. »

Aucune fausse donnée ni perte. L'APK 1.2.0 déjà installé (cœur de juin 2026, qui accepte les tailles en double) n'est pas touché tant que rien n'est publié.

### Règle : avant toute nouvelle build de l'application mobile, publier un v4

Marche à suivre minimale (barèmes seuls), depuis la racine du dépôt :
1. `node scripts/build-example-dataset.mjs`, avec `DATASET_CHANGELOG` (commandes dans `docs/donnees-aides.md`, « Publier vers les applications installées ») : le script écrit `v4.json`, `latest.json` et `manifest.json` (version 4, empreinte SHA-256) à partir des 11 barèmes de `packages/core/data/opcos/`. Essai du 08/10/2026 sur une copie hors dépôt : `{ version: 4, generatedAt, opcos }` accepté par `validateDataset`, 11 OPCO, environ 475 Ko (la taille suit les barèmes), une entrée par taille chez Constructys, empreinte du manifest exacte.
2. Mettre `EMBEDDED_DATASET_VERSION` à 4 et `EMBEDDED_DATASET_DATE` à la date de génération dans `apps/mobile/src/lib/dataset-sync.ts` (lignes 31 à 34) : l'application reconstruite ne retéléchargera pas les données qu'elle embarque déjà.
3. Commit puis push sur `main`, puis construire l'application.

Publier à cette adresse touche aussi les APK 1.2.0 déjà installés. Essai avec le cœur du commit `4a887a0` (celui de l'APK 1.2.0) : ils acceptent le v4, mais ignorent les champs qu'ils ne connaissent pas (seuils horaires par durée, portée du budget annuel, unité des frais de restauration, alertes) et calculent avec leur logique de juin 2026. Exemple mesuré, 35 h à 60 €/h : pour OPCO EP, dont le v4 ne publie plus de plafond horaire général, l'APK 1.2.0 compterait 2 100 € pris en charge (« dépend de l'accord de branche ») là où le moteur actuel ne compte rien et renvoie à l'OPCO ; pour Constructys (11 à 49 salariés), 1 243,20 € contre 665 € pour une formation non qualifiante (1 068,20 € pour une action qualifiante : certification RNCP, diplôme ou CQP, depuis que le moteur actuel réserve les salaires et le forfait de frais annexes à ces actions). Pour laisser les APK 1.2.0 sur le v3, il faudrait publier le v4 à une autre adresse, lue seulement par la nouvelle build (`datasetBaseUrl`), alors que le script n'écrit aujourd'hui que dans `datasets/`. Ce choix revient à l'utilisateur.

### Publier un v4 à sections (aides, table IDCC, suggestions NAF, portails)

C'est la tâche 19 du plan `docs/superpowers/plans/2026-10-05-aides-financements.md`, une journée de travail environ : `scripts/build-example-dataset.mjs` (+20 lignes pour lire `packages/core/data/aides/*.json` et `packages/core/data/idcc/*.json`), `backend/src/publish.ts` (+15), `backend/src/run.ts` (+15), tests (+40), et l'application mobile, qui devrait lire ces sections. À peser :
- la taille : `latest.json` passerait de 117 Ko (v3) à environ 1,9 Mo (mesure en mémoire du 08/10/2026, en JSON indenté comme le script : environ 465 Ko pour les barèmes, 810 Ko pour les aides, 562 Ko pour la table IDCC, 23 Ko pour les suggestions NAF et 25 Ko pour les portails ; ces tailles suivent les données), haché par `expo-crypto` et stocké dans `AsyncStorage` (limite Android de 6 Mo par défaut) ;
- les schémas stricts : `AideSchema` et `IdccEntreeSchema` refusent toute clé inconnue (vérifié : une clé ajoutée à une seule aide, ou à une seule entrée IDCC, fait rejeter tout le dataset). Une application installée refuserait donc tout dataset ultérieur qui ajoute un champ à une aide ou à la table IDCC : elle garderait son cache et afficherait « Le dataset téléchargé est invalide et a été rejeté », sans autre explication. Les barèmes (`OpcoDataSchema`) ignorent au contraire les clés inconnues ;
- le pipeline IA : il ne republie que les barèmes. Activé après un v4 à sections, son premier run produirait un v5 sans aides, table IDCC, suggestions NAF ni portails, commité sur `main` sans revue si aucun écart n'est à revoir (voir `docs/donnees-aides.md`, « Le pipeline IA : désactivé par défaut »).

## Régénérer l'exemple

```bash
node scripts/build-example-dataset.mjs
```

Le script écrit dans ce dossier et incrémente la version : c'est une publication dès que le commit est poussé sur `main` (voir la règle ci-dessus).

## Servir localement pour tester l'app

```bash
npx serve datasets   # puis pointer expo.extra.datasetBaseUrl sur http://<IP-machine>:3000
```
