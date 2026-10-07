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
4. Ne jamais réutiliser les tables ni les API de France compétences sans licence (art. R. 6123-35 du code du travail). Le contrôle des liens ne contacte jamais `api.francecompetences.fr`.
5. Alternatives (`cumul.alternatives`) : deux aides « au choix » (non additionnables) se déclarent comme alternatives, dans un sens ou dans l'autre. À montants égaux, le plan retient l'aide que le plus grand nombre d'autres aides citent (le « pivot », l'aide générale, par exemple `nat-cpf` pour les aides prélevant sur le solde CPF). Toute composante du graphe des alternatives doit être une clique ; les rares exceptions sont justifiées une à une dans `packages/core/tests/donnees-aides-coherence.test.ts`.
6. Catégorie d'une aide : `cout_formation` = elle paie la formation elle-même ; `remuneration_beneficiaire` = revenu ou aide à la personne (rémunération, transport, hébergement, restauration, permis, équipement, mobilité) ; `aide_employeur` = versée à l'entreprise ou à une structure sans payer la formation. Un montant `pourcentage`, `par_heure` ou `par_mois` n'a de sens que pour une aide qui porte sur le coût ou la durée de la formation ; sinon on utilise `forfait` (total maximal) ou `non_chiffre`. Une aide propre à un type de formation (VAE) porte `criteres.types_formation`.

## Mettre à jour une aide

**Source de vérité : les fichiers JSON du catalogue** (`packages/core/data/aides/*.json`). Ne pas relancer `scripts/integrer-recherches.mjs` pour une mise à jour ponctuelle : il réécrit les trois fichiers du catalogue et effacerait les modifications faites à la main.

1. Modifier l'entrée dans le fichier JSON (montant, critères, conditions, démarches, sources, `derniere_verification`).
2. `cd packages/core && npx vitest run` : les tests de données refusent une forme invalide, un identifiant en double, une source non https ou une vérification de plus de 12 mois.
3. `cd backend && npm run check-sources` : aucun lien cassé (voir la section suivante).

## Contrôler les liens

`cd backend && npm run check-sources` vérifie en trois minutes environ toutes les adresses web des données : sources des barèmes OPCO (variantes, alertes, dispositifs), sources et démarches des aides, liens des portails, table IDCC et suggestions NAF, y compris les adresses écrites dans les notes. Aucune clé d'API n'est nécessaire. Le rapport est écrit dans `backend/out/liens.md` (lisible) et `backend/out/liens.json` (complet, avec l'adresse finale quand le site redirige). La commande se termine avec le code 1 s'il reste un lien cassé.

| Classe | Signification | Que faire |
|---|---|---|
| OK | Réponse 2xx ou 3xx. | Rien. Si le site redirige vers une autre adresse de façon durable, mettre l'adresse à jour. |
| Cassé | 404, 410, autre erreur 4xx ou 5xx, nom d'hôte inconnu, certificat refusé, délai de connexion dépassé. | Ouvrir l'adresse dans un navigateur, éventuellement depuis un autre réseau : un délai dépassé peut venir du réseau qui lance le contrôle. Si la page a disparu, trouver la nouvelle adresse officielle, vérifier que l'extrait cité y figure toujours mot pour mot, corriger le fichier JSON, relancer. Sans page de remplacement, le montant n'a plus de source : passer l'aide en `a_confirmer` (règle 2). |
| À vérifier | 401, 403, 429, 503, connexion coupée par le serveur ou réponse hors protocole HTTP. Ce sont en général des protections anti-robots : Légifrance, par exemple, répond 403 aux requêtes automatiques. | Ouvrir l'adresse dans un navigateur. Le contrôle ne les compte pas comme cassées. |
| Ignoré | Adresses de `api.francecompetences.fr`. | Jamais contactées, redirections comprises (règle 4). Une page web ordinaire du même organisme, comme l'outil « Quel est mon OPCO », est vérifiée normalement. |

Le contrôle envoie au plus deux requêtes à la fois vers un même site et ne télécharge pas le contenu des pages (le corps de la réponse est annulé dès les en-têtes).

## Mise à jour automatique

Le workflow `.github/workflows/update-dataset.yml` s'exécute chaque lundi à 06:00 UTC et à la demande (onglet Actions, « Run workflow »).

1. Il lance les tests et le typecheck du core et du backend, puis le contrôle des liens. Le rapport est joint au run (artefact `rapport-liens`) ; un lien cassé ne fait pas échouer le run.
2. Le pipeline d'extraction par IA ne tourne que si le secret `ANTHROPIC_API_KEY` existe (Settings > Secrets and variables > Actions). Sans lui, le run se termine en succès avec un avertissement.
3. Avec le secret, le pipeline met à jour `datasets/` : commit direct si rien n'est à revoir, sinon pull request de revue. Les modèles par défaut sont `claude-haiku-4-5` (extraction) et `claude-opus-5-5` (revue des écarts) ; les variables `EXTRACT_MODEL` et `VERIFY_MODEL` les remplacent.

GitHub désactive un workflow planifié après 60 jours sans activité dans un dépôt public : le réactiver depuis l'onglet Actions si besoin.

## Revue complète (au moins une fois par an, idéalement en janvier et en septembre)

1. Relancer les recherches selon le protocole `docs/recherche-aides/2026-10/PROTOCOLE.md` (un agent par groupe de régions, un par thème national), puis la double vérification (`CONSIGNE-VERIFICATION.md`). Les fichiers `<recherche>.verifie.json` et les rapports `verification-*.md` de la campagne d'octobre 2026 sont archivés dans `docs/recherche-aides/2026-10/` comme modèle ; une nouvelle campagne va dans `docs/recherche-aides/<AAAA-MM>/`.
2. `node scripts/integrer-recherches.mjs docs/recherche-aides/<AAAA-MM>` (le script refuse toute recherche sans version vérifiée), puis lire `rapport-integration.md`. **Revoir la table `CORRECTIONS` du script** : elle consigne les corrections décidées après la campagne d'octobre 2026 (catégories des aides à la personne, majoration RQTH du RFFT, forfaits). Chaque correction vérifie l'état attendu de l'aide et arrête l'intégration si la nouvelle recherche a changé les données : supprimer ou adapter la correction, ne jamais la forcer.
3. Tests (core, backend) et contrôle des liens.

## Publier vers les applications installées

1. `DATASET_CHANGELOG="…" node scripts/build-example-dataset.mjs` (incrémente la version).
2. Mettre `EMBEDDED_DATASET_VERSION` et `EMBEDDED_DATASET_DATE` (`apps/mobile/src/lib/dataset-sync.ts`) à la même version et date.
3. Commit puis push sur `main` : les apps téléchargent `datasets/latest.json` (empreinte SHA-256 vérifiée) au prochain « Vérifier les mises à jour ».

Le site (`apps/web`) embarque les données au moment de son build : après une mise à jour des fichiers JSON, un nouveau build suffit.
