# Maintenir les données : aides, barèmes OPCO, table IDCC

## Où sont les données

| Fichier | Contenu |
|---|---|
| `packages/core/data/opcos/*.json` | Barèmes des 11 OPCO (`derniere_verification`, sources et extraits dans `note`) |
| `packages/core/data/idcc/idcc-opco.json` | Table IDCC → OPCO (titres officiels, fusions, partages, codes échappatoires) |
| `packages/core/data/idcc/naf-suggestions.json` | Suggestions d'OPCO par code NAF (sans IDCC exploitable) |
| `packages/core/data/aides/nationales.json` | Aides nationales, européennes, fonds des non-salariés, fiscalité |
| `packages/core/data/aides/regions.json` | Aides des 18 régions (identifiants `r<code région>-…`) et l'aide de la LADOM pour l'outre-mer |
| `packages/core/data/aides/portails.json` | Portails officiels « pour aller plus loin », un par région |

Le format exact est défini par `packages/core/src/aides/types.ts` et validé par `packages/core/src/schema.ts`.

## Règles

1. Sources officielles uniquement (service-public, travail-emploi, France Travail, Transitions Pro, Agefiph, Régions, OPCO, FAF, Légifrance, URSSAF, impots.gouv).
2. Chaque montant : URL + extrait mot pour mot + date de vérification. Sinon `montant.mode = "non_chiffre"` et `statut = "a_confirmer"`.
3. Un dispositif terminé ou suspendu est retiré (ou `statut = "suspendu"` le temps de la vérification).
4. Ne jamais réutiliser l'API de France compétences, ni les tables de correspondance telles que France compétences les diffuse, sans licence (art. R. 6123-35 du code du travail). Le contrôle des liens ne contacte jamais `api.francecompetences.fr`. La Table SIRET-OPCO publiée sur data.gouv.fr est, elle, sous Licence Ouverte 2.0 (réutilisation libre avec mention de la source et de la date de mise à jour) ; le site ne l'utilise pas à ce jour (décision en attente, voir `docs/demande-licence-france-competences.md`).
5. Alternatives (`cumul.alternatives`) : deux aides « au choix » (non additionnables) se déclarent comme alternatives, dans un sens ou dans l'autre. À montants égaux, le plan retient l'aide que le plus grand nombre d'autres aides citent (le « pivot », l'aide générale, par exemple `nat-cpf` pour les aides prélevant sur le solde CPF). Toute composante du graphe des alternatives doit être une clique ; les rares exceptions sont justifiées une à une dans `packages/core/tests/donnees-aides-coherence.test.ts`.
6. Catégorie d'une aide : `cout_formation` = elle paie la formation elle-même ; `remuneration_beneficiaire` = revenu ou aide à la personne (rémunération, transport, hébergement, restauration, permis, équipement, mobilité) ; `aide_employeur` = versée à l'entreprise ou à une structure sans payer la formation. Un montant `pourcentage`, `par_heure` ou `par_mois` n'a de sens que pour une aide qui porte sur le coût ou la durée de la formation ; sinon on utilise `forfait` (total maximal) ou `non_chiffre`. Une aide propre à un type de formation (VAE) porte `criteres.types_formation`.

## Mettre à jour une aide

**Source de vérité : les fichiers JSON du catalogue** (`packages/core/data/aides/*.json`). Ne pas relancer `scripts/integrer-recherches.mjs` pour une mise à jour ponctuelle : il réécrit les trois fichiers du catalogue et effacerait les modifications faites à la main.

1. Modifier l'entrée dans le fichier JSON (montant, critères, conditions, démarches, sources, `derniere_verification`).
2. `cd packages/core && npx vitest run` : les tests de données refusent une forme invalide, un identifiant en double ou une source non https. `npm run test:fraicheur` (même dossier) signale en plus une vérification de plus de 12 mois ; ce contrôle lit la date du jour, il est donc exclu de `npx vitest run` et lancé chaque lundi par le workflow hebdomadaire.
3. `cd backend && npm run check-sources` : aucun lien cassé (voir la section suivante).

## Contrôler les liens

`cd backend && npm run check-sources` vérifie en trois minutes environ toutes les adresses web des données : sources des barèmes OPCO (variantes, alertes, dispositifs), sources et démarches des aides, liens des portails, table IDCC et suggestions NAF, y compris les adresses écrites dans les notes. Aucune clé d'API n'est nécessaire. Le rapport est écrit dans `backend/out/liens.md` (lisible) et `backend/out/liens.json` (complet, avec l'adresse finale quand le site redirige). La commande se termine avec le code 1 s'il reste un lien cassé.

| Classe | Signification | Que faire |
|---|---|---|
| OK | Réponse 2xx ou 3xx. | Rien. Si le site redirige vers une autre adresse de façon durable, mettre l'adresse à jour. |
| Cassé | 404, 410, autre erreur 4xx ou 5xx, nom d'hôte inconnu, certificat refusé, délai de connexion dépassé. | Ouvrir l'adresse dans un navigateur, éventuellement depuis un autre réseau : un délai dépassé peut venir du réseau qui lance le contrôle. Si la page a disparu, trouver la nouvelle adresse officielle, vérifier que l'extrait cité y figure toujours mot pour mot, corriger le fichier JSON, relancer. Sans page de remplacement, le montant n'a plus de source : passer l'aide en `a_confirmer` (règle 2). |
| À vérifier | 401, 403, 429, 503, connexion coupée ou fermée par le serveur sans réponse, ou réponse hors protocole HTTP. Ce sont en général des protections anti-robots : Légifrance, par exemple, répond 403 aux requêtes automatiques. | Ouvrir l'adresse dans un navigateur. Le contrôle ne les compte pas comme cassées. |
| Ignoré | Adresses de `api.francecompetences.fr` et de ses sous-domaines, quelle que soit l'écriture du nom (majuscules, point final, port, identifiants). | Jamais contactées, redirections comprises (règle 4). Une page web ordinaire du même organisme, comme l'outil « Quel est mon OPCO », est vérifiée normalement. |

Le contrôle envoie au plus deux requêtes à la fois vers un même site et ne télécharge pas le contenu des pages (le corps de la réponse est annulé dès les en-têtes). Une erreur réseau ou une réponse 5xx est retentée une fois ; une boucle de redirections ou un certificat refusé ne l'est pas, car l'échec se reproduirait à l'identique.

## Mettre à jour les données du site

Le site (`apps/web`) embarque les données de `packages/core/data` au moment de son build. Aucun workflow ne les met à jour, et le site ne lit jamais `datasets/`. Une correction n'est visible en ligne qu'après ces quatre étapes :

1. Modifier les fichiers JSON de `packages/core/data/**` (barème d'un OPCO, table IDCC, aide, portail), en suivant les règles ci-dessus.
2. Lancer les tests du core (`cd packages/core && npx vitest run`) et le contrôle des liens (`cd backend && npm run check-sources`).
3. Reconstruire le site : `npm run build --workspace web` écrit l'export statique dans `apps/web/out/`.
4. Redéposer le contenu de `apps/web/out/` sur l'hébergement (Hostinger) : l'archive, le dépôt et la liste de contrôle sont décrits dans `docs/deploiement-site.md`.

## Mise à jour automatique

Le workflow `.github/workflows/update-dataset.yml` s'exécute chaque lundi à 06:00 UTC et à la demande (onglet Actions, « Run workflow »). Une seule exécution tourne à la fois : une exécution lancée pendant une autre attend sa fin.

### Ce qu'il fait aujourd'hui

Son job « controle » n'a que le droit de lecture sur le dépôt. Dans cet ordre :

1. Il lance le contrôle des liens. Le rapport est ajouté au résumé du run et joint au run (artefact `rapports`). Si le contrôle échoue (lien cassé, ou contrôle interrompu), un avertissement apparaît dans le run, qui reste vert. Le contrôle passe avant les tests : un test rouge n'empêche plus le rapport.
2. Il contrôle la fraîcheur des données (`npm run test:fraicheur --workspace @opco/core`) : si la dernière vérification d'un OPCO, d'une aide ou d'un portail date de plus de 12 mois, le résumé du run affiche « Données plus anciennes que 12 mois : revue des données à planifier », avec un avertissement, et le run reste vert ; sinon « Fraîcheur des données : OK ». C'est le rappel de la revue annuelle (plus bas). La CI (`ci.yml`) ne lance pas ce contrôle : une pull request ne passe pas au rouge parce que le temps a passé.
3. Il lance les tests et le typecheck du core et du backend.

Il ne modifie aucune donnée : une anomalie se corrige à la main, comme décrit dans « Contrôler les liens ».

Un échec de `npm ci` (registre npm) ou du contrôle des liens (réseau du runner) peut venir de l'extérieur : relancer le job avant de chercher une cause dans le dépôt.

GitHub désactive un workflow planifié après 60 jours sans activité dans un dépôt public : le réactiver depuis l'onglet Actions si besoin.

### Le pipeline IA : désactivé par défaut

Le pipeline (`npm run live --workspace @opco/backend`) lit les pages des 11 OPCO, fait extraire les montants par Claude, les compare à `datasets/latest.json`, puis réécrit `datasets/` : commit direct sur `main` si rien n'est à revoir, sinon pull request de revue. Les modèles par défaut sont `claude-haiku-4-5` (extraction) et `claude-opus-5-5` (avis sur les écarts) ; les variables `EXTRACT_MODEL` et `VERIFY_MODEL` les remplacent. Le rapport du pipeline, `report.json`, est joint au run dans l'artefact `rapport-pipeline-ia`.

Il met à jour le dataset des applications mobiles, pas le site : le site embarque `packages/core/data` à son build et ne lit jamais `datasets/`.

Il tourne dans un job à part, « pipeline-ia », le seul du workflow à pouvoir écrire dans le dépôt et ouvrir une pull request. Ce job ne démarre que si le job « controle » a réussi et que le secret `ANTHROPIC_API_KEY` ET la variable de dépôt `PIPELINE_LIVE` (valeur `true`) existent (Settings > Secrets and variables > Actions, onglets Secrets et Variables). Quand l'une des deux manque, le run affiche une note qui dit laquelle. Ajouter le secret seul ne déclenche donc aucune étape payante.

Il reste désactivé pour deux raisons :

- Sa base de départ, `datasets/latest.json` (version 3, juin 2026), est rejetée par la validation actuelle : les plafonds de Constructys y ont des tailles en double (`less_11` et `11_49`, voir `datasets/README.md`). Activé, il paierait chaque lundi l'extraction et l'avis du modèle, puis échouerait à la validation sans rien publier. Le dry-run ne le montre pas : il part des données embarquées.
- Il ne republie que les barèmes : `backend/src/run.ts` prend `datasets/latest.json` pour référence et `backend/src/publish.ts` n'écrit que `{version, generatedAt, opcos}`. Après la publication d'un v4 à sections (aides, table IDCC, suggestions NAF, portails), son premier run produirait un v5 sans ces sections, écrit dans `datasets/` et commité sur `main` sans revue si aucun écart n'est à revoir : les applications installées le téléchargeraient. C'est une raison de plus de le laisser désactivé tant que `run.ts` et `publish.ts` ne portent pas ces sections.

Limite de GitHub : la pull request et le commit du pipeline sont faits avec le `GITHUB_TOKEN`. Quand le pipeline crée ou met à jour sa pull request (branche `bot/opco-dataset-update`), la CI (`ci.yml`) démarre en attente d'approbation : la pull request affiche un bandeau, et une personne qui a le droit d'écriture sur le dépôt lance les exécutions par « Approve workflows to run ». Le commit direct sur `main` ne déclenche pas la CI : la lancer à la main (onglet Actions, CI, « Run workflow »), ce qui fonctionne toujours, sur `main` comme sur une autre branche. Source : aide de GitHub, page « Triggering a workflow », section « Triggering a workflow from a workflow », relue le 08/10/2026.

Pour l'activer, dans cet ordre :

1. Réaliser la tâche « dataset v4 » du plan `docs/superpowers/plans/2026-10-05-aides-financements.md` (tâche 19) : réécrire le script de publication, étendre `backend/src/publish.ts` et `backend/src/run.ts` aux nouvelles sections, puis générer et publier la version 4 (voir « Publier vers les applications installées »).
2. Autoriser GitHub Actions à créer des pull requests (Settings > Actions > General > Workflow permissions) : sans ce réglage, l'étape qui ouvre la pull request de revue échoue.
3. Créer la variable de dépôt `PIPELINE_LIVE` (valeur `true`) et le secret `ANTHROPIC_API_KEY`.
4. Lancer le workflow à la main une première fois et lire son résultat avant de le laisser tourner chaque lundi.

## Revue complète (au moins une fois par an, idéalement en janvier et en septembre)

Le workflow hebdomadaire la rappelle : dès qu'une dernière vérification a plus de 12 mois, son résumé affiche « Données plus anciennes que 12 mois : revue des données à planifier ».

1. Relancer les recherches selon le protocole `docs/recherche-aides/2026-10/PROTOCOLE.md` (un agent par groupe de régions, un par thème national), puis la double vérification (`CONSIGNE-VERIFICATION.md`). Les fichiers `<recherche>.verifie.json` et les rapports `verification-*.md` de la campagne d'octobre 2026 sont archivés dans `docs/recherche-aides/2026-10/` comme modèle ; une nouvelle campagne va dans `docs/recherche-aides/<AAAA-MM>/`.
2. Depuis la racine du dépôt : `node scripts/integrer-recherches.mjs docs/recherche-aides/<AAAA-MM>` (le script refuse toute recherche sans version vérifiée), puis lire `rapport-integration.md`. **Revoir la table `CORRECTIONS` du script** : elle consigne les corrections décidées après la campagne d'octobre 2026 (catégories des aides à la personne, majoration RQTH du RFFT, forfaits, et cumul des fonds d'assurance formation des non-salariés avec le CPF : AGEFICE, FAFCEA et FIF PL au choix avec le CPF, FAF PM limité aux formations non certifiantes). Chaque correction vérifie l'état attendu de l'aide et arrête l'intégration si la nouvelle recherche a changé les données : supprimer ou adapter la correction, ne jamais la forcer.
3. Tests (core, backend) et contrôle des liens.

## Publier vers les applications installées

Le site n'en dépend pas. Publier met à jour les applications mobiles déjà installées, donc seulement sur décision explicite de l'utilisateur.

**Avant toute nouvelle build de l'application mobile, publier un jeu de données v4.** Le jeu publié (version 3, juin 2026) est rejeté par le cœur actuel : une application reconstruite l'écarterait, et chaque « Vérifier les mises à jour » le retéléchargerait pour le refuser (mesures et cause : `datasets/README.md`, « Compatibilité avec le cœur actuel »).

Deux chemins :

- v4 minimal, barèmes seuls : `scripts/build-example-dataset.mjs` tel quel écrit `{version, generatedAt, opcos}` avec les 11 barèmes de `packages/core/data/opcos/`, sans aides, table IDCC, suggestions NAF ni portails. Essai hors dépôt du 08/10/2026 : version 4 acceptée par `validateDataset`, environ 475 Ko (la taille suit les barèmes).
- v4 à sections (aides, table IDCC, suggestions NAF, portails) : tâche 19 du plan `docs/superpowers/plans/2026-10-05-aides-financements.md`, une journée environ. Taille (environ 1,9 Mo), schémas stricts des aides et de la table IDCC et risque du pipeline IA : `datasets/README.md`.

Publier à l'adresse actuelle touche aussi les APK 1.2.0 déjà installés : ils acceptent le v4 mais calculent avec leur logique de juin 2026 (exemple mesuré : pour OPCO EP, 2 100 € comptés par l'APK 1.2.0 contre 0 € par le moteur actuel, faute de plafond publié ; détail dans `datasets/README.md`).

Marche à suivre, depuis la racine du dépôt :

1. Générer le dataset (la version s'incrémente ; `DATASET_CHANGELOG` est le texte du journal des changements) :
   - bash : `DATASET_CHANGELOG="…" node scripts/build-example-dataset.mjs`
   - PowerShell : `$env:DATASET_CHANGELOG = "…"; node scripts/build-example-dataset.mjs`, puis `Remove-Item Env:DATASET_CHANGELOG` (la variable reste définie dans la session).
2. Mettre `EMBEDDED_DATASET_VERSION` et `EMBEDDED_DATASET_DATE` (`apps/mobile/src/lib/dataset-sync.ts`) à la même version et date.
3. Commit puis push sur `main` : les apps téléchargent `datasets/latest.json` (empreinte SHA-256 vérifiée) au prochain « Vérifier les mises à jour ». Construire ensuite la nouvelle application.
