# Financement OPCO — V2 mobile (APK autonome, auto-mise à jour & auto-correction)

Application mobile Android qui estime ce qu'un OPCO peut financer pour une formation. Reprend le moteur de la V1 web (`../opco-funding`), fonctionne **hors-ligne**, et dont les **montants se mettent à jour régulièrement** et **s'autocorrigent** via un pipeline IA.

> Spécification d'origine : voir `../SPEC-APP-MOBILE-OPCO.md`.

## Monorepo (npm workspaces)

```
opco-mobile/
├── packages/core/      @opco/core — logique métier PARTAGÉE (0 dépendance UI)
│   ├── src/            types · calculator (pur) · opco-resolver · schema (Zod) · data
│   ├── data/opcos/     les 11 OPCO sourcés (+ idcc-opco-map.json)
│   └── tests/          19 tests (moteur + schéma + résolution IDCC)
├── apps/mobile/        Expo / React Native — l'app, l'APK
│   ├── src/app/        écrans (expo-router) : accueil + wizard
│   ├── src/components/  wizard 5 étapes · FundingBreakdown · badges
│   ├── src/lib/        dataset-sync · siren-client
│   └── eas.json        profil "preview" → APK
├── backend/            @opco/backend — pipeline auto-correctif (cron)
│   ├── src/            scrape → extract(IA) → verify → correct → validate → publish
│   ├── sources/        opco-sources.json (URLs officielles par champ)
│   └── tests/          22 tests
├── datasets/           dataset publié & versionné (manifest + latest + vN)
├── scripts/            build-example-dataset.mjs (seed)
└── .github/workflows/  update-dataset.yml (cron hebdo)
```

Le **`packages/core` est la source de vérité** : l'app et le backend l'importent tous les deux → le schéma et le calcul ne peuvent pas diverger.

## Démarrage rapide

```bash
npm install                         # à la racine (workspaces)
npm test                            # tests du core (19)
npm run test --workspace @opco/backend   # tests backend (22)
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

## Vérifications (état actuel)

| Package | Typecheck | Tests |
|---|---|---|
| `@opco/core` | ✅ | ✅ 30/30 |
| `apps/mobile` | ✅ (`tsc --noEmit`, `expo export` OK) | — |
| `@opco/backend` | ✅ | ✅ 22/22 + dry-run OK |

## À configurer côté utilisateur (hors code)

1. **`ANTHROPIC_API_KEY`** comme **secret GitHub Actions** (jamais dans l'app) pour le mode `--live` du pipeline hebdo.
2. **OCAPIAT** : sa source de financement est un **PDF** (non géré par le scraper minimal) → ses champs passeront en `not_found` → rétrogradation de confiance (jamais d'invention). Ajouter un parseur PDF si besoin d'extraction automatique pour cet OPCO.
3. **Limite connue du pipeline** : la vérification hebdomadaire couvre les barèmes principaux des 11 OPCO, pas encore les `variantes_branche` (pages de branche) ni les `dispositifs_complementaires` — à étendre (voir issues).

## Principes non négociables

- **Aucun montant inventé.** Toute valeur chiffrée vient d'une source officielle citée, sinon `depends_on_branche`.
- Le **moteur de calcul reste pur** (mêmes entrées → mêmes sorties) et **partagé** web/mobile/backend.
- Les **données sont des estimations**, pas un engagement de l'OPCO (disclaimer conservé dans l'app).
