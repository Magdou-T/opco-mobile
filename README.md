# Financement OPCO — V2 mobile (APK autonome, auto-mise à jour & auto-correction)

Application mobile Android qui estime ce qu'un OPCO peut financer pour une formation. Reprend le moteur de la V1 web (`../opco-funding`), fonctionne **hors-ligne**, et dont les **montants se mettent à jour régulièrement** et **s'autocorrigent** via un pipeline IA.

> Spécification d'origine : voir `../SPEC-APP-MOBILE-OPCO.md`.

## Monorepo (npm workspaces)

```
opco-mobile/
├── packages/core/      @opco/core — logique métier PARTAGÉE (0 dépendance UI)
│   ├── src/            types · calculator (pur) · opco-resolver · schema (Zod) · data
│   ├── data/opcos/     les 11 OPCO sourcés (+ idcc-opco-map.json)
│   └── tests/          1248 tests (moteur, schéma, données, aides, scénarios)
├── apps/mobile/        Expo / React Native — l'app, l'APK
│   ├── src/app/        écrans (expo-router) : accueil + wizard
│   ├── src/components/  wizard 5 étapes · FundingBreakdown · badges
│   ├── src/lib/        dataset-sync · siren-client
│   └── eas.json        profil "preview" → APK
├── backend/            @opco/backend — pipeline auto-correctif (cron)
│   ├── src/            scrape → extract(IA) → verify → correct → validate → publish
│   ├── sources/        opco-sources.json (URLs officielles par champ)
│   └── tests/          52 tests (pipeline, contrôle des liens)
├── datasets/           dataset publié & versionné (manifest + latest + vN)
├── scripts/            build-example-dataset.mjs (seed)
└── .github/workflows/  update-dataset.yml (cron hebdo)
```

Le **`packages/core` est la source de vérité** : l'app et le backend l'importent tous les deux → le schéma et le calcul ne peuvent pas diverger.

## Démarrage rapide

```bash
npm install                         # à la racine (workspaces)
npm test                            # tests du core (1248)
npm run test --workspace @opco/backend   # tests backend (52)
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

### Régénérer / corriger le dataset
```bash
# Seed local (sans réseau, sans IA) :
node scripts/build-example-dataset.mjs

# Pipeline auto-correctif :
cd backend
npm run dry-run     # cycle complet SANS réseau ni clé → publie dans datasets/_drafts/
npm run live        # vrai scrape + IA (requiert ANTHROPIC_API_KEY) → publie dans datasets/
```

## Comment ça se met à jour & s'autocorrige

1. **Cron** (`.github/workflows/update-dataset.yml`, hebdo) exécute le pipeline `--live`.
2. **scrape** récupère les pages officielles OPCO → **extract** (Claude) en extrait les montants au format `OpcoData` strict (jamais de montant inventé ; citation de la source obligatoire).
3. **verify** diffe vs le dataset courant → **correct** applique les règles :
   - confirmé par la source → `value` mise à jour, `confidence='exact'`, note datée ;
   - non retrouvé → valeur **conservée**, confiance **rétrogradée** (`exact→estimated→depends_on_branche`), note « non confirmé au JJ/MM ». Jamais d'écrasement silencieux.
4. **validate** (garde-fous) : schéma Zod + bornes + **seuil de variation 50 %** (au-delà → mis en revue, non auto-publié) + non-régression (11 OPCO + scénarios `calculateFunding`).
5. **publish** écrit `datasets/v<N>.json` + `latest.json` + `manifest.json` (avec SHA-256). Si des changements sont « à revoir », une **PR** est créée au lieu d'un commit direct.
6. **L'app** lit `manifest.json` au démarrage ; si une version plus récente existe, télécharge `latest.json`, **vérifie le SHA-256**, **valide** via `@opco/core`, puis remplace le cache. En cas d'échec → garde le cache (jamais d'état cassé). Affiche « Données à jour au JJ/MM/AAAA ».

## Fonctionnalités « dirigeant de PME » (V2.1 / V2.2)

- **Enveloppe maximale potentielle** : financement PDC + dispositifs cumulables chiffrables, affichée en tête des résultats.
- **Dispositifs complémentaires** (`dispositifs_complementaires` par OPCO) : Boost Compétences, Click&Form, FSE+, transition écologique TP hors budget, abondements CPF/SPSTI, versements volontaires… avec règle de cumul (`hors_budget` / `additif` / `alternatif`), **conditions d'attribution**, **démarches** et source. Tous sourcés.
- **Barèmes par branche** (`variantes_branche`, V2.2) : les montants d'un OPCO varient selon la convention collective. Une variante (identifiée par codes **IDCC**) surcharge le barème général : budget annuel, coût horaire, **salaire**, frais. Application automatique selon l'IDCC détecté (recherche SIREN) ou le choix manuel à l'étape 1 ; priorité : choix manuel > IDCC détecté > barème général (+ avertissement). Branches couvertes : AKTO Organismes de formation (1516) et Commerces de gros (0573), OPCO EP Pharmacie d'officine (1996). Extensible par simple ajout de données.
- **Budget déjà consommé** : saisi à l'étape Situation, déduit du plafond annuel.
- **« Vos démarches, étape par étape »** : checklist concrète générée pour chaque résultat.

## Aides et financements (v1.3)

L'estimation du financement par l'OPCO s'accompagne d'un recensement des aides mobilisables pour un projet de formation : Région, CPF, France Travail, Transitions Pro, Agefiph, Union européenne, fonds d'assurance formation des non-salariés, fiscalité. Le catalogue compte 173 aides (46 nationales et européennes, 127 régionales) et un portail officiel par région. Chaque aide cite ses sources (adresse et extrait mot pour mot) et sa date de vérification.

### Le parcours en six étapes

Le parcours de saisie, tel que la spécification le définit, compte six étapes. Le moteur n'en dépend pas : il évalue le profil que le parcours produit.

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

`DatasetSchema` (`packages/core/src/schema.ts`) ajoute aux barèmes des OPCO les sections facultatives `aides`, `idcc`, `naf` et `portails` ; une application qui ne les connaît pas les ignore. Le dataset publié dans `datasets/` est pour l'instant en version 3 (barèmes des OPCO seuls). La version 4 est générée au moment de la publication (section « Publier vers les applications installées » de `docs/donnees-aides.md`) : elle met à jour les applications déjà installées, donc seulement sur décision explicite. Le site (`apps/web`) embarque les données au build.

### Contrôle des liens et maintenance

- `cd backend && npm run check-sources` vérifie toutes les adresses web des données (barèmes, aides, portails, table IDCC) et écrit `backend/out/liens.md` et `backend/out/liens.json`. Les liens cassés font échouer la commande, les refus anti-robots sont listés « à vérifier », et `api.francecompetences.fr` n'est jamais contacté.
- Le workflow hebdomadaire `.github/workflows/update-dataset.yml` lance les tests, le contrôle des liens (rapport joint au run) puis, si le secret `ANTHROPIC_API_KEY` existe, le pipeline d'extraction par IA. Sans le secret, il avertit sans échouer.
- Le guide `docs/donnees-aides.md` décrit le format des données, les règles de sourçage, la mise à jour d'une aide, la revue complète et la publication.

## Vérifications (état actuel)

Résultats du 07/10/2026 :

| Package | Typecheck | Tests |
|---|---|---|
| `@opco/core` | OK (`tsc --noEmit`) | OK : 1248 tests dans 18 fichiers (`npx vitest run`) |
| `apps/mobile` | OK (`tsc --noEmit`) | aucun test |
| `@opco/backend` | OK (`tsc --noEmit`) | OK : 52 tests dans 2 fichiers (`npx vitest run`), dry-run du pipeline OK |

Contrôle des liens (`npm run check-sources`) : 675 adresses sur 127 sites. 533 répondent, 133 sont à vérifier à la main (protections anti-robots, dont 111 pages de Légifrance) et 9 sont injoignables depuis le poste qui a lancé le contrôle : 8 pages de `opcomobilites.fr`, qui répondent 200 depuis d'autres réseaux, et `meformerenregion.fr`, qui ne répond depuis aucun des réseaux testés. Aucune adresse ne renvoie 404.

## À configurer côté utilisateur (hors code)

1. **`ANTHROPIC_API_KEY`** comme **secret GitHub Actions** (jamais dans l'app) pour le mode `--live` du pipeline hebdo.
2. **OCAPIAT** : sa source de financement est un **PDF** (non géré par le scraper minimal) → ses champs passeront en `not_found` → rétrogradation de confiance (jamais d'invention). Ajouter un parseur PDF si besoin d'extraction automatique pour cet OPCO.
3. **Limite connue du pipeline** : la vérification hebdomadaire couvre les barèmes principaux des 11 OPCO, pas encore les `variantes_branche` (pages de branche) ni les `dispositifs_complementaires` — à étendre (voir issues).

## Principes non négociables

- **Aucun montant inventé.** Toute valeur chiffrée vient d'une source officielle citée, sinon `depends_on_branche`.
- Le **moteur de calcul reste pur** (mêmes entrées → mêmes sorties) et **partagé** web/mobile/backend.
- Les **données sont des estimations**, pas un engagement de l'OPCO (disclaimer conservé dans l'app).
