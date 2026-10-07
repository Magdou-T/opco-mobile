# Financement OPCO : site web, application mobile et moteur partagé

Ce dépôt réunit ce qui sert à estimer le financement d'une formation par les OPCO et par les autres aides. Le moteur de calcul et les données vivent dans `packages/core` (`@opco/core`), importé par :

- le site financementOPCO (`apps/web`) : simulateur, fiches des 11 OPCO et guides. C'est un export statique Next.js, déposé sur un hébergement mutualisé Apache (Hostinger) ;
- l'application Android (`apps/mobile`) : l'estimation du financement par l'OPCO, hors-ligne, avec des montants qui peuvent se mettre à jour par le dataset publié dans `datasets/` ;
- le backend (`backend`) : le contrôle des liens sources et un pipeline d'extraction par IA, qui peut corriger les montants du dataset mobile (désactivé par défaut aujourd'hui : voir « Contrôle des liens et maintenance »).

> Spécification de la version « aides et financements » : `docs/superpowers/specs/2026-10-05-aides-financements-design.md`.

## Monorepo (npm workspaces)

```
opco-mobile/
├── packages/core/      @opco/core : logique métier PARTAGÉE (0 dépendance UI)
│   ├── src/            types · calculator (pur) · opco-resolver · schema (Zod) · aides (moteur) · entreprise (lecture de l'API recherche-entreprises) · geo (régions, départements) · data
│   ├── data/           opcos/ (les 11 OPCO sourcés) · idcc/ (idcc-opco.json, naf-suggestions.json) · aides/ (catalogue, portails)
│   └── tests/          tests du core (moteur, schéma, données, aides, scénarios)
├── apps/mobile/        Expo / React Native : l'app, l'APK
│   ├── src/app/        écrans (expo-router) : accueil + wizard
│   ├── src/components/  wizard 5 étapes · FundingBreakdown · badges
│   ├── src/lib/        dataset-sync · siren-client
│   └── eas.json        profil "preview" → APK
├── apps/web/           site financementOPCO : Next.js 16, export statique dans apps/web/out
│   ├── src/            app/ (pages) · components/ · hooks/ · lib/ ; données de packages/core/data embarquées au build
│   ├── tests/          tests du site (node:test)
│   ├── public/         logo-sfg.png · .htaccess (Apache)
│   └── DESIGN.md       système de design SFG : jetons, primitives, contrastes, interdits
├── backend/            @opco/backend : pipeline auto-correctif (IA, désactivé par défaut) et contrôle des liens
│   ├── src/            scrape → extract(IA) → verify → correct → validate → publish · check-sources
│   ├── sources/        opco-sources.json (URLs officielles par champ)
│   └── tests/          tests du pipeline et du contrôle des liens
├── datasets/           dataset publié & versionné pour l'app mobile (manifest + latest + vN)
├── docs/               donnees-aides.md (maintenance des données) · deploiement-site.md (dépôt du site sur Hostinger) · demande-licence-france-competences.md (brouillon) · recherche-aides/ (campagne d'octobre 2026, archivée) · superpowers/ (spécification et plan)
├── scripts/            build-example-dataset.mjs (seed) · integrer-recherches.mjs (catalogue d'aides) · check-charte-sfg.mjs (garde de charte du site) · add-dispositifs.mjs et add-variantes.mjs (injections de juin 2026, à ne pas relancer : voir ci-dessous)
└── .github/workflows/  ci.yml (vérifications et build du site) · update-dataset.yml (tests et contrôle des liens chaque lundi)
```

Les scripts `add-dispositifs.mjs` et `add-variantes.mjs` remplacent en entier les champs `dispositifs_complementaires` et `variantes_branche` des fichiers OPCO qu'ils citent : relancés, ils effaceraient les ajouts faits depuis juin 2026.

Le **`packages/core` est la source de vérité** : le site, l'app et le backend l'importent tous les trois → le schéma et le calcul ne peuvent pas diverger.

## Démarrage rapide

```bash
npm install                         # à la racine (workspaces)
npm test                            # tests du core
npm run test --workspace @opco/backend   # tests du backend
npm run test:web                    # tests du site
```

### Lancer l'app en dev
```bash
cd apps/mobile
npx expo start                      # Expo Go / émulateur Android
```

### Builder l'APK (nécessite un compte Expo)
```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build -p android --profile preview   # APK installable
```

### Site web

```bash
npm run dev --workspace web         # serveur de développement : http://localhost:3000
npm run build --workspace web       # export statique dans apps/web/out
npm run lint --workspace web
npm run check:charte                # garde de charte SFG sur apps/web/src
```

Le build télécharge les polices Google : il demande une connexion Internet. L'export (`apps/web/out`) se dépose tel quel sur l'hébergement ; la procédure de dépôt sur Hostinger, la liste de contrôle et les limites connues sont dans `docs/deploiement-site.md`. Le workflow `.github/workflows/ci.yml` rejoue les vérifications et construit le site à chaque pull request et à chaque push sur `main`, puis conserve l'export pendant 30 jours (artefact `site-hostinger`).

Le système de design est décrit dans `apps/web/DESIGN.md` (jetons, primitives, contrastes, interdits) ; `npm run check:charte` en applique les interdits au code du site : tiret cadratin, bleu, violet, police mono, émojis. Le site a son propre parcours en six étapes (Projet, Entreprise, Bénéficiaire, Formation, Frais, Récapitulatif) et présente le plan de financement. L'app mobile garde son parcours en cinq étapes (`WIZARD_STEPS` dans `@opco/core`) et l'estimation de l'OPCO.

### Régénérer / corriger le dataset
```bash
# Seed local (sans réseau, sans IA) : écrit les 11 barèmes seulement ({version, generatedAt, opcos}),
# sans aides, table IDCC, suggestions NAF ni portails (voir « Dataset v4 » plus bas) :
node scripts/build-example-dataset.mjs

# Pipeline auto-correctif :
cd backend
npm run dry-run     # cycle complet SANS réseau ni clé → publie dans datasets/_drafts/
npm run live        # vrai scrape + IA (requiert ANTHROPIC_API_KEY) → publie dans datasets/ ;
                    # échoue aujourd'hui à la validation de sa base de départ (voir « Contrôle des liens et maintenance »)
```

## Comment ça se met à jour & s'autocorrige

Ce mécanisme est le pipeline IA du backend. Il est **désactivé par défaut** dans le workflow hebdomadaire et met à jour le dataset de l'app mobile (`datasets/`), pas le site : voir « Contrôle des liens et maintenance » plus bas.

1. **Cron** (`.github/workflows/update-dataset.yml`, hebdo) exécute le pipeline `--live` seulement si le secret `ANTHROPIC_API_KEY` et la variable de dépôt `PIPELINE_LIVE` (valeur `true`) existent.
2. **scrape** récupère les pages officielles OPCO → **extract** (Claude) en extrait les montants au format `OpcoData` strict (jamais de montant inventé ; citation de la source obligatoire).
3. **verify** diffe vs le dataset courant → **correct** applique les règles :
   - confirmé par la source → `value` mise à jour, `confidence='exact'`, note datée ;
   - non retrouvé → valeur **conservée**, confiance **rétrogradée** (`exact→estimated→depends_on_branche`), note « non confirmé au JJ/MM ». Jamais d'écrasement silencieux.
4. **validate** (garde-fous) : schéma Zod + bornes + **seuil de variation 50 %** (au-delà → mis en revue, non auto-publié) + non-régression (11 OPCO + scénarios `calculateFunding`).
5. **publish** écrit `datasets/v<N>.json` + `latest.json` + `manifest.json` (avec SHA-256). Si des changements sont « à revoir », une **PR** est créée au lieu d'un commit direct.
6. **L'app** lit `manifest.json` au démarrage ; si une version plus récente existe, télécharge `latest.json`, **vérifie le SHA-256**, **valide** via `@opco/core`, puis remplace le cache. En cas d'échec → garde le cache (jamais d'état cassé). Affiche « Données à jour au JJ/MM/AAAA ».

## Fonctionnalités « dirigeant de PME » (V2.1 / V2.2)

Ces fonctions viennent du moteur et des données de `@opco/core`. Les intitulés cités sont ceux de l'app mobile ; le site présente les résultats dans son propre écran (voir « Site web »).

- **Enveloppe maximale potentielle** : financement PDC + dispositifs cumulables chiffrables, affichée par l'app sous le résultat principal.
- **Dispositifs complémentaires** (`dispositifs_complementaires` par OPCO) : Boost Compétences, Click&Form, FSE+, transition écologique TP hors budget, abondements CPF/SPSTI, versements volontaires… avec règle de cumul (`hors_budget` / `additif` / `alternatif`), **conditions d'attribution**, **démarches** et source. Tous sourcés.
- **Barèmes par branche** (`variantes_branche`, V2.2) : les montants d'un OPCO varient selon la convention collective. Une variante (identifiée par codes **IDCC**) surcharge le barème général : budget annuel, coût horaire, **salaire**, frais. Application automatique selon l'IDCC détecté (recherche SIREN) ou le choix manuel de la branche à l'étape d'identification (« Votre OPCO » dans l'app, « Entreprise » sur le site) ; priorité : choix manuel > IDCC détecté > barème général (+ avertissement). Les branches couvertes se lisent dans le champ `variantes_branche` des fichiers `packages/core/data/opcos/*.json`. Extensible par simple ajout de données.
- **Budget déjà consommé** : saisi à l'étape Situation de l'app et à l'étape Entreprise du site, déduit du plafond annuel.
- **« Vos démarches, étape par étape »** (app mobile) : checklist concrète générée pour chaque résultat.

## Aides et financements (v1.3)

L'estimation du financement par l'OPCO s'accompagne d'un recensement des aides mobilisables pour un projet de formation : Région, CPF, France Travail, Transitions Pro, Agefiph, Union européenne, fonds d'assurance formation des non-salariés, fiscalité. Le catalogue compte 173 aides (46 nationales et européennes, 127 régionales) et un portail officiel par région. Chaque aide cite ses sources (adresse et extrait mot pour mot) et sa date de vérification.

### Le parcours en six étapes

Le parcours de saisie, tel que la spécification le définit, compte six étapes. Le moteur n'en dépend pas : il évalue le profil que le parcours produit. Le site suit ce parcours (`apps/web/src/lib/etapes.ts`) ; l'app mobile garde le sien, en cinq étapes.

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
| `criteres` | `evaluerCriteres` juge chaque critère d'une aide (région, effectif, âge, RQTH, contrat, type de formation…) : satisfait, non satisfait ou inconnu. |
| `evaluer` | `evaluerAides` classe chaque aide en `eligible`, `a_verifier` ou `non_eligible`, donne les raisons, estime le montant (forfait, pourcentage, par heure, par mois, solde CPF) et applique les majorations. |
| `profil` | `profilDepuisWizard` traduit l'état du parcours en profil évalué (bornes d'effectif, région, statut du bénéficiaire…). |
| `plan` | `construirePlan` empile les aides dans l'ordre sans jamais dépasser le coût de la formation, retient une seule aide parmi des alternatives, partage le solde CPF et présente à part les aides à l'employeur, les rémunérations et les avantages fiscaux et sociaux. |

Le calcul reste pur : mêmes entrées, mêmes sorties.

### Identification de l'OPCO (v2)

`resoudreOpco` (`packages/core/src/opco-resolver.ts`) part des conventions collectives (IDCC) de l'entreprise et de son code NAF, et renvoie l'OPCO avec un niveau de certitude :

- `fiable` : un seul OPCO possible, établi par au moins une convention en vigueur ;
- `a_confirmer` : plusieurs OPCO possibles, convention non rattachée ou simple suggestion d'après le code NAF ; l'utilisateur choisit parmi les candidats ;
- `inconnu` : aucun OPCO identifié, sélection manuelle.

Chaque résultat renvoie vers l'outil officiel de France compétences (`https://quel-est-mon-opco.francecompetences.fr/`). La table IDCC (956 codes) est reconstruite à partir de sources réutilisables : table DSN, Légifrance, arrêtés d'agrément, listes de branches publiées par les OPCO.

Le niveau `confirme` est réservé aux données officielles de France compétences (SIRET vers OPCO). Leur réutilisation est soumise à licence (art. R. 6123-35 du code du travail) : tant qu'elle n'est pas obtenue, le service n'appelle ni l'API ni les tables de France compétences. Le brouillon de la demande est dans `docs/demande-licence-france-competences.md`.

### Dataset v4

`DatasetSchema` (`packages/core/src/schema.ts`) ajoute aux barèmes des OPCO les sections facultatives `aides`, `idcc`, `naf` et `portails` ; une application qui ne les connaît pas les ignore. Le dataset publié dans `datasets/` est pour l'instant en version 3 (barèmes des OPCO seuls) et n'est pas régénéré.

Le script `scripts/build-example-dataset.mjs` et le pipeline (`backend/src/publish.ts`) n'écrivent aujourd'hui que `{version, generatedAt, opcos}` : la procédure « Publier vers les applications installées » de `docs/donnees-aides.md` ne produit donc ni aides, ni table IDCC, ni suggestions NAF, ni portails. Les étendre est la tâche « dataset v4 » du plan (`docs/superpowers/plans/2026-10-05-aides-financements.md`, tâche 19). Elle est facultative : elle met à jour les applications déjà installées, donc seulement sur décision explicite.

Le site (`apps/web`) n'est pas concerné : il embarque `packages/core/data` à son build et ne lit jamais `datasets/`.

### Contrôle des liens et maintenance

- `cd backend && npm run check-sources` vérifie toutes les adresses web des données (barèmes, aides, portails, table IDCC) et écrit `backend/out/liens.md` et `backend/out/liens.json`. Les liens cassés font échouer la commande, les refus anti-robots sont listés « à vérifier », et `api.francecompetences.fr` (sous-domaines compris) n'est jamais contacté.
- Le workflow hebdomadaire `.github/workflows/update-dataset.yml` lance aujourd'hui les tests puis le contrôle des liens : le rapport est ajouté au résumé du run et joint au run (artefact `rapports`), et un avertissement signale un échec du contrôle sans faire échouer le run. Il ne modifie aucune donnée.
- Le pipeline d'extraction par IA y est **désactivé par défaut**. Il met à jour le dataset de l'app mobile (`datasets/`), pas le site, et il part de `datasets/latest.json` (version 3), que la validation actuelle rejette (tailles en double dans les plafonds de Constructys) : activé, il paierait l'extraction chaque lundi puis échouerait sans rien publier. Ses étapes ne tournent que si le secret `ANTHROPIC_API_KEY` ET la variable de dépôt `PIPELINE_LIVE` (valeur `true`) existent. À n'activer qu'après la publication du dataset v4 (voir `docs/donnees-aides.md`, section « Mise à jour automatique »).
- Les données du site se mettent à jour à la main : modifier `packages/core/data/**`, lancer les tests du core et le contrôle des liens, reconstruire le site (`apps/web`) puis le redéposer sur l'hébergement (`docs/deploiement-site.md`). Étapes détaillées dans `docs/donnees-aides.md`, section « Mettre à jour les données du site ».
- Le guide `docs/donnees-aides.md` décrit le format des données, les règles de sourçage, la mise à jour d'une aide, les données du site, le workflow, la revue complète et la publication.

## Vérifications (état actuel)

Mesuré au commit `7c791cf` le 08/10/2026, dans l'arbre de travail, à réactualiser. Les totaux de tests et d'adresses ne figurent que dans ce tableau.

| Package | Typecheck | Tests |
|---|---|---|
| `@opco/core` | OK (`tsc --noEmit`) | OK : 1305 tests dans 18 fichiers (`npx vitest run`) |
| `apps/mobile` | OK (`tsc --noEmit`) | aucun test |
| `apps/web` | OK (`tsc --noEmit`), lint OK (`npm run lint --workspace web`) | OK : 218 tests (`npm run test:web`) |
| Garde de charte du site | sans objet | OK : aucun problème dans 82 fichiers (`npm run check:charte`), autotest de 178 cas (`node scripts/check-charte-sfg.mjs --self-test`) |
| Build du site | sans objet | OK : 23 pages (`npm run build --workspace web`). `/simulateur/` charge 341 916 octets de JavaScript en gzip (niveau 9, 11 fichiers) ; l'écran de résultats et le catalogue d'aides forment un lot à part de 792 603 octets bruts, chargé à la demande |
| `@opco/backend` | OK (`tsc --noEmit`) | OK : 97 tests dans 3 fichiers (`npx vitest run`), dry-run du pipeline OK |
| Contrôle des liens | sans objet | 679 adresses sur 128 sites, comptées hors ligne par `collecterUrls` sur les données embarquées |

Résultat du contrôle réseau (`npm run check-sources`), lancé le 08/10/2026 depuis un poste de développement (le rapport `liens.md` porte la date UTC du 07/10/2026) : 537 adresses répondent, 133 sont à vérifier à la main (en général des protections anti-robots, dont 111 pages de Légifrance) et 9 sont injoignables depuis ce poste, délai de connexion dépassé : 8 pages de `opcomobilites.fr` et `meformerenregion.fr`. Aucune adresse ne renvoie 404. Ces chiffres varient d'un lancement et d'un réseau à l'autre.

## À configurer côté utilisateur (hors code)

1. **Dépôt du site** : l'archive se dépose à la main sur Hostinger ; le réglage « Forcer HTTPS » (dans hPanel) et le test sur téléphone se font hors du dépôt. Marche à suivre dans `docs/deploiement-site.md`.
2. **Pipeline IA hebdomadaire** : désactivé par défaut, à n'activer qu'après la publication du dataset v4 (voir « Contrôle des liens et maintenance »). Il demande à la fois le **secret GitHub Actions** `ANTHROPIC_API_KEY` (jamais dans l'app) et la variable de dépôt `PIPELINE_LIVE` valant `true` (Settings > Secrets and variables > Actions) : le secret seul ne lance rien.
3. **OCAPIAT** : sa source de financement est un **PDF** (non géré par le scraper minimal) → ses champs passeront en `not_found` → rétrogradation de confiance (jamais d'invention). Ajouter un parseur PDF si besoin d'extraction automatique pour cet OPCO.
4. **Limite connue du pipeline** : la vérification hebdomadaire couvre les barèmes principaux des 11 OPCO, pas encore les `variantes_branche` (pages de branche) ni les `dispositifs_complementaires` : à étendre (voir issues).

## Principes non négociables

- **Aucun montant inventé.** Toute valeur chiffrée vient d'une source officielle citée, sinon `depends_on_branche`.
- Le **moteur de calcul reste pur** (mêmes entrées → mêmes sorties) et **partagé** web/mobile/backend.
- Les **données sont des estimations**, pas un engagement de l'OPCO (disclaimer conservé dans l'app).
