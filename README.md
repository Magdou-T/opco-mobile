# Financement OPCO : site web, application mobile et moteur partagé

Ce dépôt réunit ce qui sert à estimer le financement d'une formation par les OPCO et par les autres aides. Le moteur de calcul et les données vivent dans `packages/core` (`@opco/core`), importé par :

- le site financementOPCO (`apps/web`) : simulateur, fiches des 11 OPCO, guides et page légale. C'est un export statique Next.js, déposé sur un hébergement mutualisé Apache (Hostinger), et la cible finale du projet ;
- l'application Android (`apps/mobile`) : l'estimation du financement par l'OPCO, hors ligne, avec des montants qui peuvent se mettre à jour par le jeu de données publié dans `datasets/`. Son code n'a pas changé avec la version « aides et financements » (hors configuration de Metro et typographie : tirets cadratins retirés des commentaires et des textes, dont trois tirets affichés seuls devenus « Aucun » ou « Non renseigné »), mais le cœur qu'elle importe, si : avant toute nouvelle build, lire `datasets/README.md`, section « Compatibilité avec le cœur actuel » ;
- le backend (`backend`) : le contrôle des liens sources et un pipeline d'extraction par IA, qui peut corriger les montants du jeu de données mobile (désactivé par défaut : voir « Contrôle des liens et maintenance »).

> Spécification de la version « aides et financements » : `docs/superpowers/specs/2026-10-05-aides-financements-design.md`.

## Monorepo (npm workspaces)

```
opco-mobile/
├── packages/core/      @opco/core : logique métier partagée (aucune dépendance d'interface)
│   ├── src/            types · calculator (pur) · opco-resolver · schema (Zod) · aides (moteur) · entreprise (lecture de l'API recherche-entreprises) · geo (régions, départements) · data
│   ├── data/           opcos/ (les 11 OPCO sourcés) · idcc/ (idcc-opco.json, naf-suggestions.json) · aides/ (catalogue, portails)
│   └── tests/          tests du cœur (moteur, schéma, données, aides, scénarios)
├── apps/mobile/        Expo / React Native : l'application, l'APK
│   ├── src/app/        écrans (expo-router) : accueil et parcours
│   ├── src/components/ parcours en 5 étapes · FundingBreakdown · badges
│   ├── src/lib/        dataset-sync · siren-client
│   └── eas.json        profil « preview » : APK installable
├── apps/web/           site financementOPCO : Next.js 16, export statique dans apps/web/out
│   ├── src/            app/ (pages) · components/ · hooks/ · lib/ ; données de packages/core/data embarquées au build
│   ├── tests/          tests du site (node:test)
│   ├── public/         logo-sfg.png · .htaccess (Apache)
│   └── DESIGN.md       système de design SFG : jetons, primitives, contrastes, interdits
├── backend/            @opco/backend : pipeline d'extraction par IA (désactivé par défaut) et contrôle des liens
│   ├── src/            scrape → extract (IA) → verify → correct → validate → publish · check-sources
│   ├── sources/        opco-sources.json (adresses officielles par champ)
│   └── tests/          tests du pipeline et du contrôle des liens
├── datasets/           jeu de données publié et versionné pour l'application mobile (manifest, latest, vN)
├── docs/               donnees-aides.md (maintenance des données) · deploiement-site.md (dépôt du site sur Hostinger) · integration-wordpress.md (affichage dans une page WordPress, Divi) · demande-licence-france-competences.md (brouillon) · recherche-aides/ (campagne d'octobre 2026, archivée) · superpowers/ (spécification et plan)
├── scripts/            build-example-dataset.mjs (jeu de données des barèmes) · integrer-recherches.mjs (catalogue d'aides) · check-charte-sfg.mjs (garde de charte du site et garde des tirets) · calibrer-suggestions-naf.mjs (mesure des suggestions d'OPCO par code NAF sur la Table SIRET-OPCO)
└── .github/workflows/  ci.yml (vérifications et build du site) · update-dataset.yml (liens, fraîcheur et tests chaque lundi ; pipeline IA désactivé)
```

Les scripts `add-dispositifs.mjs` et `add-variantes.mjs` ont été supprimés le 08/10/2026 : ils remplaçaient en entier les dispositifs complémentaires et les variantes de branche des OPCO qu'ils citaient, et les relancer effaçait tout ce qui avait été ajouté depuis juin 2026.

`packages/core` est la source de vérité : le site, l'application et le backend l'importent tous les trois, si bien que le schéma et le calcul ne peuvent pas diverger.

## Démarrage rapide

```bash
npm install                              # à la racine (workspaces) ; non testée ici
npm test                                 # tests du cœur
npm run test --workspace @opco/backend   # tests du backend
npm run test:web                         # tests du site
```

### Lancer l'application en développement (non testé ici)
```bash
cd apps/mobile
npx expo start                      # Expo Go ou émulateur Android
```

### Construire l'APK (compte Expo nécessaire ; non testé ici)

Lire d'abord `datasets/README.md`, section « Compatibilité avec le cœur actuel » : aucune nouvelle build avant la publication d'un jeu de données v4.

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build -p android --profile preview   # APK installable
```

### Site web

```bash
npm run dev --workspace web         # serveur de développement, http://localhost:3000 (non testée ici)
npm run build --workspace web       # export statique dans apps/web/out (non testée ici)
npm run lint --workspace web
npm run check:charte                # garde de charte SFG du site
npm run check:tirets                # tirets cadratins dans tout le dépôt
```

Le build télécharge les polices Google : il demande une connexion Internet. L'export (`apps/web/out`) se dépose tel quel sur l'hébergement ; la procédure de dépôt sur Hostinger, ce qu'il faut compléter avant (page légale, nom de domaine), la liste de contrôle et les limites connues sont dans `docs/deploiement-site.md`. Pour l'afficher dans une page WordPress (Divi), dans un cadre, sans son en-tête ni son pied de page : `docs/integration-wordpress.md`. Le workflow `.github/workflows/ci.yml` rejoue les vérifications et construit le site à chaque pull request et à chaque push sur `main`, puis conserve l'export pendant 30 jours (artefact `site-hostinger`) ; il n'a encore jamais tourné sur GitHub (rien n'est poussé).

Le système de design est décrit dans `apps/web/DESIGN.md` (jetons, primitives, contrastes, interdits). `npm run check:charte` en applique les interdits au code du site (`apps/web/src` : tiret cadratin, bleu, violet, police mono, émojis) et cherche tirets et émojis dans `apps/web/tests` et `DESIGN.md`. `npm run check:tirets` cherche le tiret cadratin et ses variantes dans les fichiers texte suivis du dépôt, hors données JSON de `datasets/` et de `packages/core/data/` ; c'est aussi une étape de la CI (`ci.yml`). Les instantanés publiés de `datasets/` (`v1.json` à `v3.json` et `latest.json`, immuables, `latest.json` étant haché dans `manifest.json`) contiennent 19 tirets cadratins, laissés tels quels ; les données de `packages/core/data/` n'en contiennent aucun, et un test du cœur (`packages/core/tests/charte-sfg.test.ts`) y refuse le tiret cadratin et la barre horizontale hors des citations mot pour mot. Le site a son propre parcours en six étapes (Projet, Entreprise, Bénéficiaire, Formation, Frais, Récapitulatif) et présente le plan de financement. L'application mobile garde son parcours en cinq étapes (`WIZARD_STEPS` dans `@opco/core`) et l'estimation de l'OPCO.

### Régénérer ou corriger le jeu de données mobile (non testé ici)
```bash
# Écrit dans datasets/ un jeu de données des 11 barèmes ({version, generatedAt, opcos}), sans aides, table IDCC,
# suggestions NAF ni portails, et incrémente la version : c'est une publication dès que le commit arrive sur main.
# Lire d'abord datasets/README.md, section « Compatibilité avec le cœur actuel ».
node scripts/build-example-dataset.mjs

# Pipeline d'extraction par IA :
cd backend
npm run dry-run     # cycle complet sans réseau ni clé : publie dans datasets/_drafts/ (ignoré par git)
npm run live        # lecture des pages et extraction par IA (ANTHROPIC_API_KEY) : publie dans datasets/ ;
                    # échoue aujourd'hui à la validation de sa base de départ (voir « Contrôle des liens et maintenance »)
```

## Mise à jour du jeu de données mobile par le pipeline IA (désactivé)

Ce mécanisme met à jour le jeu de données de l'application mobile (`datasets/`), pas le site. Il est désactivé par défaut : voir « Contrôle des liens et maintenance ».

1. **Planification** (`.github/workflows/update-dataset.yml`, chaque lundi) : le job « pipeline-ia » ne démarre qu'après le job « controle » (liens, fraîcheur, tests) et seulement si le secret `ANTHROPIC_API_KEY` ET la variable de dépôt `PIPELINE_LIVE` (valeur `true`) existent.
2. **scrape** récupère les pages officielles des OPCO, puis **extract** (Claude) en extrait les montants au format `OpcoData` strict : jamais de montant inventé, citation de la source obligatoire.
3. **verify** compare au jeu de données courant, puis **correct** applique les règles :
   - confirmé par la source : `value` mise à jour, `confidence='exact'`, note datée ;
   - non retrouvé : valeur **conservée**, confiance **rétrogradée** (`exact`, puis `estimated`, puis `depends_on_branche`), note « Non confirmé au JJ/MM/AAAA ». Jamais d'écrasement silencieux.
4. **validate** (garde-fous) : schéma Zod, bornes, **seuil de variation de 50 %** (au-delà, la valeur est mise en revue et non publiée) et non-régression (11 OPCO et scénarios `calculateFunding`).
5. **publish** écrit `datasets/v<N>.json`, `latest.json` et `manifest.json` (avec l'empreinte SHA-256). Si des changements sont à revoir, le workflow ouvre une pull request au lieu d'un commit direct.
6. **L'application**, quand l'utilisateur touche « Vérifier les mises à jour », lit `manifest.json` ; si une version plus récente existe, elle télécharge `latest.json`, **vérifie le SHA-256**, **valide** le contenu avec `@opco/core`, puis remplace son cache. En cas d'échec, elle garde le cache (jamais d'état cassé). Elle affiche « Données à jour au JJ/MM/AAAA ».

## Fonctionnalités « dirigeant de PME » (V2.1 / V2.2)

Ces fonctions viennent du moteur et des données de `@opco/core`. Les intitulés cités sont ceux de l'application mobile ; le site présente les résultats dans son propre écran (voir « Site web »).

- **Enveloppe maximale potentielle** : financement du plan de développement des compétences et dispositifs cumulables chiffrables, affichée par l'application sous le résultat principal.
- **Dispositifs complémentaires** (`dispositifs_complementaires` par OPCO) : Boost Compétences, Click&Form, FSE+, transition écologique, versements volontaires, etc., avec leur règle de cumul (`hors_budget`, `additif` ou `alternatif`), leurs **conditions d'attribution**, leurs **démarches** et leur source.
- **Barèmes par branche** (`variantes_branche`, V2.2) : les montants d'un OPCO varient selon la convention collective. Une variante (identifiée par ses codes **IDCC**) remplace le barème général : budget annuel, coût horaire, **salaire**, frais. Elle s'applique selon l'IDCC détecté (recherche SIREN) ou le choix manuel de la branche à l'étape d'identification (« Votre OPCO » dans l'application, « Entreprise » sur le site) ; priorité : choix manuel, puis IDCC détecté, puis barème général (avec un avertissement). Les branches couvertes se lisent dans le champ `variantes_branche` des fichiers `packages/core/data/opcos/*.json`.
- **Budget déjà consommé** : saisi à l'étape Situation de l'application et à l'étape Entreprise du site, déduit du plafond annuel.
- **« Vos démarches, étape par étape »** (application mobile) : liste concrète générée pour chaque résultat.

## Aides et financements (site)

L'estimation du financement par l'OPCO s'accompagne d'un recensement des aides mobilisables pour un projet de formation : Région, CPF, France Travail, Transitions Pro, Agefiph, Union européenne, fonds d'assurance formation des non-salariés, fiscalité. Le catalogue compte 173 aides, dont 126 financées par une Région, et un portail officiel par région (18). Chaque aide cite ses sources (adresse et extrait mot pour mot) et sa date de vérification.

### Le parcours en six étapes

Le parcours de saisie, tel que la spécification le définit, compte six étapes. Le moteur n'en dépend pas : il évalue le profil que le parcours produit. Le site suit ce parcours (`apps/web/src/lib/etapes.ts`) ; l'application mobile garde le sien, en cinq étapes.

1. **Votre projet** : former un salarié, reconversion d'un salarié, recruter et former un demandeur d'emploi, recruter en alternance, former le dirigeant.
2. **Entreprise** : recherche par nom, SIREN ou SIRET ; OPCO identifié avec son niveau de certitude, région, effectif, code NAF et statut (ESS, SIAE, association) pré-remplis et modifiables.
3. **Bénéficiaire** : questions adaptées au projet (contrat, ancienneté, âge, RQTH, niveau de diplôme, solde CPF, statut du dirigeant).
4. **Formation** : nom, type, mode, durée, coût, certification et niveau visés, éligibilité au CPF, date de début, organisme certifié Qualiopi.
5. **Frais annexes** : transport, hébergement, restauration (étape sautée quand la formation est entièrement à distance).
6. **Récapitulatif** des réponses, puis le plan de financement.

La spécification complète est dans `docs/superpowers/specs/2026-10-05-aides-financements-design.md` (section 4).

### Le moteur (`packages/core/src/aides/`)

| Module | Rôle |
|---|---|
| `criteres` | `evaluerCriteres` juge chaque critère d'une aide (région, effectif, âge, RQTH, contrat, type de formation, etc.) : satisfait, non satisfait ou inconnu. |
| `evaluer` | `evaluerAides` classe chaque aide en `eligible`, `a_verifier` ou `non_eligible`, donne les raisons, estime le montant (forfait, pourcentage, par heure, par mois, solde CPF) et applique les majorations. |
| `profil` | `profilDepuisWizard` traduit l'état du parcours en profil évalué (bornes d'effectif, région, statut du bénéficiaire, etc.). |
| `plan` | `construirePlan` empile les aides dans l'ordre sans jamais dépasser le coût de la formation, retient une seule aide parmi des alternatives, partage le solde CPF et présente à part les aides à l'employeur, les rémunérations et les avantages fiscaux et sociaux. |

Le calcul reste pur : mêmes entrées, mêmes sorties.

### Identification de l'OPCO (v2)

`resoudreOpco` (`packages/core/src/opco-resolver.ts`) part des conventions collectives (IDCC) de l'entreprise, de son code NAF et de sa catégorie juridique, et renvoie l'OPCO avec un niveau de certitude :

- `fiable` : un seul OPCO possible, établi par au moins une convention en vigueur ;
- `a_confirmer` : plusieurs OPCO possibles, convention non rattachée ou simple suggestion d'après le code NAF ; l'utilisateur choisit parmi les candidats ;
- `inconnu` : aucun OPCO identifié, sélection manuelle.

Chaque résultat renvoie vers l'outil officiel de France compétences (`https://quel-est-mon-opco.francecompetences.fr/`). La table IDCC (956 codes) est reconstruite à partir de sources réutilisables : table DSN, Légifrance, arrêtés d'agrément, listes de branches publiées par les OPCO. Sans convention exploitable, `naf-suggestions.json` propose un OPCO d'après le code NAF : 99 préfixes, chacun mesuré sur un échantillon d'au moins 30 établissements employeurs rapprochés de la Table SIRET-OPCO de France compétences, avec une part d'au moins 60 % pour l'OPCO proposé ; les secteurs partagés entre plusieurs OPCO n'en ont pas (méthode et mesures : spécification, section 5.5 ; `scripts/calibrer-suggestions-naf.mjs` refait la mesure à chaque mise à jour de la table).

Le niveau `confirme` (l'OPCO tel que France compétences le déclare pour un SIRET) n'est jamais produit aujourd'hui. La Table SIRET-OPCO est publiée en données ouvertes sur data.gouv.fr (licence ouverte 2.0) : elle a servi, hors du site, à mesurer et calibrer les suggestions par code NAF, mais le site ne l'interroge pas ; l'y intégrer est une décision en attente de l'utilisateur. L'API de France compétences (`api.francecompetences.fr`), dont la réutilisation demande une licence (art. R. 6123-35 du code du travail), n'est jamais appelée. Le brouillon de demande de licence, `docs/demande-licence-france-competences.md`, n'est plus nécessaire pour identifier l'OPCO à partir du SIRET.

### Jeu de données de l'application mobile

`DatasetSchema` (`packages/core/src/schema.ts`) accepte, en plus des barèmes des OPCO, les sections facultatives `aides`, `idcc`, `naf` et `portails`. Le jeu publié dans `datasets/` est en version 3 (barèmes seuls, juin 2026) et le schéma actuel du cœur le rejette (tailles en double dans les plafonds de Constructys). Aucun jeu de données v4 n'est publié par cette branche (décision du 08/10/2026) : une application reconstruite depuis cette branche travaillerait sur ses données embarquées et refuserait le jeu publié à chaque « Vérifier les mises à jour ». Mesures, effet sur les APK 1.2.0 déjà installés et marche à suivre : `datasets/README.md`, section « Compatibilité avec le cœur actuel ».

Le script `scripts/build-example-dataset.mjs` et le pipeline (`backend/src/publish.ts`) n'écrivent que `{version, generatedAt, opcos}` : un v4 « à sections » (aides, table IDCC, suggestions NAF, portails) reste à faire (tâche 19 du plan `docs/superpowers/plans/2026-10-05-aides-financements.md`), et seulement sur décision explicite, puisqu'il met à jour les applications installées.

Le site (`apps/web`) n'est pas concerné : il embarque `packages/core/data` à son build et ne lit jamais `datasets/`.

### Contrôle des liens et maintenance

- `cd backend && npm run check-sources` vérifie toutes les adresses web des données (barèmes, aides, portails, table IDCC, suggestions NAF) et écrit `backend/out/liens.md` et `backend/out/liens.json`. Les liens cassés font échouer la commande, les refus anti-robots sont listés « à vérifier », et `api.francecompetences.fr` (sous-domaines compris) n'est jamais contacté. Commande non relancée pour la dernière relecture des documents (non testée ici) : son dernier résultat suit le tableau « Vérifications ».
- Le workflow hebdomadaire `.github/workflows/update-dataset.yml` a deux jobs. Le job « controle », en lecture seule, lance d'abord le contrôle des liens (rapport ajouté au résumé du run et joint en artefact `rapports` ; un échec donne un avertissement sans faire échouer le run), puis le contrôle de fraîcheur (`npm run test:fraicheur` du cœur : une dernière vérification de plus de 12 mois donne un avertissement, sans bloquer), puis les tests et le typecheck du cœur et du backend. Il ne modifie aucune donnée.
- Le job « pipeline-ia » est **désactivé par défaut** : il ne démarre que si le job « controle » a réussi et que le secret `ANTHROPIC_API_KEY` ET la variable de dépôt `PIPELINE_LIVE` (valeur `true`) existent ; son rapport est joint en artefact `rapport-pipeline-ia`. Il met à jour le jeu de données de l'application mobile (`datasets/`), pas le site. Il part de `datasets/latest.json` (version 3), que la validation actuelle rejette : activé tel quel, il paierait l'extraction chaque lundi puis échouerait sans rien publier. Et il ne republie que les barèmes : après un v4 à sections, son premier run écrirait un v5 sans ces sections, commité sur `main` sans revue si aucun écart n'est à revoir (`docs/donnees-aides.md`, « Le pipeline IA : désactivé par défaut »). Marche à suivre pour l'activer : `docs/donnees-aides.md`, section « Mise à jour automatique ».
- Les données du site se mettent à jour à la main : modifier `packages/core/data/**`, lancer les tests du cœur et le contrôle des liens, reconstruire le site (`apps/web`) puis le redéposer sur l'hébergement (`docs/deploiement-site.md`). Étapes détaillées dans `docs/donnees-aides.md`, section « Mettre à jour les données du site ».
- Le guide `docs/donnees-aides.md` décrit le format des données, les règles de sourçage, la mise à jour d'une aide, les données du site, le workflow, la revue complète et la publication.

## Vérifications (état actuel)

Mesures du 09/10/2026 au commit `ffb9bae` de la branche d'intégration WordPress (suites, gardes et build de production du même jour), page légale remplie sauf le téléphone de l'hébergeur ; sa saisie ne change que de quelques octets la taille de `/mentions-legales/`. Les nombres de tests, de pages et de fichiers sont exacts ; les tailles changent à chaque build. C'est le seul endroit du dépôt où ces chiffres sont tenus à jour : les autres documents y renvoient.

| Contrôle | Commande | Résultat |
|---|---|---|
| Cœur `@opco/core` | `cd packages/core && npx vitest run` ; `npx tsc --noEmit` | 1 526 tests dans 25 fichiers, tous verts ; typage sans erreur. Le contrôle de fraîcheur des données est à part : `npm run test:fraicheur` (3 tests, hors de `npm test`) |
| Backend `@opco/backend` | `cd backend && npx vitest run` ; `npx tsc --noEmit` | 110 tests dans 3 fichiers, tous verts ; typage sans erreur |
| Site `apps/web` | `npm run test:web` ; `cd apps/web && npx tsc --noEmit` ; `npm run lint --workspace web` | 331 tests (86 suites), tous verts ; typage sans erreur ; lint sans erreur ni avertissement |
| Application mobile | `cd apps/mobile && npx tsc --noEmit` | typage sans erreur ; l'application n'a pas de tests |
| Garde de charte | `npm run check:charte` ; `node scripts/check-charte-sfg.mjs --self-test` | aucun problème dans 97 fichiers (`apps/web/src`) et 22 fichiers (`apps/web/tests` et `apps/web/DESIGN.md` : tirets et émojis) ; autotest : 215 cas |
| Garde des tirets | `npm run check:tirets` | aucun tiret cadratin dans 268 fichiers suivis (155 dans 13 fichiers avant le nettoyage de l'application mobile, du plan et de la spécification) ; la garde est une étape de la CI |
| Build du site | `npm run build --workspace web` | 24 pages annoncées ; `apps/web/out` : 210 fichiers, 20 428 712 octets. JavaScript chargé d'emblée par `/simulateur/` : 345 776 octets compressés (gzip niveau 9, 11 fichiers). Le catalogue d'aides est dans un lot chargé à la demande : 798 691 octets bruts, 150 418 compressés |
| Archive pour Hostinger | commande principale de `docs/deploiement-site.md`, § 4 (PowerShell : liste des fichiers de `apps/web/out`, puis `tar -a -c -f <chemin>\financementOPCO-hostinger-AAAA-MM.zip --no-recursion -C $out $noms`) | 210 entrées, une par fichier, comme l'archive de juillet : aucune entrée de dossier, aucune en `./` ; 2 658 305 octets. Extraite par `tar -xf` et `Expand-Archive` : les 210 fichiers à l'identique (SHA-256). Variantes `Get-ChildItem -Name` et `*` : 266 entrées (56 dossiers en plus) |
| Données embarquées | `collecterUrls` du contrôle des liens, hors ligne, et décompte des données de `packages/core/data` (commit `ffb9bae`) | 675 adresses sur 129 sites ; 11 OPCO, 173 aides (126 financées par une Région), 18 portails régionaux, 956 codes IDCC, 99 préfixes NAF |

Résultat du dernier contrôle réseau (`npm run check-sources`), lancé le 08/10/2026 depuis un poste de développement, avant les dernières corrections d'adresses des données (679 adresses à ce moment) : 537 répondent, 133 sont à vérifier à la main (des protections anti-robots, dont 111 pages de Légifrance) et 9 sont injoignables depuis ce poste, délai de connexion dépassé : 8 pages de `opcomobilites.fr` et 1 de `meformerenregion.fr`. Aucune adresse ne renvoie 404. Ces chiffres varient d'un lancement et d'un réseau à l'autre.

## Limites connues

- **Safari et iOS non testés** : les essais du site ont eu lieu dans un navigateur Chromium. À vérifier sur un iPhone après le dépôt (barre collante du parcours, menu mobile). Les limites propres à l'hébergement (préchargements en 404, écran de résultats chargé à la demande) sont dans `docs/deploiement-site.md`, section « Limites connues ».
- **FSE+** : la carte de l'aide nationale FSE+ peut s'afficher « à vérifier » pour une entreprise d'AKTO alors que l'alerte d'AKTO annonce son dispositif FSE+ terminé (dépôts clos depuis le 1er juillet 2026) : l'opération 2026-2027 de plusieurs OPCO n'est pas encore connue, la carte n'a donc pas été retirée.
- **CPF, participation forfaitaire** : le montant du CPF repose sur le solde saisi ; la participation forfaitaire de 150 € (demandes depuis le 2 avril 2026, sauf exonération) n'en est pas déduite, et le libellé de l'aide le rappelle.
- **CléA** : le parcours ne permet pas de désigner la certification CléA ; pour une certification du répertoire spécifique, le CPF est estimé dans la limite de 1 500 €, même quand la formation prépare CléA, qui échappe à ce plafond : l'estimation est prudente et le libellé du CPF le signale.
- **Convention déclarée et table officielle** : un établissement peut déclarer une convention qui mène à un OPCO autre que celui de la Table SIRET-OPCO. Exemple relevé : GROUPAMA SUPPORTS ET SERVICES, dont l'IDCC 1672 transmis par l'API mène à ATLAS (réponse « fiable ») alors que la table rattache le siège à OCAPIAT. Le lien vers l'outil officiel « Quel est mon OPCO », présent sur chaque résultat, permet de le vérifier.
- **Suggestions par code NAF** : environ 86 % des suggestions par le seul code NAF sont exactes sur un tirage uniforme de la table officielle ; elles sont toujours présentées comme à confirmer.
- **Plafonds de durée et plafond du forfait de frais annexes (Constructys, Bâtiment)** : le forfait de 8 % est réservé aux actions qualifiantes (diplôme, certification enregistrée au RNCP, CQP) et n'est plus compté pour une autre formation, mais deux plafonds de la source ne sont pas appliqués : 1 500 € HT par stagiaire pour le forfait, et la durée maximale (300 h pour une action non qualifiante, 1 200 h pour une qualifiante). Pour une formation de plusieurs centaines d'heures, l'estimation peut être trop haute ; au-delà de 1 200 h, l'avertissement de durée dit que les heures en trop ne sont pas prises en charge, alors que les montants les comptent encore. Le parcours ne demande pas non plus si la formation relève de la création-reprise-transmission ou de l'AFEST (15 € HT/h au lieu de 10 € de 11 à 49 salariés) : le montant retenu est le plus prudent.
- **Frais annexes selon la taille (OPCO EP, OCAPIAT)** : pour la pharmacie et les cabinets médicaux de l'OPCO EP, la source réserve l'hébergement et la restauration aux entreprises de moins de 11 salariés, et le moteur les compte aussi de 11 à 49 salariés ; pour la pêche d'OCAPIAT, il les compte sous 11 salariés alors que la source ne prévoit alors qu'un forfait mensuel pour les formations diplômantes (et pas de repas), et de 11 à 49 salariés pour toute durée alors que l'hébergement et les repas sont réservés aux formations courtes (moins de 150 h). Le parcours ne peut pas non plus vérifier la condition « hors des locaux de l'entreprise et sur le temps de travail » des salaires des cabinets médicaux et dentaires. Le dispositif « parcours certifiants » d'OCAPIAT (jusqu'à 8 000 €) est proposé comme option pour tout type de formation, alors qu'il est réservé aux certifications de ses branches. Ces lignes sont des estimations à confirmer auprès de l'OPCO.
- **Pipeline IA** : une fois activé, il ne vérifiera que les barèmes principaux des 11 OPCO, ni les `variantes_branche` (pages de branche) ni les `dispositifs_complementaires`.
- **Application mobile** : elle garde ses couleurs d'origine, bleu et violet compris, hors de la charte graphique SFG appliquée au site ; la décision de départ était de ne pas la modifier. Elle arrondit aussi le coût horaire avant le calcul, ce que le site ne fait pas.

## Sources et licences

- Recherche d'entreprise : API Recherche d'entreprises de la DINUM, qui diffuse les données SIRENE de l'INSEE, sous licence ouverte 2.0 ; le site cite la source sous les résultats et sur sa page légale.
- Table SIRET-OPCO de France compétences : data.gouv.fr, licence ouverte 2.0, mise à jour du 24/09/2026 ; utilisée hors du site pour mesurer et calibrer les suggestions par code NAF.
- Barèmes des OPCO et aides : chaque montant cite sa source officielle (adresse, extrait mot pour mot) et sa date de vérification.
- Polices Montserrat et Inter : licence SIL Open Font License 1.1, auto-hébergées (le build les range dans `_next/static/media/` ; le site n'appelle pas Google).
- Logo et marque SFG Développement : propriété de SFG Développement.
- Code du dépôt : aucun fichier `LICENSE` à la racine, donc tous droits réservés par défaut. Choisir une licence est une décision de l'utilisateur.
- Avis de sécurité : `npm audit --omit=dev` (08/10/2026) signale 50 avis (2 critiques, 34 élevés, 13 modérés, 1 faible). `next` 16.2.1 en porte 31 (npm propose de passer à 16.4.0) : ils visent le serveur de Next (composants et actions serveur, middleware et proxy, optimisation d'images, cache et rendu incrémental, `next/og`, serveur de développement) ou `next/script`, absents d'un export statique servi par Apache ; le site n'utilise ni middleware, ni actions serveur, ni `next/script`, ni `next/og`, et ses images ne passent pas par l'optimiseur (`images.unoptimized`). `next` n'est donc pas mis à jour sur cette branche. Les autres avis viennent surtout des outils de l'application mobile (Expo, React Native, Metro) et du backend (`undici` par `cheerio`) : à revoir avant une nouvelle build de l'application.

## À configurer côté utilisateur (hors code)

1. **Dépôt du site** : compléter la page légale (`apps/web/src/lib/mentions.ts`), choisir le nom de domaine (`financementopco.fr` n'est pas enregistré au 08/10/2026), construire l'archive (fichiers seuls, comme celle de juillet ; une archive de prévisualisation, `financementOPCO-hostinger-2026-10-previsualisation.zip`, a été construite hors du dépôt, à côté de celle de juillet, avec la page légale encore à compléter : elle montre le site et ne doit pas être déposée telle quelle), sauvegarder, déposer, vérifier le certificat SSL et « Forcer HTTPS », vider le gestionnaire de cache, puis tester sur un téléphone Android et sur un iPhone. Marche à suivre dans `docs/deploiement-site.md`. Pour l'afficher dans la page WordPress « simulation-financement » de sfgdeveloppement.fr (brouillon n° 12546, cadre vers le sous-domaine `financement.sfgdeveloppement.fr`, à créer chez OVH), voir `docs/integration-wordpress.md` ; l'archive du sous-domaine, `financementOPCO-sous-domaine-previsualisation.zip`, est construite à côté de celle de juillet.
2. **Application mobile** : aucune nouvelle build avant d'avoir lu `datasets/README.md`, section « Compatibilité avec le cœur actuel » (le jeu de données v3 publié est refusé par le cœur actuel ; les APK 1.2.0 déjà installés continuent avec leur copie).
3. **Pipeline IA hebdomadaire** : désactivé par défaut, à n'activer qu'après la publication d'un jeu de données v4 compatible. Il faut alors autoriser GitHub Actions à créer des pull requests (Settings, Actions, General, Workflow permissions), puis créer le **secret GitHub Actions** `ANTHROPIC_API_KEY` (jamais dans l'application) ET la variable de dépôt `PIPELINE_LIVE` valant `true` (Settings, Secrets and variables, Actions) : le secret seul ne lance rien. Détail : `docs/donnees-aides.md`, section « Mise à jour automatique ».
4. **OCAPIAT** : sa source de financement est un **PDF**, que le scraper minimal ne lit pas : ses champs passeront en `not_found`, d'où une confiance rétrogradée (jamais d'invention). Ajouter un lecteur de PDF si l'on veut l'extraction automatique pour cet OPCO.
5. **Décisions en attente** : licence du code (aucun fichier `LICENSE`), intégration éventuelle de la Table SIRET-OPCO au site, envoi ou non du brouillon de demande de licence.

## Principes non négociables

- **Aucun montant inventé.** Toute valeur chiffrée vient d'une source officielle citée, sinon `depends_on_branche`.
- Le **moteur de calcul reste pur** (mêmes entrées, mêmes sorties) et **partagé** entre le site, l'application et le backend.
- Les **données sont des estimations**, pas un engagement de l'OPCO (avertissement conservé dans l'application et sur le site).
