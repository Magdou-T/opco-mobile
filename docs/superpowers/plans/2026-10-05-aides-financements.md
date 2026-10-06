# Plan d'implémentation — Moteur d'aides et financements + identification fiable de l'OPCO

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger l'app mobile « Financement OPCO », fiabiliser l'identification de l'OPCO et ajouter un moteur qui identifie toutes les aides et financements mobilisables (OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe, fonds des non-salariés, fiscalité) avec un plan de financement plafonné au coût réel.

**Architecture:** La logique métier reste dans `@opco/core` (fonctions pures testées par vitest) : résolveur OPCO v2, évaluation d'un catalogue d'aides sourcé, plan de financement. Les données (barèmes OPCO, table IDCC, aides, portails régionaux) sont embarquées dans `packages/core/data` et publiées dans le dataset versionné v4 que l'app télécharge. L'app Expo ajoute une étape « Projet », enrichit les étapes « Entreprise » et « Bénéficiaire » et affiche un écran « Votre plan de financement ».

**Tech Stack:** TypeScript 5.6 (core, backend) / 6.0 (app), Zod 3.25, Vitest 2.1, Expo 56 / React Native 0.85 / expo-router / NativeWind 4, Node 22.

**Spécification :** `docs/superpowers/specs/2026-10-05-aides-financements-design.md`

## Global Constraints

- Branche `feature/aides-financements` ; **aucun push** ni publication de dataset sans accord explicite de l'utilisateur.
- Chaque message de commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `@opco/core` : fonctions **pures** (aucune E/S, aucune lecture de l'horloge ; la date de référence est un paramètre).
- **Aucun montant inventé** : toute valeur chiffrée des données porte une source officielle (URL + extrait mot pour mot + date) ; sinon `non_chiffre` / `a_confirmer`.
- **Ne jamais appeler** `api.francecompetences.fr` ni réutiliser les tables de France Compétences (licence requise, art. R. 6123-35 du code du travail) ; un simple lien vers `https://quel-est-mon-opco.francecompetences.fr/` est autorisé.
- Pas de nouvelle dépendance npm.
- Textes affichés en français, apostrophes droites `'`, pas d'émoji (les symboles déjà utilisés dans l'UI — ✓ ⚠ ↗ ▸ ▾ — restent autorisés).
- Codes région INSEE : `84 27 53 24 94 44 32 11 28 75 76 52 93 01 02 03 04 06` (18 régions).
- Commandes de test : `npx vitest run` dans `packages/core` et dans `backend` ; typecheck : `npx tsc --noEmit` dans `packages/core`, `backend`, `apps/mobile`.
- Dossier des recherches documentaires (produit par les agents de recherche, hors dépôt) :
  `C:\Users\magdo\AppData\Local\Temp\claude\C--Users-magdo-Desktop-Claude-Projet-OPCO\52697ff6-6d7d-4f13-8eff-c5938bb2697d\scratchpad\research` — noté `$RECHERCHE` ci-dessous.

---

## Structure des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `packages/core/src/types.ts` | Types partagés : projet, bénéficiaire, régions, champs du parcours, champs OPCO ajoutés | 1, 2, 14 |
| `packages/core/src/geo.ts` | Régions/départements INSEE, code postal → département → région | 1 |
| `packages/core/src/calculator.ts` | Calcul OPCO corrigé (50 salariés, dégressif, portée du plafond, dispositifs sur le reste) | 2 |
| `packages/core/src/aides/types.ts` | Types du catalogue d'aides et de l'évaluation | 3 |
| `packages/core/src/schema.ts` | Schémas Zod v4 : OPCO, aides, IDCC, NAF, portails, dataset, manifest | 3 |
| `packages/core/src/opco-resolver.ts` | Résolveur OPCO v2 (certitude, multi-IDCC, échappatoires, fusions, NAF) | 4 |
| `packages/core/src/data.ts` | Données embarquées : OPCO, IDCC, NAF, aides, portails | 4 |
| `packages/core/src/entreprise.ts` | Lecture d'un résultat de l'API recherche-entreprises | 5 |
| `packages/core/src/aides/criteres.ts` | Évaluation tri-état des critères (ok / ko / inconnu) | 10 |
| `packages/core/src/aides/evaluer.ts` | Statut d'éligibilité, montant estimé, tri | 11 |
| `packages/core/src/aides/profil.ts` | État du parcours → profil d'évaluation ; dates | 12 |
| `packages/core/src/aides/plan.ts` | Plan de financement empilé et plafonné | 13 |
| `packages/core/data/idcc/*.json` | Table IDCC → OPCO v2 et suggestions NAF | 4, 9 |
| `packages/core/data/aides/*.json` | Catalogue d'aides (nationales, régionales) et portails | 4, 17 |
| `apps/mobile/src/lib/dataset-sync.ts` + `hooks/useActiveDataset.ts` | Dataset actif complet (cache ou embarqué) | 6 |
| `apps/mobile/src/components/wizard/*` | Étapes du parcours (Projet, Entreprise, Bénéficiaire, Formation, Récap) | 7, 14 |
| `apps/mobile/src/components/results/*` | Plan de financement, liste d'aides, portails, détail OPCO | 15 |
| `scripts/convertir-table-idcc.mjs` | Conversion ponctuelle de l'ancienne table IDCC | 4 |
| `scripts/integrer-recherches.mjs` | Intégration des fichiers de recherche dans le catalogue | 17 |
| `scripts/build-example-dataset.mjs`, `backend/src/publish.ts`, `backend/src/run.ts` | Dataset v4 | 19 |
| `backend/src/check-sources.ts` | Contrôle des liens sources | 20 |

---

# Phase 1 — Socle

### Task 1 : Types du parcours et référentiel géographique

**Files:**
- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/geo.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/geo.test.ts`

**Interfaces:**
- Produces (types.ts) : `CoutHoraireSeuil`, `ModeSeuils`, `PorteeBudget`, `ProjetType`, `StatutBeneficiaire`, `NiveauDiplome`, `NiveauCertification`, `StatutDirigeant`, `TypeStructure`, `TypeAlternance`, `CertitudeOpco`, `CodeRegion`, `STATUT_PAR_PROJET`, `PROJET_LABELS`, `NIVEAU_DIPLOME_LABELS`, `NIVEAU_CERTIFICATION_LABELS`, `STATUT_DIRIGEANT_LABELS`, `TYPE_ALTERNANCE_LABELS`, `CERTIFICATION_LABELS` ; `CertificationType` étendu (`'rs'`, `'aucune'`) ; champs ajoutés à `OpcoData`, `VarianteBranche`, `WizardState`.
- Produces (geo.ts) : `REGIONS: Record<CodeRegion, string>`, `REGIONS_TRIEES: { code: CodeRegion; nom: string }[]`, `DEPARTEMENT_REGION: Record<string, CodeRegion>`, `estCodeRegion(code): code is CodeRegion`, `regionDuDepartement(dep): CodeRegion | null`, `departementDuCodePostal(cp): string | null`.

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/core/tests/geo.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import {
  DEPARTEMENT_REGION,
  REGIONS,
  REGIONS_TRIEES,
  departementDuCodePostal,
  estCodeRegion,
  regionDuDepartement,
} from '../src/geo';

describe('référentiel géographique', () => {
  it('compte 18 régions et 101 départements', () => {
    expect(Object.keys(REGIONS)).toHaveLength(18);
    expect(Object.keys(DEPARTEMENT_REGION)).toHaveLength(101);
    expect(REGIONS_TRIEES).toHaveLength(18);
  });

  it('rattache chaque département à une région connue', () => {
    for (const region of Object.values(DEPARTEMENT_REGION)) {
      expect(REGIONS[region]).toBeDefined();
    }
  });

  it('déduit le département du code postal', () => {
    expect(departementDuCodePostal('75001')).toBe('75');
    expect(departementDuCodePostal('95870')).toBe('95');
    expect(departementDuCodePostal('20090')).toBe('2A');
    expect(departementDuCodePostal('20200')).toBe('2B');
    expect(departementDuCodePostal('97400')).toBe('974');
    expect(departementDuCodePostal('97600')).toBe('976');
    expect(departementDuCodePostal('98000')).toBeNull();
    expect(departementDuCodePostal('7500')).toBeNull();
    expect(departementDuCodePostal(null)).toBeNull();
  });

  it('déduit la région du département', () => {
    expect(regionDuDepartement('95')).toBe('11');
    expect(regionDuDepartement('2a')).toBe('94');
    expect(regionDuDepartement('974')).toBe('04');
    expect(regionDuDepartement('99')).toBeNull();
  });

  it('reconnaît les codes région INSEE', () => {
    expect(estCodeRegion('11')).toBe(true);
    expect(estCodeRegion('06')).toBe(true);
    expect(estCodeRegion('99')).toBe(false);
    expect(estCodeRegion(null)).toBe(false);
  });

  it('ordonne les régions : métropole puis outre-mer', () => {
    expect(REGIONS_TRIEES[0]).toEqual({ code: '84', nom: 'Auvergne-Rhône-Alpes' });
    expect(REGIONS_TRIEES[13].code).toBe('01');
    expect(REGIONS_TRIEES[17].code).toBe('06');
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `cd packages/core && npx vitest run tests/geo.test.ts`
Expected : FAIL — `Failed to load url ../src/geo`.

- [ ] **Step 3 : Ajouter les types dans `packages/core/src/types.ts`**

3a. Après l'interface `SourcedValue`, insérer :

```ts
/** Tranche d'un barème dégressif selon la durée de la formation (ex. Uniformation). */
export interface CoutHoraireSeuil {
  /** Durée (heures) jusqu'à laquelle ce taux s'applique ; null = au-delà du dernier seuil. */
  max_heures: number | null;
  /** Plafond horaire de la tranche (€/h). */
  valeur: number;
}

/**
 * Lecture d'un barème dégressif :
 * - 'par_tranche' (défaut) : chaque tranche d'heures est financée à son propre taux ;
 * - 'selon_duree_totale' : un seul taux, choisi selon la durée totale de la formation.
 */
export type ModeSeuils = 'par_tranche' | 'selon_duree_totale';

/**
 * Portée du plafond annuel :
 * - 'global' (défaut) : tous postes confondus ;
 * - 'pedagogie' : coûts pédagogiques seuls (salaires et frais annexes financés en plus).
 */
export type PorteeBudget = 'global' | 'pedagogie';
```

3b. Dans `OpcoData`, après `cout_horaire_metier`, ajouter :

```ts
  /** Barème dégressif selon la durée (prioritaire sur les plafonds horaires ci-dessus). */
  cout_horaire_seuils?: CoutHoraireSeuil[];
  cout_horaire_seuils_mode?: ModeSeuils;
```

après `budget_annuel_max`, ajouter :

```ts
  budget_annuel_portee?: PorteeBudget;
```

et à la fin de l'interface (après `variantes_branche?`), ajouter :

```ts

  /** Date de dernière vérification des barèmes auprès des sources officielles (AAAA-MM-JJ). */
  derniere_verification?: string;
```

3c. Dans `VarianteBranche`, après `cout_horaire_metier?`, ajouter :

```ts
  cout_horaire_seuils?: CoutHoraireSeuil[];
  cout_horaire_seuils_mode?: ModeSeuils;
```

et après `budget_annuel_max?` :

```ts
  budget_annuel_portee?: PorteeBudget;
```

3d. Remplacer la ligne `export type CertificationType = ...` par :

```ts
export type CertificationType = 'rncp' | 'rs' | 'cqp' | 'diplome' | 'habilitation' | 'aucune' | 'autre';
```

3e. Juste avant `export interface WizardState`, insérer la section :

```ts
// --- Projet, bénéficiaire, géographie ---

export type ProjetType =
  | 'formation_salarie'
  | 'reconversion_salarie'
  | 'recrutement_demandeur_emploi'
  | 'alternance'
  | 'formation_dirigeant';

/** Personne qui suit la formation ou qui est recrutée. */
export type StatutBeneficiaire = 'salarie' | 'demandeur_emploi' | 'alternant' | 'dirigeant';
export type NiveauDiplome = 'sans_diplome' | 'cap_bep' | 'bac' | 'bac_plus_2' | 'bac_plus_3_et_plus';
/** Niveau du cadre national des certifications (3 = CAP … 8 = doctorat). */
export type NiveauCertification = 3 | 4 | 5 | 6 | 7 | 8;
export type StatutDirigeant =
  | 'commercant'
  | 'artisan'
  | 'profession_liberale'
  | 'exploitant_agricole'
  | 'assimile_salarie';
export type TypeStructure = 'ess' | 'siae' | 'association';
export type TypeAlternance = 'apprentissage' | 'professionnalisation';
/** Certitude de l'identification de l'OPCO ('confirme' : source officielle sous licence). */
export type CertitudeOpco = 'confirme' | 'fiable' | 'a_confirmer' | 'inconnu';
/** Code région INSEE (13 régions métropolitaines + 5 régions d'outre-mer). */
export type CodeRegion =
  | '84' | '27' | '53' | '24' | '94' | '44' | '32' | '11' | '28' | '75' | '76' | '52' | '93'
  | '01' | '02' | '03' | '04' | '06';

export const STATUT_PAR_PROJET: Record<ProjetType, StatutBeneficiaire> = {
  formation_salarie: 'salarie',
  reconversion_salarie: 'salarie',
  recrutement_demandeur_emploi: 'demandeur_emploi',
  alternance: 'alternant',
  formation_dirigeant: 'dirigeant',
};

export const PROJET_LABELS: Record<ProjetType, { label: string; description: string }> = {
  formation_salarie: {
    label: 'Former un salarié',
    description: "Développer les compétences d'un salarié de l'entreprise",
  },
  reconversion_salarie: {
    label: "Reconversion d'un salarié",
    description: "Changer de métier, dans l'entreprise ou en dehors",
  },
  recrutement_demandeur_emploi: {
    label: "Recruter et former un demandeur d'emploi",
    description: "Former une personne inscrite à France Travail avant ou à l'embauche",
  },
  alternance: {
    label: 'Recruter en alternance',
    description: "Contrat d'apprentissage ou de professionnalisation",
  },
  formation_dirigeant: {
    label: 'Former le dirigeant',
    description: "Chef d'entreprise, travailleur indépendant ou dirigeant non salarié",
  },
};

export const NIVEAU_DIPLOME_LABELS: Record<NiveauDiplome, string> = {
  sans_diplome: 'Sans diplôme',
  cap_bep: 'CAP / BEP',
  bac: 'Bac',
  bac_plus_2: 'Bac +2',
  bac_plus_3_et_plus: 'Bac +3 et plus',
};

export const NIVEAU_CERTIFICATION_LABELS: Record<NiveauCertification, string> = {
  3: 'Niveau 3 (CAP, BEP)',
  4: 'Niveau 4 (Bac)',
  5: 'Niveau 5 (Bac +2)',
  6: 'Niveau 6 (Bac +3 / +4)',
  7: 'Niveau 7 (Bac +5)',
  8: 'Niveau 8 (Doctorat)',
};

export const STATUT_DIRIGEANT_LABELS: Record<StatutDirigeant, string> = {
  commercant: 'Commerçant (ou prestataire de services)',
  artisan: 'Artisan',
  profession_liberale: 'Profession libérale',
  exploitant_agricole: 'Exploitant agricole',
  assimile_salarie: 'Dirigeant assimilé salarié (président de SAS, gérant minoritaire…)',
};

export const TYPE_ALTERNANCE_LABELS: Record<TypeAlternance, string> = {
  apprentissage: "Contrat d'apprentissage",
  professionnalisation: 'Contrat de professionnalisation',
};

export const CERTIFICATION_LABELS: Record<CertificationType, string> = {
  rncp: 'RNCP (titre ou diplôme enregistré)',
  rs: 'Répertoire spécifique (RS)',
  cqp: 'CQP (certificat de qualification professionnelle)',
  diplome: "Diplôme d'État",
  habilitation: 'Habilitation',
  aucune: 'Aucune certification',
  autre: 'Autre',
};
```

3f. Remplacer l'interface `WizardState` par (les champs `isReconversion` et `isSortieChomage` sont conservés jusqu'à la tâche 14) :

```ts
export interface WizardState {
  // Étape 0 : projet
  projetType: ProjetType | null;

  // Étape 1 : entreprise et OPCO
  opcoKnown: boolean | null;
  selectedOpcoSlug: string | null;
  companyName: string | null;
  sirenNumber: string | null;
  /** SIRET du siège (recherche entreprise). */
  siret: string | null;
  detectedOpcoSlug: string | null;
  detectedIdcc: string | null;
  detectedCompanyName: string | null;
  /** Branche choisie manuellement (id de VarianteBranche) — prime sur l'IDCC détecté. */
  selectedBrancheId: string | null;
  /** Certitude de l'identification automatique de l'OPCO. */
  opcoCertitude: CertitudeOpco | null;
  /** Tous les IDCC déclarés par l'entreprise et ses établissements. */
  idccEtablissements: string[];
  /** IDCC déclarés par le siège (présélection en cas de pluralité). */
  idccSiege: string[];
  regionCode: CodeRegion | null;
  departementCode: string | null;
  codeNaf: string | null;
  /** Code de tranche d'effectif INSEE (indicatif, année N-2). */
  trancheEffectifInsee: string | null;
  companySize: CompanySize | null;
  /** Effectif exact, si l'utilisateur le précise (affine les seuils des aides). */
  effectif: number | null;
  /** Statuts connus via la recherche entreprise (ESS, SIAE, association). */
  structures: TypeStructure[];
  /** Budget formation déjà consommé auprès de l'OPCO cette année (euros). Déduit du plafond annuel. */
  budgetDejaConsomme: number | null;

  // Étape 2 : bénéficiaire
  contractType: ContractType | null;
  anciennete_mois: number | null;
  isHandicap: boolean;
  isReconversion: boolean;
  isSortieChomage: boolean;
  ageBeneficiaire: number | null;
  niveauDiplome: NiveauDiplome | null;
  typeAlternance: TypeAlternance | null;
  inscritFranceTravail: boolean | null;
  statutDirigeant: StatutDirigeant | null;
  microEntrepreneur: boolean | null;
  soldeCpf: number | null;
  /** Région de résidence du bénéficiaire, si différente de celle de l'entreprise. */
  regionBeneficiaireCode: CodeRegion | null;

  // Étape 3 : formation
  formationNom: string | null;
  formationType: TrainingType | null;
  certificationLevel: CertificationType | null;
  niveauFormationVise: NiveauCertification | null;
  eligibleCpf: boolean | null;
  /** Mois de début prévu (AAAA-MM). */
  dateDebutFormation: string | null;
  organismeQualiopi: boolean | null;
  durationHours: number | null;
  pedagogyCostTotal: number | null;
  pedagogyCostPerHour: number | null;
  trainingMode: TrainingMode | null;
  organismeFormation: string | null;

  // Étape 4 : frais annexes
  needsTransport: boolean;
  transportMode: TransportMode | null;
  transportDistanceKm: number | null;
  needsAccommodation: boolean;
  accommodationNights: number | null;
  accommodationCostPerNight: number | null;
  needsMeals: boolean;
  mealCostPerDay: number | null;
  trainingDays: number | null;
}
```

3g. Remplacer `createInitialWizardState` par :

```ts
export function createInitialWizardState(): WizardState {
  return {
    projetType: null,
    opcoKnown: null,
    selectedOpcoSlug: null,
    companyName: null,
    sirenNumber: null,
    siret: null,
    detectedOpcoSlug: null,
    detectedIdcc: null,
    detectedCompanyName: null,
    selectedBrancheId: null,
    opcoCertitude: null,
    idccEtablissements: [],
    idccSiege: [],
    regionCode: null,
    departementCode: null,
    codeNaf: null,
    trancheEffectifInsee: null,
    companySize: null,
    effectif: null,
    structures: [],
    budgetDejaConsomme: null,
    contractType: null,
    anciennete_mois: null,
    isHandicap: false,
    isReconversion: false,
    isSortieChomage: false,
    ageBeneficiaire: null,
    niveauDiplome: null,
    typeAlternance: null,
    inscritFranceTravail: null,
    statutDirigeant: null,
    microEntrepreneur: null,
    soldeCpf: null,
    regionBeneficiaireCode: null,
    formationNom: null,
    formationType: null,
    certificationLevel: null,
    niveauFormationVise: null,
    eligibleCpf: null,
    dateDebutFormation: null,
    organismeQualiopi: null,
    durationHours: null,
    pedagogyCostTotal: null,
    pedagogyCostPerHour: null,
    trainingMode: null,
    organismeFormation: null,
    needsTransport: false,
    transportMode: null,
    transportDistanceKm: null,
    needsAccommodation: false,
    accommodationNights: null,
    accommodationCostPerNight: null,
    needsMeals: false,
    mealCostPerDay: null,
    trainingDays: null,
  };
}
```

- [ ] **Step 4 : Créer `packages/core/src/geo.ts`**

```ts
// ============================================================
// Référentiel géographique INSEE (code officiel géographique) :
// 18 régions et 101 départements, pour cibler les aides régionales.
// ============================================================

import type { CodeRegion } from './types';

export const REGIONS: Record<CodeRegion, string> = {
  '84': 'Auvergne-Rhône-Alpes',
  '27': 'Bourgogne-Franche-Comté',
  '53': 'Bretagne',
  '24': 'Centre-Val de Loire',
  '94': 'Corse',
  '44': 'Grand Est',
  '32': 'Hauts-de-France',
  '11': 'Île-de-France',
  '28': 'Normandie',
  '75': 'Nouvelle-Aquitaine',
  '76': 'Occitanie',
  '52': 'Pays de la Loire',
  '93': "Provence-Alpes-Côte d'Azur",
  '01': 'Guadeloupe',
  '02': 'Martinique',
  '03': 'Guyane',
  '04': 'La Réunion',
  '06': 'Mayotte',
};

/** Ordre des sélecteurs : métropole puis outre-mer, alphabétique (liste figée, indépendante d'Intl). */
const ORDRE_REGIONS: CodeRegion[] = [
  '84', '27', '53', '24', '94', '44', '32', '11', '28', '75', '76', '52', '93',
  '01', '03', '04', '02', '06',
];

export const REGIONS_TRIEES: { code: CodeRegion; nom: string }[] = ORDRE_REGIONS.map((code) => ({
  code,
  nom: REGIONS[code],
}));

/** Département → région (COG). Corse : 2A / 2B ; outre-mer : 971 à 976. */
export const DEPARTEMENT_REGION: Record<string, CodeRegion> = {
  '01': '84', '02': '32', '03': '84', '04': '93', '05': '93', '06': '93', '07': '84', '08': '44', '09': '76',
  '10': '44', '11': '76', '12': '76', '13': '93', '14': '28', '15': '84', '16': '75', '17': '75', '18': '24',
  '19': '75', '2A': '94', '2B': '94', '21': '27', '22': '53', '23': '75', '24': '75', '25': '27', '26': '84',
  '27': '28', '28': '24', '29': '53', '30': '76', '31': '76', '32': '76', '33': '75', '34': '76', '35': '53',
  '36': '24', '37': '24', '38': '84', '39': '27', '40': '75', '41': '24', '42': '84', '43': '84', '44': '52',
  '45': '24', '46': '76', '47': '75', '48': '76', '49': '52', '50': '28', '51': '44', '52': '44', '53': '52',
  '54': '44', '55': '44', '56': '53', '57': '44', '58': '27', '59': '32', '60': '32', '61': '28', '62': '32',
  '63': '84', '64': '75', '65': '76', '66': '76', '67': '44', '68': '44', '69': '84', '70': '27', '71': '27',
  '72': '52', '73': '84', '74': '84', '75': '11', '76': '28', '77': '11', '78': '11', '79': '75', '80': '32',
  '81': '76', '82': '76', '83': '93', '84': '93', '85': '52', '86': '75', '87': '75', '88': '44', '89': '27',
  '90': '27', '91': '11', '92': '11', '93': '11', '94': '11', '95': '11',
  '971': '01', '972': '02', '973': '03', '974': '04', '976': '06',
};

export function estCodeRegion(code: string | null | undefined): code is CodeRegion {
  return code != null && Object.prototype.hasOwnProperty.call(REGIONS, code);
}

export function regionDuDepartement(departement: string | null | undefined): CodeRegion | null {
  if (!departement) return null;
  return DEPARTEMENT_REGION[departement.trim().toUpperCase()] ?? null;
}

/** Département d'un code postal français (null : format invalide, Monaco, collectivités hors région). */
export function departementDuCodePostal(codePostal: string | null | undefined): string | null {
  const cp = (codePostal ?? '').trim();
  if (!/^\d{5}$/.test(cp)) return null;
  if (cp.startsWith('97')) {
    const dep = cp.slice(0, 3);
    return dep in DEPARTEMENT_REGION ? dep : null;
  }
  if (cp.startsWith('20')) return Number(cp) < 20200 ? '2A' : '2B';
  const dep = cp.slice(0, 2);
  return dep in DEPARTEMENT_REGION ? dep : null;
}
```

- [ ] **Step 5 : Exporter le module** — dans `packages/core/src/index.ts`, ajouter après `export * from './data';` :

```ts
export * from './geo';
```

- [ ] **Step 6 : Vérifier que tout passe**

Run : `cd packages/core && npx vitest run && npx tsc --noEmit`
Expected : PASS (30 tests existants + 6 nouveaux), aucune erreur de type.
Run : `cd apps/mobile && npx tsc --noEmit` — Expected : aucune erreur (changements additifs).

- [ ] **Step 7 : Commit**

```bash
git add packages/core/src/types.ts packages/core/src/geo.ts packages/core/src/index.ts packages/core/tests/geo.test.ts
git commit -m "core : types du parcours (projet, beneficiaire, regions) et referentiel geographique INSEE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Corrections du calcul OPCO

**Files:**
- Modify: `packages/core/src/types.ts` (ajout `PosteFinancement`, champ `poste` de `FundingLine`)
- Modify: `packages/core/src/calculator.ts` (réécriture complète ci-dessous)
- Test: `packages/core/tests/calculator.test.ts`

**Interfaces:**
- Consumes : types de la tâche 1.
- Produces : `export type PosteFinancement = 'pedagogie' | 'salaires' | 'transport' | 'hebergement' | 'restauration' | 'frais_annexes'` ; `FundingLine.poste: PosteFinancement` ; `export const REFERENCE_REGLE_50_SALARIES: string` ; `export function estEntreprise50Plus(size: CompanySize | null): boolean` ; `calculateFunding(opco, state): FundingResult` (signature inchangée) ; `FundingResult.enveloppeMaxPotentielle` ≤ `totalRequested`.

- [ ] **Step 1 : Écrire les tests qui échouent** — ajouter à la fin de `packages/core/tests/calculator.test.ts` :

```ts
describe('calculateFunding — règle des 50 salariés', () => {
  it('50+ sans enveloppe publiée : PDC mutualisé à 0 € et explication', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState({ companySize: '50_299', durationHours: 100, pedagogyCostPerHour: 30, pedagogyCostTotal: 3000 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.poste === 'pedagogie')!;
    expect(peda.requestedAmount).toBe(3000);
    expect(peda.fundedAmount).toBe(0);
    expect(r.totalFunded).toBe(0);
    expect(r.warnings.some((w) => w.includes('moins de 50 salariés'))).toBe(true);
    expect(r.dispositifPrincipal).toContain('non accessibles');
  });

  it('50+ avec enveloppe publiée : calcul appliqué avec cette enveloppe', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      plafonds_par_taille: [
        { taille: '50_299', cout_horaire_max: null, budget_annuel_max: 1000, quota_horaire_max: null, description: 'Plan conventionnel 50+.' },
      ],
    });
    const state = makeFormationState({ companySize: '50_299', durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    expect(r.totalFunded).toBe(1000);
    expect(r.warnings.some((w) => w.includes('50 salariés et plus'))).toBe(true);
  });
});

describe('calculateFunding — barème dégressif', () => {
  const seuils = [
    { max_heures: 105, valeur: 65 },
    { max_heures: null, valeur: 15 },
  ];

  it('par tranche : chaque tranche d’heures à son taux', () => {
    const opco = makeOpco({ cout_horaire_seuils: seuils, cout_horaire_seuils_mode: 'par_tranche' });
    const state = makeFormationState({ durationHours: 140, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // 105 h × min(40, 65) + 35 h × min(40, 15) = 4200 + 525
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(4725);
  });

  it('selon la durée totale : un seul taux', () => {
    const opco = makeOpco({ cout_horaire_seuils: seuils, cout_horaire_seuils_mode: 'selon_duree_totale' });
    const state = makeFormationState({ durationHours: 140, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // 140 h > 105 h → 15 €/h × 140 h
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(2100);
  });
});

describe('calculateFunding — portée du plafond annuel', () => {
  it('portée pédagogie : salaires financés en plus du plafond', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
      budget_annuel_portee: 'pedagogie',
    });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(2000);
    expect(r.lines.find((l) => l.poste === 'salaires')!.fundedAmount).toBe(1200);
    expect(r.totalFunded).toBe(3200);
    expect(r.budgetCapApplied).toBe(true);
  });
});

describe('calculateFunding — dispositifs complémentaires et enveloppe', () => {
  const boost = {
    id: 'boost', nom: 'Boost', cumul: 'additif' as const,
    montant_max: 750, unite: 'par_dossier' as const, pourcentage_couts: 50,
    description: 'd', conditions: ['c'], demarches: 'm',
    tailles_eligibles: null, publics: null,
    confidence: 'exact' as const, source_url: 'x',
  };

  it('un dispositif en % est calculé sur le reste à financer', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' }, dispositifs_complementaires: [boost] });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 60, pedagogyCostTotal: 6000 });
    const r = calculateFunding(opco, state);
    // PDC 4000 ; reste 2000 → 50 % = 1000, plafonné à 750
    expect(r.dispositifsComplementaires[0].montantEstime).toBe(750);
    expect(r.enveloppeMaxPotentielle).toBe(4750);
  });

  it('l’enveloppe ne dépasse jamais le coût demandé', () => {
    const gros = { ...boost, id: 'gros', pourcentage_couts: null, montant_max: 10000 };
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' }, dispositifs_complementaires: [gros] });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    expect(r.enveloppeMaxPotentielle).toBeLessThanOrEqual(r.totalRequested);
  });

  it('chaque ligne porte son poste', () => {
    const opco = makeOpco();
    const r = calculateFunding(opco, makeFormationState({ needsMeals: true, mealCostPerDay: 15, trainingDays: 2 }));
    expect(r.lines.map((l) => l.poste)).toEqual(['pedagogie', 'salaires', 'transport', 'hebergement', 'restauration']);
  });
});
```

Puis, dans le test existant `filtre les dispositifs par taille et calcule l’enveloppe max potentielle`, remplacer les deux dernières assertions par :

```ts
    // boost : PDC couvre déjà 100 % (30 €/h sous le plafond 40 €/h) → reste 0 → 0 €
    expect(r.dispositifsComplementaires.find((d) => d.id === 'boost')!.montantEstime).toBe(0);
    // l'enveloppe est plafonnée au coût : 3000
    expect(r.enveloppeMaxPotentielle).toBe(3000);
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `cd packages/core && npx vitest run tests/calculator.test.ts`
Expected : FAIL (propriété `poste` absente, règle des 50 salariés non appliquée, `cout_horaire_seuils` ignoré).

- [ ] **Step 3 : Ajouter `PosteFinancement` dans `types.ts`** — juste avant `export interface FundingLine`, insérer :

```ts
/** Poste de dépense d'une ligne de financement OPCO. */
export type PosteFinancement =
  | 'pedagogie'
  | 'salaires'
  | 'transport'
  | 'hebergement'
  | 'restauration'
  | 'frais_annexes';
```

et ajouter en tête de `FundingLine` :

```ts
  poste: PosteFinancement;
```

- [ ] **Step 4 : Réécrire `packages/core/src/calculator.ts`**

```ts
// ============================================================
// OPCO Funding Calculation Engine
// Pure function: no side effects, no I/O, fully deterministic.
// ============================================================

import type {
  OpcoData,
  WizardState,
  FundingResult,
  FundingLine,
  Confidence,
  CompanySize,
  PlafondTaille,
  DispositifEligible,
  VarianteBranche,
  PosteFinancement,
} from './types';

/** Texte de référence de la règle des 50 salariés (fonds mutualisés du PDC). */
export const REFERENCE_REGLE_50_SALARIES = 'art. L. 6332-17 du code du travail';

// ---------------------------------------------------------------------------
// Variantes de branche (barèmes spécifiques par convention collective)
// ---------------------------------------------------------------------------

/**
 * Résout la variante de branche applicable.
 * Priorité : choix manuel de l'utilisateur > IDCC détecté (SIREN) > aucune.
 */
export function resolveVarianteBranche(
  opco: OpcoData,
  state: Pick<WizardState, 'selectedBrancheId' | 'detectedIdcc'>,
): VarianteBranche | null {
  const variantes = opco.variantes_branche ?? [];
  if (variantes.length === 0) return null;

  if (state.selectedBrancheId) {
    const manual = variantes.find((v) => v.id === state.selectedBrancheId);
    if (manual) return manual;
  }

  if (state.detectedIdcc) {
    const idcc = state.detectedIdcc.padStart(4, '0');
    const byIdcc = variantes.find((v) => v.idcc.includes(idcc));
    if (byIdcc) return byIdcc;
  }

  return null;
}

/**
 * Applique une variante de branche au barème par défaut de l'OPCO.
 * Pure : retourne un nouvel OpcoData fusionné, sans muter les entrées.
 */
export function applyVarianteBranche(opco: OpcoData, variante: VarianteBranche): OpcoData {
  return {
    ...opco,
    cout_horaire_inter: variante.cout_horaire_inter ?? opco.cout_horaire_inter,
    cout_horaire_metier: variante.cout_horaire_metier ?? opco.cout_horaire_metier,
    cout_horaire_seuils: variante.cout_horaire_seuils ?? opco.cout_horaire_seuils,
    cout_horaire_seuils_mode: variante.cout_horaire_seuils_mode ?? opco.cout_horaire_seuils_mode,
    prise_en_charge_salaires: variante.prise_en_charge_salaires ?? opco.prise_en_charge_salaires,
    prise_en_charge_salaires_mode:
      variante.prise_en_charge_salaires_mode ?? opco.prise_en_charge_salaires_mode,
    frais_transport: variante.frais_transport ?? opco.frais_transport,
    frais_hebergement: variante.frais_hebergement ?? opco.frais_hebergement,
    frais_restauration: variante.frais_restauration ?? opco.frais_restauration,
    budget_annuel_max: variante.budget_annuel_max ?? opco.budget_annuel_max,
    budget_annuel_portee: variante.budget_annuel_portee ?? opco.budget_annuel_portee,
    budget_annuel_description: variante.budget_annuel_description ?? opco.budget_annuel_description,
    plafonds_par_taille: variante.plafonds_par_taille ?? opco.plafonds_par_taille,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const arrondi = (n: number): number => Math.round(n * 100) / 100;

/** Build a single FundingLine. */
function line(
  poste: PosteFinancement,
  label: string,
  requested: number,
  funded: number,
  confidence: Confidence,
  sourceUrl: string,
  note?: string,
  details?: string[],
): FundingLine {
  return {
    poste,
    label,
    requestedAmount: arrondi(requested),
    fundedAmount: arrondi(funded),
    remainder: arrondi(requested - funded),
    confidence,
    sourceUrl,
    note,
    details,
  };
}

function resolvePlafondForSize(opco: OpcoData, size: CompanySize | null): PlafondTaille | null {
  if (!opco.plafonds_par_taille || !size) return null;
  return opco.plafonds_par_taille.find((p) => p.taille === size) ?? null;
}

/** true si l'entreprise compte 50 salariés ou plus. */
export function estEntreprise50Plus(size: CompanySize | null): boolean {
  return size === '50_299' || size === '300_plus';
}

/** Enveloppe publiée pour les entreprises de 50 salariés et plus (plan conventionnel ou volontaire). */
function enveloppe50Plus(opco: OpcoData, size: CompanySize | null): PlafondTaille | null {
  if (!estEntreprise50Plus(size)) return null;
  const plafond = resolvePlafondForSize(opco, size);
  return plafond?.budget_annuel_max != null && plafond.budget_annuel_max > 0 ? plafond : null;
}

/**
 * Determine the effective hourly ceiling for pedagogy costs.
 * Priority: 1. size-specific ceiling, 2. training-type ceiling, 3. null.
 */
function resolveHourlyCeiling(
  opco: OpcoData,
  state: WizardState,
): { ceiling: number | null; confidence: Confidence; sourceUrl: string } {
  const plafond = resolvePlafondForSize(opco, state.companySize);
  if (plafond?.cout_horaire_max != null) {
    return { ceiling: plafond.cout_horaire_max, confidence: 'exact', sourceUrl: opco.url_finance_page };
  }

  const isMetier =
    state.formationType === 'cqp' ||
    state.formationType === 'certification' ||
    state.formationType === 'habilitation';
  const sourcedCeiling = isMetier ? opco.cout_horaire_metier : opco.cout_horaire_inter;
  const fallback = isMetier ? opco.cout_horaire_inter : opco.cout_horaire_metier;
  const chosen = sourcedCeiling.value != null ? sourcedCeiling : fallback;

  return { ceiling: chosen.value, confidence: chosen.confidence, sourceUrl: chosen.source_url };
}

/** Applique le barème dégressif de l'OPCO (null si l'OPCO n'en publie pas). */
function financementDegressif(
  opco: OpcoData,
  heures: number,
  tauxDemande: number,
): { finance: number; details: string[] } | null {
  const seuils = [...(opco.cout_horaire_seuils ?? [])].sort(
    (a, b) => (a.max_heures ?? Infinity) - (b.max_heures ?? Infinity),
  );
  if (seuils.length === 0 || heures <= 0) return null;

  if ((opco.cout_horaire_seuils_mode ?? 'par_tranche') === 'selon_duree_totale') {
    const tranche =
      seuils.find((t) => t.max_heures != null && heures <= t.max_heures) ?? seuils[seuils.length - 1];
    const taux = Math.min(tauxDemande, tranche.valeur);
    return {
      finance: taux * heures,
      details: [
        `Barème selon la durée totale (${heures} h) : plafond ${tranche.valeur} €/h`,
        `Calcul : ${taux} €/h × ${heures} h = ${(taux * heures).toFixed(2)} €`,
      ],
    };
  }

  const details: string[] = [];
  let restant = heures;
  let borneBasse = 0;
  let finance = 0;
  for (const t of seuils) {
    if (restant <= 0) break;
    const largeur = t.max_heures == null ? restant : Math.max(0, t.max_heures - borneBasse);
    const h = Math.min(restant, largeur);
    if (h > 0) {
      const taux = Math.min(tauxDemande, t.valeur);
      finance += taux * h;
      details.push(
        `Tranche ${borneBasse}-${t.max_heures ?? '…'} h : ${h} h × ${taux} €/h (plafond ${t.valeur} €/h) = ${(taux * h).toFixed(2)} €`,
      );
      restant -= h;
    }
    if (t.max_heures != null) borneBasse = t.max_heures;
  }
  if (restant > 0) details.push(`${restant} h au-delà du dernier seuil publié : non financées`);
  return { finance, details };
}

// ---------------------------------------------------------------------------
// Individual line calculators
// ---------------------------------------------------------------------------

function calcPedagogy(
  opco: OpcoData,
  state: WizardState,
  warnings: string[],
  capPedagogie: number | null,
): { ligne: FundingLine; capApplique: boolean } {
  const hours = state.durationHours ?? 0;
  const userCostPerHour = state.pedagogyCostPerHour ?? 0;
  const requestedTotal = state.pedagogyCostTotal ?? userCostPerHour * hours;
  const details: string[] = [
    `Votre coût horaire : ${userCostPerHour} €/h × ${hours} h = ${(userCostPerHour * hours).toFixed(2)} €`,
  ];

  let funded: number;
  let confidence: Confidence;
  let sourceUrl: string;
  let note: string;

  const degressif = financementDegressif(opco, hours, userCostPerHour);
  if (degressif) {
    funded = degressif.finance;
    confidence = opco.cout_horaire_inter.confidence;
    sourceUrl = opco.cout_horaire_inter.source_url;
    note = 'Barème dégressif selon la durée';
    details.push(...degressif.details);
    const reste = userCostPerHour * hours - funded;
    if (reste > 0) {
      warnings.push(
        `Le barème dégressif de ${opco.name} laisse un reste à charge de ${reste.toFixed(2)} € sur les coûts pédagogiques.`,
      );
    }
  } else {
    const ceilingInfo = resolveHourlyCeiling(opco, state);
    sourceUrl = ceilingInfo.sourceUrl;
    if (ceilingInfo.ceiling != null) {
      const ceiling = ceilingInfo.ceiling;
      confidence = ceilingInfo.confidence;
      funded = Math.min(userCostPerHour, ceiling) * hours;
      note = `Plafond horaire : ${ceiling} €/h`;
      details.push(`Plafond horaire ${opco.name} : ${ceiling} €/h`);
      if (userCostPerHour > ceiling) {
        const reste = (userCostPerHour - ceiling) * hours;
        details.push(`⚠ Votre coût (${userCostPerHour} €/h) dépasse le plafond → taux appliqué : ${ceiling} €/h`);
        details.push(`Calcul : ${ceiling} €/h × ${hours} h = ${(ceiling * hours).toFixed(2)} €`);
        details.push(`Reste à charge sur ce poste : ${reste.toFixed(2)} €`);
        warnings.push(
          `Le coût horaire demandé (${userCostPerHour} €/h) dépasse le plafond ${opco.name} (${ceiling} €/h). ` +
            `Le reste à charge est de ${reste.toFixed(2)} €.`,
        );
      } else {
        details.push('Votre coût est dans le plafond → intégralement pris en charge');
        details.push(`Calcul : ${userCostPerHour} €/h × ${hours} h = ${(userCostPerHour * hours).toFixed(2)} €`);
      }
    } else {
      confidence = 'depends_on_branche';
      funded = userCostPerHour * hours;
      note = "Plafond horaire non renseigné — dépend de l'accord de branche";
      details.push(`Aucun plafond horaire officiel renseigné pour ${opco.name}`);
      details.push('Le montant réel dépend de votre accord de branche — contactez votre OPCO');
    }
  }

  let capApplique = false;
  if (capPedagogie != null && funded > capPedagogie) {
    details.push(`Plafond annuel applicable aux coûts pédagogiques : ${capPedagogie.toFixed(2)} €`);
    details.push(`Le montant calculé (${funded.toFixed(2)} €) dépasse ce plafond → ramené à ${capPedagogie.toFixed(2)} €`);
    funded = capPedagogie;
    capApplique = true;
    warnings.push(
      `Plafond annuel appliqué aux coûts pédagogiques : ${capPedagogie.toFixed(2)} € (salaires et frais annexes financés en plus).`,
    );
  }

  return {
    ligne: line('pedagogie', 'Coûts pédagogiques', requestedTotal, funded, confidence, sourceUrl, note, details),
    capApplique,
  };
}

function calcSalary(opco: OpcoData, state: WizardState, pedagogyFunded: number): FundingLine {
  const hours = state.durationHours ?? 0;
  const mode = opco.prise_en_charge_salaires_mode;
  const rate = opco.prise_en_charge_salaires.value;
  const confidence = opco.prise_en_charge_salaires.confidence;
  const sourceUrl = opco.prise_en_charge_salaires.source_url;
  const details: string[] = [];

  let funded = 0;
  let note: string | undefined;

  switch (mode) {
    case 'euro_par_heure':
      funded = (rate ?? 0) * hours;
      note = rate != null ? `${rate} €/h × ${hours}h` : undefined;
      details.push(`Mode de calcul ${opco.name} : forfait horaire`);
      if (rate != null) {
        details.push(`Taux de prise en charge : ${rate} €/h`);
        details.push(`Calcul : ${rate} €/h × ${hours}h = ${funded.toFixed(2)} €`);
      }
      break;
    case 'pourcentage_pedagogique':
      funded = pedagogyFunded * ((rate ?? 0) / 100);
      note = rate != null ? `${rate}% des coûts pédagogiques pris en charge` : undefined;
      details.push(`Mode de calcul ${opco.name} : pourcentage des coûts pédagogiques`);
      if (rate != null) {
        details.push(`Taux : ${rate}% des coûts péda financés (${pedagogyFunded.toFixed(2)} €)`);
        details.push(`Calcul : ${pedagogyFunded.toFixed(2)} € × ${rate}% = ${funded.toFixed(2)} €`);
      }
      break;
    case 'selon_accord':
      note = "Montant dépendant de l'accord de branche";
      details.push(`${opco.name} ne publie pas de taux fixe pour les salaires`);
      details.push('Le montant dépend de votre convention collective / accord de branche');
      details.push('Contactez votre OPCO pour connaître le montant exact');
      break;
    case 'inclus_plafond_horaire':
      note = 'Prise en charge salaire incluse dans le plafond horaire pédagogique';
      details.push(`${opco.name} n'attribue pas de forfait salaire distinct`);
      details.push('La prise en charge est intégrée au plafond horaire pédagogique');
      details.push("Aucune ligne salaire séparée n'est donc calculée");
      break;
  }

  const effectiveConfidence: Confidence =
    mode === 'selon_accord' || mode === 'inclus_plafond_horaire' ? 'depends_on_branche' : confidence;

  return line('salaires', 'Prise en charge salaires', funded, funded, effectiveConfidence, sourceUrl, note, details);
}

function calcTransport(opco: OpcoData, state: WizardState): FundingLine {
  if (!state.needsTransport) return line('transport', 'Transport', 0, 0, 'exact', opco.url_finance_page);

  const days = state.trainingDays ?? 0;
  const rate = opco.frais_transport.value;
  const confidence = opco.frais_transport.confidence;
  const sourceUrl = opco.frais_transport.source_url;

  if (rate != null && rate > 0) {
    const funded = rate * days;
    return line('transport', 'Transport', funded, funded, confidence, sourceUrl, `${rate} €/jour × ${days} jours`, [
      `Forfait transport journalier ${opco.name} : ${rate} €/jour`,
      `Calcul : ${rate} €/jour × ${days} jours = ${funded.toFixed(2)} €`,
    ]);
  }

  return line('transport', 'Transport', 0, 0, 'depends_on_branche', sourceUrl, 'Montant transport selon accord de branche', [
    `${opco.name} ne publie pas de forfait transport fixe`,
    'Le montant dépend de votre accord de branche',
  ]);
}

function calcAccommodation(opco: OpcoData, state: WizardState): FundingLine {
  if (!state.needsAccommodation) return line('hebergement', 'Hébergement', 0, 0, 'exact', opco.url_finance_page);

  const nights = state.accommodationNights ?? 0;
  const userCostPerNight = state.accommodationCostPerNight ?? 0;
  const requested = userCostPerNight * nights;
  const ceiling = opco.frais_hebergement.value;
  const confidence = opco.frais_hebergement.confidence;
  const sourceUrl = opco.frais_hebergement.source_url;

  if (ceiling != null && ceiling > 0) {
    const funded = Math.min(userCostPerNight, ceiling) * nights;
    const details = [
      `Votre coût : ${userCostPerNight} €/nuit × ${nights} nuits = ${requested.toFixed(2)} €`,
      `Plafond hébergement ${opco.name} : ${ceiling} €/nuit`,
    ];
    if (userCostPerNight > ceiling) {
      details.push(`⚠ Votre coût dépasse le plafond → taux appliqué : ${ceiling} €/nuit`);
      details.push(`Calcul : ${ceiling} €/nuit × ${nights} nuits = ${funded.toFixed(2)} €`);
    } else {
      details.push('Votre coût est dans le plafond → intégralement pris en charge');
    }
    return line('hebergement', 'Hébergement', requested, funded, confidence, sourceUrl, `Plafond : ${ceiling} €/nuit`, details);
  }

  return line(
    'hebergement',
    'Hébergement',
    requested,
    requested,
    'depends_on_branche',
    sourceUrl,
    "Plafond hébergement non renseigné — dépend de l'accord de branche",
    [
      `${opco.name} ne publie pas de plafond hébergement fixe`,
      'Le montant affiché est basé sur votre estimation et reste à confirmer',
    ],
  );
}

function calcMeals(opco: OpcoData, state: WizardState): FundingLine {
  if (!state.needsMeals) return line('restauration', 'Restauration', 0, 0, 'exact', opco.url_finance_page);

  const days = state.trainingDays ?? 0;
  const userCostPerDay = state.mealCostPerDay ?? 0;
  const requested = userCostPerDay * days;
  const rate = opco.frais_restauration.value;
  const confidence = opco.frais_restauration.confidence;
  const sourceUrl = opco.frais_restauration.source_url;

  if (rate != null && rate > 0) {
    const funded = rate * days;
    return line('restauration', 'Restauration', requested, funded, confidence, sourceUrl, `${rate} €/jour × ${days} jours`, [
      `Forfait restauration ${opco.name} : ${rate} €/jour`,
      `Calcul : ${rate} €/jour × ${days} jours = ${funded.toFixed(2)} €`,
      requested > funded
        ? `Reste à charge : ${(requested - funded).toFixed(2)} €`
        : 'Intégralement couvert par le forfait',
    ]);
  }

  return line('restauration', 'Restauration', 0, 0, 'depends_on_branche', sourceUrl, 'Montant restauration selon accord de branche', [
    `${opco.name} ne publie pas de forfait restauration fixe`,
    'Le montant dépend de votre accord de branche',
  ]);
}

function calcFraisAnnexesPourcentage(opco: OpcoData, pedagogyFunded: number): FundingLine | null {
  const pct = opco.frais_annexes_pourcentage.value;
  if (pct == null || pct <= 0) return null;

  const funded = pedagogyFunded * (pct / 100);
  return line(
    'frais_annexes',
    'Frais annexes (forfait %)',
    funded,
    funded,
    opco.frais_annexes_pourcentage.confidence,
    opco.frais_annexes_pourcentage.source_url,
    `${pct}% des coûts pédagogiques`,
    [
      `${opco.name} utilise un forfait global pour les frais annexes`,
      `Taux : ${pct}% des coûts pédagogiques financés`,
      `Calcul : ${pedagogyFunded.toFixed(2)} € × ${pct}% = ${funded.toFixed(2)} €`,
      'Ce forfait couvre transport, hébergement et restauration',
    ],
  );
}

/** Lignes à 0 € quand le PDC mutualisé n'est pas accessible (50 salariés et plus). */
function lignesPdcFerme(opco: OpcoData, state: WizardState): FundingLine[] {
  const hours = state.durationHours ?? 0;
  const requested = state.pedagogyCostTotal ?? (state.pedagogyCostPerHour ?? 0) * hours;
  const note = 'Fonds mutualisés réservés aux entreprises de moins de 50 salariés';
  const details = [
    `Les fonds mutualisés de ${opco.name} pour le plan de développement des compétences sont réservés aux entreprises de moins de 50 salariés (${REFERENCE_REGLE_50_SALARIES}).`,
    `${opco.name} ne publie pas d'enveloppe conventionnelle ou volontaire pour votre taille d'entreprise : aucun financement n'est estimé sur ce dispositif.`,
  ];
  const lignes = [
    line('pedagogie', 'Coûts pédagogiques', requested, 0, 'exact', opco.url_finance_page, note, details),
    line('salaires', 'Prise en charge salaires', 0, 0, 'exact', opco.url_finance_page, note),
  ];
  if (state.needsAccommodation) {
    lignes.push(
      line('hebergement', 'Hébergement', (state.accommodationCostPerNight ?? 0) * (state.accommodationNights ?? 0), 0, 'exact', opco.url_finance_page, note),
    );
  }
  if (state.needsMeals) {
    lignes.push(
      line('restauration', 'Restauration', (state.mealCostPerDay ?? 0) * (state.trainingDays ?? 0), 0, 'exact', opco.url_finance_page, note),
    );
  }
  return lignes;
}

// ---------------------------------------------------------------------------
// Warnings, conditions, next steps
// ---------------------------------------------------------------------------

function generateWarnings(
  opco: OpcoData,
  state: WizardState,
  lines: FundingLine[],
  budgetCapApplied: boolean,
): string[] {
  const warnings: string[] = [];

  if (opco.quota_horaire_min != null && state.durationHours != null && state.durationHours < opco.quota_horaire_min) {
    warnings.push(
      `La durée de formation (${state.durationHours}h) est inférieure au minimum requis par ${opco.name} (${opco.quota_horaire_min}h). ` +
        'La prise en charge pourrait être refusée.',
    );
  }

  const plafond = resolvePlafondForSize(opco, state.companySize);
  if (plafond?.quota_horaire_max != null && state.durationHours != null && state.durationHours > plafond.quota_horaire_max) {
    warnings.push(
      `La durée de formation (${state.durationHours}h) dépasse le plafond horaire pour votre taille d'entreprise ` +
        `(${plafond.quota_horaire_max}h). Les heures au-delà ne seront pas prises en charge.`,
    );
  }

  if (plafond == null && opco.quota_horaire_max != null && state.durationHours != null && state.durationHours > opco.quota_horaire_max) {
    warnings.push(`La durée de formation (${state.durationHours}h) dépasse le plafond horaire ${opco.name} (${opco.quota_horaire_max}h).`);
  }

  if (opco.priorite_tpe_pme && state.companySize === '300_plus') {
    warnings.push(
      `${opco.name} priorise les TPE/PME. Les entreprises de 300+ salariés peuvent avoir des prises en charge réduites ` +
        'ou des enveloppes limitées.',
    );
  }

  if (lines.some((l) => l.confidence === 'depends_on_branche' && l.fundedAmount > 0)) {
    warnings.push(
      'Certains montants dépendent de votre accord de branche et peuvent varier. ' +
        `Contactez ${opco.name} pour confirmation.`,
    );
  }

  if (budgetCapApplied) {
    warnings.push(`Le plafond budgétaire annuel de ${opco.name} a été appliqué. Le montant total finançable est plafonné.`);
  }

  return warnings;
}

function generateConditions(opco: OpcoData, state: WizardState): string[] {
  const conditions: string[] = [`Être à jour des cotisations auprès de ${opco.name}.`];
  if (opco.processus_approbation) conditions.push(opco.processus_approbation);
  if (state.formationType === 'vae' && opco.vae_possible) {
    conditions.push("VAE : la formation doit être éligible au dispositif VAE de l'OPCO.");
  }
  if (opco.duree_min_formation) conditions.push(`Durée minimale de formation : ${opco.duree_min_formation}.`);
  return conditions;
}

function generateNextSteps(opco: OpcoData): { label: string; url: string }[] {
  const steps = [{ label: `Consulter les critères de financement ${opco.name}`, url: opco.url_finance_page }];
  if (opco.email_contact) steps.push({ label: `Contacter ${opco.name} par email`, url: `mailto:${opco.email_contact}` });
  return steps;
}

// ---------------------------------------------------------------------------
// Dispositifs complémentaires (cumuls d'enveloppes)
// ---------------------------------------------------------------------------

/**
 * Évalue les dispositifs complémentaires de l'OPCO pour la situation donnée.
 * Un dispositif en % est calculé sur le RESTE à financer (sur le coût complet
 * s'il est « alternatif » au PDC). Les forfaits restent théoriques ; l'enveloppe
 * globale est plafonnée au coût par calculateFunding.
 */
function evaluateDispositifs(
  opco: OpcoData,
  state: WizardState,
  pedagogyRequested: number,
  pedagogyFunded: number,
): DispositifEligible[] {
  const results: DispositifEligible[] = [];

  for (const d of opco.dispositifs_complementaires ?? []) {
    if (d.tailles_eligibles != null && state.companySize != null && !d.tailles_eligibles.includes(state.companySize)) {
      continue;
    }

    let montantEstime: number | null = null;
    if (d.pourcentage_couts != null) {
      const base = d.cumul === 'alternatif' ? pedagogyRequested : Math.max(0, pedagogyRequested - pedagogyFunded);
      if (pedagogyRequested > 0) {
        montantEstime = base * (d.pourcentage_couts / 100);
        if (d.montant_max != null) montantEstime = Math.min(montantEstime, d.montant_max);
      }
    } else if (d.montant_max != null) {
      switch (d.unite) {
        case 'par_heure':
          montantEstime = state.durationHours != null ? d.montant_max * state.durationHours : null;
          break;
        case 'par_jour':
          montantEstime = state.trainingDays != null ? d.montant_max * state.trainingDays : null;
          break;
        default:
          montantEstime = d.montant_max;
      }
    }

    results.push({
      id: d.id,
      nom: d.nom,
      cumul: d.cumul,
      montantEstime: montantEstime != null ? arrondi(montantEstime) : null,
      description: d.description,
      conditions: d.conditions,
      demarches: d.demarches,
      publics: d.publics,
      confidence: d.confidence,
      sourceUrl: d.source_url,
    });
  }

  return results;
}

/** Construit la liste ordonnée des démarches concrètes. */
function generateDemarches(opco: OpcoData, dispositifs: DispositifEligible[]): string[] {
  const steps: string[] = [
    `Vérifier que votre entreprise est à jour de ses cotisations auprès de ${opco.name}.`,
    "Demander un devis et le programme détaillé à l'organisme de formation (certifié Qualiopi).",
  ];
  steps.push(
    opco.processus_approbation ||
      `Déposer la demande de prise en charge sur l'espace entreprise ${opco.name}, AVANT le début de la formation.`,
  );
  if (typeof opco.delai_validation === 'string' && opco.delai_validation) {
    steps.push(`Délai : ${opco.delai_validation}`);
  }
  steps.push("Attendre l'accord de prise en charge AVANT de démarrer la formation (sous réserve de fonds disponibles).");
  const cumulables = dispositifs.filter((d) => d.cumul !== 'alternatif');
  if (cumulables.length > 0) {
    steps.push(
      `Demander en parallèle les financements complémentaires éligibles : ${cumulables.map((d) => d.nom).join(', ')} (voir conditions de chaque dispositif).`,
    );
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Main calculation function
// ---------------------------------------------------------------------------

/**
 * Calculate OPCO funding estimate (plan de développement des compétences).
 * Pure function: same OpcoData + WizardState → same FundingResult.
 */
export function calculateFunding(rawOpcoData: OpcoData, state: WizardState): FundingResult {
  const earlyWarnings: string[] = [];

  // ---- 0. Barème de branche (variante) ----
  const variante = resolveVarianteBranche(rawOpcoData, state);
  const opcoData = variante ? applyVarianteBranche(rawOpcoData, variante) : rawOpcoData;
  const brancheAppliquee = variante?.branche_nom ?? null;
  if (!variante && (rawOpcoData.variantes_branche?.length ?? 0) > 0) {
    earlyWarnings.push(
      `Barème général ${rawOpcoData.name} appliqué : votre branche professionnelle peut prévoir des montants différents ` +
        `(souvent supérieurs). Sélectionnez votre branche à l'étape Entreprise ou vérifiez les règles de votre branche sur ${rawOpcoData.url_finance_page}`,
    );
  }

  // ---- 1. Règle des 50 salariés ----
  const grandeEntreprise = estEntreprise50Plus(state.companySize);
  const enveloppeGrande = enveloppe50Plus(opcoData, state.companySize);
  const pdcFerme = grandeEntreprise && enveloppeGrande == null;

  // ---- 2. Plafond annuel restant ----
  const budgetDejaConsomme = Math.max(0, state.budgetDejaConsomme ?? 0);
  const plafond = resolvePlafondForSize(opcoData, state.companySize);
  const annualCap = plafond?.budget_annuel_max ?? (grandeEntreprise ? null : opcoData.budget_annuel_max.value);
  const capRestant = annualCap != null && annualCap > 0 ? Math.max(0, annualCap - budgetDejaConsomme) : null;
  const portee = opcoData.budget_annuel_portee ?? 'global';

  // ---- 3. Lignes ----
  let allLines: FundingLine[];
  let capPedagogieApplique = false;
  if (pdcFerme) {
    allLines = lignesPdcFerme(opcoData, state);
  } else {
    const { ligne: pedagogyLine, capApplique } = calcPedagogy(
      opcoData,
      state,
      earlyWarnings,
      portee === 'pedagogie' ? capRestant : null,
    );
    capPedagogieApplique = capApplique;
    const salaryLine = calcSalary(opcoData, state, pedagogyLine.fundedAmount);

    const usePercentageModel =
      opcoData.frais_annexes_pourcentage.value != null && opcoData.frais_annexes_pourcentage.value > 0;
    const ancillaryLines: FundingLine[] = [];
    if (usePercentageModel) {
      const pctLine = calcFraisAnnexesPourcentage(opcoData, pedagogyLine.fundedAmount);
      if (pctLine) ancillaryLines.push(pctLine);
      const inclus = 'Inclus dans le forfait frais annexes (%)';
      if (state.needsTransport) ancillaryLines.push(line('transport', 'Transport', 0, 0, 'exact', opcoData.url_finance_page, inclus));
      if (state.needsAccommodation) ancillaryLines.push(line('hebergement', 'Hébergement', 0, 0, 'exact', opcoData.url_finance_page, inclus));
      if (state.needsMeals) ancillaryLines.push(line('restauration', 'Restauration', 0, 0, 'exact', opcoData.url_finance_page, inclus));
    } else {
      ancillaryLines.push(calcTransport(opcoData, state));
      ancillaryLines.push(calcAccommodation(opcoData, state));
      ancillaryLines.push(calcMeals(opcoData, state));
    }
    allLines = [pedagogyLine, salaryLine, ...ancillaryLines];
  }

  // ---- 4. Totaux et plafond global ----
  const totalRequested = allLines.reduce((s, l) => s + l.requestedAmount, 0);
  let totalFunded = allLines.reduce((s, l) => s + l.fundedAmount, 0);
  let budgetCapApplied = capPedagogieApplique;
  let budgetCapAmount: number | null = capPedagogieApplique ? capRestant : null;

  if (!pdcFerme && portee === 'global' && capRestant != null && totalFunded > capRestant) {
    const ratio = capRestant > 0 ? capRestant / totalFunded : 0;
    for (const l of allLines) {
      l.fundedAmount = arrondi(l.fundedAmount * ratio);
      l.remainder = arrondi(l.requestedAmount - l.fundedAmount);
    }
    totalFunded = capRestant;
    budgetCapApplied = true;
    budgetCapAmount = capRestant;
  }

  const totalRemainder = arrondi(totalRequested - totalFunded);

  // ---- 5. Dispositifs complémentaires (enveloppe plafonnée au coût) ----
  const pedagogyLine = allLines.find((l) => l.poste === 'pedagogie')!;
  const dispositifsComplementaires = evaluateDispositifs(
    opcoData,
    state,
    pedagogyLine.requestedAmount,
    pedagogyLine.fundedAmount,
  );
  const cumulable = dispositifsComplementaires
    .filter((d) => d.cumul !== 'alternatif')
    .reduce((s, d) => s + (d.montantEstime ?? 0), 0);
  const enveloppeMaxPotentielle = arrondi(Math.min(totalRequested, totalFunded + cumulable));

  // ---- 6. Warnings ----
  const warnings = [...earlyWarnings, ...generateWarnings(opcoData, state, allLines, budgetCapApplied)];
  if (pdcFerme) {
    warnings.unshift(
      `Règle légale : les fonds mutualisés de ${opcoData.name} pour le plan de développement des compétences sont réservés ` +
        `aux entreprises de moins de 50 salariés (${REFERENCE_REGLE_50_SALARIES}). Aucune prise en charge n'est estimée sur ces fonds.`,
      `Pistes pour votre entreprise : contributions conventionnelles ou versements volontaires auprès de ${opcoData.name} ` +
        '(selon votre branche), alternance, période de reconversion, actions collectives, et les autres aides identifiées.',
    );
  }
  if (enveloppeGrande) {
    warnings.push(
      `Entreprise de 50 salariés et plus : ${enveloppeGrande.description} Ces fonds (conventionnels ou volontaires) ` +
        'dépendent de votre branche et restent soumis aux fonds disponibles.',
    );
  }
  if (!pdcFerme && budgetDejaConsomme > 0 && annualCap != null && annualCap > 0) {
    warnings.push(
      `Budget déjà consommé cette année (${budgetDejaConsomme.toFixed(0)} €) déduit du plafond annuel ` +
        `(${annualCap.toFixed(0)} €) : enveloppe restante ${Math.max(0, annualCap - budgetDejaConsomme).toFixed(0)} €.`,
    );
    if (annualCap - budgetDejaConsomme <= 0) {
      warnings.push(
        `Votre enveloppe annuelle ${opcoData.name} est épuisée. Examinez les financements complémentaires ci-dessous ou attendez l'année suivante.`,
      );
    }
  }
  if (dispositifsComplementaires.some((d) => d.cumul !== 'alternatif' && d.montantEstime == null)) {
    warnings.push(
      "Certains financements complémentaires ne sont pas chiffrables à l'avance : l'enveloppe maximale réelle peut être supérieure à l'estimation.",
    );
  }

  // ---- 7. Conditions, démarches & next steps ----
  const dispositifPrincipal = pdcFerme
    ? 'Plan de développement des compétences — fonds mutualisés non accessibles (50 salariés et plus)'
    : enveloppeGrande
      ? 'Plan de développement des compétences (fonds conventionnels ou volontaires, 50 salariés et plus)'
      : 'Plan de développement des compétences (fonds mutualisés OPCO)';

  return {
    opcoName: opcoData.name,
    opcoSlug: opcoData.slug,
    opcoEmail: opcoData.email_contact,
    opcoUrl: opcoData.url_finance_page,
    dispositifPrincipal,
    brancheAppliquee,
    lines: allLines,
    totalRequested: arrondi(totalRequested),
    totalFunded: arrondi(totalFunded),
    totalRemainder,
    budgetCapApplied,
    budgetCapAmount,
    budgetDejaConsomme,
    dispositifsComplementaires,
    enveloppeMaxPotentielle,
    warnings,
    conditions: generateConditions(opcoData, state),
    demarches: generateDemarches(opcoData, dispositifsComplementaires),
    nextSteps: generateNextSteps(opcoData),
    delaiValidation: opcoData.delai_validation,
    modePaiement: opcoData.mode_paiement,
  };
}
```

- [ ] **Step 5 : Vérifier**

Run : `cd packages/core && npx vitest run && npx tsc --noEmit`
Expected : PASS (tous les tests, y compris les 8 nouveaux et le test d'enveloppe mis à jour).
Run : `cd backend && npx vitest run && npx tsc --noEmit` — Expected : PASS (les scénarios du pipeline ne vérifient que des totaux finis et positifs).
Run : `cd apps/mobile && npx tsc --noEmit` — Expected : aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add packages/core/src/types.ts packages/core/src/calculator.ts packages/core/tests/calculator.test.ts
git commit -m "core : regle des 50 salaries, bareme degressif, portee du plafond, enveloppe plafonnee au cout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Types du catalogue d'aides et schémas Zod v4

**Files:**
- Create: `packages/core/src/aides/types.ts`
- Modify: `packages/core/src/schema.ts` (réécriture complète)
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/tests/fixtures-aides.ts`
- Test: `packages/core/tests/schema-aides.test.ts`

**Interfaces:**
- Produces (aides/types.ts) : `Financeur`, `CategorieAide`, `SourceAide`, `CriteresAide`, `MajorationAide`, `MontantAide`, `RegleCumul`, `Aide`, `LienPortail`, `PortailRegional`, `FichierAides`, `FichierPortails`, `StatutEligibilite`, `ProfilAides`, `AideEvaluee`, `ORDRE_EMPILEMENT_DEFAUT`, `FINANCEUR_LABELS`.
- Produces (schema.ts) : `PlafondsParTailleSchema`, `CoutHoraireSeuilSchema`, `CodeRegionSchema`, `CriteresAideSchema`, `MontantAideSchema`, `AideSchema`, `PortailRegionalSchema`, `IdccEntreeSchema`, `IdccTableSchema`, `SuggestionNafSchema`, `sanityCheckAides(aides: Aide[]): string[]` ; `DatasetSchema` avec `aides?`, `idcc?`, `naf?`, `portails?` ; `DatasetManifestSchema` avec `aidesCount?`.

- [ ] **Step 1 : Créer la fabrique de test** `packages/core/tests/fixtures-aides.ts`

```ts
import type { Aide } from '../src/aides/types';

/** Fabrique une aide valide (données fictives), surchargée par `over`. */
export function makeAide(over: Partial<Aide> = {}): Aide {
  return {
    id: 'nat-test',
    nom: 'Aide de test',
    financeur: 'etat',
    financeur_nom: 'État',
    categorie: 'cout_formation',
    projets: ['formation_salarie'],
    beneficiaires: ['salarie'],
    description: 'Aide fictive pour les tests.',
    criteres: {},
    conditions: [],
    montant: {
      mode: 'forfait',
      valeur: 1000,
      pourcentage: null,
      base: null,
      plafond: null,
      duree_max_mois: null,
      libelle: '1 000 € par dossier',
    },
    cumul: { cumulable: true },
    demarches: ['Déposer la demande avant le début de la formation.'],
    url_demarche: 'https://www.example.gouv.fr/demande',
    sources: [
      { url: 'https://www.example.gouv.fr/aide', titre: 'Page officielle', extrait: 'Montant : 1 000 € par dossier.' },
    ],
    derniere_verification: '2026-10-05',
    validite: { debut: null, fin: null },
    statut: 'actif',
    confidence: 'exact',
    ...over,
  };
}
```

- [ ] **Step 2 : Écrire les tests qui échouent** — `packages/core/tests/schema-aides.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  AideSchema,
  DatasetSchema,
  IdccTableSchema,
  PlafondsParTailleSchema,
  PortailRegionalSchema,
  sanityCheckAides,
  validateDataset,
} from '../src/schema';
import type { Aide } from '../src/aides/types';
import { EMBEDDED_OPCOS } from '../src/data';
import { makeAide } from './fixtures-aides';

// Vérification à la compilation : le schéma Zod produit bien des `Aide`.
const versAide = (a: z.infer<typeof AideSchema>): Aide => a;

describe('schéma du catalogue d’aides', () => {
  it('accepte une aide complète', () => {
    expect(versAide(AideSchema.parse(makeAide())).id).toBe('nat-test');
  });

  it('refuse un forfait sans valeur', () => {
    const aide = makeAide({ montant: { ...makeAide().montant, valeur: null } });
    expect(AideSchema.safeParse(aide).success).toBe(false);
  });

  it('refuse un pourcentage sans base', () => {
    const aide = makeAide({ montant: { ...makeAide().montant, mode: 'pourcentage', valeur: null, pourcentage: 50, base: null } });
    expect(AideSchema.safeParse(aide).success).toBe(false);
  });

  it('refuse une source non https', () => {
    const aide = makeAide({ sources: [{ url: 'http://exemple.fr', titre: 't', extrait: 'e' }] });
    expect(AideSchema.safeParse(aide).success).toBe(false);
  });

  it('refuse un identifiant mal formé', () => {
    expect(AideSchema.safeParse(makeAide({ id: 'Nat Test' })).success).toBe(false);
  });

  it('sanityCheckAides détecte doublons et alternatives inconnues', () => {
    const a = makeAide({ id: 'nat-a', cumul: { cumulable: true, alternatives: ['nat-z'] } });
    const issues = sanityCheckAides([a, makeAide({ id: 'nat-a' })]);
    expect(issues.some((i) => i.includes('en double'))).toBe(true);
    expect(issues.some((i) => i.includes('nat-z'))).toBe(true);
  });

  it('sanityCheckAides détecte des bornes incohérentes', () => {
    const a = makeAide({ criteres: { age_min: 30, age_max: 20 } });
    expect(sanityCheckAides([a]).length).toBeGreaterThan(0);
  });

  it('valide un portail régional', () => {
    const portail = {
      region: '11',
      nom_region: 'Île-de-France',
      liens: [{ titre: 'Région', url: 'https://www.iledefrance.fr', type: 'region' }],
      derniere_verification: '2026-10-05',
    };
    expect(PortailRegionalSchema.safeParse(portail).success).toBe(true);
    expect(PortailRegionalSchema.safeParse({ ...portail, region: '99' }).success).toBe(false);
  });

  it('valide une table IDCC', () => {
    const table = {
      '1516': { idcc: '1516', titre: 'Organismes de formation', opco: 'akto', statut: 'actif', source: 'https://x.fr' },
      '9999': { idcc: '9999', titre: 'Absence de convention collective', opco: null, statut: 'echappatoire', source: 'https://x.fr' },
    };
    expect(IdccTableSchema.safeParse(table).success).toBe(true);
  });
});

describe('schéma OPCO v4', () => {
  it('refuse une taille en double dans plafonds_par_taille', () => {
    const p = { taille: 'less_11', cout_horaire_max: null, budget_annuel_max: 1000, quota_horaire_max: null, description: 'x' };
    expect(PlafondsParTailleSchema.safeParse([p, p]).success).toBe(false);
  });
});

describe('dataset v4', () => {
  it('accepte les sections facultatives', () => {
    const ds = {
      version: 4,
      generatedAt: '2026-10-05T00:00:00.000Z',
      opcos: EMBEDDED_OPCOS,
      aides: [makeAide()],
      idcc: {},
      naf: [],
      portails: [],
    };
    expect(() => validateDataset(ds)).not.toThrow();
  });

  it('un ancien dataset sans aides reste valide', () => {
    const ds = { version: 3, generatedAt: '2026-06-11T00:00:00.000Z', opcos: EMBEDDED_OPCOS };
    expect(DatasetSchema.parse(ds).aides).toBeUndefined();
  });

  it('rejette un dataset dont les aides sont incohérentes', () => {
    const ds = {
      version: 4,
      generatedAt: '2026-10-05T00:00:00.000Z',
      opcos: EMBEDDED_OPCOS,
      aides: [makeAide({ id: 'nat-a' }), makeAide({ id: 'nat-a' })],
    };
    expect(() => validateDataset(ds)).toThrow(/en double/);
  });
});
```

- [ ] **Step 3 : Vérifier l'échec**

Run : `cd packages/core && npx vitest run tests/schema-aides.test.ts`
Expected : FAIL — `../src/aides/types` introuvable, exports de schéma absents.

- [ ] **Step 4 : Créer `packages/core/src/aides/types.ts`**

```ts
// ============================================================
// Catalogue d'aides et de financements : types des données
// (snake_case, comme les fichiers JSON) et des résultats (camelCase).
// ============================================================

import type {
  CertificationType,
  CodeRegion,
  Confidence,
  ContractType,
  NiveauCertification,
  NiveauDiplome,
  ProjetType,
  StatutBeneficiaire,
  StatutDirigeant,
  TypeAlternance,
  TypeStructure,
} from '../types';

export type Financeur =
  | 'etat'
  | 'region'
  | 'departement'
  | 'france_travail'
  | 'transitions_pro'
  | 'agefiph'
  | 'europe'
  | 'cpf'
  | 'opco'
  | 'faf'
  | 'fiscal'
  | 'branche'
  | 'autre';

/** Ce que l'aide réduit ou apporte. */
export type CategorieAide =
  | 'cout_formation' // réduit le coût pédagogique et les frais annexes
  | 'aide_employeur' // versée à l'employeur (embauche, salaires…)
  | 'remuneration_beneficiaire' // revenu du bénéficiaire pendant la formation
  | 'avantage_fiscal_social' // crédit d'impôt, exonérations
  | 'service_gratuit'; // conseil ou accompagnement gratuit (sans montant)

export interface SourceAide {
  url: string;
  titre: string;
  /** Extrait mot pour mot de la page officielle justifiant les montants. */
  extrait: string;
}

/** Critères vérifiés automatiquement ; un critère absent n'impose aucune contrainte. */
export interface CriteresAide {
  regions?: CodeRegion[];
  /** Localisation prise en compte : établissement (défaut) ou résidence du bénéficiaire. */
  perimetre_region?: 'entreprise' | 'beneficiaire';
  departements?: string[];
  effectif_min?: number;
  effectif_max?: number;
  age_min?: number;
  age_max?: number;
  /** true : réservé aux personnes reconnues travailleurs handicapés. */
  rqth?: boolean;
  niveaux_diplome?: NiveauDiplome[];
  niveau_certification_max?: NiveauCertification;
  niveau_certification_min?: NiveauCertification;
  contrats?: ContractType[];
  types_alternance?: TypeAlternance[];
  anciennete_min_mois?: number;
  inscrit_france_travail?: boolean;
  statuts_dirigeant?: StatutDirigeant[];
  /** true : réservé aux micro-entrepreneurs ; false : les exclut. */
  micro_entrepreneur?: boolean;
  certifications?: CertificationType[];
  eligible_cpf?: boolean;
  duree_min_heures?: number;
  duree_max_heures?: number;
  opcos?: string[];
  idcc?: string[];
  naf_prefixes?: string[];
  structures?: TypeStructure[];
  qualiopi_requis?: boolean;
}

export interface MajorationAide {
  criteres: CriteresAide;
  valeur?: number | null;
  pourcentage?: number | null;
  plafond?: number | null;
  libelle: string;
}

export interface MontantAide {
  mode: 'forfait' | 'pourcentage' | 'par_heure' | 'par_mois' | 'solde_cpf' | 'non_chiffre';
  valeur: number | null;
  pourcentage: number | null;
  base: 'cout_pedagogique' | 'cout_total' | null;
  plafond: number | null;
  duree_max_mois: number | null;
  /** Règle lisible : « 5 000 € pour la 1re année du contrat ». */
  libelle: string;
  /** La première majoration dont tous les critères sont remplis remplace valeur, pourcentage et plafond. */
  majorations?: MajorationAide[];
}

export interface RegleCumul {
  cumulable: boolean;
  /** Identifiants d'aides « au choix » (jamais additionnées). */
  alternatives?: string[];
  note?: string;
}

export interface Aide {
  id: string;
  nom: string;
  financeur: Financeur;
  financeur_nom: string;
  categorie: CategorieAide;
  projets: ProjetType[];
  beneficiaires: StatutBeneficiaire[];
  description: string;
  criteres: CriteresAide;
  conditions: string[];
  montant: MontantAide;
  cumul: RegleCumul;
  demarches: string[];
  url_demarche: string | null;
  /** Dispositifs nationaux gérés en région (Transitions Pro, Agefiph…). */
  liens_par_region?: Partial<Record<CodeRegion, string>>;
  sources: SourceAide[];
  /** AAAA-MM-JJ */
  derniere_verification: string;
  validite: { debut: string | null; fin: string | null };
  statut: 'actif' | 'a_confirmer' | 'suspendu';
  confidence: Confidence;
  ordre_empilement?: number;
}

export interface LienPortail {
  titre: string;
  url: string;
  type: 'region' | 'carif_oref' | 'transitions_pro' | 'france_travail' | 'agefiph' | 'autre';
}

export interface PortailRegional {
  region: CodeRegion;
  nom_region: string;
  liens: LienPortail[];
  derniere_verification: string;
}

/** Fichiers JSON du catalogue embarqué (data/aides/*.json). */
export interface FichierAides {
  meta: Record<string, unknown>;
  aides: Aide[];
}

export interface FichierPortails {
  meta: Record<string, unknown>;
  portails: PortailRegional[];
}

// --- Évaluation -------------------------------------------------------------

export type StatutEligibilite = 'eligible' | 'a_verifier' | 'non_eligible';

/** Situation évaluée (dérivée du parcours par profilDepuisWizard). null = information inconnue. */
export interface ProfilAides {
  projet: ProjetType;
  statutBeneficiaire: StatutBeneficiaire;
  regionEntreprise: CodeRegion | null;
  departementEntreprise: string | null;
  regionBeneficiaire: CodeRegion | null;
  /** Bornes connues de l'effectif (exact si min = max ; max null = sans borne haute). */
  effectifMin: number | null;
  effectifMax: number | null;
  codeNaf: string | null;
  idccs: string[];
  opco: string | null;
  /** null = statut de la structure inconnu (pas de recherche entreprise). */
  structures: TypeStructure[] | null;
  age: number | null;
  rqth: boolean;
  niveauDiplome: NiveauDiplome | null;
  contrat: ContractType | null;
  typeAlternance: TypeAlternance | null;
  ancienneteMois: number | null;
  inscritFranceTravail: boolean | null;
  statutDirigeant: StatutDirigeant | null;
  microEntrepreneur: boolean | null;
  certification: CertificationType | null;
  niveauFormationVise: NiveauCertification | null;
  eligibleCpf: boolean | null;
  dureeHeures: number | null;
  coutPedagogique: number | null;
  /** Frais annexes saisis (hébergement + restauration), en euros. */
  coutFraisAnnexes: number;
  qualiopi: boolean | null;
  soldeCpf: number | null;
}

export interface AideEvaluee {
  id: string;
  nom: string;
  financeur: Financeur;
  financeurNom: string;
  categorie: CategorieAide;
  description: string;
  statut: StatutEligibilite;
  /** non_eligible : critères non remplis ; a_verifier : informations à confirmer. */
  raisons: string[];
  /** true : aide sans rapport avec la situation (autre projet, autre public, autre région) — masquée à l'écran. */
  horsPerimetre: boolean;
  conditions: string[];
  montantEstime: number | null;
  libelleMontant: string;
  cumulable: boolean;
  alternatives: string[];
  noteCumul: string | null;
  demarches: string[];
  urlDemarche: string | null;
  sources: SourceAide[];
  derniereVerification: string;
  confidence: Confidence;
  ordreEmpilement: number;
}

/** Ordre d'empilement par défaut dans le plan de financement (petit = d'abord). */
export const ORDRE_EMPILEMENT_DEFAUT: Record<Financeur, number> = {
  opco: 10,
  branche: 15,
  region: 20,
  departement: 25,
  agefiph: 30,
  europe: 40,
  etat: 50,
  france_travail: 50,
  transitions_pro: 50,
  faf: 60,
  fiscal: 80,
  autre: 85,
  cpf: 90,
};

export const FINANCEUR_LABELS: Record<Financeur, string> = {
  etat: 'État',
  region: 'Région',
  departement: 'Département',
  france_travail: 'France Travail',
  transitions_pro: 'Transitions Pro',
  agefiph: 'Agefiph',
  europe: 'Union européenne',
  cpf: 'Compte personnel de formation',
  opco: 'OPCO',
  faf: 'Fonds de formation des non-salariés',
  fiscal: 'Fiscalité',
  branche: 'Branche professionnelle',
  autre: 'Autres financeurs',
};
```

- [ ] **Step 5 : Réécrire `packages/core/src/schema.ts`**

```ts
// ============================================================
// Schéma de validation (Zod) — miroir de types.ts et aides/types.ts.
// Source de vérité partagée : utilisé par le BACKEND avant publication
// d'un dataset ET par l'APP après téléchargement, pour ne jamais
// charger de données corrompues.
// ============================================================

import { z } from 'zod';
import type { Aide } from './aides/types';

export const ConfidenceSchema = z.enum(['exact', 'estimated', 'depends_on_branche']);

/** SourcedValue<number | null> — le cas le plus courant. */
export const SourcedNumberSchema = z.object({
  value: z.number().nullable(),
  confidence: ConfidenceSchema,
  source_url: z.string().url().or(z.literal('')),
  note: z.string().optional(),
});

/**
 * Champ descriptif libre. Les données réelles mélangent string, objet sourcé
 * enrichi ou null. Ces champs ne pilotent PAS le calcul.
 */
export const FreeTextSchema = z.union([z.string(), z.record(z.unknown())]).nullable();

export const CompanySizeSchema = z.enum(['less_11', '11_49', '50_299', '300_plus']);

const DateIsoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue au format AAAA-MM-JJ');
const HttpsUrlSchema = z.string().url().startsWith('https://');

export const PlafondTailleSchema = z.object({
  taille: CompanySizeSchema,
  cout_horaire_max: z.number().nullable(),
  budget_annuel_max: z.number().nullable(),
  quota_horaire_max: z.number().nullable(),
  description: z.string(),
});

/** Une seule entrée par taille : le calcul ne retiendrait que la première. */
export const PlafondsParTailleSchema = z.array(PlafondTailleSchema).superRefine((plafonds, ctx) => {
  const vues = new Set<string>();
  for (const p of plafonds) {
    if (vues.has(p.taille)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `plafonds_par_taille : taille en double (${p.taille})` });
    }
    vues.add(p.taille);
  }
});

export const CoutHoraireSeuilSchema = z.object({
  max_heures: z.number().positive().nullable(),
  valeur: z.number().min(0),
});
const ModeSeuilsSchema = z.enum(['par_tranche', 'selon_duree_totale']);
const PorteeBudgetSchema = z.enum(['global', 'pedagogie']);
const ModeSalairesSchema = z.enum(['euro_par_heure', 'pourcentage_pedagogique', 'selon_accord', 'inclus_plafond_horaire']);

export const VarianteBrancheSchema = z.object({
  id: z.string().min(1),
  branche_nom: z.string().min(1),
  idcc: z.array(z.string().regex(/^\d{4}$/)).min(1),
  source_url: z.string().min(1),
  confidence: ConfidenceSchema,
  note: z.string().optional(),

  cout_horaire_inter: SourcedNumberSchema.optional(),
  cout_horaire_metier: SourcedNumberSchema.optional(),
  cout_horaire_seuils: z.array(CoutHoraireSeuilSchema).optional(),
  cout_horaire_seuils_mode: ModeSeuilsSchema.optional(),
  prise_en_charge_salaires: SourcedNumberSchema.optional(),
  prise_en_charge_salaires_mode: ModeSalairesSchema.optional(),
  frais_transport: SourcedNumberSchema.optional(),
  frais_hebergement: SourcedNumberSchema.optional(),
  frais_restauration: SourcedNumberSchema.optional(),
  budget_annuel_max: SourcedNumberSchema.optional(),
  budget_annuel_portee: PorteeBudgetSchema.optional(),
  budget_annuel_description: z.string().optional(),
  plafonds_par_taille: PlafondsParTailleSchema.optional(),
});

export const DispositifComplementaireSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  cumul: z.enum(['hors_budget', 'additif', 'alternatif']),
  montant_max: z.number().nullable(),
  unite: z.enum(['par_stagiaire', 'par_dossier', 'par_an', 'par_jour', 'par_heure']).nullable(),
  pourcentage_couts: z.number().nullable(),
  description: z.string().min(1),
  conditions: z.array(z.string()),
  demarches: z.string().min(1),
  tailles_eligibles: z.array(CompanySizeSchema).nullable(),
  publics: z.string().nullable(),
  confidence: ConfidenceSchema,
  source_url: z.string(),
});

export const OpcoDataSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  secteurs: z.string(),
  secteurs_source: z.string(),
  email_contact: z.string(),
  url_finance_page: z.string(),

  types_formations: z.array(z.string()),
  types_formations_source: z.string(),

  cout_horaire_inter: SourcedNumberSchema,
  cout_horaire_intra: SourcedNumberSchema,
  cout_horaire_metier: SourcedNumberSchema,
  cout_horaire_seuils: z.array(CoutHoraireSeuilSchema).optional(),
  cout_horaire_seuils_mode: ModeSeuilsSchema.optional(),

  prise_en_charge_salaires: SourcedNumberSchema,
  prise_en_charge_salaires_mode: ModeSalairesSchema,

  frais_transport: SourcedNumberSchema,
  frais_hebergement: SourcedNumberSchema,
  frais_restauration: SourcedNumberSchema,
  frais_annexes_pourcentage: SourcedNumberSchema,

  budget_annuel_max: SourcedNumberSchema,
  budget_annuel_portee: PorteeBudgetSchema.optional(),
  budget_annuel_description: z.string(),
  quota_horaire_min: z.number().nullable(),
  quota_horaire_max: z.number().nullable(),

  profils_candidats: z.array(z.string()),
  tailles_cibles: z.string(),
  priorite_tpe_pme: z.boolean(),
  duree_min_formation: z.string().nullable(),

  processus_approbation: z.string(),
  delai_validation: FreeTextSchema,
  mode_paiement: z.string(),

  alternance_apprentissage: FreeTextSchema,
  alternance_professionnalisation: FreeTextSchema,

  cpf_abondement: z.boolean(),
  cpf_details: FreeTextSchema,

  vae_possible: z.boolean(),
  vae_details: FreeTextSchema,

  limite_dossiers_an: FreeTextSchema,

  specificites: z.string(),
  points_cles_maximisation: z.string(),

  plafonds_par_taille: PlafondsParTailleSchema.optional(),
  dispositifs_complementaires: z.array(DispositifComplementaireSchema).optional(),
  variantes_branche: z.array(VarianteBrancheSchema).optional(),
  derniere_verification: DateIsoSchema.optional(),
});

/**
 * Bornes de cohérence (sanity checks) appliquées en plus du schéma de forme.
 * Renvoie la liste des problèmes détectés (vide = OK).
 */
export function sanityCheckOpco(o: z.infer<typeof OpcoDataSchema>): string[] {
  const issues: string[] = [];
  const inRange = (v: number | null, lo: number, hi: number, label: string) => {
    if (v != null && (v < lo || v > hi)) issues.push(`${o.slug}: ${label}=${v} hors bornes [${lo}, ${hi}]`);
  };

  inRange(o.cout_horaire_inter.value, 0, 200, 'cout_horaire_inter');
  inRange(o.cout_horaire_intra.value, 0, 200, 'cout_horaire_intra');
  inRange(o.cout_horaire_metier.value, 0, 200, 'cout_horaire_metier');
  inRange(o.frais_annexes_pourcentage.value, 0, 100, 'frais_annexes_pourcentage');
  inRange(o.budget_annuel_max.value, 0, 1_000_000, 'budget_annuel_max');
  for (const s of o.cout_horaire_seuils ?? []) inRange(s.valeur, 0, 200, 'cout_horaire_seuils.valeur');

  for (const p of o.plafonds_par_taille ?? []) {
    inRange(p.cout_horaire_max, 0, 200, `plafond[${p.taille}].cout_horaire_max`);
    inRange(p.budget_annuel_max, 0, 1_000_000, `plafond[${p.taille}].budget_annuel_max`);
  }
  for (const d of o.dispositifs_complementaires ?? []) {
    inRange(d.montant_max, 0, 100_000, `dispositif[${d.id}].montant_max`);
    inRange(d.pourcentage_couts, 0, 100, `dispositif[${d.id}].pourcentage_couts`);
  }
  for (const v of o.variantes_branche ?? []) {
    inRange(v.cout_horaire_inter?.value ?? null, 0, 200, `variante[${v.id}].cout_horaire_inter`);
    inRange(v.cout_horaire_metier?.value ?? null, 0, 200, `variante[${v.id}].cout_horaire_metier`);
    inRange(v.budget_annuel_max?.value ?? null, 0, 1_000_000, `variante[${v.id}].budget_annuel_max`);
    for (const p of v.plafonds_par_taille ?? []) {
      inRange(p.cout_horaire_max, 0, 200, `variante[${v.id}].plafond[${p.taille}].cout_horaire_max`);
      inRange(p.budget_annuel_max, 0, 1_000_000, `variante[${v.id}].plafond[${p.taille}].budget_annuel_max`);
    }
  }
  return issues;
}

// --- Catalogue d'aides --------------------------------------------------------

export const CodeRegionSchema = z.enum([
  '84', '27', '53', '24', '94', '44', '32', '11', '28', '75', '76', '52', '93', '01', '02', '03', '04', '06',
]);
const ProjetTypeSchema = z.enum([
  'formation_salarie',
  'reconversion_salarie',
  'recrutement_demandeur_emploi',
  'alternance',
  'formation_dirigeant',
]);
const StatutBeneficiaireSchema = z.enum(['salarie', 'demandeur_emploi', 'alternant', 'dirigeant']);
const NiveauDiplomeSchema = z.enum(['sans_diplome', 'cap_bep', 'bac', 'bac_plus_2', 'bac_plus_3_et_plus']);
const NiveauCertificationSchema = z.union([
  z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8),
]);
const StatutDirigeantSchema = z.enum(['commercant', 'artisan', 'profession_liberale', 'exploitant_agricole', 'assimile_salarie']);
const ContractTypeSchema = z.enum(['cdi', 'cdd', 'interim', 'alternance']);
const CertificationTypeSchema = z.enum(['rncp', 'rs', 'cqp', 'diplome', 'habilitation', 'aucune', 'autre']);
const FinanceurSchema = z.enum([
  'etat', 'region', 'departement', 'france_travail', 'transitions_pro', 'agefiph',
  'europe', 'cpf', 'opco', 'faf', 'fiscal', 'branche', 'autre',
]);

export const CriteresAideSchema = z.object({
  regions: z.array(CodeRegionSchema).optional(),
  perimetre_region: z.enum(['entreprise', 'beneficiaire']).optional(),
  departements: z.array(z.string().regex(/^(\d{2}|2A|2B|97[1-6])$/)).optional(),
  effectif_min: z.number().int().min(0).optional(),
  effectif_max: z.number().int().min(0).optional(),
  age_min: z.number().int().min(0).max(100).optional(),
  age_max: z.number().int().min(0).max(100).optional(),
  rqth: z.boolean().optional(),
  niveaux_diplome: z.array(NiveauDiplomeSchema).optional(),
  niveau_certification_max: NiveauCertificationSchema.optional(),
  niveau_certification_min: NiveauCertificationSchema.optional(),
  contrats: z.array(ContractTypeSchema).optional(),
  types_alternance: z.array(z.enum(['apprentissage', 'professionnalisation'])).optional(),
  anciennete_min_mois: z.number().int().min(0).optional(),
  inscrit_france_travail: z.boolean().optional(),
  statuts_dirigeant: z.array(StatutDirigeantSchema).optional(),
  micro_entrepreneur: z.boolean().optional(),
  certifications: z.array(CertificationTypeSchema).optional(),
  eligible_cpf: z.boolean().optional(),
  duree_min_heures: z.number().min(0).optional(),
  duree_max_heures: z.number().min(0).optional(),
  opcos: z.array(z.string().min(1)).optional(),
  idcc: z.array(z.string().regex(/^\d{4}$/)).optional(),
  naf_prefixes: z.array(z.string().min(2)).optional(),
  structures: z.array(z.enum(['ess', 'siae', 'association'])).optional(),
  qualiopi_requis: z.boolean().optional(),
});

const MajorationAideSchema = z.object({
  criteres: CriteresAideSchema,
  valeur: z.number().min(0).nullable().optional(),
  pourcentage: z.number().min(0).max(100).nullable().optional(),
  plafond: z.number().min(0).nullable().optional(),
  libelle: z.string().min(1),
});

export const MontantAideSchema = z
  .object({
    mode: z.enum(['forfait', 'pourcentage', 'par_heure', 'par_mois', 'solde_cpf', 'non_chiffre']),
    valeur: z.number().min(0).nullable(),
    pourcentage: z.number().min(0).max(100).nullable(),
    base: z.enum(['cout_pedagogique', 'cout_total']).nullable(),
    plafond: z.number().min(0).nullable(),
    duree_max_mois: z.number().int().positive().nullable(),
    libelle: z.string().min(1),
    majorations: z.array(MajorationAideSchema).optional(),
  })
  .superRefine((m, ctx) => {
    if ((m.mode === 'forfait' || m.mode === 'par_heure' || m.mode === 'par_mois') && m.valeur == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `montant.valeur requis pour le mode ${m.mode}` });
    }
    if (m.mode === 'pourcentage' && (m.pourcentage == null || m.base == null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'montant.pourcentage et montant.base requis pour le mode pourcentage' });
    }
    if (m.mode === 'par_mois' && m.duree_max_mois == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'montant.duree_max_mois requis pour le mode par_mois' });
    }
  });

export const SourceAideSchema = z.object({
  url: HttpsUrlSchema,
  titre: z.string().min(1),
  extrait: z.string().min(1).max(600),
});

export const AideSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'identifiant kebab-case attendu'),
  nom: z.string().min(1),
  financeur: FinanceurSchema,
  financeur_nom: z.string().min(1),
  categorie: z.enum(['cout_formation', 'aide_employeur', 'remuneration_beneficiaire', 'avantage_fiscal_social', 'service_gratuit']),
  projets: z.array(ProjetTypeSchema).min(1),
  beneficiaires: z.array(StatutBeneficiaireSchema).min(1),
  description: z.string().min(1),
  criteres: CriteresAideSchema,
  conditions: z.array(z.string().min(1)),
  montant: MontantAideSchema,
  cumul: z.object({
    cumulable: z.boolean(),
    alternatives: z.array(z.string()).optional(),
    note: z.string().optional(),
  }),
  demarches: z.array(z.string().min(1)).min(1),
  url_demarche: HttpsUrlSchema.nullable(),
  liens_par_region: z.record(CodeRegionSchema, HttpsUrlSchema).optional(),
  sources: z.array(SourceAideSchema).min(1),
  derniere_verification: DateIsoSchema,
  validite: z.object({ debut: DateIsoSchema.nullable(), fin: DateIsoSchema.nullable() }),
  statut: z.enum(['actif', 'a_confirmer', 'suspendu']),
  confidence: ConfidenceSchema,
  ordre_empilement: z.number().optional(),
});

export const PortailRegionalSchema = z.object({
  region: CodeRegionSchema,
  nom_region: z.string().min(1),
  liens: z
    .array(
      z.object({
        titre: z.string().min(1),
        url: HttpsUrlSchema,
        type: z.enum(['region', 'carif_oref', 'transitions_pro', 'france_travail', 'agefiph', 'autre']),
      }),
    )
    .min(1),
  derniere_verification: DateIsoSchema,
});

export const IdccEntreeSchema = z.object({
  idcc: z.string().regex(/^\d{4}$/),
  titre: z.string().min(1),
  opco: z.string().min(1).nullable(),
  statut: z.enum(['actif', 'fusionne', 'echappatoire', 'partage']),
  idcc_cible: z.string().regex(/^\d{4}$/).optional(),
  opcos_possibles: z.array(z.string().min(1)).optional(),
  note: z.string().optional(),
  source: z.string().min(1),
});

export const IdccTableSchema = z.record(z.string().regex(/^\d{4}$/), IdccEntreeSchema);

export const SuggestionNafSchema = z.object({
  prefixe: z.string().min(2),
  opco: z.string().min(1),
  part: z.number().min(0).max(1).nullable(),
  effectif_etablissements: z.number().int().min(0).nullable().optional(),
  libelle: z.string(),
  source: z.string().min(1),
});

/** Cohérence globale du catalogue (en plus du schéma). Renvoie la liste des problèmes. */
export function sanityCheckAides(aides: Aide[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const a of aides) {
    if (ids.has(a.id)) issues.push(`aide ${a.id} : identifiant en double`);
    ids.add(a.id);
  }
  for (const a of aides) {
    for (const alt of a.cumul.alternatives ?? []) {
      if (!ids.has(alt)) issues.push(`aide ${a.id} : alternative inconnue ${alt}`);
    }
    const { valeur, plafond } = a.montant;
    if (valeur != null && valeur > 100_000) issues.push(`aide ${a.id} : montant.valeur=${valeur} hors bornes`);
    if (plafond != null && plafond > 100_000) issues.push(`aide ${a.id} : montant.plafond=${plafond} hors bornes`);
    const c = a.criteres;
    if (c.age_min != null && c.age_max != null && c.age_min > c.age_max) issues.push(`aide ${a.id} : age_min > age_max`);
    if (c.effectif_min != null && c.effectif_max != null && c.effectif_min > c.effectif_max) {
      issues.push(`aide ${a.id} : effectif_min > effectif_max`);
    }
    if (a.validite.debut && a.validite.fin && a.validite.debut > a.validite.fin) {
      issues.push(`aide ${a.id} : validité incohérente`);
    }
  }
  return issues;
}

// --- Dataset et manifest --------------------------------------------------------

/** Manifest publié à côté du dataset, lu par l'app pour décider de la sync. */
export const DatasetManifestSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  sha256: z.string(),
  opcoCount: z.number().int(),
  aidesCount: z.number().int().optional(),
  changelog: z.array(z.string()),
});

/** Dataset complet téléchargé par l'app. Les sections v4 sont facultatives (compatibilité). */
export const DatasetSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  opcos: z.array(OpcoDataSchema),
  aides: z.array(AideSchema).optional(),
  idcc: IdccTableSchema.optional(),
  naf: z.array(SuggestionNafSchema).optional(),
  portails: z.array(PortailRegionalSchema).optional(),
});

export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;
export type Dataset = z.infer<typeof DatasetSchema>;

/**
 * Valide un dataset complet (forme + bornes + présence des 11 OPCO + cohérence des aides).
 * Lève une erreur agrégée si invalide. Utilisé backend ET app.
 */
export function validateDataset(raw: unknown, opts: { minOpcoCount?: number } = {}): Dataset {
  const parsed = DatasetSchema.parse(raw);
  const minCount = opts.minOpcoCount ?? 11;
  if (parsed.opcos.length < minCount) {
    throw new Error(`Dataset incomplet : ${parsed.opcos.length} OPCO, minimum attendu ${minCount}`);
  }
  const issues = [
    ...parsed.opcos.flatMap((o) => sanityCheckOpco(o)),
    ...(parsed.aides ? sanityCheckAides(parsed.aides as unknown as Aide[]) : []),
  ];
  if (issues.length > 0) {
    throw new Error(`Dataset rejeté :\n- ${issues.join('\n- ')}`);
  }
  return parsed;
}
```

- [ ] **Step 6 : Exporter** — dans `packages/core/src/index.ts`, ajouter :

```ts
export * from './aides/types';
```

- [ ] **Step 7 : Vérifier**

Run : `cd packages/core && npx vitest run && npx tsc --noEmit`
Expected : PASS. **Si** `chaque OPCO embarqué respecte le schéma Zod` échoue sur `constructys` (tailles en double, données de juin), c'est attendu : corriger les données en tâche 8 n'est pas encore possible, donc déplacer dès maintenant les entrées en double de `packages/core/data/opcos/constructys.json` : conserver dans `plafonds_par_taille` les entrées `branche: "batiment"` (bâtiment) et `50_299`/`300_plus`, supprimer les deux entrées `branche: "travaux_publics"` (elles seront reprises en variante de branche par les données vérifiées de la tâche 8). Relancer les tests : PASS.
Run : `cd backend && npx vitest run && npx tsc --noEmit` et `cd apps/mobile && npx tsc --noEmit` — Expected : aucune erreur.

- [ ] **Step 8 : Commit**

```bash
git add packages/core/src/aides/types.ts packages/core/src/schema.ts packages/core/src/index.ts packages/core/tests/fixtures-aides.ts packages/core/tests/schema-aides.test.ts packages/core/data/opcos/constructys.json
git commit -m "core : types du catalogue d'aides et schemas Zod v4 (aides, IDCC, NAF, portails, dataset)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Résolveur OPCO v2 et socle des données embarquées

**Files:**
- Modify: `packages/core/src/opco-resolver.ts` (réécriture complète)
- Create: `scripts/convertir-table-idcc.mjs`
- Create: `packages/core/data/idcc/idcc-opco.json` (généré), `packages/core/data/idcc/naf-suggestions.json`, `packages/core/data/aides/nationales.json`, `packages/core/data/aides/regions.json`, `packages/core/data/aides/portails.json`
- Modify: `packages/core/src/data.ts`
- Test: `packages/core/tests/opco-resolver.test.ts` ; Modify: `packages/core/tests/schema.test.ts`

**Interfaces:**
- Produces : `IdccEntree`, `IdccTable`, `SuggestionNaf`, `CandidatOpco`, `ResolutionOpco`, `EntreeResolution`, `CODES_ECHAPPATOIRES`, `URL_VERIFICATION_OPCO`, `normaliserIdcc(raw: string): string | null`, `suggestionParNaf(codeNaf: string | null, suggestions: SuggestionNaf[]): SuggestionNaf | null`, `resoudreOpco(entree: EntreeResolution, table: IdccTable, suggestionsNaf?: SuggestionNaf[]): ResolutionOpco`, `titreConvention(idcc: string, table: IdccTable): string` ; `EMBEDDED_IDCC: IdccTable`, `EMBEDDED_NAF: SuggestionNaf[]`, `EMBEDDED_AIDES: Aide[]`, `EMBEDDED_PORTAILS: PortailRegional[]`.
- Conserve temporairement `resolveIdccToOpco(idccCodes: string[])` (marqué déprécié, supprimé en tâche 7).

- [ ] **Step 1 : Écrire les tests qui échouent** — `packages/core/tests/opco-resolver.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  normaliserIdcc,
  resoudreOpco,
  suggestionParNaf,
  titreConvention,
  type IdccTable,
  type SuggestionNaf,
} from '../src/opco-resolver';
import { IdccTableSchema, SuggestionNafSchema } from '../src/schema';
import { EMBEDDED_IDCC, EMBEDDED_NAF } from '../src/data';

// Table fictive (codes inventés sauf 1516/1486/3248) : seule la logique est testée ici.
const TABLE: IdccTable = {
  '1516': { idcc: '1516', titre: 'Organismes de formation', opco: 'akto', statut: 'actif', source: 'https://x.fr' },
  '1486': { idcc: '1486', titre: 'Bureaux d’études techniques', opco: 'atlas', statut: 'actif', source: 'https://x.fr' },
  '3248': { idcc: '3248', titre: 'Métallurgie', opco: 'opco2i', statut: 'actif', source: 'https://x.fr' },
  '8001': { idcc: '8001', titre: 'Ancienne convention fusionnée', opco: 'opco2i', statut: 'fusionne', idcc_cible: '3248', source: 'https://x.fr' },
  '7777': {
    idcc: '7777', titre: 'Convention partagée', opco: null, statut: 'partage',
    opcos_possibles: ['ocapiat', 'akto'], note: 'Selon le secteur d’activité', source: 'https://x.fr',
  },
  '9999': { idcc: '9999', titre: 'Absence de convention collective', opco: null, statut: 'echappatoire', source: 'https://x.fr' },
};
const NAF: SuggestionNaf[] = [
  { prefixe: '85.59', opco: 'akto', part: 0.8, libelle: 'Autres enseignements', source: 'test' },
  { prefixe: '47', opco: 'opcommerce', part: null, libelle: 'Commerce de détail', source: 'test' },
  { prefixe: '47.11F', opco: 'opcommerce', part: 0.9, libelle: 'Hypermarchés', source: 'test' },
];

describe('normaliserIdcc', () => {
  it('complète à 4 chiffres et ignore les valeurs invalides', () => {
    expect(normaliserIdcc('2')).toBe('0002');
    expect(normaliserIdcc(' 1516 ')).toBe('1516');
    expect(normaliserIdcc('0000')).toBeNull();
    expect(normaliserIdcc('abc')).toBeNull();
  });
});

describe('resoudreOpco', () => {
  it('un IDCC connu → OPCO fiable', () => {
    const r = resoudreOpco({ idccs: ['1516'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'fiable', idccRetenu: '1516' });
    expect(r.motif).toContain('IDCC 1516');
    expect(r.urlVerificationOfficielle).toContain('francecompetences');
  });

  it('plusieurs IDCC du même OPCO → fiable', () => {
    const r = resoudreOpco({ idccs: ['3248', '8001'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'opco2i', certitude: 'fiable' });
  });

  it('IDCC d’OPCO différents → à confirmer, présélection du siège', () => {
    const r = resoudreOpco({ idccs: ['1516', '1486'], idccSiege: ['1486'] }, TABLE);
    expect(r.certitude).toBe('a_confirmer');
    expect(r.opcoSlug).toBe('atlas');
    expect(r.idccRetenu).toBe('1486');
    expect(r.candidats.map((c) => c.opcoSlug).sort()).toEqual(['akto', 'atlas']);
  });

  it('IDCC fusionné → redirigé avec avertissement', () => {
    const r = resoudreOpco({ idccs: ['8001'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'opco2i', certitude: 'fiable', idccRetenu: '3248' });
    expect(r.avertissements.some((a) => a.includes('fusionnée'))).toBe(true);
  });

  it('IDCC partagé → plusieurs candidats à confirmer', () => {
    const r = resoudreOpco({ idccs: ['7777'] }, TABLE);
    expect(r.certitude).toBe('a_confirmer');
    expect(r.candidats).toHaveLength(2);
  });

  it('code échappatoire + NAF → suggestion à confirmer', () => {
    const r = resoudreOpco({ idccs: ['9999'], codeNaf: '85.59A' }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: null });
    expect(r.motif).toContain('80 %');
    expect(r.avertissements.some((a) => a.includes('9999'))).toBe(true);
  });

  it('rien d’exploitable → inconnu', () => {
    const r = resoudreOpco({ idccs: ['4242'] }, TABLE);
    expect(r.certitude).toBe('inconnu');
    expect(r.opcoSlug).toBeNull();
    expect(r.avertissements.some((a) => a.includes('4242'))).toBe(true);
  });
});

describe('suggestionParNaf', () => {
  it('retient la suggestion la plus précise', () => {
    expect(suggestionParNaf('47.11F', NAF)?.prefixe).toBe('47.11F');
    expect(suggestionParNaf('47.19B', NAF)?.prefixe).toBe('47');
    expect(suggestionParNaf('01.11Z', NAF)).toBeNull();
    expect(suggestionParNaf(null, NAF)).toBeNull();
  });
});

describe('titreConvention', () => {
  it('renvoie le titre officiel ou un libellé générique', () => {
    expect(titreConvention('1516', TABLE)).toBe('Organismes de formation');
    expect(titreConvention('4242', TABLE)).toBe('Convention IDCC 4242');
  });
});

describe('données IDCC embarquées', () => {
  it('respectent le schéma et contiennent les codes échappatoires', () => {
    expect(IdccTableSchema.safeParse(EMBEDDED_IDCC).success).toBe(true);
    for (const code of ['5501', '5100', '9998', '9999']) {
      expect(EMBEDDED_IDCC[code]?.statut).toBe('echappatoire');
    }
    for (const s of EMBEDDED_NAF) expect(SuggestionNafSchema.safeParse(s).success).toBe(true);
  });
});
```

Dans `packages/core/tests/schema.test.ts`, supprimer l'import `resolveIdccToOpco` et tout le bloc `describe('résolution IDCC → OPCO', …)` (remplacé par le fichier ci-dessus).

- [ ] **Step 2 : Vérifier l'échec**

Run : `cd packages/core && npx vitest run tests/opco-resolver.test.ts`
Expected : FAIL — `resoudreOpco` non exporté, `EMBEDDED_IDCC` absent.

- [ ] **Step 3 : Réécrire `packages/core/src/opco-resolver.ts`**

```ts
// ============================================================
// Identification de l'OPCO (v2) : IDCC → OPCO avec niveau de certitude.
//
// Table construite à partir de sources réutilisables : arrêtés d'agrément
// des OPCO (Légifrance), listes de branches publiées par les OPCO, liste
// des IDCC du ministère du Travail. Les tables de France Compétences
// (art. R. 6123-34 du code du travail) ne sont PAS utilisées : leur
// réutilisation exige une licence. Le niveau 'confirme' leur est réservé.
// ============================================================

import type { CertitudeOpco } from './types';
import { EMBEDDED_IDCC } from './data';

export interface IdccEntree {
  idcc: string;
  titre: string;
  opco: string | null;
  statut: 'actif' | 'fusionne' | 'echappatoire' | 'partage';
  /** Statut 'fusionne' : IDCC de rattachement. */
  idcc_cible?: string;
  /** Statut 'partage' : OPCO possibles selon l'activité. */
  opcos_possibles?: string[];
  note?: string;
  source: string;
}

export type IdccTable = Record<string, IdccEntree>;

export interface SuggestionNaf {
  /** Code NAF ou préfixe : '47.11F', '47.11', '47.1' ou '47'. */
  prefixe: string;
  opco: string;
  /** Part des établissements du secteur relevant de cet OPCO (0-1), si connue. */
  part: number | null;
  effectif_etablissements?: number | null;
  libelle: string;
  source: string;
}

export interface CandidatOpco {
  opcoSlug: string;
  idccs: { idcc: string; titre: string }[];
}

export interface ResolutionOpco {
  opcoSlug: string | null;
  certitude: CertitudeOpco;
  motif: string;
  candidats: CandidatOpco[];
  idccRetenu: string | null;
  avertissements: string[];
  urlVerificationOfficielle: string;
}

export interface EntreeResolution {
  /** Tous les IDCC trouvés (entreprise et établissements). */
  idccs: string[];
  /** IDCC du siège : présélection en cas de pluralité. */
  idccSiege?: string[];
  codeNaf?: string | null;
}

/** Codes « échappatoires » de la DSN : ils ne désignent aucun OPCO. */
export const CODES_ECHAPPATOIRES: Record<string, string> = {
  '5501': "Convention d'entreprise indépendante ou texte assimilé non précisé",
  '5100': 'Statuts divers ou inconnus',
  '9998': 'Convention non encore en vigueur',
  '9999': 'Absence de convention collective',
};

/** Outil officiel de France Compétences (lien de vérification pour l'utilisateur). */
export const URL_VERIFICATION_OPCO = 'https://quel-est-mon-opco.francecompetences.fr/';

export function normaliserIdcc(raw: string): string | null {
  const s = String(raw).trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const code = s.padStart(4, '0');
  return code === '0000' ? null : code;
}

function redirigerFusion(code: string, table: IdccTable, avertissements: string[]): string {
  const entree = table[code];
  if (entree?.statut === 'fusionne' && entree.idcc_cible) {
    avertissements.push(
      `IDCC ${code} (${entree.titre}) : convention fusionnée, rattachement à l'IDCC ${entree.idcc_cible}.`,
    );
    return entree.idcc_cible;
  }
  return code;
}

/** Suggestion la plus précise : sous-classe (47.11F) > classe (47.11) > groupe (47.1) > division (47). */
export function suggestionParNaf(codeNaf: string | null, suggestions: SuggestionNaf[]): SuggestionNaf | null {
  if (!codeNaf) return null;
  const naf = codeNaf.trim().toUpperCase();
  for (const prefixe of [naf, naf.slice(0, 5), naf.slice(0, 4), naf.slice(0, 2)]) {
    const trouvee = suggestions.find((s) => s.prefixe.toUpperCase() === prefixe);
    if (trouvee) return trouvee;
  }
  return null;
}

export function resoudreOpco(
  entree: EntreeResolution,
  table: IdccTable,
  suggestionsNaf: SuggestionNaf[] = [],
): ResolutionOpco {
  const avertissements: string[] = [];
  const urlVerificationOfficielle = URL_VERIFICATION_OPCO;

  // 1. Normalisation + redirection des conventions fusionnées
  const codes: string[] = [];
  for (const brut of entree.idccs) {
    const code = normaliserIdcc(brut);
    if (!code) continue;
    const effectif = redirigerFusion(code, table, avertissements);
    if (!codes.includes(effectif)) codes.push(effectif);
  }
  const siege = new Set<string>();
  for (const brut of entree.idccSiege ?? []) {
    const code = normaliserIdcc(brut);
    if (code) siege.add(redirigerFusion(code, table, []));
  }

  // 2. Codes échappatoires
  const exploitables: string[] = [];
  for (const code of codes) {
    const libelle =
      CODES_ECHAPPATOIRES[code] ?? (table[code]?.statut === 'echappatoire' ? table[code].titre : null);
    if (libelle) avertissements.push(`Code ${code} (${libelle}) : ce code ne permet pas de déterminer l'OPCO.`);
    else exploitables.push(code);
  }

  // 3. Regroupement par OPCO
  const parOpco = new Map<string, { idcc: string; titre: string }[]>();
  const nonReferences: string[] = [];
  for (const code of exploitables) {
    const e = table[code];
    const opcos = e ? (e.statut === 'partage' ? e.opcos_possibles ?? [] : e.opco ? [e.opco] : []) : [];
    if (!e || opcos.length === 0) {
      nonReferences.push(code);
      continue;
    }
    if (e.statut === 'partage') {
      avertissements.push(`IDCC ${code} (${e.titre}) : ${e.note ?? "convention répartie entre plusieurs OPCO selon l'activité"}.`);
    }
    for (const opco of opcos) {
      const liste = parOpco.get(opco) ?? [];
      liste.push({ idcc: code, titre: e.titre });
      parOpco.set(opco, liste);
    }
  }
  if (nonReferences.length > 0) {
    avertissements.push(`IDCC non référencé(s) dans notre table : ${nonReferences.join(', ')}.`);
  }

  const candidats: CandidatOpco[] = [...parOpco.entries()].map(([opcoSlug, idccs]) => ({ opcoSlug, idccs }));

  if (candidats.length === 1) {
    const c = candidats[0];
    return {
      opcoSlug: c.opcoSlug,
      certitude: 'fiable',
      motif: `Identifié via la convention collective ${c.idccs.map((i) => `IDCC ${i.idcc} (${i.titre})`).join(', ')}.`,
      candidats,
      idccRetenu: c.idccs[0].idcc,
      avertissements,
      urlVerificationOfficielle,
    };
  }

  if (candidats.length > 1) {
    const preselection = candidats.find((c) => c.idccs.some((i) => siege.has(i.idcc))) ?? candidats[0];
    return {
      opcoSlug: preselection.opcoSlug,
      certitude: 'a_confirmer',
      motif:
        'Plusieurs OPCO possibles selon les conventions collectives déclarées. Une entreprise relève en principe ' +
        "d'une seule convention, déterminée par son activité principale (sauf établissement autonome) : choisissez " +
        "celle de l'établissement du salarié concerné. Présélection : convention du siège.",
      candidats,
      idccRetenu: preselection.idccs.find((i) => siege.has(i.idcc))?.idcc ?? preselection.idccs[0].idcc,
      avertissements,
      urlVerificationOfficielle,
    };
  }

  // 4. Aucun IDCC exploitable : suggestion par code NAF
  const suggestion = suggestionParNaf(entree.codeNaf ?? null, suggestionsNaf);
  if (suggestion) {
    const part =
      suggestion.part != null
        ? ` : ${Math.round(suggestion.part * 100)} % des établissements de ce secteur relèvent de cet OPCO`
        : '';
    return {
      opcoSlug: suggestion.opco,
      certitude: 'a_confirmer',
      motif: `Aucune convention collective exploitable. Suggestion d'après le code NAF ${suggestion.prefixe} (${suggestion.libelle})${part}. À confirmer.`,
      candidats: [{ opcoSlug: suggestion.opco, idccs: [] }],
      idccRetenu: null,
      avertissements,
      urlVerificationOfficielle,
    };
  }

  return {
    opcoSlug: null,
    certitude: 'inconnu',
    motif:
      "OPCO non identifié automatiquement : sélectionnez-le dans la liste ou vérifiez-le sur l'outil officiel de France Compétences.",
    candidats: [],
    idccRetenu: null,
    avertissements,
    urlVerificationOfficielle,
  };
}

/** Titre officiel d'une convention, ou libellé générique. */
export function titreConvention(idcc: string, table: IdccTable): string {
  const code = normaliserIdcc(idcc);
  return (code && table[code]?.titre) || `Convention IDCC ${idcc}`;
}

/**
 * @deprecated Utiliser resoudreOpco. Conservé pour l'étape Entreprise actuelle ; supprimé en tâche 7.
 */
export function resolveIdccToOpco(idccCodes: string[]): { opcoSlug: string; brancheName: string; idcc: string }[] {
  const resultats: { opcoSlug: string; brancheName: string; idcc: string }[] = [];
  for (const brut of idccCodes) {
    const idcc = normaliserIdcc(brut);
    const e = idcc ? EMBEDDED_IDCC[idcc] : undefined;
    if (idcc && e?.opco && !resultats.some((r) => r.opcoSlug === e.opco)) {
      resultats.push({ opcoSlug: e.opco, brancheName: e.titre, idcc });
    }
  }
  return resultats;
}
```

- [ ] **Step 4 : Créer le script de conversion** `scripts/convertir-table-idcc.mjs`

```js
// Conversion ponctuelle de l'ancienne table IDCC → OPCO (packages/core/data/idcc-opco-map.json)
// vers le format v2 (packages/core/data/idcc/idcc-opco.json).
// Les entrées converties sont marquées « non vérifiées » : la table vérifiée (tâche 9) les remplace.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ancienne = JSON.parse(
  fs.readFileSync(path.join(racine, 'packages/core/data/idcc-opco-map.json'), 'utf-8'),
);

const ECHAPPATOIRES = {
  '5501': "Convention d'entreprise indépendante ou texte assimilé non précisé",
  '5100': 'Statuts divers ou inconnus',
  '9998': 'Convention non encore en vigueur',
  '9999': 'Absence de convention collective',
};

const table = {};
for (const [idcc, e] of Object.entries(ancienne)) {
  table[idcc] = {
    idcc,
    titre: e.branche_name,
    opco: e.opco_slug,
    statut: 'actif',
    note: 'Entrée historique non vérifiée',
    source: 'historique',
  };
}
for (const [idcc, titre] of Object.entries(ECHAPPATOIRES)) {
  table[idcc] = { idcc, titre, opco: null, statut: 'echappatoire', source: 'https://quel-est-mon-opco.francecompetences.fr/' };
}

const trie = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
const sortie = path.join(racine, 'packages/core/data/idcc/idcc-opco.json');
fs.mkdirSync(path.dirname(sortie), { recursive: true });
fs.writeFileSync(sortie, JSON.stringify(trie, null, 2) + '\n', 'utf-8');
console.log(`OK ${sortie} (${Object.keys(trie).length} entrées)`);
```

Run : `node scripts/convertir-table-idcc.mjs`
Expected : `OK …idcc-opco.json (956 entrées)` (952 + 4 échappatoires, à ±1 près si un code échappatoire existait déjà).

- [ ] **Step 5 : Créer les fichiers de données vides**

`packages/core/data/idcc/naf-suggestions.json` :

```json
[]
```

`packages/core/data/aides/nationales.json` :

```json
{
  "meta": {
    "perimetre": "Aides nationales, européennes, fonds des non-salariés et fiscalité",
    "date_integration": null,
    "fichiers": []
  },
  "aides": []
}
```

`packages/core/data/aides/regions.json` :

```json
{
  "meta": {
    "perimetre": "Aides des 18 régions (13 métropolitaines et 5 d'outre-mer)",
    "date_integration": null,
    "fichiers": []
  },
  "aides": []
}
```

`packages/core/data/aides/portails.json` :

```json
{
  "meta": {
    "perimetre": "Portails officiels par région (Région, Carif-Oref, Transitions Pro, France Travail, Agefiph)",
    "date_integration": null
  },
  "portails": []
}
```

- [ ] **Step 6 : Étendre `packages/core/src/data.ts`** — ajouter après les imports existants :

```ts
import idccData from '../data/idcc/idcc-opco.json';
import nafData from '../data/idcc/naf-suggestions.json';
import aidesNationalesData from '../data/aides/nationales.json';
import aidesRegionalesData from '../data/aides/regions.json';
import portailsData from '../data/aides/portails.json';
import type { Aide, FichierAides, FichierPortails, PortailRegional } from './aides/types';
import type { IdccTable, SuggestionNaf } from './opco-resolver';
```

et à la fin du fichier :

```ts
/** Table IDCC → OPCO embarquée (v2). */
export const EMBEDDED_IDCC = idccData as unknown as IdccTable;

/** Suggestions d'OPCO par code NAF (utilisées sans IDCC exploitable). */
export const EMBEDDED_NAF = nafData as unknown as SuggestionNaf[];

/** Catalogue d'aides embarqué : nationales puis régionales. */
export const EMBEDDED_AIDES: Aide[] = [
  ...(aidesNationalesData as unknown as FichierAides).aides,
  ...(aidesRegionalesData as unknown as FichierAides).aides,
];

/** Portails officiels par région (« pour aller plus loin »). */
export const EMBEDDED_PORTAILS: PortailRegional[] = (portailsData as unknown as FichierPortails).portails;
```

- [ ] **Step 7 : Vérifier**

Run : `cd packages/core && npx vitest run && npx tsc --noEmit`
Expected : PASS (tests du résolveur ; plus de test `resolveIdccToOpco` dans schema.test.ts).
Run : `cd apps/mobile && npx tsc --noEmit` et `cd backend && npx vitest run` — Expected : PASS (l'app utilise encore `resolveIdccToOpco`, conservé).

- [ ] **Step 8 : Commit**

```bash
git add packages/core/src/opco-resolver.ts packages/core/src/data.ts packages/core/tests/opco-resolver.test.ts packages/core/tests/schema.test.ts packages/core/data/idcc packages/core/data/aides scripts/convertir-table-idcc.mjs
git commit -m "core : resolveur OPCO v2 (certitude, multi-IDCC, echappatoires, fusions, NAF) et socle des donnees embarquees

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Lecture des résultats de l'API recherche-entreprises

**Files:**
- Create: `packages/core/src/entreprise.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/entreprise.test.ts`

**Interfaces:**
- Consumes : `departementDuCodePostal`, `estCodeRegion`, `regionDuDepartement` (geo.ts) ; `normaliserIdcc` (opco-resolver.ts).
- Produces : `EtablissementInfo`, `EntrepriseInfo`, `TRANCHES_EFFECTIF_INSEE: Record<string, string>`, `tailleDepuisTranche(tranche: string | null): CompanySize | null`, `parseResultatRechercheEntreprises(raw: Record<string, unknown>): EntrepriseInfo`.

- [ ] **Step 1 : Écrire les tests qui échouent** — `packages/core/tests/entreprise.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseResultatRechercheEntreprises, tailleDepuisTranche } from '../src/entreprise';

// Forme réelle d'un résultat de https://recherche-entreprises.api.gouv.fr/search (valeurs fictives).
const RESULTAT = {
  siren: '123456789',
  nom_complet: 'ORGANISME EXEMPLE',
  activite_principale: '85.59A',
  categorie_entreprise: 'PME',
  nature_juridique: '5710',
  tranche_effectif_salarie: '01',
  annee_tranche_effectif_salarie: '2024',
  siege: {
    siret: '12345678900011',
    est_siege: true,
    code_postal: '95870',
    libelle_commune: 'BEZONS',
    departement: '95',
    region: '11',
    liste_idcc: ['1516'],
    tranche_effectif_salarie: '01',
  },
  matching_etablissements: [
    { siret: '12345678900029', est_siege: false, code_postal: '69003', libelle_commune: 'LYON', departement: '69', region: '84', liste_idcc: ['1486'] },
  ],
  complements: { liste_idcc: ['1516'], est_ess: true, est_siae: false, est_association: false, est_entrepreneur_individuel: false },
};

describe('parseResultatRechercheEntreprises', () => {
  it('extrait identité, NAF, effectif et statuts', () => {
    const e = parseResultatRechercheEntreprises(RESULTAT);
    expect(e).toMatchObject({
      siren: '123456789',
      nom: 'ORGANISME EXEMPLE',
      codeNaf: '85.59A',
      trancheEffectif: '01',
      anneeTrancheEffectif: '2024',
      tailleSuggeree: 'less_11',
      structures: ['ess'],
      estEntrepreneurIndividuel: false,
    });
  });

  it('extrait le siège et les établissements avec leur région', () => {
    const e = parseResultatRechercheEntreprises(RESULTAT);
    expect(e.siege).toMatchObject({ siret: '12345678900011', estSiege: true, departement: '95', region: '11', idccs: ['1516'] });
    expect(e.etablissements[0]).toMatchObject({ departement: '69', region: '84', idccs: ['1486'] });
  });

  it('agrège les IDCC sans doublon et isole ceux du siège', () => {
    const e = parseResultatRechercheEntreprises(RESULTAT);
    expect(e.idccs).toEqual(['1516', '1486']);
    expect(e.idccSiege).toEqual(['1516']);
  });

  it('déduit département et région du code postal si absents', () => {
    const e = parseResultatRechercheEntreprises({
      ...RESULTAT,
      siege: { siret: '1', code_postal: '20090', libelle_commune: 'AJACCIO', liste_idcc: [] },
      matching_etablissements: [],
    });
    expect(e.siege).toMatchObject({ departement: '2A', region: '94' });
  });

  it('ignore 0000 et les tranches inconnues', () => {
    const e = parseResultatRechercheEntreprises({
      ...RESULTAT,
      tranche_effectif_salarie: 'NN',
      complements: { liste_idcc: ['0000'] },
      siege: { ...RESULTAT.siege, liste_idcc: ['0000'] },
      matching_etablissements: [],
    });
    expect(e.idccs).toEqual([]);
    expect(e.trancheEffectif).toBeNull();
    expect(e.tailleSuggeree).toBeNull();
  });
});

describe('tailleDepuisTranche', () => {
  it('suggère une taille seulement si la tranche est sans ambiguïté', () => {
    expect(tailleDepuisTranche('03')).toBe('less_11');
    expect(tailleDepuisTranche('11')).toBeNull(); // 10 à 19 salariés
    expect(tailleDepuisTranche('12')).toBe('11_49');
    expect(tailleDepuisTranche('31')).toBe('50_299');
    expect(tailleDepuisTranche('32')).toBeNull(); // 250 à 499 salariés
    expect(tailleDepuisTranche('41')).toBe('300_plus');
    expect(tailleDepuisTranche(null)).toBeNull();
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `cd packages/core && npx vitest run tests/entreprise.test.ts`
Expected : FAIL — module `../src/entreprise` introuvable.

- [ ] **Step 3 : Créer `packages/core/src/entreprise.ts`**

```ts
// ============================================================
// Lecture d'un résultat de l'API publique recherche-entreprises
// (https://recherche-entreprises.api.gouv.fr) : établissements, région,
// effectif, NAF, IDCC et statuts. Fonction pure : aucun appel réseau ici.
// ============================================================

import { departementDuCodePostal, estCodeRegion, regionDuDepartement } from './geo';
import { normaliserIdcc } from './opco-resolver';
import type { CodeRegion, CompanySize, TypeStructure } from './types';

export interface EtablissementInfo {
  siret: string;
  estSiege: boolean;
  codePostal: string;
  commune: string;
  departement: string | null;
  region: CodeRegion | null;
  idccs: string[];
}

export interface EntrepriseInfo {
  siren: string;
  nom: string;
  codeNaf: string | null;
  categorie: string | null;
  natureJuridique: string | null;
  /** Code de tranche d'effectif INSEE (null si inconnu). */
  trancheEffectif: string | null;
  anneeTrancheEffectif: string | null;
  tailleSuggeree: CompanySize | null;
  structures: TypeStructure[];
  estEntrepreneurIndividuel: boolean;
  siege: EtablissementInfo;
  etablissements: EtablissementInfo[];
  /** Tous les IDCC (entreprise et établissements), sans doublon. */
  idccs: string[];
  idccSiege: string[];
}

/** Libellés des tranches d'effectif salarié INSEE. */
export const TRANCHES_EFFECTIF_INSEE: Record<string, string> = {
  '00': '0 salarié',
  '01': '1 ou 2 salariés',
  '02': '3 à 5 salariés',
  '03': '6 à 9 salariés',
  '11': '10 à 19 salariés',
  '12': '20 à 49 salariés',
  '21': '50 à 99 salariés',
  '22': '100 à 199 salariés',
  '31': '200 à 249 salariés',
  '32': '250 à 499 salariés',
  '41': '500 à 999 salariés',
  '42': '1 000 à 1 999 salariés',
  '51': '2 000 à 4 999 salariés',
  '52': '5 000 à 9 999 salariés',
  '53': '10 000 salariés et plus',
};

/** Taille suggérée d'après la tranche INSEE ; null si la tranche chevauche deux tailles (10-19, 250-499). */
export function tailleDepuisTranche(tranche: string | null): CompanySize | null {
  switch (tranche) {
    case '00':
    case '01':
    case '02':
    case '03':
      return 'less_11';
    case '12':
      return '11_49';
    case '21':
    case '22':
    case '31':
      return '50_299';
    case '41':
    case '42':
    case '51':
    case '52':
    case '53':
      return '300_plus';
    default:
      return null;
  }
}

const texte = (v: unknown): string => (v == null ? '' : String(v));
const texteOuNull = (v: unknown): string | null => {
  const s = texte(v).trim();
  return s ? s : null;
};

function idccsDe(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const codes: string[] = [];
  for (const brut of v) {
    const code = normaliserIdcc(String(brut));
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function etablissementDepuis(raw: Record<string, unknown> | undefined, siege: boolean): EtablissementInfo {
  const r = raw ?? {};
  const codePostal = texte(r.code_postal);
  const departement = texteOuNull(r.departement) ?? departementDuCodePostal(codePostal);
  const regionBrute = texteOuNull(r.region);
  return {
    siret: texte(r.siret),
    estSiege: r.est_siege === true || siege,
    codePostal,
    commune: texte(r.libelle_commune),
    departement,
    region: estCodeRegion(regionBrute) ? regionBrute : regionDuDepartement(departement),
    idccs: idccsDe(r.liste_idcc),
  };
}

export function parseResultatRechercheEntreprises(raw: Record<string, unknown>): EntrepriseInfo {
  const complements = (raw.complements as Record<string, unknown> | undefined) ?? {};
  const siegeBrut = raw.siege as Record<string, unknown> | undefined;
  const siege = etablissementDepuis(siegeBrut, true);
  const matching = Array.isArray(raw.matching_etablissements)
    ? (raw.matching_etablissements as Record<string, unknown>[])
    : [];
  const etablissements = matching.map((e) => etablissementDepuis(e, false));

  const idccs: string[] = [];
  for (const code of [...idccsDe(complements.liste_idcc), ...siege.idccs, ...etablissements.flatMap((e) => e.idccs)]) {
    if (!idccs.includes(code)) idccs.push(code);
  }

  const trancheBrute = texteOuNull(raw.tranche_effectif_salarie) ?? texteOuNull(siegeBrut?.tranche_effectif_salarie);
  const tranche = trancheBrute === 'NN' ? null : trancheBrute;

  const structures: TypeStructure[] = [];
  if (complements.est_ess === true) structures.push('ess');
  if (complements.est_siae === true) structures.push('siae');
  if (complements.est_association === true) structures.push('association');

  return {
    siren: texte(raw.siren),
    nom: texte(raw.nom_complet || raw.nom_raison_sociale),
    codeNaf: texteOuNull(raw.activite_principale),
    categorie: texteOuNull(raw.categorie_entreprise),
    natureJuridique: texteOuNull(raw.nature_juridique),
    trancheEffectif: tranche,
    anneeTrancheEffectif: texteOuNull(raw.annee_tranche_effectif_salarie),
    tailleSuggeree: tailleDepuisTranche(tranche),
    structures,
    estEntrepreneurIndividuel: complements.est_entrepreneur_individuel === true,
    siege,
    etablissements,
    idccs,
    idccSiege: siege.idccs.length > 0 ? siege.idccs : (etablissements.find((e) => e.estSiege)?.idccs ?? []),
  };
}
```

- [ ] **Step 4 : Exporter** — dans `packages/core/src/index.ts`, ajouter :

```ts
export * from './entreprise';
```

- [ ] **Step 5 : Vérifier**

Run : `cd packages/core && npx vitest run && npx tsc --noEmit`
Expected : PASS.

- [ ] **Step 6 : Commit**

```bash
git add packages/core/src/entreprise.ts packages/core/src/index.ts packages/core/tests/entreprise.test.ts
git commit -m "core : lecture des resultats recherche-entreprises (region, effectif, NAF, IDCC par etablissement)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : App — dataset actif complet

**Files:**
- Modify: `apps/mobile/src/lib/dataset-sync.ts`
- Create: `apps/mobile/src/hooks/useActiveDataset.ts`
- Delete: `apps/mobile/src/hooks/useActiveOpcos.ts`
- Modify: `apps/mobile/src/app/index.tsx`, `apps/mobile/src/components/wizard/WizardContainer.tsx`

**Interfaces:**
- Consumes : `EMBEDDED_AIDES`, `EMBEDDED_IDCC`, `EMBEDDED_NAF`, `EMBEDDED_PORTAILS` (tâche 4).
- Produces : `ActiveDataset { opcos; aides; idcc; naf; portails; source; version; generatedAt }`, `getActiveDataset(): Promise<ActiveDataset>` ; hook `useActiveDataset(): ActiveDatasetState` (champs `loading, opcos, opcoList, getOpcoBySlug, aides, idcc, naf, portails, source, version, generatedAt, reload`).

- [ ] **Step 1 : Modifier `apps/mobile/src/lib/dataset-sync.ts`**

1a. Remplacer le commentaire d'en-tête et le bloc d'import `@opco/core` par :

```ts
// ============================================================
// Synchronisation du dataset (OPCO, aides, table IDCC, suggestions NAF, portails).
//
// Stratégie « jamais d'état cassé » :
// 1. L'app fonctionne d'abord sur les données embarquées (@opco/core).
// 2. syncDataset() télécharge <base>/manifest.json ; si la version publiée est
//    plus récente que la version active, télécharge <base>/latest.json, vérifie
//    le SHA-256 annoncé, valide via validateDataset() puis stocke en AsyncStorage.
// 3. Toute erreur (réseau, hash, validation) laisse les données courantes intactes.
// 4. Un cache plus ancien que les données embarquées (après une mise à jour de
//    l'app) est ignoré ; une section absente du cache retombe sur l'embarqué.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import {
  EMBEDDED_AIDES,
  EMBEDDED_IDCC,
  EMBEDDED_NAF,
  EMBEDDED_OPCOS,
  EMBEDDED_PORTAILS,
  validateDataset,
  DatasetManifestSchema,
  type Aide,
  type Dataset,
  type DatasetManifest,
  type IdccTable,
  type OpcoData,
  type PortailRegional,
  type SuggestionNaf,
} from '@opco/core';
```

1b. Remplacer l'interface `ActiveDataset` par :

```ts
export interface ActiveDataset {
  opcos: OpcoData[];
  aides: Aide[];
  idcc: IdccTable;
  naf: SuggestionNaf[];
  portails: PortailRegional[];
  /** 'cache' = dataset téléchargé et validé ; 'embedded' = données embarquées. */
  source: 'cache' | 'embedded';
  version: number;
  /** Date de génération du dataset actif (pour « Données à jour au … »). */
  generatedAt: string;
}
```

1c. Remplacer la fonction `getActiveOpcos` (et son commentaire) par :

```ts
function donneesEmbarquees(): ActiveDataset {
  return {
    opcos: EMBEDDED_OPCOS,
    aides: EMBEDDED_AIDES,
    idcc: EMBEDDED_IDCC,
    naf: EMBEDDED_NAF,
    portails: EMBEDDED_PORTAILS,
    source: 'embedded',
    version: EMBEDDED_DATASET_VERSION,
    generatedAt: EMBEDDED_DATASET_DATE,
  };
}

/**
 * Retourne le dataset actif : le cache téléchargé s'il est valide et au moins aussi
 * récent que les données embarquées, sinon les données embarquées. Ne lève jamais.
 */
export async function getActiveDataset(): Promise<ActiveDataset> {
  const cached = await readCachedDataset();
  if (!cached || cached.version < EMBEDDED_DATASET_VERSION) return donneesEmbarquees();
  const embarque = donneesEmbarquees();
  return {
    // Le schéma Zod tolère des champs descriptifs plus larges : même cast que @opco/core.
    opcos: cached.opcos as unknown as OpcoData[],
    aides: (cached.aides as unknown as Aide[] | undefined) ?? embarque.aides,
    idcc: (cached.idcc as unknown as IdccTable | undefined) ?? embarque.idcc,
    naf: (cached.naf as unknown as SuggestionNaf[] | undefined) ?? embarque.naf,
    portails: (cached.portails as unknown as PortailRegional[] | undefined) ?? embarque.portails,
    source: 'cache',
    version: cached.version,
    generatedAt: cached.generatedAt,
  };
}
```

1d. Dans `syncDataset`, remplacer `const active = await getActiveOpcos();` par `const active = await getActiveDataset();`.

- [ ] **Step 2 : Créer `apps/mobile/src/hooks/useActiveDataset.ts`**

```ts
// Charge le dataset actif (cache validé ou données embarquées) et expose
// des index prêts à l'emploi pour l'UI.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  indexBySlug,
  toOpcoList,
  type Aide,
  type IdccTable,
  type OpcoData,
  type PortailRegional,
  type SuggestionNaf,
} from '@opco/core';
import { getActiveDataset, type ActiveDataset } from '@/lib/dataset-sync';

export interface ActiveDatasetState {
  loading: boolean;
  opcos: OpcoData[];
  opcoList: { slug: string; name: string; secteurs: string }[];
  getOpcoBySlug: (slug: string) => OpcoData | undefined;
  aides: Aide[];
  idcc: IdccTable;
  naf: SuggestionNaf[];
  portails: PortailRegional[];
  source: ActiveDataset['source'];
  version: number;
  generatedAt: string;
  /** Recharge le dataset actif (après une sync réussie). */
  reload: () => Promise<void>;
}

const AUCUNE_AIDE: Aide[] = [];
const AUCUN_OPCO: OpcoData[] = [];
const TABLE_VIDE: IdccTable = {};
const AUCUNE_SUGGESTION: SuggestionNaf[] = [];
const AUCUN_PORTAIL: PortailRegional[] = [];

export function useActiveDataset(): ActiveDatasetState {
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<ActiveDataset | null>(null);

  const load = useCallback(async () => {
    setDataset(await getActiveDataset());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const opcos = dataset?.opcos ?? AUCUN_OPCO;
  const bySlug = useMemo(() => indexBySlug(opcos), [opcos]);
  const opcoList = useMemo(() => toOpcoList(opcos), [opcos]);
  const getOpcoBySlug = useCallback((slug: string) => bySlug[slug], [bySlug]);

  return {
    loading,
    opcos,
    opcoList,
    getOpcoBySlug,
    aides: dataset?.aides ?? AUCUNE_AIDE,
    idcc: dataset?.idcc ?? TABLE_VIDE,
    naf: dataset?.naf ?? AUCUNE_SUGGESTION,
    portails: dataset?.portails ?? AUCUN_PORTAIL,
    source: dataset?.source ?? 'embedded',
    version: dataset?.version ?? 1,
    generatedAt: dataset?.generatedAt ?? '',
    reload: load,
  };
}
```

- [ ] **Step 3 : Basculer les consommateurs**

Supprimer `apps/mobile/src/hooks/useActiveOpcos.ts`.
Dans `apps/mobile/src/app/index.tsx` et `apps/mobile/src/components/wizard/WizardContainer.tsx`, remplacer `import { useActiveOpcos } from '@/hooks/useActiveOpcos';` par `import { useActiveDataset } from '@/hooks/useActiveDataset';` et chaque appel `useActiveOpcos()` par `useActiveDataset()`.

- [ ] **Step 4 : Vérifier**

Run : `cd apps/mobile && npx tsc --noEmit`
Expected : aucune erreur.
Run : `grep -rn "useActiveOpcos\|getActiveOpcos" apps/mobile/src` — Expected : aucun résultat.

- [ ] **Step 5 : Commit**

```bash
git add -A apps/mobile/src/lib/dataset-sync.ts apps/mobile/src/hooks apps/mobile/src/app/index.tsx apps/mobile/src/components/wizard/WizardContainer.tsx
git commit -m "app : dataset actif complet (aides, IDCC, NAF, portails) et cache plus ancien que l'embarque ignore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : App — étape « Entreprise »

**Files:**
- Modify: `apps/mobile/src/lib/siren-client.ts`, `apps/mobile/src/hooks/useSirenLookup.ts`
- Modify: `apps/mobile/src/components/ui/forms.tsx` (ajout `RegionPicker`, `OuiNonChoix`)
- Create: `apps/mobile/src/components/ui/CertitudeBadge.tsx`
- Modify: `apps/mobile/src/components/wizard/StepIdentification.tsx` (réécriture complète)
- Modify: `apps/mobile/src/components/wizard/StepSituation.tsx`, `StepRecap.tsx`, `WizardContainer.tsx`, `apps/mobile/src/hooks/useWizard.ts`
- Modify: `packages/core/src/types.ts`, `packages/core/src/opco-resolver.ts`

**Interfaces:**
- Consumes : `parseResultatRechercheEntreprises`, `EntrepriseInfo`, `TRANCHES_EFFECTIF_INSEE` (tâche 5) ; `resoudreOpco`, `URL_VERIFICATION_OPCO` (tâche 4) ; `REGIONS`, `REGIONS_TRIEES`, `departementDuCodePostal`, `regionDuDepartement` (tâche 1) ; `useActiveDataset` (tâche 6).
- Produces : `RegionPicker({ selected, onSelect })`, `OuiNonChoix({ label, value, onChange, avecInconnu?, required? })`, `CertitudeBadge({ certitude })`. Supprime de `@opco/core` : `SirenSearchResult`, `SirenApiResponse`, `IdccOpcoMapping`, `resolveIdccToOpco`.

- [ ] **Step 1 : Nettoyer `@opco/core`**

Dans `packages/core/src/types.ts` : supprimer les sections `// --- SIREN API Types ---` (interfaces `SirenSearchResult`, `SirenApiResponse`) et `// --- IDCC Mapping ---` (interface `IdccOpcoMapping`) ; dans `WIZARD_STEPS`, remplacer `{ key: 'identification', label: 'Votre OPCO', icon: '1' }` par `{ key: 'identification', label: 'Entreprise', icon: '1' }` et `{ key: 'situation', label: 'Situation professionnelle', icon: '2' }` par `{ key: 'situation', label: 'Bénéficiaire', icon: '2' }`.
Dans `packages/core/src/opco-resolver.ts` : supprimer la fonction `resolveIdccToOpco` et l'import `EMBEDDED_IDCC`.

Run : `cd packages/core && npx vitest run && npx tsc --noEmit` — Expected : PASS.

- [ ] **Step 2 : `apps/mobile/src/lib/siren-client.ts`** — remplacer le fichier par :

```ts
// ============================================================
// Client SIREN — appel DIRECT de l'API publique recherche-entreprises.
// La lecture du résultat (établissements, région, effectif, NAF, IDCC)
// est faite par parseResultatRechercheEntreprises (@opco/core, testée).
// ============================================================

import { parseResultatRechercheEntreprises, type EntrepriseInfo } from '@opco/core';

const API_BASE = 'https://recherche-entreprises.api.gouv.fr/search';

/** Erreur réseau typée : permet à l'UI de proposer la saisie manuelle. */
export class SirenNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SirenNetworkError';
  }
}

export async function searchCompanies(
  query: string,
  signal?: AbortSignal,
): Promise<{ results: EntrepriseInfo[]; total_results: number }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { results: [], total_results: 0 };

  const params = new URLSearchParams({ q: trimmed, page: '1', per_page: '10', mtm_campaign: 'opco-calculator' });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}?${params}`, { headers: { Accept: 'application/json' }, signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new SirenNetworkError(
      'Recherche impossible : pas de connexion Internet. Vous pouvez saisir votre entreprise manuellement.',
    );
  }

  if (!response.ok) {
    throw new SirenNetworkError("Erreur lors de la recherche d'entreprise. Veuillez réessayer.");
  }

  const data = (await response.json()) as { results?: Record<string, unknown>[]; total_results?: number };
  return {
    results: (data.results ?? []).map((r) => parseResultatRechercheEntreprises(r)),
    total_results: Number(data.total_results || 0),
  };
}
```

Dans `apps/mobile/src/hooks/useSirenLookup.ts`, remplacer `import type { SirenSearchResult } from '@opco/core';` par `import type { EntrepriseInfo } from '@opco/core';` et chaque `SirenSearchResult` par `EntrepriseInfo`.

- [ ] **Step 3 : Ajouter à `apps/mobile/src/components/ui/forms.tsx`**

Ajouter l'import `import { REGIONS_TRIEES, type CodeRegion } from '@opco/core';` en tête, puis à la fin du fichier :

```tsx
// --- Sélecteur de région ----------------------------------------------------

interface RegionPickerProps {
  selected: CodeRegion | null;
  onSelect: (code: CodeRegion) => void;
}

export function RegionPicker({ selected, onSelect }: RegionPickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {REGIONS_TRIEES.map(({ code, nom }) => (
        <View key={code} className="w-[48%]">
          <ChoiceButton label={nom} compact selected={selected === code} onPress={() => onSelect(code)} />
        </View>
      ))}
    </View>
  );
}

// --- Choix oui / non (/ je ne sais pas) -------------------------------------

interface OuiNonChoixProps {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  /** Ajoute « Je ne sais pas » (valeur null). */
  avecInconnu?: boolean;
  required?: boolean;
}

export function OuiNonChoix({ label, value, onChange, avecInconnu, required }: OuiNonChoixProps) {
  return (
    <View className="gap-2">
      <FieldLabel label={label} required={required} />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <ChoiceButton label="Oui" center selected={value === true} onPress={() => onChange(true)} />
        </View>
        <View className="flex-1">
          <ChoiceButton label="Non" center selected={value === false} onPress={() => onChange(false)} />
        </View>
        {avecInconnu ? (
          <View className="flex-1">
            <ChoiceButton label="Je ne sais pas" center selected={value === null} onPress={() => onChange(null)} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 4 : Créer `apps/mobile/src/components/ui/CertitudeBadge.tsx`**

```tsx
import { Text, View } from 'react-native';
import type { CertitudeOpco } from '@opco/core';

const CONFIG: Record<CertitudeOpco, { label: string; container: string; text: string }> = {
  confirme: { label: 'Confirmé par la source officielle', container: 'bg-green-50 border-green-200', text: 'text-green-700' },
  fiable: { label: 'Identifié via la convention collective', container: 'bg-green-50 border-green-200', text: 'text-green-700' },
  a_confirmer: { label: 'À confirmer', container: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800' },
  inconnu: { label: 'Non identifié', container: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
};

/** Badge de certitude de l'identification de l'OPCO. */
export function CertitudeBadge({ certitude }: { certitude: CertitudeOpco }) {
  const c = CONFIG[certitude];
  return (
    <View className={`self-start rounded-full border px-2 py-0.5 ${c.container}`}>
      <Text className={`text-xs font-medium ${c.text}`}>{c.label}</Text>
    </View>
  );
}
```

- [ ] **Step 5 : Réécrire `apps/mobile/src/components/wizard/StepIdentification.tsx`**

```tsx
// Étape 1 — Entreprise : recherche (nom, SIREN ou SIRET) ou saisie manuelle.
// L'OPCO est identifié par resoudreOpco (@opco/core) avec un niveau de certitude
// explicite ; l'utilisateur peut toujours le vérifier sur l'outil officiel.

import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import {
  COMPANY_SIZE_LABELS,
  REGIONS,
  TRANCHES_EFFECTIF_INSEE,
  URL_VERIFICATION_OPCO,
  departementDuCodePostal,
  regionDuDepartement,
  resolveVarianteBranche,
  resoudreOpco,
  type CompanySize,
  type EntrepriseInfo,
  type IdccTable,
  type OpcoData,
  type SuggestionNaf,
  type WizardState,
} from '@opco/core';
import { useSirenLookup } from '@/hooks/useSirenLookup';
import { ChoiceButton, NumberField, OpcoPicker, RegionPicker, TextField } from '@/components/ui/forms';
import { CertitudeBadge } from '@/components/ui/CertitudeBadge';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  opcoList: { slug: string; name: string; secteurs: string }[];
  getOpcoBySlug: (slug: string) => OpcoData | undefined;
  idccTable: IdccTable;
  suggestionsNaf: SuggestionNaf[];
}

const LIBELLES_STRUCTURES = { ess: 'ESS', siae: "Structure d'insertion (SIAE)", association: 'Association' } as const;

export function StepIdentification({ state, updateState, opcoList, getOpcoBySlug, idccTable, suggestionsNaf }: Props) {
  const [mode, setMode] = useState<'search' | 'manual' | null>(
    state.sirenNumber ? 'search' : state.opcoKnown ? 'manual' : null,
  );
  const [searchQuery, setSearchQuery] = useState(state.companyName || '');
  const [codePostal, setCodePostal] = useState('');
  const [changerOpco, setChangerOpco] = useState(false);
  const [changerRegion, setChangerRegion] = useState(false);
  const { results, loading, error, isOffline, search } = useSirenLookup();
  const opcoFacultatif = state.projetType === 'formation_dirigeant';
  const avecBudgetOpco =
    state.projetType == null || state.projetType === 'formation_salarie' || state.projetType === 'reconversion_salarie';

  const resolution = useMemo(
    () =>
      state.sirenNumber
        ? resoudreOpco(
            { idccs: state.idccEtablissements, idccSiege: state.idccSiege, codeNaf: state.codeNaf },
            idccTable,
            suggestionsNaf,
          )
        : null,
    [state.sirenNumber, state.idccEtablissements, state.idccSiege, state.codeNaf, idccTable, suggestionsNaf],
  );

  const choisirMode = (m: 'search' | 'manual') => {
    setMode(m);
    updateState({ opcoKnown: m === 'manual' });
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    updateState({ companyName: value });
    search(value);
  };

  const handleCompanySelect = (c: EntrepriseInfo) => {
    const r = resoudreOpco({ idccs: c.idccs, idccSiege: c.idccSiege, codeNaf: c.codeNaf }, idccTable, suggestionsNaf);
    updateState({
      companyName: c.nom,
      detectedCompanyName: c.nom,
      sirenNumber: c.siren,
      siret: c.siege.siret || null,
      detectedOpcoSlug: r.opcoSlug,
      detectedIdcc: r.idccRetenu,
      opcoCertitude: r.certitude,
      idccEtablissements: c.idccs,
      idccSiege: c.idccSiege,
      regionCode: c.siege.region,
      departementCode: c.siege.departement,
      codeNaf: c.codeNaf,
      trancheEffectifInsee: c.trancheEffectif,
      structures: c.structures,
      companySize: c.tailleSuggeree ?? state.companySize,
      selectedOpcoSlug: null,
      selectedBrancheId: null,
    });
    setChangerOpco(false);
    setSearchQuery(c.nom);
    search('');
  };

  const saisirCodePostal = (texte: string) => {
    setCodePostal(texte);
    const departement = departementDuCodePostal(texte);
    if (departement) updateState({ departementCode: departement, regionCode: regionDuDepartement(departement) });
  };

  const effectiveSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opcoEffectif = effectiveSlug ? opcoList.find((o) => o.slug === effectiveSlug) : undefined;
  const opcoData = effectiveSlug ? getOpcoBySlug(effectiveSlug) : undefined;
  const variantes = opcoData?.variantes_branche ?? [];
  const appliedVariante = opcoData ? resolveVarianteBranche(opcoData, state) : null;
  const idccVariante = opcoData
    ? resolveVarianteBranche(opcoData, { selectedBrancheId: null, detectedIdcc: state.detectedIdcc })
    : null;
  const nomOpco = (slug: string) => opcoList.find((o) => o.slug === slug)?.name ?? slug;

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">Votre entreprise</Text>
        <Text className="text-sm text-gray-600">
          L'entreprise détermine son OPCO (opérateur de compétences) et les aides de sa région.
        </Text>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <ChoiceButton label="Rechercher mon entreprise" sublabel="Nom, SIREN ou SIRET" selected={mode === 'search'} onPress={() => choisirMode('search')} />
        </View>
        <View className="flex-1">
          <ChoiceButton label="Saisir manuellement" sublabel="OPCO, région, taille" selected={mode === 'manual'} onPress={() => choisirMode('manual')} />
        </View>
      </View>

      {mode === 'search' && (
        <View className="gap-3">
          <View className="relative">
            <TextInput
              value={searchQuery}
              onChangeText={handleSearchInput}
              placeholder="Ex : Boulangerie Martin, 552 100 554…"
              placeholderTextColor="#9ca3af"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 pr-10 text-gray-900"
              autoCorrect={false}
            />
            {loading && (
              <View className="absolute right-3 top-0 h-full justify-center">
                <ActivityIndicator size="small" color="#3b82f6" />
              </View>
            )}
          </View>
          {error ? (
            <View className={`rounded-lg p-3 ${isOffline ? 'border border-amber-200 bg-amber-50' : ''}`}>
              <Text className={`text-sm ${isOffline ? 'text-amber-800' : 'text-red-600'}`}>{error}</Text>
              {isOffline ? <Text className="mt-1 text-xs text-amber-700">Hors connexion ? Utilisez « Saisir manuellement ».</Text> : null}
            </View>
          ) : null}
          {results.length > 0 && (
            <View className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              {results.map((r, i) => (
                <Pressable
                  key={r.siren || String(i)}
                  onPress={() => handleCompanySelect(r)}
                  className={`px-4 py-3 active:bg-blue-50 ${i > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <Text className="font-medium text-gray-900">{r.nom}</Text>
                  <Text className="mt-0.5 text-xs text-gray-500">
                    SIREN {r.siren} — {r.siege.commune} ({r.siege.codePostal})
                    {r.idccs.length > 0 ? ` — IDCC ${r.idccs.join(', ')}` : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {mode === 'search' && state.sirenNumber ? (
        <View className="gap-1 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <Text className="font-semibold text-gray-900">{state.detectedCompanyName}</Text>
          <Text className="text-xs text-gray-600">
            SIREN {state.sirenNumber}
            {state.siret ? ` — SIRET du siège ${state.siret}` : ''}
          </Text>
          {state.codeNaf ? <Text className="text-xs text-gray-600">Code NAF : {state.codeNaf}</Text> : null}
          {state.trancheEffectifInsee ? (
            <Text className="text-xs text-gray-600">
              Effectif déclaré à l'INSEE : {TRANCHES_EFFECTIF_INSEE[state.trancheEffectifInsee] ?? state.trancheEffectifInsee}
            </Text>
          ) : null}
          {state.structures.length > 0 ? (
            <Text className="text-xs text-gray-600">Statut : {state.structures.map((s) => LIBELLES_STRUCTURES[s]).join(', ')}</Text>
          ) : null}
        </View>
      ) : null}

      {mode === 'search' && resolution ? (
        <View className="gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="font-semibold text-gray-900">
              {opcoEffectif ? `OPCO : ${opcoEffectif.name}` : 'OPCO non identifié'}
            </Text>
            {state.selectedOpcoSlug ? null : <CertitudeBadge certitude={resolution.certitude} />}
          </View>
          <Text className="text-sm text-gray-600">{state.selectedOpcoSlug ? 'OPCO choisi manuellement.' : resolution.motif}</Text>
          {resolution.avertissements.map((a) => (
            <Text key={a} className="text-xs text-amber-800">⚠ {a}</Text>
          ))}
          {resolution.candidats.length > 1 && !state.selectedOpcoSlug ? (
            <View className="gap-2">
              <Text className="text-sm font-medium text-gray-700">Convention de l'établissement concerné</Text>
              {resolution.candidats.map((c) => (
                <ChoiceButton
                  key={c.opcoSlug}
                  label={nomOpco(c.opcoSlug)}
                  sublabel={c.idccs.map((i) => `IDCC ${i.idcc} — ${i.titre}`).join(' · ')}
                  selected={state.detectedOpcoSlug === c.opcoSlug}
                  onPress={() => updateState({ detectedOpcoSlug: c.opcoSlug, detectedIdcc: c.idccs[0]?.idcc ?? null, selectedBrancheId: null })}
                />
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={() => Linking.openURL(resolution.urlVerificationOfficielle).catch(() => {})}
            accessibilityRole="link"
            className="self-start rounded-full bg-blue-50 px-3 py-1 active:bg-blue-100"
          >
            <Text className="text-xs text-blue-700">↗ Vérifier sur l'outil officiel France Compétences</Text>
          </Pressable>
          <Pressable onPress={() => setChangerOpco((v) => !v)} accessibilityRole="button">
            <Text className="text-sm font-medium text-blue-600">{changerOpco ? 'Masquer la liste des OPCO' : "Ce n'est pas mon OPCO"}</Text>
          </Pressable>
          {changerOpco ? (
            <OpcoPicker options={opcoList} selectedSlug={state.selectedOpcoSlug} onSelect={(slug) => updateState({ selectedOpcoSlug: slug, selectedBrancheId: null })} />
          ) : null}
        </View>
      ) : null}

      {mode === 'manual' && (
        <View className="gap-4">
          <View className="gap-2">
            <Text className="text-sm font-medium text-gray-700">Votre OPCO{opcoFacultatif ? ' (facultatif)' : ''}</Text>
            <OpcoPicker options={opcoList} selectedSlug={state.selectedOpcoSlug} onSelect={(slug) => updateState({ selectedOpcoSlug: slug, selectedBrancheId: null })} />
            <Pressable onPress={() => Linking.openURL(URL_VERIFICATION_OPCO).catch(() => {})} accessibilityRole="link">
              <Text className="text-xs text-blue-600">↗ Je ne connais pas mon OPCO : outil officiel France Compétences</Text>
            </Pressable>
          </View>
          <TextField label="Code postal de l'établissement" value={codePostal} onChangeText={saisirCodePostal} placeholder="Ex : 69003" helper="Sert à identifier les aides de votre région." />
        </View>
      )}

      {mode !== null && (
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">
            Région <Text className="text-red-500">*</Text>
          </Text>
          {state.regionCode && !changerRegion ? (
            <View className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <Text className="text-sm text-gray-900">{REGIONS[state.regionCode]}</Text>
              <Pressable onPress={() => setChangerRegion(true)} accessibilityRole="button">
                <Text className="text-sm font-medium text-blue-600">Modifier</Text>
              </Pressable>
            </View>
          ) : (
            <RegionPicker
              selected={state.regionCode}
              onSelect={(code) => {
                updateState({ regionCode: code, departementCode: null });
                setChangerRegion(false);
              }}
            />
          )}
        </View>
      )}

      {mode !== null && (
        <View className="gap-2">
          <Text className="text-sm font-medium text-gray-700">
            Taille de l'entreprise <Text className="text-red-500">*</Text>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(Object.entries(COMPANY_SIZE_LABELS) as [CompanySize, string][]).map(([key, label]) => (
              <View key={key} className="w-[48%]">
                <ChoiceButton label={label} selected={state.companySize === key} onPress={() => updateState({ companySize: key })} />
              </View>
            ))}
          </View>
          <NumberField
            label="Effectif exact (facultatif)"
            value={state.effectif}
            onChangeNumber={(v) => updateState({ effectif: v })}
            placeholder="Ex : 8"
            helper="Certaines aides dépendent de seuils précis (par exemple 250 salariés)."
          />
        </View>
      )}

      {mode !== null && avecBudgetOpco ? (
        <NumberField
          label="Budget formation déjà consommé cette année auprès de votre OPCO (€)"
          decimal
          value={state.budgetDejaConsomme}
          onChangeNumber={(v) => updateState({ budgetDejaConsomme: v })}
          placeholder="Ex : 1500"
          helper="Laissez vide si aucune formation financée cette année : ce montant est déduit de votre plafond annuel."
        />
      ) : null}

      {variantes.length > 0 && (
        <View className="gap-3">
          <View>
            <Text className="text-sm font-medium text-gray-700">Votre branche professionnelle</Text>
            <Text className="mt-1 text-xs text-gray-500">Le barème de votre branche peut être plus avantageux que le barème général.</Text>
          </View>
          <View className="gap-2">
            {variantes.map((v) => {
              const selected = appliedVariante?.id === v.id;
              const detectedViaIdcc = idccVariante?.id === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => updateState({ selectedBrancheId: v.id })}
                  className={`rounded-lg border-2 p-3 ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className={`text-sm ${selected ? 'font-medium text-blue-900' : 'text-gray-700'}`}>
                      {selected ? '✓ ' : ''}
                      {v.branche_nom}
                    </Text>
                    {detectedViaIdcc ? (
                      <View className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5">
                        <Text className="text-xs font-medium text-green-700">détectée via votre convention collective</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            <ChoiceButton label="Barème général / je ne sais pas" selected={appliedVariante == null} onPress={() => updateState({ selectedBrancheId: null })} />
          </View>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 6 : Adapter les autres écrans**

6a. `WizardContainer.tsx` : récupérer `idcc` et `naf` du hook (`const { loading, opcoList, getOpcoBySlug, generatedAt, idcc, naf } = useActiveDataset();`) et passer à `StepIdentification` les props `idccTable={idcc}` et `suggestionsNaf={naf}`.

6b. `StepSituation.tsx` : supprimer les blocs « Taille entreprise » et « Budget déjà consommé » (déplacés à l'étape Entreprise), l'import `COMPANY_SIZE_LABELS` et le type `CompanySize`.

6c. `StepRecap.tsx` : renommer la section `OPCO` en `Entreprise` ; y déplacer l'item « Taille entreprise » ; y ajouter, avant « Entreprise » :

```tsx
        <Item label="Région" value={state.regionCode ? REGIONS[state.regionCode] : null} />
```

(ajouter `REGIONS` à l'import `@opco/core`) ; renommer la section « Situation professionnelle » en « Bénéficiaire » et retirer l'item « Budget déjà consommé » de cette section pour le placer dans la section « Entreprise ».

6d. `useWizard.ts` : dans `canGoNext`, remplacer les cas `identification` et `situation` par :

```ts
      case 'identification': {
        const opcoOk =
          !!(state.selectedOpcoSlug || state.detectedOpcoSlug) || state.projetType === 'formation_dirigeant';
        return opcoOk && state.regionCode != null && state.companySize != null;
      }
      case 'situation':
        return !!state.contractType;
```

- [ ] **Step 7 : Vérifier**

Run : `cd apps/mobile && npx tsc --noEmit` — Expected : aucune erreur.
Run : `cd packages/core && npx vitest run` — Expected : PASS.
Run : `grep -rn "SirenSearchResult\|resolveIdccToOpco\|IdccOpcoMapping" packages apps --include=*.ts --include=*.tsx | grep -v node_modules` — Expected : aucun résultat.

- [ ] **Step 8 : Commit**

```bash
git add -A packages/core/src apps/mobile/src
git commit -m "app : etape Entreprise (resolution OPCO avec certitude, region, effectif, verification officielle)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Données — barèmes OPCO vérifiés

**Dépendance :** fichiers des agents de recherche OPCO dans `$RECHERCHE/opcos/` (11 fichiers `<slug>.json` + `rapport-groupe-A.md`, `-B.md`, `-C.md`).

**Files:**
- Modify: `packages/core/data/opcos/*.json` (11 fichiers)
- Test: `packages/core/tests/donnees-opco.test.ts`

**Interfaces:**
- Consumes : `OpcoDataSchema`, `sanityCheckOpco` (tâche 3) ; `REFERENCE_REGLE_50_SALARIES` (tâche 2).

- [ ] **Step 1 : Écrire le test de données** — `packages/core/tests/donnees-opco.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { EMBEDDED_OPCOS } from '../src/data';
import { OpcoDataSchema, sanityCheckOpco } from '../src/schema';

const CHAMPS_CHIFFRES = [
  'cout_horaire_inter',
  'cout_horaire_intra',
  'cout_horaire_metier',
  'prise_en_charge_salaires',
  'frais_transport',
  'frais_hebergement',
  'frais_restauration',
  'frais_annexes_pourcentage',
  'budget_annuel_max',
] as const;

/** Nombre de mois entiers écoulés depuis une date AAAA-MM-JJ (horloge du test). */
function moisDepuis(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const maintenant = new Date();
  return (maintenant.getUTCFullYear() - d.getUTCFullYear()) * 12 + (maintenant.getUTCMonth() - d.getUTCMonth());
}

describe('barèmes OPCO embarqués', () => {
  it('respectent le schéma (une seule entrée par taille) et les bornes', () => {
    for (const o of EMBEDDED_OPCOS) {
      const parsed = OpcoDataSchema.safeParse(o);
      expect(parsed.success, `${o.slug} : ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true);
      if (parsed.success) expect(sanityCheckOpco(parsed.data)).toEqual([]);
    }
  });

  it('ont été vérifiés il y a moins de 12 mois', () => {
    for (const o of EMBEDDED_OPCOS) {
      expect(o.derniere_verification, o.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(moisDepuis(o.derniere_verification!), o.slug).toBeLessThan(12);
    }
  });

  it('chaque montant « exact » cite une source https et un extrait entre guillemets', () => {
    for (const o of EMBEDDED_OPCOS) {
      for (const champ of CHAMPS_CHIFFRES) {
        const v = o[champ];
        if (v.value != null && v.confidence === 'exact') {
          expect(v.source_url, `${o.slug}.${champ}`).toMatch(/^https:\/\//);
          expect(v.note ?? '', `${o.slug}.${champ}`).toMatch(/«[^»]+»/);
        }
      }
    }
  });

  it('une enveloppe 50+ est toujours décrite', () => {
    for (const o of EMBEDDED_OPCOS) {
      for (const p of o.plafonds_par_taille ?? []) {
        if ((p.taille === '50_299' || p.taille === '300_plus') && p.budget_annuel_max != null) {
          expect(p.description.length, `${o.slug}.${p.taille}`).toBeGreaterThan(20);
        }
      }
    }
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `cd packages/core && npx vitest run tests/donnees-opco.test.ts`
Expected : FAIL (aucun `derniere_verification` dans les données de juin).

- [ ] **Step 3 : Contrôler les fichiers de recherche**

Run :

```bash
ls "$RECHERCHE/opcos/"
python -c "import json,glob,sys; sys.stdout.reconfigure(encoding='utf-8'); [print(f, json.load(open(f,encoding='utf-8'))['slug']) for f in sorted(glob.glob(r'$RECHERCHE/opcos/*.json'))]"
```

Expected : 11 fichiers JSON (afdas, akto, atlas, constructys, ocapiat, opco-ep, opco-mobilites, opco-sante, opco2i, opcommerce, uniformation) + 3 rapports.
Lire les trois rapports ; pour chaque valeur passée à `exact`, vérifier que l'extrait du rapport contient bien le nombre. Ouvrir au moins 10 sources tirées au hasard (WebFetch) pour confirmer valeur et extrait ; noter les vérifications dans le message de commit.

- [ ] **Step 4 : Intégrer**

Copier les 11 fichiers `$RECHERCHE/opcos/<slug>.json` vers `packages/core/data/opcos/<slug>.json`.

- [ ] **Step 5 : Faire passer les tests**

Run : `cd packages/core && npx vitest run`
Si un test de données échoue : corriger la donnée concernée (jamais le test) — note sans extrait `« »` → passer `confidence` à `estimated` et préciser la note ; taille en double → déplacer l'écart dans une `variantes_branche` avec ses IDCC ; date absente → `derniere_verification` = date de vérification de l'agent. Si un test de calcul existant échoue parce qu'il lit les données réelles, corriger l'attente du test en citant la nouvelle valeur sourcée.
Expected final : PASS.
Run : `cd backend && npx vitest run` — Expected : PASS.

- [ ] **Step 6 : Commit**

```bash
git add packages/core/data/opcos packages/core/tests/donnees-opco.test.ts
git commit -m "donnees : baremes des 11 OPCO revérifies (octobre 2026), sources et extraits

<Résumé des principales corrections, sources contrôlées à la main.>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Données — table IDCC v2 et suggestions NAF

**Dépendance :** `$RECHERCHE/idcc/idcc-opco.json`, `$RECHERCHE/idcc/naf-suggestions.json`, `$RECHERCHE/idcc/rapport.md`.

**Files:**
- Modify: `packages/core/data/idcc/idcc-opco.json`, `packages/core/data/idcc/naf-suggestions.json`
- Delete: `packages/core/data/idcc-opco-map.json`, `scripts/convertir-table-idcc.mjs`
- Test: `packages/core/tests/donnees-idcc.test.ts`

- [ ] **Step 1 : Écrire le test de données** — `packages/core/tests/donnees-idcc.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { EMBEDDED_IDCC, EMBEDDED_NAF, EMBEDDED_OPCOS } from '../src/data';
import { IdccTableSchema, SuggestionNafSchema } from '../src/schema';
import { resoudreOpco } from '../src/opco-resolver';

const SLUGS = new Set(EMBEDDED_OPCOS.map((o) => o.slug));

// Rattachements notoires servant de garde-fous (vérifiés sur les sites des OPCO).
const ANCRES: Record<string, string> = {
  '1516': 'akto', // organismes de formation
  '1979': 'akto', // hôtels, cafés, restaurants
  '3248': 'opco2i', // métallurgie
  '0044': 'opco2i', // industries chimiques
  '1486': 'atlas', // bureaux d'études techniques (Syntec)
  '2216': 'opcommerce', // commerce à prédominance alimentaire
  '0016': 'opco-mobilites', // transports routiers
  '1597': 'constructys', // bâtiment ouvriers (plus de 10 salariés)
  '2264': 'opco-sante', // hospitalisation privée
  '1996': 'opco-ep', // pharmacie d'officine
  '1261': 'uniformation', // acteurs du lien social et familial
};

describe('table IDCC v2', () => {
  it('respecte le schéma et couvre au moins 500 conventions', () => {
    expect(IdccTableSchema.safeParse(EMBEDDED_IDCC).success).toBe(true);
    expect(Object.keys(EMBEDDED_IDCC).length).toBeGreaterThanOrEqual(500);
  });

  it('n’utilise que les 11 OPCO connus', () => {
    for (const e of Object.values(EMBEDDED_IDCC)) {
      if (e.opco) expect(SLUGS.has(e.opco), e.idcc).toBe(true);
      for (const o of e.opcos_possibles ?? []) expect(SLUGS.has(o), e.idcc).toBe(true);
    }
  });

  it('décrit correctement fusions, partages et échappatoires', () => {
    for (const e of Object.values(EMBEDDED_IDCC)) {
      if (e.statut === 'fusionne') {
        expect(e.idcc_cible, e.idcc).toBeDefined();
        expect(EMBEDDED_IDCC[e.idcc_cible!]?.statut, e.idcc).not.toBe('fusionne');
      }
      if (e.statut === 'partage') expect((e.opcos_possibles ?? []).length, e.idcc).toBeGreaterThanOrEqual(2);
      if (e.statut === 'echappatoire') expect(e.opco, e.idcc).toBeNull();
      if (e.statut === 'actif') expect(e.opco, e.idcc).not.toBeNull();
      expect(e.source, e.idcc).not.toBe('historique');
    }
    for (const code of ['5501', '5100', '9998', '9999']) expect(EMBEDDED_IDCC[code]?.statut).toBe('echappatoire');
  });

  it('respecte les rattachements notoires', () => {
    for (const [idcc, opco] of Object.entries(ANCRES)) {
      expect(resoudreOpco({ idccs: [idcc] }, EMBEDDED_IDCC).opcoSlug, idcc).toBe(opco);
    }
  });

  it('les suggestions NAF sont valides', () => {
    for (const s of EMBEDDED_NAF) {
      expect(SuggestionNafSchema.safeParse(s).success, s.prefixe).toBe(true);
      expect(SLUGS.has(s.opco), s.prefixe).toBe(true);
    }
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `cd packages/core && npx vitest run tests/donnees-idcc.test.ts`
Expected : FAIL (entrées `source: 'historique'` de la table convertie).

- [ ] **Step 3 : Contrôler et intégrer**

Lire `$RECHERCHE/idcc/rapport.md` (méthode, sources, différences avec l'ancienne table). Pour chaque changement d'OPCO signalé, ouvrir la source citée et confirmer. Puis copier `$RECHERCHE/idcc/idcc-opco.json` et `$RECHERCHE/idcc/naf-suggestions.json` dans `packages/core/data/idcc/`. Supprimer `packages/core/data/idcc-opco-map.json` et `scripts/convertir-table-idcc.mjs` (plus utilisés : vérifier avec `grep -rn "idcc-opco-map\|convertir-table-idcc" packages scripts backend apps --include=*.ts --include=*.tsx --include=*.mjs --include=*.json | grep -v node_modules`, aucun résultat attendu).

- [ ] **Step 4 : Faire passer les tests**

Run : `cd packages/core && npx vitest run`
Si une ancre échoue : vérifier la source officielle de l'OPCO pour cet IDCC ; corriger la table si elle est fausse ; ne modifier l'ancre que si la source officielle la contredit (le noter dans le commit). Entrées `source: 'historique'` restantes : les vérifier une à une ou les retirer.
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add -A packages/core/data/idcc packages/core/data/idcc-opco-map.json scripts/convertir-table-idcc.mjs packages/core/tests/donnees-idcc.test.ts
git commit -m "donnees : table IDCC v2 verifiee (titres officiels, fusions, partages, echappatoires) et suggestions NAF

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Phase 2 — Moteur d'aides

### Task 10 : Évaluation des critères (tri-état)

**Files:**
- Create: `packages/core/src/aides/criteres.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/tests/fixtures-aides.ts`
- Test: `packages/core/tests/aides-criteres.test.ts`

**Interfaces:**
- Consumes : `CriteresAide`, `ProfilAides` (tâche 3) ; `REGIONS` (tâche 1) ; libellés de `types.ts`.
- Produces : `type EtatCritere = 'ok' | 'ko' | 'inconnu'`, `interface BilanCriteres { etat: EtatCritere; raisonsKo: string[]; raisonsInconnu: string[] }`, `evaluerCriteres(c: CriteresAide, p: ProfilAides): BilanCriteres`, `OPCO_NOMS: Record<string, string>` ; fixture `makeProfil(over?: Partial<ProfilAides>): ProfilAides`.

- [ ] **Step 1 : Ajouter la fabrique de profil** à la fin de `packages/core/tests/fixtures-aides.ts` (et ajouter `ProfilAides` à l'import de type) :

```ts
/** Profil type : salarié en CDI d'une TPE d'Île-de-France (AKTO), formation RNCP de 140 h à 4 200 €. */
export function makeProfil(over: Partial<ProfilAides> = {}): ProfilAides {
  return {
    projet: 'formation_salarie',
    statutBeneficiaire: 'salarie',
    regionEntreprise: '11',
    departementEntreprise: '95',
    regionBeneficiaire: null,
    effectifMin: 0,
    effectifMax: 10,
    codeNaf: '85.59A',
    idccs: ['1516'],
    opco: 'akto',
    structures: [],
    age: 35,
    rqth: false,
    niveauDiplome: 'bac',
    contrat: 'cdi',
    typeAlternance: null,
    ancienneteMois: 24,
    inscritFranceTravail: null,
    statutDirigeant: null,
    microEntrepreneur: null,
    certification: 'rncp',
    niveauFormationVise: 5,
    eligibleCpf: true,
    dureeHeures: 140,
    coutPedagogique: 4200,
    coutFraisAnnexes: 0,
    qualiopi: true,
    soldeCpf: null,
    ...over,
  };
}
```

(l'import devient `import type { Aide, ProfilAides } from '../src/aides/types';`)

- [ ] **Step 2 : Écrire les tests qui échouent** — `packages/core/tests/aides-criteres.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { evaluerCriteres } from '../src/aides/criteres';
import type { CriteresAide, ProfilAides } from '../src/aides/types';
import { makeProfil } from './fixtures-aides';

describe('evaluerCriteres', () => {
  it('sans critère : ok', () => {
    expect(evaluerCriteres({}, makeProfil()).etat).toBe('ok');
  });

  const cas: [string, CriteresAide, Partial<ProfilAides>, 'ok' | 'ko' | 'inconnu'][] = [
    ['région ok', { regions: ['11'] }, {}, 'ok'],
    ['région ko', { regions: ['84'] }, {}, 'ko'],
    ['région inconnue', { regions: ['11'] }, { regionEntreprise: null }, 'inconnu'],
    ['région du bénéficiaire', { regions: ['76'], perimetre_region: 'beneficiaire' }, { regionBeneficiaire: '76' }, 'ok'],
    ['bénéficiaire sans région : celle de l’entreprise', { regions: ['11'], perimetre_region: 'beneficiaire' }, {}, 'ok'],
    ['département', { departements: ['95'] }, {}, 'ok'],
    ['effectif sous le seuil', { effectif_max: 249 }, { effectifMin: 0, effectifMax: 10 }, 'ok'],
    ['effectif dans une tranche ambiguë', { effectif_max: 249 }, { effectifMin: 50, effectifMax: 299 }, 'inconnu'],
    ['effectif au-dessus du seuil', { effectif_max: 249 }, { effectifMin: 300, effectifMax: null }, 'ko'],
    ['effectif minimum atteint', { effectif_min: 11 }, { effectifMin: 11, effectifMax: 49 }, 'ok'],
    ['effectif inconnu', { effectif_max: 49 }, { effectifMin: null, effectifMax: null }, 'inconnu'],
    ['âge dans la tranche', { age_min: 16, age_max: 29 }, { age: 19 }, 'ok'],
    ['âge hors tranche', { age_max: 29 }, { age: 35 }, 'ko'],
    ['âge inconnu', { age_max: 29 }, { age: null }, 'inconnu'],
    ['RQTH requise absente', { rqth: true }, { rqth: false }, 'ko'],
    ['RQTH requise présente', { rqth: true }, { rqth: true }, 'ok'],
    ['diplôme', { niveaux_diplome: ['sans_diplome'] }, { niveauDiplome: 'bac' }, 'ko'],
    ['niveau visé trop élevé', { niveau_certification_max: 4 }, { niveauFormationVise: 5 }, 'ko'],
    ['niveau visé inconnu', { niveau_certification_max: 4 }, { niveauFormationVise: null }, 'inconnu'],
    ['contrat', { contrats: ['cdi'] }, { contrat: 'cdd' }, 'ko'],
    ['type d’alternance', { types_alternance: ['apprentissage'] }, { typeAlternance: 'apprentissage' }, 'ok'],
    ['ancienneté insuffisante', { anciennete_min_mois: 24 }, { ancienneteMois: 12 }, 'ko'],
    ['inscription France Travail inconnue', { inscrit_france_travail: true }, { inscritFranceTravail: null }, 'inconnu'],
    ['statut du dirigeant', { statuts_dirigeant: ['artisan'] }, { statutDirigeant: 'artisan' }, 'ok'],
    ['micro-entrepreneur exclu', { micro_entrepreneur: false }, { microEntrepreneur: true }, 'ko'],
    ['certification visée', { certifications: ['rncp', 'rs'] }, { certification: 'aucune' }, 'ko'],
    ['éligibilité CPF inconnue', { eligible_cpf: true }, { eligibleCpf: null }, 'inconnu'],
    ['durée minimale', { duree_min_heures: 150 }, { dureeHeures: 140 }, 'ko'],
    ['OPCO', { opcos: ['akto'] }, {}, 'ok'],
    ['IDCC', { idcc: ['1486'] }, {}, 'ko'],
    ['NAF', { naf_prefixes: ['85'] }, {}, 'ok'],
    ['structure inconnue', { structures: ['association'] }, { structures: null }, 'inconnu'],
    ['structure absente', { structures: ['association'] }, { structures: [] }, 'ko'],
    ['Qualiopi', { qualiopi_requis: true }, { qualiopi: false }, 'ko'],
  ];

  it.each(cas)('%s', (_nom, criteres, profil, attendu) => {
    expect(evaluerCriteres(criteres, makeProfil(profil)).etat).toBe(attendu);
  });

  it('donne des raisons lisibles', () => {
    const r = evaluerCriteres({ regions: ['84'], age_max: 29 }, makeProfil({ age: 40 }));
    expect(r.raisonsKo).toContain('Réservé à : Auvergne-Rhône-Alpes');
    expect(r.raisonsKo.some((x) => x.includes('29 ans'))).toBe(true);
  });

  it('ko l’emporte sur inconnu', () => {
    const r = evaluerCriteres({ regions: ['84'], age_max: 29 }, makeProfil({ age: null }));
    expect(r.etat).toBe('ko');
    expect(r.raisonsInconnu.length).toBe(1);
  });
});
```

- [ ] **Step 3 : Vérifier l'échec**

Run : `cd packages/core && npx vitest run tests/aides-criteres.test.ts`
Expected : FAIL — module `../src/aides/criteres` introuvable.

- [ ] **Step 4 : Créer `packages/core/src/aides/criteres.ts`**

```ts
// ============================================================
// Évaluation des critères d'une aide, en trois états :
//   ok      : critère rempli
//   ko      : critère non rempli (raison « Réservé à … »)
//   inconnu : information manquante (raison « Précisez … » / « Vérifiez … »)
// ============================================================

import { REGIONS } from '../geo';
import {
  CERTIFICATION_LABELS,
  CONTRACT_TYPE_LABELS,
  NIVEAU_DIPLOME_LABELS,
  STATUT_DIRIGEANT_LABELS,
  TYPE_ALTERNANCE_LABELS,
} from '../types';
import type { CriteresAide, ProfilAides } from './types';

export type EtatCritere = 'ok' | 'ko' | 'inconnu';

export interface BilanCriteres {
  etat: EtatCritere;
  raisonsKo: string[];
  raisonsInconnu: string[];
}

export const OPCO_NOMS: Record<string, string> = {
  afdas: 'AFDAS',
  akto: 'AKTO',
  atlas: 'ATLAS',
  constructys: 'Constructys',
  ocapiat: 'OCAPIAT',
  'opco-ep': 'OPCO EP',
  'opco-mobilites': 'OPCO Mobilités',
  'opco-sante': 'OPCO Santé',
  opco2i: 'OPCO 2i',
  opcommerce: "L'Opcommerce",
  uniformation: 'Uniformation',
};

const LIBELLES_STRUCTURES = { ess: 'ESS', siae: "structure d'insertion (SIAE)", association: 'association' } as const;

const liste = (valeurs: string[]) => valeurs.join(', ');

function trancheAge(min?: number, max?: number): string {
  if (min != null && max != null) return `Réservé aux personnes de ${min} à ${max} ans`;
  if (min != null) return `Réservé aux personnes de ${min} ans et plus`;
  return `Réservé aux personnes de ${max} ans au plus`;
}

export function evaluerCriteres(c: CriteresAide, p: ProfilAides): BilanCriteres {
  const ko: string[] = [];
  const inconnu: string[] = [];

  if (c.regions?.length) {
    const region = c.perimetre_region === 'beneficiaire' ? (p.regionBeneficiaire ?? p.regionEntreprise) : p.regionEntreprise;
    if (region == null) inconnu.push('Précisez la région');
    else if (!c.regions.includes(region)) ko.push(`Réservé à : ${liste(c.regions.map((r) => REGIONS[r]))}`);
  }

  if (c.departements?.length) {
    if (c.perimetre_region === 'beneficiaire') {
      inconnu.push(`Vérifiez que le bénéficiaire réside dans l'un de ces départements : ${liste(c.departements)}`);
    } else if (p.departementEntreprise == null) {
      inconnu.push("Précisez le département de l'établissement");
    } else if (!c.departements.includes(p.departementEntreprise)) {
      ko.push(`Réservé aux départements : ${liste(c.departements)}`);
    }
  }

  if (c.effectif_max != null) {
    if (p.effectifMax != null && p.effectifMax <= c.effectif_max) {
      // rempli
    } else if (p.effectifMin != null && p.effectifMin > c.effectif_max) {
      ko.push(`Réservé aux entreprises de ${c.effectif_max} salariés au plus`);
    } else {
      inconnu.push(`Vérifiez que l'effectif ne dépasse pas ${c.effectif_max} salariés`);
    }
  }
  if (c.effectif_min != null) {
    if (p.effectifMin != null && p.effectifMin >= c.effectif_min) {
      // rempli
    } else if (p.effectifMax != null && p.effectifMax < c.effectif_min) {
      ko.push(`Réservé aux entreprises d'au moins ${c.effectif_min} salariés`);
    } else {
      inconnu.push(`Vérifiez que l'effectif atteint au moins ${c.effectif_min} salariés`);
    }
  }

  if (c.age_min != null || c.age_max != null) {
    if (p.age == null) inconnu.push("Précisez l'âge du bénéficiaire");
    else if ((c.age_min != null && p.age < c.age_min) || (c.age_max != null && p.age > c.age_max)) {
      ko.push(trancheAge(c.age_min, c.age_max));
    }
  }

  if (c.rqth === true && !p.rqth) {
    ko.push('Réservé aux personnes reconnues travailleurs handicapés (RQTH ou équivalent)');
  }

  if (c.niveaux_diplome?.length) {
    if (p.niveauDiplome == null) inconnu.push('Précisez le niveau de diplôme du bénéficiaire');
    else if (!c.niveaux_diplome.includes(p.niveauDiplome)) {
      ko.push(`Réservé aux niveaux de diplôme : ${liste(c.niveaux_diplome.map((n) => NIVEAU_DIPLOME_LABELS[n]))}`);
    }
  }

  if (c.niveau_certification_max != null || c.niveau_certification_min != null) {
    if (p.niveauFormationVise == null) inconnu.push('Précisez le niveau de la certification visée');
    else if (c.niveau_certification_max != null && p.niveauFormationVise > c.niveau_certification_max) {
      ko.push(`Réservé aux certifications de niveau ${c.niveau_certification_max} au plus`);
    } else if (c.niveau_certification_min != null && p.niveauFormationVise < c.niveau_certification_min) {
      ko.push(`Réservé aux certifications de niveau ${c.niveau_certification_min} au moins`);
    }
  }

  if (c.contrats?.length) {
    if (p.contrat == null) inconnu.push('Précisez le type de contrat');
    else if (!c.contrats.includes(p.contrat)) {
      ko.push(`Réservé aux contrats : ${liste(c.contrats.map((k) => CONTRACT_TYPE_LABELS[k]))}`);
    }
  }

  if (c.types_alternance?.length) {
    if (p.typeAlternance == null) inconnu.push("Précisez le type de contrat d'alternance");
    else if (!c.types_alternance.includes(p.typeAlternance)) {
      ko.push(`Réservé aux : ${liste(c.types_alternance.map((t) => TYPE_ALTERNANCE_LABELS[t]))}`);
    }
  }

  if (c.anciennete_min_mois != null) {
    if (p.ancienneteMois == null) inconnu.push("Précisez l'ancienneté du salarié");
    else if (p.ancienneteMois < c.anciennete_min_mois) {
      ko.push(`Ancienneté minimale requise : ${c.anciennete_min_mois} mois`);
    }
  }

  if (c.inscrit_france_travail != null) {
    if (p.inscritFranceTravail == null) inconnu.push('Précisez si le bénéficiaire est inscrit à France Travail');
    else if (p.inscritFranceTravail !== c.inscrit_france_travail) {
      ko.push(c.inscrit_france_travail ? 'Réservé aux personnes inscrites à France Travail' : 'Réservé aux personnes non inscrites à France Travail');
    }
  }

  if (c.statuts_dirigeant?.length) {
    if (p.statutDirigeant == null) inconnu.push('Précisez le statut du dirigeant');
    else if (!c.statuts_dirigeant.includes(p.statutDirigeant)) {
      ko.push(`Réservé aux : ${liste(c.statuts_dirigeant.map((s) => STATUT_DIRIGEANT_LABELS[s]))}`);
    }
  }

  if (c.micro_entrepreneur != null) {
    if (p.microEntrepreneur == null) inconnu.push('Précisez si le dirigeant est micro-entrepreneur');
    else if (p.microEntrepreneur !== c.micro_entrepreneur) {
      ko.push(c.micro_entrepreneur ? 'Réservé aux micro-entrepreneurs' : 'Non ouvert aux micro-entrepreneurs');
    }
  }

  if (c.certifications?.length) {
    if (p.certification == null) inconnu.push('Précisez la certification visée par la formation');
    else if (!c.certifications.includes(p.certification)) {
      ko.push(`Réservé aux formations menant à : ${liste(c.certifications.map((k) => CERTIFICATION_LABELS[k]))}`);
    }
  }

  if (c.eligible_cpf === true) {
    if (p.eligibleCpf == null) inconnu.push('Vérifiez que la formation est éligible au CPF');
    else if (!p.eligibleCpf) ko.push('Réservé aux formations éligibles au CPF');
  }

  if (c.duree_min_heures != null || c.duree_max_heures != null) {
    if (p.dureeHeures == null) inconnu.push('Précisez la durée de la formation');
    else if (c.duree_min_heures != null && p.dureeHeures < c.duree_min_heures) ko.push(`Durée minimale : ${c.duree_min_heures} h`);
    else if (c.duree_max_heures != null && p.dureeHeures > c.duree_max_heures) ko.push(`Durée maximale : ${c.duree_max_heures} h`);
  }

  if (c.opcos?.length) {
    if (p.opco == null) inconnu.push("Identifiez l'OPCO de l'entreprise");
    else if (!c.opcos.includes(p.opco)) {
      ko.push(`Réservé aux entreprises relevant de : ${liste(c.opcos.map((o) => OPCO_NOMS[o] ?? o))}`);
    }
  }

  if (c.idcc?.length) {
    if (p.idccs.length === 0) inconnu.push("Précisez la convention collective de l'entreprise");
    else if (!p.idccs.some((i) => c.idcc!.includes(i))) ko.push(`Réservé aux conventions collectives : IDCC ${liste(c.idcc)}`);
  }

  if (c.naf_prefixes?.length) {
    const naf = p.codeNaf?.toUpperCase();
    if (naf == null) inconnu.push("Précisez le code NAF de l'entreprise");
    else if (!c.naf_prefixes.some((pre) => naf.startsWith(pre.toUpperCase()))) {
      ko.push(`Réservé aux secteurs (code NAF) : ${liste(c.naf_prefixes)}`);
    }
  }

  if (c.structures?.length) {
    const libelles = liste(c.structures.map((s) => LIBELLES_STRUCTURES[s]));
    if (p.structures == null) inconnu.push(`Vérifiez que votre structure relève de : ${libelles}`);
    else if (!p.structures.some((s) => c.structures!.includes(s))) ko.push(`Réservé aux structures : ${libelles}`);
  }

  if (c.qualiopi_requis === true) {
    if (p.qualiopi == null) inconnu.push("Vérifiez que l'organisme de formation est certifié Qualiopi");
    else if (!p.qualiopi) ko.push('Organisme de formation certifié Qualiopi exigé');
  }

  return {
    etat: ko.length > 0 ? 'ko' : inconnu.length > 0 ? 'inconnu' : 'ok',
    raisonsKo: ko,
    raisonsInconnu: inconnu,
  };
}
```

- [ ] **Step 5 : Exporter** — `packages/core/src/index.ts` : ajouter `export * from './aides/criteres';`

- [ ] **Step 6 : Vérifier** — Run : `cd packages/core && npx vitest run && npx tsc --noEmit` — Expected : PASS.

- [ ] **Step 7 : Commit**

```bash
git add packages/core/src/aides/criteres.ts packages/core/src/index.ts packages/core/tests/aides-criteres.test.ts packages/core/tests/fixtures-aides.ts
git commit -m "core : evaluation tri-etat des criteres d'eligibilite des aides

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11 : Évaluation des aides et estimation des montants

**Files:**
- Create: `packages/core/src/aides/evaluer.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/aides-evaluer.test.ts`

**Interfaces:**
- Consumes : `evaluerCriteres` (tâche 10), `ORDRE_EMPILEMENT_DEFAUT` (tâche 3).
- Produces : `formaterDate(iso: string): string` (« JJ/MM/AAAA »), `estimerMontant(m: MontantAide, p: ProfilAides): { montant: number | null; libelle: string }`, `evaluerAide(aide: Aide, p: ProfilAides, dateRef: string): AideEvaluee`, `evaluerAides(aides: Aide[], p: ProfilAides, dateRef: string): AideEvaluee[]` (triées : éligibles, à vérifier, non éligibles ; puis montant décroissant ; puis nom).

- [ ] **Step 1 : Écrire les tests qui échouent** — `packages/core/tests/aides-evaluer.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { estimerMontant, evaluerAide, evaluerAides, formaterDate } from '../src/aides/evaluer';
import type { MontantAide } from '../src/aides/types';
import { makeAide, makeProfil } from './fixtures-aides';

const AUJOURDHUI = '2026-10-05';
const montant = (over: Partial<MontantAide>): MontantAide => ({
  mode: 'forfait', valeur: null, pourcentage: null, base: null, plafond: null, duree_max_mois: null, libelle: 'règle', ...over,
});

describe('evaluerAide — statut', () => {
  it('éligible quand tout est rempli', () => {
    const r = evaluerAide(makeAide(), makeProfil(), AUJOURDHUI);
    expect(r).toMatchObject({ statut: 'eligible', montantEstime: 1000, raisons: [] });
  });

  it('non éligible : autre projet ou autre public', () => {
    expect(evaluerAide(makeAide({ projets: ['alternance'] }), makeProfil(), AUJOURDHUI).statut).toBe('non_eligible');
    expect(evaluerAide(makeAide({ beneficiaires: ['dirigeant'] }), makeProfil(), AUJOURDHUI).statut).toBe('non_eligible');
  });

  it('non éligible : dispositif suspendu ou terminé', () => {
    expect(evaluerAide(makeAide({ statut: 'suspendu' }), makeProfil(), AUJOURDHUI).statut).toBe('non_eligible');
    const fini = evaluerAide(makeAide({ validite: { debut: null, fin: '2026-06-30' } }), makeProfil(), AUJOURDHUI);
    expect(fini.statut).toBe('non_eligible');
    expect(fini.raisons[0]).toContain('30/06/2026');
  });

  it('à vérifier : information manquante, montant à confirmer ou ouverture future', () => {
    expect(evaluerAide(makeAide({ criteres: { age_max: 29 } }), makeProfil({ age: null }), AUJOURDHUI).statut).toBe('a_verifier');
    expect(evaluerAide(makeAide({ statut: 'a_confirmer' }), makeProfil(), AUJOURDHUI).statut).toBe('a_verifier');
    expect(evaluerAide(makeAide({ validite: { debut: '2027-01-01', fin: null } }), makeProfil(), AUJOURDHUI).statut).toBe('a_verifier');
  });

  it('un critère ko l’emporte sur une information manquante', () => {
    const r = evaluerAide(makeAide({ criteres: { regions: ['84'], age_max: 29 } }), makeProfil({ age: null }), AUJOURDHUI);
    expect(r.statut).toBe('non_eligible');
  });

  it('marque hors périmètre une aide d’un autre projet ou d’une autre région', () => {
    expect(evaluerAide(makeAide({ projets: ['alternance'] }), makeProfil(), AUJOURDHUI).horsPerimetre).toBe(true);
    expect(evaluerAide(makeAide({ criteres: { regions: ['84'] } }), makeProfil(), AUJOURDHUI).horsPerimetre).toBe(true);
    expect(evaluerAide(makeAide({ criteres: { age_max: 29 } }), makeProfil({ age: 40 }), AUJOURDHUI).horsPerimetre).toBe(false);
  });

  it('utilise le lien régional quand il existe', () => {
    const aide = makeAide({ liens_par_region: { '11': 'https://www.transitionspro-idf.fr' } });
    expect(evaluerAide(aide, makeProfil(), AUJOURDHUI).urlDemarche).toBe('https://www.transitionspro-idf.fr');
    expect(evaluerAide(aide, makeProfil({ regionEntreprise: '84' }), AUJOURDHUI).urlDemarche).toBe('https://www.example.gouv.fr/demande');
  });

  it('ordre d’empilement par défaut selon le financeur', () => {
    expect(evaluerAide(makeAide({ financeur: 'cpf' }), makeProfil(), AUJOURDHUI).ordreEmpilement).toBe(90);
    expect(evaluerAide(makeAide({ ordre_empilement: 5 }), makeProfil(), AUJOURDHUI).ordreEmpilement).toBe(5);
  });
});

describe('estimerMontant', () => {
  const p = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 300, dureeHeures: 140 });

  it('forfait avec plafond', () => {
    expect(estimerMontant(montant({ valeur: 5000, plafond: 3000 }), p).montant).toBe(3000);
  });
  it('pourcentage du coût pédagogique ou du coût total', () => {
    expect(estimerMontant(montant({ mode: 'pourcentage', pourcentage: 50, base: 'cout_pedagogique' }), p).montant).toBe(2100);
    expect(estimerMontant(montant({ mode: 'pourcentage', pourcentage: 50, base: 'cout_total' }), p).montant).toBe(2250);
  });
  it('par heure × durée', () => {
    expect(estimerMontant(montant({ mode: 'par_heure', valeur: 10 }), p).montant).toBe(1400);
  });
  it('par mois × durée maximale', () => {
    expect(estimerMontant(montant({ mode: 'par_mois', valeur: 500, duree_max_mois: 12 }), p).montant).toBe(6000);
  });
  it('solde CPF connu ou non', () => {
    expect(estimerMontant(montant({ mode: 'solde_cpf' }), p).montant).toBeNull();
    expect(estimerMontant(montant({ mode: 'solde_cpf' }), makeProfil({ soldeCpf: 1800 })).montant).toBe(1800);
  });
  it('non chiffré', () => {
    expect(estimerMontant(montant({ mode: 'non_chiffre' }), p).montant).toBeNull();
  });
  it('applique la première majoration remplie', () => {
    const m = montant({ valeur: 5000, majorations: [{ criteres: { rqth: true }, valeur: 6000, libelle: '6 000 € (RQTH)' }] });
    expect(estimerMontant(m, makeProfil({ rqth: true }))).toEqual({ montant: 6000, libelle: '6 000 € (RQTH)' });
    expect(estimerMontant(m, makeProfil({ rqth: false })).montant).toBe(5000);
  });
  it('ignore une majoration dont un critère est inconnu', () => {
    const m = montant({ valeur: 5000, majorations: [{ criteres: { age_max: 25 }, valeur: 7000, libelle: 'jeune' }] });
    expect(estimerMontant(m, makeProfil({ age: null })).montant).toBe(5000);
  });
});

describe('evaluerAides', () => {
  it('trie : éligibles, à vérifier, non éligibles, puis montant décroissant', () => {
    const aides = [
      makeAide({ id: 'nat-c', criteres: { regions: ['84'] } }),
      makeAide({ id: 'nat-b', statut: 'a_confirmer' }),
      makeAide({ id: 'nat-a', montant: montant({ valeur: 500, libelle: '500 €' }) }),
      makeAide({ id: 'nat-d' }),
    ];
    expect(evaluerAides(aides, makeProfil(), AUJOURDHUI).map((a) => a.id)).toEqual(['nat-d', 'nat-a', 'nat-b', 'nat-c']);
  });
});

describe('formaterDate', () => {
  it('affiche JJ/MM/AAAA', () => {
    expect(formaterDate('2026-10-05')).toBe('05/10/2026');
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — Run : `cd packages/core && npx vitest run tests/aides-evaluer.test.ts` — Expected : FAIL (module absent).

- [ ] **Step 3 : Créer `packages/core/src/aides/evaluer.ts`**

```ts
// ============================================================
// Évaluation des aides pour un profil : statut d'éligibilité,
// raisons, montant estimé. Fonctions pures (date de référence en paramètre).
// ============================================================

import { evaluerCriteres } from './criteres';
import {
  ORDRE_EMPILEMENT_DEFAUT,
  type Aide,
  type AideEvaluee,
  type MontantAide,
  type ProfilAides,
  type StatutEligibilite,
} from './types';

const arrondi = (n: number): number => Math.round(n * 100) / 100;

/** AAAA-MM-JJ → JJ/MM/AAAA */
export function formaterDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-');
  return annee && mois && jour ? `${jour}/${mois}/${annee}` : iso;
}

/** Montant estimé d'une aide pour le profil (null si non chiffrable). */
export function estimerMontant(m: MontantAide, p: ProfilAides): { montant: number | null; libelle: string } {
  let valeur = m.valeur;
  let pourcentage = m.pourcentage;
  let plafond = m.plafond;
  let libelle = m.libelle;

  for (const maj of m.majorations ?? []) {
    if (evaluerCriteres(maj.criteres, p).etat === 'ok') {
      if (maj.valeur !== undefined) valeur = maj.valeur;
      if (maj.pourcentage !== undefined) pourcentage = maj.pourcentage;
      if (maj.plafond !== undefined) plafond = maj.plafond;
      libelle = maj.libelle;
      break;
    }
  }

  let montant: number | null = null;
  switch (m.mode) {
    case 'forfait':
      montant = valeur;
      break;
    case 'pourcentage': {
      const base =
        m.base === 'cout_total'
          ? p.coutPedagogique != null
            ? p.coutPedagogique + p.coutFraisAnnexes
            : null
          : p.coutPedagogique;
      montant = base != null && pourcentage != null ? (base * pourcentage) / 100 : null;
      break;
    }
    case 'par_heure':
      montant = valeur != null && p.dureeHeures != null ? valeur * p.dureeHeures : null;
      break;
    case 'par_mois':
      montant = valeur != null && m.duree_max_mois != null ? valeur * m.duree_max_mois : null;
      break;
    case 'solde_cpf':
      montant = p.soldeCpf;
      break;
    case 'non_chiffre':
      montant = null;
      break;
  }

  if (montant != null && plafond != null) montant = Math.min(montant, plafond);
  return { montant: montant != null ? Math.max(0, arrondi(montant)) : null, libelle };
}

export function evaluerAide(aide: Aide, p: ProfilAides, dateRef: string): AideEvaluee {
  const exclusions: string[] = [];
  const doutes: string[] = [];

  if (!aide.projets.includes(p.projet)) exclusions.push('Ne concerne pas ce type de projet');
  if (!aide.beneficiaires.includes(p.statutBeneficiaire)) exclusions.push('Ne concerne pas ce public');
  if (aide.statut === 'suspendu') exclusions.push('Dispositif suspendu : pas de nouvelle demande possible actuellement');
  if (aide.validite.fin != null && aide.validite.fin < dateRef) {
    exclusions.push(`Dispositif terminé le ${formaterDate(aide.validite.fin)}`);
  }

  const bilan = evaluerCriteres(aide.criteres, p);
  exclusions.push(...bilan.raisonsKo);
  doutes.push(...bilan.raisonsInconnu);
  if (aide.statut === 'a_confirmer') doutes.push('Montant ou conditions en cours de confirmation auprès du financeur');
  if (aide.validite.debut != null && aide.validite.debut > dateRef) {
    doutes.push(`Dispositif ouvert à partir du ${formaterDate(aide.validite.debut)}`);
  }

  const statut: StatutEligibilite = exclusions.length > 0 ? 'non_eligible' : doutes.length > 0 ? 'a_verifier' : 'eligible';
  const { montant, libelle } = estimerMontant(aide.montant, p);
  const region =
    aide.criteres.perimetre_region === 'beneficiaire' ? (p.regionBeneficiaire ?? p.regionEntreprise) : p.regionEntreprise;
  const lienRegional = region ? aide.liens_par_region?.[region] : undefined;
  const autreRegion = !!aide.criteres.regions?.length && region != null && !aide.criteres.regions.includes(region);
  const horsPerimetre =
    !aide.projets.includes(p.projet) || !aide.beneficiaires.includes(p.statutBeneficiaire) || autreRegion;

  return {
    id: aide.id,
    nom: aide.nom,
    financeur: aide.financeur,
    financeurNom: aide.financeur_nom,
    categorie: aide.categorie,
    description: aide.description,
    statut,
    raisons: exclusions.length > 0 ? exclusions : doutes,
    horsPerimetre,
    conditions: aide.conditions,
    montantEstime: montant,
    libelleMontant: libelle,
    cumulable: aide.cumul.cumulable,
    alternatives: aide.cumul.alternatives ?? [],
    noteCumul: aide.cumul.note ?? null,
    demarches: aide.demarches,
    urlDemarche: lienRegional ?? aide.url_demarche,
    sources: aide.sources,
    derniereVerification: aide.derniere_verification,
    confidence: aide.confidence,
    ordreEmpilement: aide.ordre_empilement ?? ORDRE_EMPILEMENT_DEFAUT[aide.financeur],
  };
}

const RANG: Record<StatutEligibilite, number> = { eligible: 0, a_verifier: 1, non_eligible: 2 };

export function evaluerAides(aides: Aide[], p: ProfilAides, dateRef: string): AideEvaluee[] {
  return aides
    .map((a) => evaluerAide(a, p, dateRef))
    .sort(
      (a, b) =>
        RANG[a.statut] - RANG[b.statut] ||
        (b.montantEstime ?? -1) - (a.montantEstime ?? -1) ||
        a.nom.localeCompare(b.nom, 'fr') ||
        a.id.localeCompare(b.id),
    );
}
```

Note : dans le test de tri, `nat-d` et `nat-a` sont éligibles (1 000 € puis 500 €), `nat-b` est à vérifier et `nat-c` non éligible.

- [ ] **Step 4 : Exporter** — `packages/core/src/index.ts` : ajouter `export * from './aides/evaluer';`

- [ ] **Step 5 : Vérifier** — Run : `cd packages/core && npx vitest run && npx tsc --noEmit` — Expected : PASS.

- [ ] **Step 6 : Commit**

```bash
git add packages/core/src/aides/evaluer.ts packages/core/src/index.ts packages/core/tests/aides-evaluer.test.ts
git commit -m "core : evaluation des aides (statut, raisons, montant estime, majorations, tri)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12 : Profil d'évaluation depuis le parcours

**Files:**
- Create: `packages/core/src/aides/profil.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/aides-profil.test.ts`

**Interfaces:**
- Produces : `bornesEffectif(effectif: number | null, taille: CompanySize | null): { min: number | null; max: number | null }`, `profilDepuisWizard(state: WizardState, opcoSlug: string | null): ProfilAides`, `moisDepuisSaisie(texte: string): string | null` (« MM/AAAA » → « AAAA-MM »), `saisieDepuisMois(mois: string | null): string` (« AAAA-MM » → « MM/AAAA »), `dateDeReference(debutFormation: string | null, aujourdhui: string): string`.

- [ ] **Step 1 : Écrire les tests qui échouent** — `packages/core/tests/aides-profil.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { bornesEffectif, dateDeReference, moisDepuisSaisie, profilDepuisWizard, saisieDepuisMois } from '../src/aides/profil';
import { createInitialWizardState } from '../src/types';

describe('bornesEffectif', () => {
  it('effectif exact prioritaire, sinon bornes de la tranche', () => {
    expect(bornesEffectif(8, '50_299')).toEqual({ min: 8, max: 8 });
    expect(bornesEffectif(null, 'less_11')).toEqual({ min: 0, max: 10 });
    expect(bornesEffectif(null, '300_plus')).toEqual({ min: 300, max: null });
    expect(bornesEffectif(null, null)).toEqual({ min: null, max: null });
  });
});

describe('profilDepuisWizard', () => {
  const base = {
    ...createInitialWizardState(),
    projetType: 'alternance' as const,
    regionCode: '32' as const,
    departementCode: '59',
    companySize: '11_49' as const,
    idccEtablissements: ['1979'],
    detectedIdcc: '1979',
    ageBeneficiaire: 19,
    typeAlternance: 'apprentissage' as const,
    durationHours: 70,
    pedagogyCostTotal: 2100,
    needsAccommodation: true,
    accommodationNights: 2,
    accommodationCostPerNight: 80,
    needsMeals: true,
    mealCostPerDay: 15,
  };

  it('dérive statut, contrat, effectif et frais annexes', () => {
    const p = profilDepuisWizard(base, 'akto');
    expect(p).toMatchObject({
      projet: 'alternance',
      statutBeneficiaire: 'alternant',
      contrat: 'alternance',
      regionEntreprise: '32',
      effectifMin: 11,
      effectifMax: 49,
      opco: 'akto',
      idccs: ['1979'],
      age: 19,
      coutPedagogique: 2100,
      coutFraisAnnexes: 310, // 2 nuits × 80 € + 10 jours × 15 € (70 h / 7)
    });
  });

  it('statuts de la structure inconnus sans recherche entreprise', () => {
    expect(profilDepuisWizard(base, 'akto').structures).toBeNull();
    expect(profilDepuisWizard({ ...base, sirenNumber: '123456789', structures: ['ess'] }, 'akto').structures).toEqual(['ess']);
  });

  it('projet par défaut : former un salarié', () => {
    const p = profilDepuisWizard(createInitialWizardState(), null);
    expect(p.projet).toBe('formation_salarie');
    expect(p.statutBeneficiaire).toBe('salarie');
  });
});

describe('dates', () => {
  it('convertit la saisie MM/AAAA', () => {
    expect(moisDepuisSaisie('3/2027')).toBe('2027-03');
    expect(moisDepuisSaisie('13/2027')).toBeNull();
    expect(moisDepuisSaisie('2027-03')).toBeNull();
    expect(saisieDepuisMois('2027-03')).toBe('03/2027');
    expect(saisieDepuisMois(null)).toBe('');
  });

  it('date de référence : début de formation futur, sinon aujourd’hui', () => {
    expect(dateDeReference('2027-03', '2026-10-05')).toBe('2027-03-01');
    expect(dateDeReference('2026-01', '2026-10-05')).toBe('2026-10-05');
    expect(dateDeReference(null, '2026-10-05')).toBe('2026-10-05');
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — Run : `cd packages/core && npx vitest run tests/aides-profil.test.ts` — Expected : FAIL.

- [ ] **Step 3 : Créer `packages/core/src/aides/profil.ts`**

```ts
// ============================================================
// Passage de l'état du parcours (WizardState) au profil évalué
// par le moteur d'aides, et utilitaires de dates.
// ============================================================

import { estCodeRegion } from '../geo';
import { STATUT_PAR_PROJET, type CompanySize, type WizardState } from '../types';
import type { ProfilAides } from './types';

const BORNES_TAILLE: Record<CompanySize, { min: number; max: number | null }> = {
  less_11: { min: 0, max: 10 },
  '11_49': { min: 11, max: 49 },
  '50_299': { min: 50, max: 299 },
  '300_plus': { min: 300, max: null },
};

/** Bornes de l'effectif : exact s'il est saisi, sinon celles de la tranche choisie. */
export function bornesEffectif(
  effectif: number | null,
  taille: CompanySize | null,
): { min: number | null; max: number | null } {
  if (effectif != null && effectif >= 0) return { min: effectif, max: effectif };
  if (taille) return BORNES_TAILLE[taille];
  return { min: null, max: null };
}

export function profilDepuisWizard(state: WizardState, opcoSlug: string | null): ProfilAides {
  const projet = state.projetType ?? 'formation_salarie';
  const { min, max } = bornesEffectif(state.effectif, state.companySize);
  const idccs = [...state.idccEtablissements];
  if (state.detectedIdcc && !idccs.includes(state.detectedIdcc)) idccs.push(state.detectedIdcc);

  const jours = state.trainingDays ?? (state.durationHours ? Math.ceil(state.durationHours / 7) : 0);
  const hebergement = state.needsAccommodation
    ? (state.accommodationCostPerNight ?? 0) * (state.accommodationNights ?? 0)
    : 0;
  const repas = state.needsMeals ? (state.mealCostPerDay ?? 0) * jours : 0;

  return {
    projet,
    statutBeneficiaire: STATUT_PAR_PROJET[projet],
    regionEntreprise: estCodeRegion(state.regionCode) ? state.regionCode : null,
    departementEntreprise: state.departementCode,
    regionBeneficiaire: estCodeRegion(state.regionBeneficiaireCode) ? state.regionBeneficiaireCode : null,
    effectifMin: min,
    effectifMax: max,
    codeNaf: state.codeNaf,
    idccs,
    opco: opcoSlug,
    structures: state.sirenNumber ? state.structures : null,
    age: state.ageBeneficiaire,
    rqth: state.isHandicap,
    niveauDiplome: state.niveauDiplome,
    contrat: projet === 'alternance' ? 'alternance' : state.contractType,
    typeAlternance: state.typeAlternance,
    ancienneteMois: state.anciennete_mois,
    inscritFranceTravail: state.inscritFranceTravail,
    statutDirigeant: state.statutDirigeant,
    microEntrepreneur: state.microEntrepreneur,
    certification: state.certificationLevel,
    niveauFormationVise: state.niveauFormationVise,
    eligibleCpf: state.eligibleCpf,
    dureeHeures: state.durationHours,
    coutPedagogique: state.pedagogyCostTotal,
    coutFraisAnnexes: Math.round((hebergement + repas) * 100) / 100,
    qualiopi: state.organismeQualiopi,
    soldeCpf: state.soldeCpf,
  };
}

/** « MM/AAAA » → « AAAA-MM » (null si invalide). */
export function moisDepuisSaisie(texte: string): string | null {
  const m = /^(\d{1,2})\/(\d{4})$/.exec(texte.trim());
  if (!m) return null;
  const mois = Number(m[1]);
  if (mois < 1 || mois > 12) return null;
  return `${m[2]}-${String(mois).padStart(2, '0')}`;
}

/** « AAAA-MM » → « MM/AAAA ». */
export function saisieDepuisMois(mois: string | null): string {
  if (!mois) return '';
  const [annee, m] = mois.split('-');
  return `${m}/${annee}`;
}

/** Date utilisée pour vérifier la validité des aides : début de formation s'il est futur, sinon aujourd'hui. */
export function dateDeReference(debutFormation: string | null, aujourdhui: string): string {
  if (!debutFormation) return aujourdhui;
  const debut = `${debutFormation}-01`;
  return debut > aujourdhui ? debut : aujourdhui;
}
```

- [ ] **Step 4 : Exporter** — `packages/core/src/index.ts` : ajouter `export * from './aides/profil';`

- [ ] **Step 5 : Vérifier** — Run : `cd packages/core && npx vitest run && npx tsc --noEmit` — Expected : PASS.

- [ ] **Step 6 : Commit**

```bash
git add packages/core/src/aides/profil.ts packages/core/src/index.ts packages/core/tests/aides-profil.test.ts
git commit -m "core : profil d'evaluation des aides depuis le parcours, utilitaires de dates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13 : Plan de financement

**Files:**
- Create: `packages/core/src/aides/plan.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/aides-plan.test.ts`

**Interfaces:**
- Consumes : `FundingResult` (calculator), `AideEvaluee`, `ProfilAides`.
- Produces : `LignePlan { id; nom; financeurNom; montant; confidence }`, `OptionPlan { id; nom; financeurNom; montantEstime: number | null; raison }`, `PlanFinancement { coutFormation; financements: LignePlan[]; totalFinance; resteACharge; aidesEmployeur; remunerations; avantagesFiscauxSociaux; options: OptionPlan[]; nonChiffrees: AideEvaluee[]; servicesGratuits: AideEvaluee[] }`, `construirePlan(opco: FundingResult | null, aides: AideEvaluee[], profil: ProfilAides): PlanFinancement`.

- [ ] **Step 1 : Écrire les tests qui échouent** — `packages/core/tests/aides-plan.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { construirePlan } from '../src/aides/plan';
import { evaluerAide } from '../src/aides/evaluer';
import { calculateFunding } from '../src/calculator';
import type { Aide } from '../src/aides/types';
import { makeAide, makeProfil } from './fixtures-aides';
import { makeFormationState, makeOpco } from './fixtures';

const AUJOURDHUI = '2026-10-05';
const profil = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0 });
const evaluer = (aides: Aide[]) => aides.map((a) => evaluerAide(a, profil, AUJOURDHUI));
const forfait = (id: string, financeur: Aide['financeur'], valeur: number, over: Partial<Aide> = {}) =>
  makeAide({ id, financeur, montant: { ...makeAide().montant, valeur }, ...over });

describe('construirePlan — empilement', () => {
  it('empile dans l’ordre des financeurs et plafonne au coût', () => {
    const aides = evaluer([
      forfait('nat-cpf', 'cpf', 1500),
      forfait('r11-region', 'region', 1000),
      forfait('nat-etat', 'etat', 3000),
    ]);
    const plan = construirePlan(null, aides, profil);
    // Région (20) 1000, État (50) 3000 → 4000 ; CPF (90) plafonné au reste 200
    expect(plan.financements.map((l) => [l.id, l.montant])).toEqual([
      ['r11-region', 1000],
      ['nat-etat', 3000],
      ['nat-cpf', 200],
    ]);
    expect(plan.totalFinance).toBe(4200);
    expect(plan.resteACharge).toBe(0);
  });

  it('ne dépasse jamais le coût et le reste à charge n’est jamais négatif', () => {
    const plan = construirePlan(null, evaluer([forfait('nat-a', 'etat', 9000)]), profil);
    expect(plan.totalFinance).toBe(4200);
    expect(plan.resteACharge).toBe(0);
  });

  it('ne compte pas les aides à vérifier', () => {
    const plan = construirePlan(null, evaluer([forfait('nat-a', 'etat', 1000, { statut: 'a_confirmer' })]), profil);
    expect(plan.financements).toEqual([]);
    expect(plan.resteACharge).toBe(4200);
  });
});

describe('construirePlan — alternatives et catégories', () => {
  it('garde l’alternative la mieux chiffrée, l’autre devient une option', () => {
    const aides = evaluer([
      forfait('nat-a', 'etat', 1000, { cumul: { cumulable: true, alternatives: ['nat-b'] } }),
      forfait('nat-b', 'etat', 2500, { cumul: { cumulable: true, alternatives: ['nat-a'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.financements.map((l) => l.id)).toEqual(['nat-b']);
    expect(plan.options).toEqual([expect.objectContaining({ id: 'nat-a', raison: expect.stringContaining('Au choix') })]);
  });

  it('sépare aides à l’employeur, rémunérations, avantages, non chiffrées et services', () => {
    const aides = evaluer([
      forfait('nat-embauche', 'etat', 5000, { categorie: 'aide_employeur' }),
      forfait('nat-remu', 'france_travail', 900, { categorie: 'remuneration_beneficiaire' }),
      forfait('fis-credit', 'fiscal', 475, { categorie: 'avantage_fiscal_social' }),
      makeAide({ id: 'nat-flou', montant: { ...makeAide().montant, mode: 'non_chiffre', valeur: null } }),
      makeAide({ id: 'nat-cep', categorie: 'service_gratuit', montant: { ...makeAide().montant, mode: 'non_chiffre', valeur: null } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.aidesEmployeur.map((l) => l.id)).toEqual(['nat-embauche']);
    expect(plan.remunerations.map((l) => l.id)).toEqual(['nat-remu']);
    expect(plan.avantagesFiscauxSociaux.map((l) => l.id)).toEqual(['fis-credit']);
    expect(plan.nonChiffrees.map((a) => a.id)).toEqual(['nat-flou']);
    expect(plan.servicesGratuits.map((a) => a.id)).toEqual(['nat-cep']);
    expect(plan.totalFinance).toBe(0);
  });

  it('une aide non cumulable est présentée en option', () => {
    const plan = construirePlan(null, evaluer([forfait('nat-seule', 'etat', 800, { cumul: { cumulable: false } })]), profil);
    expect(plan.financements).toEqual([]);
    expect(plan.options[0].id).toBe('nat-seule');
  });
});

describe('construirePlan — intégration du calcul OPCO', () => {
  it('pédagogie dans le financement, salaires côté employeur, dispositif alternatif en option', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      dispositifs_complementaires: [
        {
          id: 'catalogue', nom: 'Catalogue', cumul: 'alternatif', montant_max: null, unite: null, pourcentage_couts: 100,
          description: 'd', conditions: [], demarches: 'm', tailles_eligibles: null, publics: null, confidence: 'exact', source_url: 'x',
        },
      ],
    });
    const funding = calculateFunding(opco, makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30, pedagogyCostTotal: 3000 }));
    const plan = construirePlan(funding, [], makeProfil({ coutPedagogique: 3000, coutFraisAnnexes: 0 }));
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'opco-pdc', montant: 3000 })]);
    expect(plan.aidesEmployeur).toEqual([expect.objectContaining({ id: 'opco-salaires', montant: 1200 })]);
    expect(plan.options).toEqual([expect.objectContaining({ id: 'opco-catalogue' })]);
    expect(plan.resteACharge).toBe(0);
  });
});
```

- [ ] **Step 2 : Vérifier l'échec** — Run : `cd packages/core && npx vitest run tests/aides-plan.test.ts` — Expected : FAIL.

- [ ] **Step 3 : Créer `packages/core/src/aides/plan.ts`**

```ts
// ============================================================
// Plan de financement : empile les financements cumulables de la
// formation dans un ordre défini, chacun plafonné au reste à charge
// (le total ne dépasse jamais le coût). Les aides à l'employeur, les
// rémunérations et les avantages fiscaux/sociaux sont présentés à part.
// ============================================================

import type { Confidence, FundingResult, PosteFinancement } from '../types';
import type { AideEvaluee, ProfilAides } from './types';

export interface LignePlan {
  id: string;
  nom: string;
  financeurNom: string;
  montant: number;
  confidence: Confidence;
}

export interface OptionPlan {
  id: string;
  nom: string;
  financeurNom: string;
  montantEstime: number | null;
  raison: string;
}

export interface PlanFinancement {
  /** Coût pédagogique + frais annexes saisis. */
  coutFormation: number;
  financements: LignePlan[];
  totalFinance: number;
  resteACharge: number;
  aidesEmployeur: LignePlan[];
  remunerations: LignePlan[];
  avantagesFiscauxSociaux: LignePlan[];
  options: OptionPlan[];
  nonChiffrees: AideEvaluee[];
  servicesGratuits: AideEvaluee[];
}

const arrondi = (n: number): number => Math.round(n * 100) / 100;
const POSTES_FORMATION: PosteFinancement[] = ['pedagogie', 'hebergement', 'restauration', 'frais_annexes'];

function confianceOpco(r: FundingResult): Confidence {
  const lignes = r.lines.filter((l) => l.fundedAmount > 0);
  if (lignes.some((l) => l.confidence === 'depends_on_branche')) return 'depends_on_branche';
  if (lignes.some((l) => l.confidence === 'estimated')) return 'estimated';
  return 'exact';
}

interface Candidat extends LignePlan {
  ordre: number;
}

export function construirePlan(opco: FundingResult | null, aides: AideEvaluee[], profil: ProfilAides): PlanFinancement {
  const coutFormation = arrondi((profil.coutPedagogique ?? 0) + profil.coutFraisAnnexes);
  const candidats: Candidat[] = [];
  const aidesEmployeur: LignePlan[] = [];
  const remunerations: LignePlan[] = [];
  const avantagesFiscauxSociaux: LignePlan[] = [];
  const options: OptionPlan[] = [];
  const nonChiffrees: AideEvaluee[] = [];
  const servicesGratuits: AideEvaluee[] = [];

  // 1. OPCO : plan de développement des compétences et dispositifs complémentaires
  if (opco) {
    const formation = opco.lines
      .filter((l) => POSTES_FORMATION.includes(l.poste))
      .reduce((s, l) => s + l.fundedAmount, 0);
    if (formation > 0) {
      candidats.push({
        ordre: 10,
        id: 'opco-pdc',
        nom: 'Plan de développement des compétences',
        financeurNom: opco.opcoName,
        montant: arrondi(formation),
        confidence: confianceOpco(opco),
      });
    }
    const salaires = opco.lines.find((l) => l.poste === 'salaires');
    if (salaires && salaires.fundedAmount > 0) {
      aidesEmployeur.push({
        id: 'opco-salaires',
        nom: 'Prise en charge des salaires pendant la formation',
        financeurNom: opco.opcoName,
        montant: salaires.fundedAmount,
        confidence: salaires.confidence,
      });
    }
    const transport = opco.lines.find((l) => l.poste === 'transport');
    if (transport && transport.fundedAmount > 0) {
      aidesEmployeur.push({
        id: 'opco-transport',
        nom: 'Forfait de frais de transport',
        financeurNom: opco.opcoName,
        montant: transport.fundedAmount,
        confidence: transport.confidence,
      });
    }
    for (const d of opco.dispositifsComplementaires) {
      if (d.cumul === 'alternatif') {
        options.push({
          id: `opco-${d.id}`,
          nom: d.nom,
          financeurNom: opco.opcoName,
          montantEstime: d.montantEstime,
          raison: 'Alternative au plan de développement des compétences (non cumulable)',
        });
      } else if (d.montantEstime != null && d.montantEstime > 0) {
        candidats.push({ ordre: 12, id: `opco-${d.id}`, nom: d.nom, financeurNom: opco.opcoName, montant: d.montantEstime, confidence: d.confidence });
      }
    }
  }

  // 2. Aides éligibles du catalogue (les aides « à vérifier » ne sont jamais comptées)
  const eligibles = aides.filter((a) => a.statut === 'eligible');
  const ecartees = new Set<string>();
  for (const a of eligibles) {
    for (const idAlternative of a.alternatives) {
      const b = eligibles.find((x) => x.id === idAlternative);
      if (!b || ecartees.has(a.id) || ecartees.has(b.id)) continue;
      const aGagne = (a.montantEstime ?? -1) >= (b.montantEstime ?? -1);
      const gagnant = aGagne ? a : b;
      const perdant = aGagne ? b : a;
      ecartees.add(perdant.id);
      options.push({
        id: perdant.id,
        nom: perdant.nom,
        financeurNom: perdant.financeurNom,
        montantEstime: perdant.montantEstime,
        raison: `Au choix avec « ${gagnant.nom} »`,
      });
    }
  }

  for (const a of eligibles) {
    if (ecartees.has(a.id)) continue;
    if (a.categorie === 'service_gratuit') {
      servicesGratuits.push(a);
      continue;
    }
    if (a.montantEstime == null) {
      nonChiffrees.push(a);
      continue;
    }
    const ligne: LignePlan = { id: a.id, nom: a.nom, financeurNom: a.financeurNom, montant: a.montantEstime, confidence: a.confidence };
    switch (a.categorie) {
      case 'cout_formation':
        if (a.cumulable) candidats.push({ ...ligne, ordre: a.ordreEmpilement });
        else {
          options.push({
            id: a.id,
            nom: a.nom,
            financeurNom: a.financeurNom,
            montantEstime: a.montantEstime,
            raison: 'Non cumulable avec les autres financements : à comparer',
          });
        }
        break;
      case 'aide_employeur':
        aidesEmployeur.push(ligne);
        break;
      case 'remuneration_beneficiaire':
        remunerations.push(ligne);
        break;
      case 'avantage_fiscal_social':
        avantagesFiscauxSociaux.push(ligne);
        break;
    }
  }

  // 3. Empilement plafonné au reste à charge
  candidats.sort((x, y) => x.ordre - y.ordre || y.montant - x.montant);
  const financements: LignePlan[] = [];
  let reste = coutFormation;
  for (const c of candidats) {
    if (reste <= 0) break;
    const montant = arrondi(Math.min(c.montant, reste));
    if (montant <= 0) continue;
    financements.push({ id: c.id, nom: c.nom, financeurNom: c.financeurNom, montant, confidence: c.confidence });
    reste = arrondi(reste - montant);
  }
  const resteACharge = Math.max(0, reste);

  return {
    coutFormation,
    financements,
    totalFinance: arrondi(coutFormation - resteACharge),
    resteACharge,
    aidesEmployeur,
    remunerations,
    avantagesFiscauxSociaux,
    options,
    nonChiffrees,
    servicesGratuits,
  };
}
```

- [ ] **Step 4 : Exporter** — `packages/core/src/index.ts` : ajouter `export * from './aides/plan';`

- [ ] **Step 5 : Vérifier** — Run : `cd packages/core && npx vitest run && npx tsc --noEmit` — Expected : PASS.

- [ ] **Step 6 : Commit**

```bash
git add packages/core/src/aides/plan.ts packages/core/src/index.ts packages/core/tests/aides-plan.test.ts
git commit -m "core : plan de financement (empilement ordonne plafonne au cout, alternatives, categories separees)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14 : App — parcours en 6 étapes

**Files:**
- Modify: `packages/core/src/types.ts` (étapes ; retrait de `isReconversion`, `isSortieChomage`)
- Create: `apps/mobile/src/components/wizard/StepProjet.tsx`
- Modify (réécriture complète) : `apps/mobile/src/components/wizard/StepSituation.tsx`, `StepFormation.tsx`, `StepRecap.tsx`
- Modify: `apps/mobile/src/hooks/useWizard.ts`, `apps/mobile/src/components/wizard/WizardContainer.tsx`, `apps/mobile/src/components/ui/ProgressBar.tsx`

**Interfaces:**
- Consumes : `PROJET_LABELS`, `STATUT_PAR_PROJET`, labels de la tâche 1 ; `moisDepuisSaisie`, `saisieDepuisMois` (tâche 12) ; `OuiNonChoix`, `RegionPicker` (tâche 7).
- Produces : `WizardStep` inclut `'projet'` ; 6 étapes.

- [ ] **Step 1 : Étapes dans `packages/core/src/types.ts`**

Remplacer `WizardStep` et `WIZARD_STEPS` par :

```ts
export type WizardStep = 'projet' | 'identification' | 'situation' | 'formation' | 'frais' | 'recap';

export const WIZARD_STEPS: { key: WizardStep; label: string; icon: string }[] = [
  { key: 'projet', label: 'Projet', icon: '1' },
  { key: 'identification', label: 'Entreprise', icon: '2' },
  { key: 'situation', label: 'Bénéficiaire', icon: '3' },
  { key: 'formation', label: 'Formation', icon: '4' },
  { key: 'frais', label: 'Frais', icon: '5' },
  { key: 'recap', label: 'Récap', icon: '6' },
];
```

Supprimer `isReconversion` et `isSortieChomage` de `WizardState` et de `createInitialWizardState`.
Run : `cd packages/core && npx vitest run && npx tsc --noEmit` — Expected : PASS.

- [ ] **Step 2 : Créer `apps/mobile/src/components/wizard/StepProjet.tsx`**

```tsx
// Étape 0 — Projet : oriente les questions posées et les aides recherchées.

import { Text, View } from 'react-native';
import { PROJET_LABELS, type ProjetType, type WizardState } from '@opco/core';
import { ChoiceButton } from '@/components/ui/forms';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

const PROJETS = Object.entries(PROJET_LABELS) as [ProjetType, { label: string; description: string }][];

export function StepProjet({ state, updateState }: Props) {
  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">Votre projet</Text>
        <Text className="text-sm text-gray-600">
          Choisissez votre situation : l'app recherche toutes les aides et tous les financements qui peuvent s'y appliquer.
        </Text>
      </View>
      <View className="gap-2">
        {PROJETS.map(([key, { label, description }]) => (
          <ChoiceButton key={key} label={label} sublabel={description} selected={state.projetType === key} onPress={() => updateState({ projetType: key })} />
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 3 : Réécrire `apps/mobile/src/components/wizard/StepSituation.tsx`**

```tsx
// Étape 2 — Bénéficiaire : questions adaptées au projet (salarié, demandeur
// d'emploi, alternant, dirigeant). Elles servent à vérifier l'éligibilité aux aides.

import { Text, View } from 'react-native';
import {
  CONTRACT_TYPE_LABELS,
  NIVEAU_DIPLOME_LABELS,
  REGIONS,
  STATUT_DIRIGEANT_LABELS,
  STATUT_PAR_PROJET,
  TYPE_ALTERNANCE_LABELS,
  type ContractType,
  type NiveauDiplome,
  type StatutBeneficiaire,
  type StatutDirigeant,
  type TypeAlternance,
  type WizardState,
} from '@opco/core';
import { CheckboxRow, ChoiceButton, FieldLabel, NumberField, OuiNonChoix, RegionPicker } from '@/components/ui/forms';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

const TITRES: Record<StatutBeneficiaire, { titre: string; intro: string }> = {
  salarie: { titre: 'Le salarié concerné', intro: "Ces informations déterminent les aides ouvertes au salarié et à l'entreprise." },
  demandeur_emploi: { titre: 'La personne à recruter', intro: "Les aides au recrutement dépendent de la situation du demandeur d'emploi." },
  alternant: { titre: "L'alternant", intro: "Le type de contrat et l'âge conditionnent la plupart des aides à l'alternance." },
  dirigeant: { titre: 'Le dirigeant', intro: 'Le statut du dirigeant détermine son fonds de formation et ses avantages fiscaux.' },
};

const CONTRATS_SALARIE = (Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).filter(([k]) => k !== 'alternance');

export function StepSituation({ state, updateState }: Props) {
  const statut = STATUT_PAR_PROJET[state.projetType ?? 'formation_salarie'];
  const reconversion = state.projetType === 'reconversion_salarie';
  const { titre, intro } = TITRES[statut];

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">{titre}</Text>
        <Text className="text-sm text-gray-600">{intro}</Text>
      </View>

      {statut === 'salarie' && (
        <>
          <View className="gap-2">
            <FieldLabel label="Type de contrat" required />
            <View className="flex-row flex-wrap gap-2">
              {CONTRATS_SALARIE.map(([key, label]) => (
                <View key={key} className="w-[48%]">
                  <ChoiceButton label={label} selected={state.contractType === key} onPress={() => updateState({ contractType: key })} />
                </View>
              ))}
            </View>
          </View>
          <NumberField
            label="Ancienneté dans l'entreprise (en mois)"
            required={reconversion}
            value={state.anciennete_mois}
            onChangeNumber={(v) => updateState({ anciennete_mois: v })}
            placeholder="Ex : 24"
          />
        </>
      )}

      {statut === 'demandeur_emploi' && (
        <>
          <OuiNonChoix label="Inscrit(e) à France Travail" required value={state.inscritFranceTravail} onChange={(v) => updateState({ inscritFranceTravail: v })} />
          <View className="gap-2">
            <FieldLabel label="Région de résidence" />
            <Text className="text-xs text-gray-500">
              Par défaut, celle de l'entreprise{state.regionCode ? ` (${REGIONS[state.regionCode]})` : ''}.
            </Text>
            <RegionPicker selected={state.regionBeneficiaireCode ?? state.regionCode} onSelect={(code) => updateState({ regionBeneficiaireCode: code })} />
          </View>
        </>
      )}

      {statut === 'alternant' && (
        <>
          <View className="gap-2">
            <FieldLabel label="Type de contrat" required />
            <View className="flex-row gap-2">
              {(Object.entries(TYPE_ALTERNANCE_LABELS) as [TypeAlternance, string][]).map(([key, label]) => (
                <View key={key} className="flex-1">
                  <ChoiceButton label={label} selected={state.typeAlternance === key} onPress={() => updateState({ typeAlternance: key, contractType: 'alternance' })} />
                </View>
              ))}
            </View>
          </View>
          <OuiNonChoix label="Actuellement inscrit(e) à France Travail" value={state.inscritFranceTravail} onChange={(v) => updateState({ inscritFranceTravail: v })} avecInconnu />
        </>
      )}

      {statut === 'dirigeant' && (
        <>
          <View className="gap-2">
            <FieldLabel label="Statut du dirigeant" required />
            {(Object.entries(STATUT_DIRIGEANT_LABELS) as [StatutDirigeant, string][]).map(([key, label]) => (
              <ChoiceButton key={key} label={label} compact selected={state.statutDirigeant === key} onPress={() => updateState({ statutDirigeant: key })} />
            ))}
          </View>
          <OuiNonChoix label="Micro-entrepreneur" value={state.microEntrepreneur} onChange={(v) => updateState({ microEntrepreneur: v })} avecInconnu />
        </>
      )}

      <NumberField
        label="Âge du bénéficiaire"
        required={statut === 'alternant'}
        value={state.ageBeneficiaire}
        onChangeNumber={(v) => updateState({ ageBeneficiaire: v })}
        placeholder="Ex : 32"
      />

      <View className="gap-2">
        <FieldLabel label="Diplôme le plus élevé" />
        <View className="flex-row flex-wrap gap-2">
          {(Object.entries(NIVEAU_DIPLOME_LABELS) as [NiveauDiplome, string][]).map(([key, label]) => (
            <View key={key} className="w-[48%]">
              <ChoiceButton label={label} compact selected={state.niveauDiplome === key} onPress={() => updateState({ niveauDiplome: key })} />
            </View>
          ))}
        </View>
      </View>

      <CheckboxRow
        label="Reconnaissance de travailleur handicapé (RQTH ou équivalent)"
        description="Ouvre droit à des aides spécifiques (Agefiph, CPF majoré…)"
        checked={state.isHandicap}
        onToggle={(next) => updateState({ isHandicap: next })}
      />

      {(statut === 'salarie' || statut === 'dirigeant') && (
        <NumberField
          label="Solde CPF du bénéficiaire (€, facultatif)"
          decimal
          value={state.soldeCpf}
          onChangeNumber={(v) => updateState({ soldeCpf: v })}
          placeholder="Ex : 1800"
          helper="Consultable sur moncompteformation.gouv.fr. Sans solde, le CPF est indiqué sans montant."
        />
      )}
    </View>
  );
}
```

- [ ] **Step 4 : Réécrire `apps/mobile/src/components/wizard/StepFormation.tsx`**

```tsx
// Étape 3 — Formation souhaitée.

import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  CERTIFICATION_LABELS,
  NIVEAU_CERTIFICATION_LABELS,
  TRAINING_MODE_LABELS,
  TRAINING_TYPE_LABELS,
  moisDepuisSaisie,
  saisieDepuisMois,
  type CertificationType,
  type NiveauCertification,
  type OpcoData,
  type TrainingMode,
  type TrainingType,
  type WizardState,
} from '@opco/core';
import { ChoiceButton, NumberField, OuiNonChoix, TextField } from '@/components/ui/forms';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  updateFormationCosts: (total: number | null, hours: number | null) => void;
  getOpcoBySlug: (slug: string) => OpcoData | undefined;
}

const CERTIFICATIONS = Object.entries(CERTIFICATION_LABELS) as [CertificationType, string][];
const NIVEAUX = (Object.entries(NIVEAU_CERTIFICATION_LABELS) as [string, string][]).map(([k, label]) => ({
  niveau: Number(k) as NiveauCertification,
  label,
}));

export function StepFormation({ state, updateState, updateFormationCosts, getOpcoBySlug }: Props) {
  const [moisSaisi, setMoisSaisi] = useState(saisieDepuisMois(state.dateDebutFormation));
  const opcoSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = opcoSlug ? getOpcoBySlug(opcoSlug) : null;

  const ceilingWarning = (() => {
    if (!opco || !state.pedagogyCostPerHour) return null;
    const ceiling = opco.cout_horaire_inter?.value || opco.cout_horaire_metier?.value;
    if (ceiling && state.pedagogyCostPerHour > ceiling) {
      return `Le coût horaire (${state.pedagogyCostPerHour} €/h) dépasse le plafond ${opco.name} (${ceiling} €/h). Le surplus sera à votre charge.`;
    }
    return null;
  })();

  const saisirMois = (texte: string) => {
    setMoisSaisi(texte);
    updateState({ dateDebutFormation: moisDepuisSaisie(texte) });
  };

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">Formation souhaitée</Text>
        <Text className="text-sm text-gray-600">Décrivez la formation pour laquelle vous cherchez un financement.</Text>
      </View>

      <TextField label="Nom de la formation" value={state.formationNom || ''} onChangeText={(text) => updateState({ formationNom: text || null })} placeholder="Ex : Développeur web full stack" />

      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">Type de formation</Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.entries(TRAINING_TYPE_LABELS) as [TrainingType, string][]).map(([key, label]) => (
            <View key={key} className="w-[48%]">
              <ChoiceButton label={label} selected={state.formationType === key} onPress={() => updateState({ formationType: key })} />
            </View>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">Certification visée</Text>
        <View className="gap-2">
          <ChoiceButton label="Ne sait pas" compact selected={state.certificationLevel === null} onPress={() => updateState({ certificationLevel: null })} />
          {CERTIFICATIONS.map(([value, label]) => (
            <ChoiceButton key={value} label={label} compact selected={state.certificationLevel === value} onPress={() => updateState({ certificationLevel: value })} />
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">Niveau de la certification visée</Text>
        <View className="flex-row flex-wrap gap-2">
          {NIVEAUX.map(({ niveau, label }) => (
            <View key={niveau} className="w-[48%]">
              <ChoiceButton label={label} compact selected={state.niveauFormationVise === niveau} onPress={() => updateState({ niveauFormationVise: niveau })} />
            </View>
          ))}
          <View className="w-[48%]">
            <ChoiceButton label="Ne sait pas" compact selected={state.niveauFormationVise === null} onPress={() => updateState({ niveauFormationVise: null })} />
          </View>
        </View>
      </View>

      <OuiNonChoix label="Formation éligible au CPF" value={state.eligibleCpf} onChange={(v) => updateState({ eligibleCpf: v })} avecInconnu />

      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">
          Mode de formation <Text className="text-red-500">*</Text>
        </Text>
        <View className="flex-row gap-2">
          {(Object.entries(TRAINING_MODE_LABELS) as [TrainingMode, string][]).map(([key, label]) => (
            <View key={key} className="flex-1">
              <ChoiceButton label={label} center selected={state.trainingMode === key} onPress={() => updateState({ trainingMode: key })} />
            </View>
          ))}
        </View>
      </View>

      <View className="flex-row gap-4">
        <View className="flex-1">
          <NumberField label="Durée (en heures)" required value={state.durationHours} onChangeNumber={(h) => updateFormationCosts(state.pedagogyCostTotal, h)} placeholder="Ex : 140" />
        </View>
        <View className="flex-1">
          <NumberField label="Coût total HT (€)" required decimal value={state.pedagogyCostTotal} onChangeNumber={(t) => updateFormationCosts(t, state.durationHours)} placeholder="Ex : 5600" />
        </View>
      </View>

      {state.pedagogyCostPerHour != null && state.pedagogyCostPerHour > 0 && (
        <View className={`rounded-lg px-4 py-2 ${ceilingWarning ? 'bg-orange-50' : 'bg-gray-50'}`}>
          <Text className={`text-sm ${ceilingWarning ? 'text-orange-800' : 'text-gray-600'}`}>
            Coût horaire calculé : <Text className="font-semibold">{state.pedagogyCostPerHour} €/h</Text>
          </Text>
          {ceilingWarning ? <Text className="mt-1 text-xs text-orange-700">{ceilingWarning}</Text> : null}
        </View>
      )}

      <TextField
        label="Mois de début prévu (MM/AAAA)"
        value={moisSaisi}
        onChangeText={saisirMois}
        placeholder="Ex : 03/2027"
        helper={moisSaisi && !state.dateDebutFormation ? 'Format attendu : MM/AAAA' : 'Facultatif : sert à vérifier les dates de validité des aides.'}
      />

      <OuiNonChoix label="Organisme de formation certifié Qualiopi" value={state.organismeQualiopi} onChange={(v) => updateState({ organismeQualiopi: v })} avecInconnu />

      <TextField label="Organisme de formation (optionnel)" value={state.organismeFormation || ''} onChangeText={(text) => updateState({ organismeFormation: text || null })} placeholder="Ex : AFPA, CNAM, organisme privé..." />
    </View>
  );
}
```

- [ ] **Step 5 : Réécrire `apps/mobile/src/components/wizard/StepRecap.tsx`**

```tsx
// Étape 6 — Récapitulatif avant calcul.

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  CERTIFICATION_LABELS,
  COMPANY_SIZE_LABELS,
  CONTRACT_TYPE_LABELS,
  NIVEAU_CERTIFICATION_LABELS,
  NIVEAU_DIPLOME_LABELS,
  PROJET_LABELS,
  REGIONS,
  STATUT_DIRIGEANT_LABELS,
  TRAINING_MODE_LABELS,
  TRAINING_TYPE_LABELS,
  TYPE_ALTERNANCE_LABELS,
  resolveVarianteBranche,
  saisieDepuisMois,
  type OpcoData,
  type WizardState,
  type WizardStep,
} from '@opco/core';

interface Props {
  state: WizardState;
  onEdit: (step: WizardStep) => void;
  opcoList: { slug: string; name: string; secteurs: string }[];
  getOpcoBySlug: (slug: string) => OpcoData | undefined;
}

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <View className="rounded-lg border border-gray-200 bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-medium text-gray-900">{title}</Text>
        <Pressable onPress={onEdit} accessibilityRole="button">
          <Text className="text-sm font-medium text-blue-600">Modifier</Text>
        </Pressable>
      </View>
      <View className="gap-2">{children}</View>
    </View>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-gray-900">{value || '—'}</Text>
    </View>
  );
}

const ouiNon = (v: boolean | null) => (v == null ? null : v ? 'Oui' : 'Non');

export function StepRecap({ state, onEdit, opcoList, getOpcoBySlug }: Props) {
  const opcoSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = opcoSlug ? opcoList.find((o) => o.slug === opcoSlug) : null;
  const opcoData = opcoSlug ? getOpcoBySlug(opcoSlug) : undefined;
  const hasVariantes = (opcoData?.variantes_branche?.length ?? 0) > 0;
  const variante = opcoData ? resolveVarianteBranche(opcoData, state) : null;

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">Récapitulatif</Text>
        <Text className="text-sm text-gray-600">Vérifiez vos informations avant de lancer la recherche de financements.</Text>
      </View>

      <Section title="Projet" onEdit={() => onEdit('projet')}>
        <Item label="Projet" value={state.projetType ? PROJET_LABELS[state.projetType].label : null} />
      </Section>

      <Section title="Entreprise" onEdit={() => onEdit('identification')}>
        {state.detectedCompanyName ? <Item label="Entreprise" value={`${state.detectedCompanyName} (${state.sirenNumber})`} /> : null}
        <Item label="OPCO" value={opco?.name} />
        {hasVariantes ? <Item label="Branche" value={variante?.branche_nom ?? 'Barème général'} /> : null}
        <Item label="Région" value={state.regionCode ? REGIONS[state.regionCode] : null} />
        <Item label="Taille" value={state.companySize ? COMPANY_SIZE_LABELS[state.companySize] : null} />
        {state.effectif != null ? <Item label="Effectif" value={`${state.effectif} salariés`} /> : null}
        {state.budgetDejaConsomme ? <Item label="Budget déjà consommé" value={`${state.budgetDejaConsomme} €`} /> : null}
      </Section>

      <Section title="Bénéficiaire" onEdit={() => onEdit('situation')}>
        {state.contractType && state.projetType !== 'alternance' ? <Item label="Contrat" value={CONTRACT_TYPE_LABELS[state.contractType]} /> : null}
        {state.typeAlternance ? <Item label="Alternance" value={TYPE_ALTERNANCE_LABELS[state.typeAlternance]} /> : null}
        {state.statutDirigeant ? <Item label="Statut" value={STATUT_DIRIGEANT_LABELS[state.statutDirigeant]} /> : null}
        {state.microEntrepreneur != null ? <Item label="Micro-entrepreneur" value={ouiNon(state.microEntrepreneur)} /> : null}
        {state.inscritFranceTravail != null ? <Item label="Inscrit à France Travail" value={ouiNon(state.inscritFranceTravail)} /> : null}
        {state.anciennete_mois != null ? <Item label="Ancienneté" value={`${state.anciennete_mois} mois`} /> : null}
        {state.ageBeneficiaire != null ? <Item label="Âge" value={`${state.ageBeneficiaire} ans`} /> : null}
        {state.niveauDiplome ? <Item label="Diplôme" value={NIVEAU_DIPLOME_LABELS[state.niveauDiplome]} /> : null}
        {state.isHandicap ? <Item label="RQTH" value="Oui" /> : null}
        {state.soldeCpf != null ? <Item label="Solde CPF" value={`${state.soldeCpf} €`} /> : null}
        {state.regionBeneficiaireCode ? <Item label="Région de résidence" value={REGIONS[state.regionBeneficiaireCode]} /> : null}
      </Section>

      <Section title="Formation" onEdit={() => onEdit('formation')}>
        <Item label="Formation" value={state.formationNom} />
        <Item label="Type" value={state.formationType ? TRAINING_TYPE_LABELS[state.formationType] : null} />
        <Item label="Certification" value={state.certificationLevel ? CERTIFICATION_LABELS[state.certificationLevel] : null} />
        <Item label="Niveau" value={state.niveauFormationVise ? NIVEAU_CERTIFICATION_LABELS[state.niveauFormationVise] : null} />
        <Item label="Éligible au CPF" value={ouiNon(state.eligibleCpf)} />
        <Item label="Mode" value={state.trainingMode ? TRAINING_MODE_LABELS[state.trainingMode] : null} />
        <Item label="Durée" value={state.durationHours ? `${state.durationHours} h` : null} />
        <Item label="Coût total" value={state.pedagogyCostTotal ? `${state.pedagogyCostTotal} €` : null} />
        <Item label="Coût/heure" value={state.pedagogyCostPerHour ? `${state.pedagogyCostPerHour} €/h` : null} />
        <Item label="Début" value={state.dateDebutFormation ? saisieDepuisMois(state.dateDebutFormation) : null} />
        <Item label="Organisme" value={state.organismeFormation} />
        <Item label="Qualiopi" value={ouiNon(state.organismeQualiopi)} />
      </Section>

      {(state.needsTransport || state.needsAccommodation || state.needsMeals) && (
        <Section title="Frais annexes" onEdit={() => onEdit('frais')}>
          {state.needsTransport ? <Item label="Transport" value={state.transportMode || 'Oui'} /> : null}
          {state.needsAccommodation ? <Item label="Hébergement" value={`${state.accommodationNights ?? 0} nuits à ${state.accommodationCostPerNight ?? 0} €`} /> : null}
          {state.needsMeals ? <Item label="Restauration" value={state.mealCostPerDay ? `${state.mealCostPerDay} €/jour` : 'Oui'} /> : null}
          <Item label="Jours de formation" value={state.trainingDays ? `${state.trainingDays} jours` : null} />
        </Section>
      )}
    </View>
  );
}
```

- [ ] **Step 6 : `apps/mobile/src/hooks/useWizard.ts`** — remplacer la fonction `canGoNext` par :

```ts
  const canGoNext = useCallback((): boolean => {
    const projet = state.projetType;
    switch (currentStep.key) {
      case 'projet':
        return projet != null;
      case 'identification': {
        const opcoOk = !!(state.selectedOpcoSlug || state.detectedOpcoSlug) || projet === 'formation_dirigeant';
        return opcoOk && state.regionCode != null && state.companySize != null;
      }
      case 'situation':
        switch (projet) {
          case 'formation_salarie':
            return state.contractType != null;
          case 'reconversion_salarie':
            return state.contractType != null && state.anciennete_mois != null;
          case 'recrutement_demandeur_emploi':
            return state.inscritFranceTravail != null;
          case 'alternance':
            return state.typeAlternance != null && state.ageBeneficiaire != null;
          case 'formation_dirigeant':
            return state.statutDirigeant != null;
          default:
            return false;
        }
      case 'formation':
        return !!(state.durationHours && state.pedagogyCostTotal && state.trainingMode);
      case 'frais':
      case 'recap':
        return true;
      default:
        return false;
    }
  }, [currentStep.key, state]);
```

- [ ] **Step 7 : Brancher l'étape Projet**

`WizardContainer.tsx` : importer `StepProjet` et ajouter, en tête du bloc des étapes :

```tsx
          {currentStep.key === 'projet' && <StepProjet state={state} updateState={updateState} />}
```

`ProgressBar.tsx` : remplacer le commentaire `(5 étapes)` par `(6 étapes)`.

- [ ] **Step 8 : Vérifier**

Run : `cd apps/mobile && npx tsc --noEmit` — Expected : aucune erreur.
Run : `grep -rn "isReconversion\|isSortieChomage" packages apps --include=*.ts --include=*.tsx | grep -v node_modules` — Expected : aucun résultat.
Run : `cd packages/core && npx vitest run` — Expected : PASS.

- [ ] **Step 9 : Commit**

```bash
git add -A packages/core/src/types.ts apps/mobile/src
git commit -m "app : parcours en 6 etapes (projet, entreprise, beneficiaire adapte au projet, formation enrichie)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15 : App — écran « Votre plan de financement »

**Files:**
- Create: `apps/mobile/src/lib/format.ts`, `apps/mobile/src/components/results/PlanFinancement.tsx`, `AideCard.tsx`, `AidesList.tsx`, `PortailsRegionaux.tsx`
- Modify: `apps/mobile/src/components/results/FundingBreakdown.tsx`, `apps/mobile/src/components/wizard/WizardContainer.tsx`, `apps/mobile/src/app/index.tsx`

**Interfaces:**
- Consumes : `calculateFunding`, `profilDepuisWizard`, `dateDeReference`, `evaluerAides`, `construirePlan`, `formaterDate`, `PlanFinancement`, `AideEvaluee`, `PortailRegional` ; `useActiveDataset` (tâche 6).
- Produces : `formatEuro(montant: number): string` ; composants `PlanFinancementCard({ plan })`, `AideCard({ aide })`, `AidesList({ aides })`, `PortailsRegionaux({ portail })`.

- [ ] **Step 1 : Créer `apps/mobile/src/lib/format.ts`**

```ts
// Formatage des montants pour l'affichage.

export function formatEuro(montant: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(montant);
}
```

- [ ] **Step 2 : Créer `apps/mobile/src/components/results/PlanFinancement.tsx`**

```tsx
// Synthèse « Votre plan de financement » : coût, financé, reste à charge,
// puis lignes empilées et aides présentées à part (jamais additionnées).

import { Text, View } from 'react-native';
import type { LignePlan, PlanFinancement } from '@opco/core';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { formatEuro } from '@/lib/format';

function Lignes({ titre, lignes, aide }: { titre: string; lignes: LignePlan[]; aide?: string }) {
  if (lignes.length === 0) return null;
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  return (
    <View className="rounded-xl border border-gray-200 bg-white p-5">
      <Text className="font-semibold text-gray-900">{titre}</Text>
      {aide ? <Text className="mt-0.5 text-xs text-gray-500">{aide}</Text> : null}
      <View className="mt-3 gap-3">
        {lignes.map((l) => (
          <View key={l.id} className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-sm font-medium text-gray-900">{l.nom}</Text>
              <Text className="text-xs text-gray-500">{l.financeurNom}</Text>
              <ConfidenceBadge confidence={l.confidence} />
            </View>
            <Text className="text-sm font-semibold text-green-700">{formatEuro(l.montant)}</Text>
          </View>
        ))}
      </View>
      {lignes.length > 1 ? <Text className="mt-3 text-right text-sm font-semibold text-gray-900">Total : {formatEuro(total)}</Text> : null}
    </View>
  );
}

function Noms({ titre, aide, noms }: { titre: string; aide: string; noms: string[] }) {
  if (noms.length === 0) return null;
  return (
    <View className="rounded-xl border border-gray-200 bg-white p-5">
      <Text className="font-semibold text-gray-900">{titre}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">{aide}</Text>
      <View className="mt-3 gap-1">
        {noms.map((n) => (
          <Text key={n} className="text-sm text-gray-700">• {n}</Text>
        ))}
      </View>
    </View>
  );
}

export function PlanFinancementCard({ plan }: { plan: PlanFinancement }) {
  return (
    <View className="gap-4">
      <View className="rounded-xl bg-blue-600 p-6">
        <Text className="text-sm font-medium text-blue-100">Votre plan de financement</Text>
        <View className="mt-3 flex-row justify-between gap-2">
          <View>
            <Text className="text-xs uppercase text-blue-200">Coût</Text>
            <Text className="text-lg font-semibold text-white">{formatEuro(plan.coutFormation)}</Text>
          </View>
          <View>
            <Text className="text-xs uppercase text-blue-200">Financé</Text>
            <Text className="text-lg font-semibold text-white">{formatEuro(plan.totalFinance)}</Text>
          </View>
          <View>
            <Text className="text-xs uppercase text-blue-200">Reste à charge</Text>
            <Text className="text-lg font-semibold text-white">{formatEuro(plan.resteACharge)}</Text>
          </View>
        </View>
        <Text className="mt-3 text-xs text-blue-100">
          Financements cumulables empilés sans jamais dépasser le coût de la formation. Les aides « à vérifier » ne sont pas comptées.
        </Text>
      </View>

      <Lignes titre="Financement de la formation" lignes={plan.financements} />

      {plan.options.length > 0 && (
        <View className="rounded-xl border border-purple-200 bg-purple-50 p-5">
          <Text className="font-semibold text-purple-900">Options au choix (non additionnées)</Text>
          <View className="mt-3 gap-3">
            {plan.options.map((o) => (
              <View key={o.id}>
                <Text className="text-sm font-medium text-purple-900">
                  {o.nom} — {o.montantEstime != null ? formatEuro(o.montantEstime) : 'montant selon dossier'}
                </Text>
                <Text className="text-xs text-purple-700">{o.financeurNom} · {o.raison}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Lignes
        titre="Aides versées à l'employeur"
        aide="Elles ne réduisent pas le prix de la formation mais le coût global du projet pour l'entreprise."
        lignes={plan.aidesEmployeur}
      />
      <Lignes titre="Rémunération du bénéficiaire pendant la formation" lignes={plan.remunerations} />
      <Lignes titre="Avantages fiscaux et sociaux" lignes={plan.avantagesFiscauxSociaux} />
      <Noms
        titre="Montant selon dossier"
        aide="Éligibles, mais le montant dépend de l'étude du dossier par le financeur."
        noms={plan.nonChiffrees.map((a) => `${a.nom} (${a.financeurNom})`)}
      />
      <Noms titre="Services gratuits" aide="Accompagnements sans coût pour vous." noms={plan.servicesGratuits.map((a) => `${a.nom} (${a.financeurNom})`)} />
    </View>
  );
}
```

- [ ] **Step 3 : Créer `apps/mobile/src/components/results/AideCard.tsx`**

```tsx
// Carte d'une aide évaluée : statut, montant, conditions, démarches, sources.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { formaterDate, type AideEvaluee, type StatutEligibilite } from '@opco/core';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { formatEuro } from '@/lib/format';

const STATUTS: Record<StatutEligibilite, { label: string; container: string; text: string }> = {
  eligible: { label: 'Éligible', container: 'bg-green-50 border-green-200', text: 'text-green-700' },
  a_verifier: { label: 'À vérifier', container: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800' },
  non_eligible: { label: 'Non éligible', container: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
};

function montantAffiche(aide: AideEvaluee): string {
  if (aide.montantEstime == null) return 'Montant selon dossier';
  if (aide.montantEstime === 0) return 'Coût déjà couvert par les autres financements';
  return `jusqu'à ${formatEuro(aide.montantEstime)}`;
}

export function AideCard({ aide }: { aide: AideEvaluee }) {
  const [ouvert, setOuvert] = useState(false);
  const statut = STATUTS[aide.statut];

  return (
    <View className="rounded-xl border border-gray-200 bg-white p-5">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="flex-1 font-semibold text-gray-900">{aide.nom}</Text>
        <View className={`self-start rounded-full border px-2 py-0.5 ${statut.container}`}>
          <Text className={`text-xs font-medium ${statut.text}`}>{statut.label}</Text>
        </View>
      </View>

      <Text className="mt-2 text-base font-bold text-green-700">{montantAffiche(aide)}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">{aide.libelleMontant}</Text>
      <Text className="mt-2 text-sm text-gray-600">{aide.description}</Text>

      {aide.statut === 'a_verifier' && aide.raisons.length > 0 ? (
        <View className="mt-3 gap-1 rounded-lg bg-yellow-50 p-3">
          {aide.raisons.map((r, i) => (
            <Text key={i} className="text-xs text-yellow-800">• {r}</Text>
          ))}
        </View>
      ) : null}

      {!aide.cumulable || aide.noteCumul ? (
        <Text className="mt-2 text-xs text-gray-500">{aide.noteCumul ?? 'Non cumulable avec les autres financements.'}</Text>
      ) : null}

      <Pressable onPress={() => setOuvert((v) => !v)} className="mt-3" accessibilityRole="button">
        <Text className="text-sm font-medium text-blue-600">{ouvert ? '▾ Masquer le détail' : '▸ Conditions et démarches'}</Text>
      </Pressable>

      {ouvert ? (
        <View className="mt-3 gap-3">
          {aide.conditions.length > 0 ? (
            <View>
              <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">Conditions</Text>
              {aide.conditions.map((c, i) => (
                <Text key={i} className="mb-1 text-sm text-gray-700">• {c}</Text>
              ))}
            </View>
          ) : null}
          <View>
            <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">Démarches</Text>
            {aide.demarches.map((d, i) => (
              <Text key={i} className="mb-1 text-sm text-gray-700">{i + 1}. {d}</Text>
            ))}
          </View>
          {aide.urlDemarche ? (
            <Pressable
              onPress={() => Linking.openURL(aide.urlDemarche!).catch(() => {})}
              className="self-start rounded-lg bg-blue-600 px-4 py-2 active:bg-blue-700"
              accessibilityRole="link"
            >
              <Text className="text-sm font-medium text-white">Faire la demande ↗</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        <ConfidenceBadge confidence={aide.confidence} />
        {aide.sources.map((s) => (
          <SourceBadge key={s.url} url={s.url} label={s.titre.length > 40 ? 'Source' : s.titre} />
        ))}
        <Text className="text-xs text-gray-400">Vérifié le {formaterDate(aide.derniereVerification)}</Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 4 : Créer `apps/mobile/src/components/results/AidesList.tsx`**

```tsx
// Liste des aides évaluées, regroupées par financeur. Les aides non éligibles
// en rapport avec la situation sont repliées ; celles hors périmètre (autre
// projet, autre public, autre région) ne sont pas affichées.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AideEvaluee } from '@opco/core';
import { AideCard } from './AideCard';

export function AidesList({ aides }: { aides: AideEvaluee[] }) {
  const [voirNonEligibles, setVoirNonEligibles] = useState(false);
  const visibles = aides.filter((a) => a.statut !== 'non_eligible');
  const nonEligibles = aides.filter((a) => a.statut === 'non_eligible' && !a.horsPerimetre);

  const groupes = new Map<string, AideEvaluee[]>();
  for (const a of visibles) groupes.set(a.financeurNom, [...(groupes.get(a.financeurNom) ?? []), a]);

  return (
    <View className="gap-4">
      <View>
        <Text className="font-semibold text-gray-900">Aides et financements identifiés ({visibles.length})</Text>
        <Text className="mt-0.5 text-xs text-gray-500">
          « À vérifier » : une information manque ou le financeur doit confirmer ; ces aides ne sont pas comptées dans le plan.
        </Text>
      </View>

      {visibles.length === 0 ? (
        <Text className="text-sm text-gray-600">Aucune autre aide identifiée pour cette situation : consultez les portails de votre région ci-dessous.</Text>
      ) : null}

      {[...groupes.entries()].map(([financeur, liste]) => (
        <View key={financeur} className="gap-3">
          <Text className="text-xs font-semibold uppercase text-gray-500">{financeur}</Text>
          {liste.map((a) => (
            <AideCard key={a.id} aide={a} />
          ))}
        </View>
      ))}

      {nonEligibles.length > 0 ? (
        <View className="rounded-xl border border-gray-200 bg-white p-4">
          <Pressable onPress={() => setVoirNonEligibles((v) => !v)} accessibilityRole="button">
            <Text className="text-sm font-medium text-blue-600">
              {voirNonEligibles ? '▾' : '▸'} Aides non éligibles pour cette situation ({nonEligibles.length})
            </Text>
          </Pressable>
          {voirNonEligibles ? (
            <View className="mt-3 gap-3">
              {nonEligibles.map((a) => (
                <View key={a.id}>
                  <Text className="text-sm font-medium text-gray-800">{a.nom}</Text>
                  {a.raisons.map((r, i) => (
                    <Text key={i} className="text-xs text-gray-500">• {r}</Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 5 : Créer `apps/mobile/src/components/results/PortailsRegionaux.tsx`**

```tsx
// « Pour aller plus loin » : portails officiels de la région.

import { Pressable, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import type { PortailRegional } from '@opco/core';

export function PortailsRegionaux({ portail }: { portail: PortailRegional }) {
  return (
    <View className="rounded-xl border border-gray-200 bg-white p-5">
      <Text className="font-semibold text-gray-900">Pour aller plus loin en {portail.nom_region}</Text>
      <Text className="mt-0.5 text-xs text-gray-500">
        Aides locales (département, commune, intercommunalité) et offre de formation : consultez ces portails officiels.
      </Text>
      <View className="mt-3 gap-2">
        {portail.liens.map((l) => (
          <Pressable
            key={l.url}
            onPress={() => Linking.openURL(l.url).catch(() => {})}
            className="flex-row items-center gap-3 rounded-lg border border-gray-200 p-3 active:bg-blue-50"
            accessibilityRole="link"
          >
            <Text className="text-blue-600">↗</Text>
            <Text className="flex-1 text-sm text-gray-700">{l.titre}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 6 : Ajuster `FundingBreakdown.tsx`**

- Supprimer la fonction locale `formatEuro` et ajouter `import { formatEuro } from '@/lib/format';`.
- Supprimer le bloc `{/* Enveloppe maximale potentielle */}` (la carte verte et son contenu) : l'information est désormais portée par le plan de financement.
- Dans l'avertissement légal final, n'afficher le lien « Contact » que si `result.opcoEmail` est non vide : entourer le `Pressable` de `{result.opcoEmail ? (…) : null}`.

- [ ] **Step 7 : Résultats dans `WizardContainer.tsx`**

7a. Imports : remplacer l'import `@opco/core` par :

```tsx
import {
  calculateFunding,
  construirePlan,
  dateDeReference,
  evaluerAides,
  profilDepuisWizard,
  type WizardState,
} from '@opco/core';
```

et ajouter :

```tsx
import { PlanFinancementCard } from '@/components/results/PlanFinancement';
import { AidesList } from '@/components/results/AidesList';
import { PortailsRegionaux } from '@/components/results/PortailsRegionaux';
```

7b. Le hook devient `const { loading, opcoList, getOpcoBySlug, generatedAt, idcc, naf, aides, portails } = useActiveDataset();`.

7c. Remplacer le calcul `const fundingResult: FundingResult | null = (() => { … })();` par :

```tsx
  // Résultats (dérivation pure, jamais de mutation d'état pendant le rendu)
  const resultats = (() => {
    if (!showResults) return null;
    const slug = getEffectiveOpcoSlug();
    const opco = slug ? getOpcoBySlug(slug) : undefined;
    const effectiveState: WizardState =
      !state.trainingDays && state.durationHours
        ? { ...state, trainingDays: Math.ceil(state.durationHours / 7) }
        : state;
    const projet = effectiveState.projetType ?? 'formation_salarie';
    const avecPdc = opco != null && (projet === 'formation_salarie' || projet === 'reconversion_salarie');
    const funding = avecPdc ? calculateFunding(opco, effectiveState) : null;
    const profil = profilDepuisWizard(effectiveState, slug);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const aidesEvaluees = evaluerAides(aides, profil, dateDeReference(effectiveState.dateDebutFormation, aujourdhui));
    const plan = construirePlan(funding, aidesEvaluees, profil);
    const portail = portails.find((p) => p.region === profil.regionEntreprise) ?? null;
    return { funding, aidesEvaluees, plan, portail };
  })();
```

7d. Remplacer la condition et le contenu de l'écran de résultats (`if (showResults && fundingResult) { … }`) par :

```tsx
  if (showResults && resultats) {
    return (
      <ScrollView
        className="flex-1 bg-gray-100"
        contentContainerClassName="p-4 gap-6"
        contentContainerStyle={{ paddingBottom: insets.bottom + 56 }}
      >
        <PlanFinancementCard plan={resultats.plan} />
        <AidesList aides={resultats.aidesEvaluees} />
        {resultats.funding ? (
          <View className="gap-3">
            <Text className="font-semibold text-gray-900">Détail de l'estimation OPCO</Text>
            <FundingBreakdown result={resultats.funding} />
          </View>
        ) : null}
        {resultats.portail ? <PortailsRegionaux portail={resultats.portail} /> : null}
        <View className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Text className="text-center text-xs text-gray-500">
            Estimation indicative fondée sur les règles publiées par chaque financeur : seul le financeur décide, après étude du dossier.
          </Text>
        </View>
        <View className="gap-3">
          <Pressable onPress={() => goToStep('recap')} className="items-center rounded-lg border border-gray-300 bg-white px-6 py-3 active:bg-gray-50">
            <Text className="text-sm font-medium text-gray-700">Modifier mes informations</Text>
          </Pressable>
          <Pressable onPress={reset} className="items-center rounded-lg bg-blue-600 px-6 py-3 active:bg-blue-700">
            <Text className="text-sm font-medium text-white">Nouvelle simulation</Text>
          </Pressable>
        </View>
        <Text className="text-center text-xs text-gray-400">Données à jour au {formatDateFr(generatedAt)}</Text>
      </ScrollView>
    );
  }
```

7e. Le bouton de l'étape récapitulatif devient « Trouver mes financements » (texte du `Pressable` qui appelle `calculate`).

- [ ] **Step 8 : Accueil `apps/mobile/src/app/index.tsx`**

- Récupérer `aides` du hook : `const { loading, opcos, aides, source, version, generatedAt, reload } = useActiveDataset();`.
- Titre du bandeau : `Trouvez tous les financements de votre formation`.
- Sous-titre : `OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe… : en 6 étapes, l'app identifie les aides mobilisables et estime votre reste à charge.`
- Bouton : `Démarrer`.
- Ligne d'état : `{opcos.length} OPCO · {aides.length} aides — version {version} — {source === 'cache' ? 'dataset téléchargé' : 'données embarquées'}`.
- Liste « Comment ça marche ? » :

```tsx
        {[
          'Choisissez votre projet (former, reconvertir, recruter, alternance, dirigeant)',
          'Identifiez votre entreprise : OPCO, région, taille',
          'Décrivez le bénéficiaire',
          'Renseignez la formation et ses frais',
          'Obtenez votre plan de financement : aides éligibles, montants, démarches, sources',
        ].map((step, i) => (
```

- Avertissement final : `Les résultats sont des estimations indicatives, pas un engagement des financeurs. L'app fonctionne hors ligne avec les données embarquées.`

- [ ] **Step 9 : Vérifier**

Run : `cd apps/mobile && npx tsc --noEmit` — Expected : aucune erreur.
Run : `cd apps/mobile && npx expo export --platform android --output-dir ../../.expo-export-check` puis supprimer `.expo-export-check` — Expected : export réussi.

- [ ] **Step 10 : Commit**

```bash
git add -A apps/mobile/src
git commit -m "app : ecran Votre plan de financement (aides par financeur, plan plafonne, portails regionaux)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Phase 3 — Catalogue d'aides

### Task 16 : Double vérification des recherches

**Dépendance :** fichiers `$RECHERCHE/nat-1-droits-reconversion.json`, `nat-2-recrutement-alternance.json`, `nat-3-handicap-ue-dirigeants.json`, `regions-1.json` … `regions-5.json` (agents de recherche, protocole `$RECHERCHE/PROTOCOLE.md`).

**Files:** produits hors dépôt : `$RECHERCHE/<fichier>.verifie.json` et `$RECHERCHE/verification-<fichier>.md` pour chacun des 8 fichiers.

- [ ] **Step 1 : Vérifier la présence et la validité JSON des 8 fichiers**

Run :

```bash
python -c "import json,glob,sys; sys.stdout.reconfigure(encoding='utf-8'); [print(f, len(json.load(open(f,encoding='utf-8'))['aides'])) for f in sorted(glob.glob(r'$RECHERCHE/nat-*.json')+glob.glob(r'$RECHERCHE/regions-*.json')) if not f.endswith('.verifie.json')]"
```

Expected : 8 lignes `<fichier> <nombre d'aides>`.

- [ ] **Step 2 : Lancer un agent de vérification indépendant par fichier** (agents `general-purpose`, en parallèle), avec ce prompt (remplacer `<FICHIER>`) :

```text
Tu es vérificateur indépendant. Lis d'abord le protocole : $RECHERCHE/PROTOCOLE.md (règles de sources et schéma).
Fichier à vérifier : $RECHERCHE/<FICHIER>.json. Date du jour : celle du système.
Pour CHAQUE aide :
1. Ouvre chaque URL de `sources` (WebFetch, sinon curl avec un User-Agent de navigateur, sinon https://r.jina.ai/<url>).
2. Vérifie que l'`extrait` figure sur la page (mot pour mot ou quasi) et que chaque nombre de `montant` et de `criteres`
   (montants, %, plafonds, âges, effectifs, durées, dates) est confirmé par une source officielle consultée aujourd'hui.
3. Vérifie que le dispositif est ouvert aux nouvelles demandes (ni terminé, ni suspendu, ni enveloppe épuisée).
Corrections : nombre faux → corrige avec un nouvel extrait ; nombre non confirmable → montant.mode "non_chiffre" et
statut "a_confirmer" ; dispositif mort → déplace l'aide dans `exclues` avec la preuve ; mets `derniere_verification`
à la date du jour pour chaque aide vérifiée. N'ajoute aucune nouvelle aide. Ne change pas les identifiants.
Écris : $RECHERCHE/<FICHIER>.verifie.json (même structure) et $RECHERCHE/verification-<FICHIER>.md
(tableau : id | verdict confirmé / corrigé / à confirmer / exclu | justification courte).
Valide le JSON avec python avant de terminer. Résume en français : nombre d'aides par verdict et corrections notables.
```

- [ ] **Step 3 : Relire les rapports** — lire les 8 `verification-*.md` ; contrôler soi-même 2 aides « corrigées » par fichier (ouvrir la source). Tout désaccord non tranché : laisser l'aide en `a_confirmer`.

- [ ] **Step 4 : Pas de commit** (fichiers hors dépôt). Noter dans le message de commit de la tâche 17 le nombre d'aides par verdict.

---

### Task 17 : Intégration du catalogue d'aides

**Files:**
- Create: `scripts/integrer-recherches.mjs`
- Modify (généré) : `packages/core/data/aides/nationales.json`, `regions.json`, `portails.json`

**Interfaces:**
- Produces : catalogue embarqué (`EMBEDDED_AIDES`, `EMBEDDED_PORTAILS`) au format de la tâche 3 ; rapport `$RECHERCHE/rapport-integration.md`.

- [ ] **Step 1 : Créer `scripts/integrer-recherches.mjs`**

```js
// Intègre les fichiers de recherche (protocole PROTOCOLE.md) dans le catalogue embarqué :
//   nat-*.json     → packages/core/data/aides/nationales.json
//   regions-*.json → packages/core/data/aides/regions.json et portails.json
// Utilise la version vérifiée <fichier>.verifie.json quand elle existe.
// Usage : node scripts/integrer-recherches.mjs <dossier-recherche>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dossier = process.argv[2];
if (!dossier || !fs.existsSync(dossier)) {
  console.error('Usage : node scripts/integrer-recherches.mjs <dossier-recherche>');
  process.exit(1);
}

const CLES_AIDE = new Set([
  'id', 'nom', 'financeur', 'financeur_nom', 'categorie', 'projets', 'beneficiaires', 'description', 'criteres',
  'conditions', 'montant', 'cumul', 'demarches', 'url_demarche', 'liens_par_region', 'sources',
  'derniere_verification', 'validite', 'statut', 'confidence', 'ordre_empilement',
]);
const aujourdhui = new Date().toISOString().slice(0, 10);
const alertes = [];

function lireFichiers(prefixe) {
  return fs
    .readdirSync(dossier)
    .filter((f) => f.startsWith(prefixe) && f.endsWith('.json') && !f.endsWith('.verifie.json'))
    .sort()
    .map((f) => {
      const verifie = f.replace(/\.json$/, '.verifie.json');
      const choisi = fs.existsSync(path.join(dossier, verifie)) ? verifie : f;
      if (choisi === f) alertes.push(`${f} : pas de version vérifiée, fichier brut utilisé`);
      return { nom: choisi, contenu: JSON.parse(fs.readFileSync(path.join(dossier, choisi), 'utf-8')) };
    });
}

const texte = (v) => String(v ?? '').trim();

function normaliserAide(a, origine) {
  for (const cle of Object.keys(a)) {
    if (!CLES_AIDE.has(cle)) alertes.push(`${origine} / ${a.id} : clé ignorée « ${cle} »`);
  }
  const m = a.montant ?? {};
  const montant = {
    mode: m.mode ?? 'non_chiffre',
    valeur: m.valeur ?? null,
    pourcentage: m.pourcentage ?? null,
    base: m.base ?? null,
    plafond: m.plafond ?? null,
    duree_max_mois: m.duree_max_mois ?? null,
    libelle: texte(m.libelle),
  };
  if (Array.isArray(m.majorations) && m.majorations.length > 0) montant.majorations = m.majorations;
  const cumul = { cumulable: a.cumul?.cumulable ?? true };
  if (a.cumul?.alternatives?.length) cumul.alternatives = a.cumul.alternatives;
  if (a.cumul?.note) cumul.note = texte(a.cumul.note);

  const aide = {
    id: texte(a.id),
    nom: texte(a.nom),
    financeur: a.financeur,
    financeur_nom: texte(a.financeur_nom),
    categorie: a.categorie,
    projets: a.projets ?? [],
    beneficiaires: a.beneficiaires ?? [],
    description: texte(a.description),
    criteres: a.criteres ?? {},
    conditions: (a.conditions ?? []).map(texte).filter(Boolean),
    montant,
    cumul,
    demarches: (a.demarches ?? []).map(texte).filter(Boolean),
    url_demarche: a.url_demarche ?? null,
    sources: (a.sources ?? []).map((s) => ({ url: texte(s.url), titre: texte(s.titre), extrait: texte(s.extrait) })),
    derniere_verification: a.derniere_verification ?? aujourdhui,
    validite: { debut: a.validite?.debut ?? null, fin: a.validite?.fin ?? null },
    statut: a.statut ?? 'a_confirmer',
    confidence: a.confidence ?? 'estimated',
  };
  if (a.liens_par_region && Object.keys(a.liens_par_region).length > 0) aide.liens_par_region = a.liens_par_region;
  if (a.ordre_empilement != null) aide.ordre_empilement = a.ordre_empilement;
  return aide;
}

function fusionner(fichiers, ids) {
  const aides = [];
  const exclues = [];
  const notes = [];
  for (const { nom, contenu } of fichiers) {
    for (const brute of contenu.aides ?? []) {
      const aide = normaliserAide(brute, nom);
      if (ids.has(aide.id)) {
        alertes.push(`${nom} : identifiant en double ignoré « ${aide.id} »`);
        continue;
      }
      ids.add(aide.id);
      aides.push(aide);
    }
    exclues.push(...(contenu.exclues ?? []).map((e) => ({ ...e, fichier: nom })));
    notes.push(...(contenu.notes ?? []).map((n) => `${nom} : ${n}`));
  }
  return { aides, exclues, notes };
}

const ids = new Set();
const fichiersNat = lireFichiers('nat-');
const fichiersReg = lireFichiers('regions-');
const nationaux = fusionner(fichiersNat, ids);
const regionaux = fusionner(fichiersReg, ids);

for (const a of [...nationaux.aides, ...regionaux.aides]) {
  if (!a.cumul.alternatives) continue;
  const inconnues = a.cumul.alternatives.filter((id) => !ids.has(id));
  if (inconnues.length > 0) {
    alertes.push(`${a.id} : alternatives inconnues retirées (${inconnues.join(', ')})`);
    a.cumul.alternatives = a.cumul.alternatives.filter((id) => ids.has(id));
    if (a.cumul.alternatives.length === 0) delete a.cumul.alternatives;
  }
}

const portails = fichiersReg
  .flatMap(({ contenu }) => contenu.portails ?? [])
  .sort((x, y) => String(x.region).localeCompare(String(y.region)));

const dossierAides = path.join(racine, 'packages/core/data/aides');
const ecrire = (fichier, objet) =>
  fs.writeFileSync(path.join(dossierAides, fichier), JSON.stringify(objet, null, 2) + '\n', 'utf-8');

ecrire('nationales.json', {
  meta: {
    perimetre: 'Aides nationales, européennes, fonds des non-salariés et fiscalité',
    date_integration: aujourdhui,
    fichiers: fichiersNat.map((f) => f.nom),
    nb_aides: nationaux.aides.length,
  },
  aides: nationaux.aides,
});
ecrire('regions.json', {
  meta: {
    perimetre: "Aides des 18 régions (13 métropolitaines et 5 d'outre-mer)",
    date_integration: aujourdhui,
    fichiers: fichiersReg.map((f) => f.nom),
    nb_aides: regionaux.aides.length,
  },
  aides: regionaux.aides,
});
ecrire('portails.json', {
  meta: {
    perimetre: 'Portails officiels par région (Région, Carif-Oref, Transitions Pro, France Travail, Agefiph)',
    date_integration: aujourdhui,
  },
  portails,
});

const aConfirmer = [...nationaux.aides, ...regionaux.aides].filter((a) => a.statut === 'a_confirmer');
const rapport = [
  `# Rapport d'intégration du catalogue — ${aujourdhui}`,
  '',
  `- Aides nationales : ${nationaux.aides.length}`,
  `- Aides régionales : ${regionaux.aides.length}`,
  `- Portails régionaux : ${portails.length}`,
  `- Aides à confirmer : ${aConfirmer.length}`,
  '',
  '## Aides à confirmer',
  ...aConfirmer.map((a) => `- ${a.id} — ${a.nom}`),
  '',
  '## Dispositifs exclus (terminés, suspendus, sans financement)',
  ...[...nationaux.exclues, ...regionaux.exclues].map((e) => `- ${e.nom} — ${e.raison} (${e.fichier})`),
  '',
  '## Notes des chercheurs',
  ...[...nationaux.notes, ...regionaux.notes].map((n) => `- ${n}`),
  '',
  '## Alertes',
  ...alertes.map((a) => `- ${a}`),
  '',
].join('\n');
fs.writeFileSync(path.join(dossier, 'rapport-integration.md'), rapport, 'utf-8');

console.log(`Nationales : ${nationaux.aides.length} | Régionales : ${regionaux.aides.length} | Portails : ${portails.length} | Alertes : ${alertes.length}`);
console.log(`Rapport : ${path.join(dossier, 'rapport-integration.md')}`);
```

- [ ] **Step 2 : Lancer l'intégration**

Run : `node scripts/integrer-recherches.mjs "$RECHERCHE"`
Expected : une ligne de totaux (au moins 15 aides nationales, au moins 18 aides régionales, 18 portails) et le chemin du rapport. Lire `rapport-integration.md` ; traiter chaque alerte (clé ignorée → corriger le fichier vérifié et relancer).

- [ ] **Step 3 : Valider avec le schéma**

Run : `cd packages/core && npx vitest run && npx tsc --noEmit`
Expected : PASS (les tests existants valident déjà la forme du dataset). Si `validateDataset` ou un test échoue sur une aide : corriger la donnée dans `$RECHERCHE/<fichier>.verifie.json` (jamais le schéma) puis relancer l'étape 2.

- [ ] **Step 4 : Commit**

```bash
git add scripts/integrer-recherches.mjs packages/core/data/aides
git commit -m "donnees : catalogue d'aides verifie (national, Europe, 18 regions, FAF, fiscalite) et portails regionaux

<Nombre d'aides par verdict de la double vérification.>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18 : Tests du catalogue et scénarios de bout en bout

**Files:**
- Test: `packages/core/tests/donnees-aides.test.ts`, `packages/core/tests/scenarios.test.ts`

- [ ] **Step 1 : Écrire `packages/core/tests/donnees-aides.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { EMBEDDED_AIDES, EMBEDDED_PORTAILS } from '../src/data';
import { AideSchema, CriteresAideSchema, PortailRegionalSchema, sanityCheckAides } from '../src/schema';
import { REGIONS } from '../src/geo';

const CLES_AIDE = Object.keys(AideSchema.shape);
const CLES_CRITERES = Object.keys(CriteresAideSchema.shape);
const CLES_MONTANT = ['mode', 'valeur', 'pourcentage', 'base', 'plafond', 'duree_max_mois', 'libelle', 'majorations'];

function moisDepuis(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const maintenant = new Date();
  return (maintenant.getUTCFullYear() - d.getUTCFullYear()) * 12 + (maintenant.getUTCMonth() - d.getUTCMonth());
}

describe('catalogue d’aides embarqué', () => {
  const nationales = EMBEDDED_AIDES.filter((a) => !/^r\d{2}-/.test(a.id));
  const regionales = EMBEDDED_AIDES.filter((a) => /^r\d{2}-/.test(a.id));

  it('couvre le national et les régions', () => {
    expect(nationales.length).toBeGreaterThanOrEqual(15);
    expect(regionales.length).toBeGreaterThanOrEqual(18);
  });

  it('chaque aide respecte le schéma, sans clé inconnue', () => {
    for (const a of EMBEDDED_AIDES) {
      const r = AideSchema.safeParse(a);
      expect(r.success, `${a.id} : ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true);
      for (const cle of Object.keys(a)) expect(CLES_AIDE, `${a.id}.${cle}`).toContain(cle);
      for (const cle of Object.keys(a.criteres)) expect(CLES_CRITERES, `${a.id}.criteres.${cle}`).toContain(cle);
      for (const cle of Object.keys(a.montant)) expect(CLES_MONTANT, `${a.id}.montant.${cle}`).toContain(cle);
    }
  });

  it('est cohérent (identifiants, alternatives, bornes)', () => {
    expect(sanityCheckAides(EMBEDDED_AIDES)).toEqual([]);
  });

  it('a été vérifié il y a moins de 12 mois', () => {
    for (const a of EMBEDDED_AIDES) expect(moisDepuis(a.derniere_verification), a.id).toBeLessThan(12);
  });

  it('chaque montant exact est justifié par un extrait chiffré', () => {
    for (const a of EMBEDDED_AIDES) {
      if (a.confidence === 'exact' && a.montant.mode !== 'non_chiffre' && a.montant.mode !== 'solde_cpf') {
        expect(a.sources.some((s) => /\d/.test(s.extrait)), a.id).toBe(true);
      }
    }
  });

  it('une aide régionale porte le code de sa région', () => {
    for (const a of regionales) {
      const code = a.id.slice(1, 3);
      expect(a.criteres.regions, a.id).toContain(code);
    }
  });

  it('propose un portail officiel pour chacune des 18 régions', () => {
    for (const p of EMBEDDED_PORTAILS) expect(PortailRegionalSchema.safeParse(p).success, p.region).toBe(true);
    expect(new Set(EMBEDDED_PORTAILS.map((p) => p.region))).toEqual(new Set(Object.keys(REGIONS)));
  });
});
```

Note : la LADOM (`nat-ladom-…`) est nationale mais restreinte aux régions d'outre-mer ; la règle « code de sa région » ne vise que les identifiants `r<code>-`.

- [ ] **Step 2 : Écrire `packages/core/tests/scenarios.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { calculateFunding } from '../src/calculator';
import { construirePlan } from '../src/aides/plan';
import { evaluerAides } from '../src/aides/evaluer';
import { profilDepuisWizard } from '../src/aides/profil';
import type { AideEvaluee, Financeur, ProfilAides } from '../src/aides/types';
import { EMBEDDED_AIDES, getEmbeddedOpcoBySlug } from '../src/data';
import { createInitialWizardState, type WizardState } from '../src/types';

const AUJOURDHUI = new Date().toISOString().slice(0, 10);

function simuler(over: Partial<WizardState>) {
  const state: WizardState = { ...createInitialWizardState(), trainingMode: 'presentiel', ...over };
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const projet = state.projetType ?? 'formation_salarie';
  const etat = { ...state, trainingDays: state.trainingDays ?? Math.ceil((state.durationHours ?? 0) / 7) };
  const funding =
    opco && (projet === 'formation_salarie' || projet === 'reconversion_salarie') ? calculateFunding(opco, etat) : null;
  const profil = profilDepuisWizard(etat, slug);
  const aides = evaluerAides(EMBEDDED_AIDES, profil, AUJOURDHUI);
  return { funding, aides, profil, plan: construirePlan(funding, aides, profil) };
}

function invariants(r: ReturnType<typeof simuler>) {
  expect(r.plan.totalFinance).toBeLessThanOrEqual(r.plan.coutFormation);
  expect(r.plan.resteACharge).toBeGreaterThanOrEqual(0);
  for (const a of r.aides.filter((x) => x.statut !== 'non_eligible')) {
    const aide = EMBEDDED_AIDES.find((y) => y.id === a.id)!;
    if (aide.criteres.regions?.length) {
      const region: ProfilAides['regionEntreprise'] =
        aide.criteres.perimetre_region === 'beneficiaire'
          ? (r.profil.regionBeneficiaire ?? r.profil.regionEntreprise)
          : r.profil.regionEntreprise;
      expect(aide.criteres.regions, a.id).toContain(region);
    }
    expect(a.sources.length, a.id).toBeGreaterThan(0);
  }
}

const visibles = (aides: AideEvaluee[], financeur: Financeur) =>
  aides.filter((a) => a.statut !== 'non_eligible' && a.financeur === financeur);

describe('scénarios de bout en bout (données réelles)', () => {
  it('1. TPE d’Île-de-France (AKTO, organismes de formation), salarié en CDI, RNCP 140 h à 4 200 €', () => {
    const r = simuler({
      projetType: 'formation_salarie', selectedOpcoSlug: 'akto', detectedIdcc: '1516', regionCode: '11', departementCode: '95',
      companySize: 'less_11', contractType: 'cdi', ageBeneficiaire: 35, certificationLevel: 'rncp', eligibleCpf: true,
      durationHours: 140, pedagogyCostTotal: 4200, pedagogyCostPerHour: 30,
    });
    invariants(r);
    expect(r.funding!.totalFunded).toBeGreaterThan(0);
    expect(visibles(r.aides, 'cpf').length).toBeGreaterThan(0);
  });

  it('2. Entreprise de 120 salariés : règle des 50 salariés', () => {
    const r = simuler({
      projetType: 'formation_salarie', selectedOpcoSlug: 'atlas', regionCode: '84', companySize: '50_299', effectif: 120,
      contractType: 'cdi', durationHours: 35, pedagogyCostTotal: 1400, pedagogyCostPerHour: 40,
    });
    invariants(r);
    expect(r.funding!.warnings.join(' ')).toMatch(/50 salariés/);
    const enveloppe = getEmbeddedOpcoBySlug('atlas')!.plafonds_par_taille?.find((p) => p.taille === '50_299')?.budget_annuel_max;
    if (enveloppe == null) expect(r.funding!.totalFunded).toBe(0);
  });

  it('3. Recrutement d’un demandeur d’emploi en Occitanie', () => {
    const r = simuler({
      projetType: 'recrutement_demandeur_emploi', selectedOpcoSlug: 'akto', regionCode: '76', companySize: '11_49',
      inscritFranceTravail: true, ageBeneficiaire: 28, durationHours: 280, pedagogyCostTotal: 3500, pedagogyCostPerHour: 12.5,
    });
    invariants(r);
    expect(visibles(r.aides, 'france_travail').length).toBeGreaterThan(0);
  });

  it('4. Apprenti de 19 ans en Hauts-de-France', () => {
    const r = simuler({
      projetType: 'alternance', selectedOpcoSlug: 'akto', regionCode: '32', companySize: '11_49', typeAlternance: 'apprentissage',
      ageBeneficiaire: 19, niveauFormationVise: 4, durationHours: 800, pedagogyCostTotal: 7000, pedagogyCostPerHour: 8.75,
    });
    invariants(r);
    expect(r.aides.some((a) => a.statut !== 'non_eligible' && a.categorie === 'aide_employeur')).toBe(true);
  });

  it('5. Artisan non salarié en Bretagne', () => {
    const r = simuler({
      projetType: 'formation_dirigeant', regionCode: '53', companySize: 'less_11', statutDirigeant: 'artisan',
      microEntrepreneur: false, ageBeneficiaire: 45, durationHours: 21, pedagogyCostTotal: 900, pedagogyCostPerHour: 42.86,
    });
    invariants(r);
    expect(visibles(r.aides, 'faf').length).toBeGreaterThan(0);
    expect(visibles(r.aides, 'fiscal').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3 : Lancer** — Run : `cd packages/core && npx vitest run`
Expected : PASS. Un échec révèle une donnée manquante ou fausse : en chercher la cause dans le catalogue et la source officielle, corriger la donnée (pas l'attente), sauf si la source officielle établit que l'attente est fausse (par exemple aucune aide France Travail ouverte) : dans ce cas, modifier l'attente en citant la source dans un commentaire du test.

- [ ] **Step 4 : Commit**

```bash
git add packages/core/tests/donnees-aides.test.ts packages/core/tests/scenarios.test.ts
git commit -m "tests : integrite du catalogue d'aides et 5 scenarios de bout en bout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Phase 4 — Publication

### Task 19 : Dataset v4

**Files:**
- Modify: `scripts/build-example-dataset.mjs` (réécriture), `backend/src/publish.ts`, `backend/src/run.ts`, `apps/mobile/src/lib/dataset-sync.ts`, `datasets/README.md`
- Create (généré) : `datasets/v4.json` ; Modify (généré) : `datasets/latest.json`, `datasets/manifest.json`
- Test: `backend/tests/pipeline.test.ts`, `backend/tests/dataset-publie.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `backend/tests/pipeline.test.ts`, à l'intérieur de `describe('publish.publishDataset', …)` :

```ts
  it('publie les sections v4 et compte les aides dans le manifest', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opco-v4-'));
    const aide = { ...EMBEDDED_AIDES[0] };
    const r = publishDataset(deepClone(EMBEDDED_OPCOS), {
      datasetsDir: tmp,
      changelog: ['v4'],
      sections: { aides: aide ? [aide] : [], idcc: {}, naf: [], portails: [] },
    });
    const latest = JSON.parse(fs.readFileSync(r.files.latest, 'utf-8'));
    const manifest = JSON.parse(fs.readFileSync(r.files.manifest, 'utf-8'));
    expect(Array.isArray(latest.aides)).toBe(true);
    expect(manifest.aidesCount).toBe(latest.aides.length);
  });
```

(ajouter `EMBEDDED_AIDES` à l'import `@opco/core` du fichier ; `fs`, `os`, `path` et `deepClone` y sont déjà importés — sinon ajouter `import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';`.)

Créer `backend/tests/dataset-publie.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatasetManifestSchema, validateDataset } from '@opco/core';

const datasets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../datasets');

describe('dataset publié (datasets/)', () => {
  it('latest.json est valide, versionné v4+ et conforme au manifest', () => {
    const brut = fs.readFileSync(path.join(datasets, 'latest.json'));
    const manifest = DatasetManifestSchema.parse(JSON.parse(fs.readFileSync(path.join(datasets, 'manifest.json'), 'utf-8')));
    const dataset = validateDataset(JSON.parse(brut.toString('utf-8')));
    expect(dataset.version).toBeGreaterThanOrEqual(4);
    expect(manifest.version).toBe(dataset.version);
    expect(manifest.sha256).toBe(crypto.createHash('sha256').update(brut).digest('hex'));
    expect(manifest.aidesCount).toBe(dataset.aides?.length);
    expect(dataset.portails?.length).toBe(18);
  });
});
```

Run : `cd backend && npx vitest run` — Expected : FAIL (option `sections` inconnue, dataset v3 publié).

- [ ] **Step 2 : `backend/src/publish.ts`**

Ajouter à l'import `@opco/core` : `import type { Aide, IdccTable, OpcoData, PortailRegional, SuggestionNaf } from '@opco/core';` (remplace `import type { OpcoData } from '@opco/core';`), puis :

```ts
/** Sections v4 facultatives publiées à côté des OPCO. */
export interface SectionsDataset {
  aides?: Aide[];
  idcc?: IdccTable;
  naf?: SuggestionNaf[];
  portails?: PortailRegional[];
}
```

Dans `PublishOptions`, ajouter :

```ts
  /** Sections v4 (aides, table IDCC, suggestions NAF, portails). */
  sections?: SectionsDataset;
```

Dans `publishDataset`, remplacer `const dataset = { version, generatedAt, opcos };` par :

```ts
  const dataset = { version, generatedAt, opcos, ...(opts.sections ?? {}) };
```

et remplacer la construction du manifest par :

```ts
  const manifest = {
    version,
    generatedAt,
    sha256,
    opcoCount: opcos.length,
    ...(opts.sections?.aides ? { aidesCount: opts.sections.aides.length } : {}),
    changelog: opts.changelog.length > 0 ? opts.changelog : ['Aucun changement détecté lors de cette vérification'],
  };
```

- [ ] **Step 3 : `backend/src/run.ts`** — remplacer `import { EMBEDDED_OPCOS } from '@opco/core';` par :

```ts
import { EMBEDDED_AIDES, EMBEDDED_IDCC, EMBEDDED_NAF, EMBEDDED_OPCOS, EMBEDDED_PORTAILS } from '@opco/core';
```

et, dans l'appel `publishDataset(validation.opcos, { … })`, ajouter l'option :

```ts
      sections: { aides: EMBEDDED_AIDES, idcc: EMBEDDED_IDCC, naf: EMBEDDED_NAF, portails: EMBEDDED_PORTAILS },
```

- [ ] **Step 4 : Réécrire `scripts/build-example-dataset.mjs`**

```js
// Génère le dataset publié (datasets/vN.json, latest.json, manifest.json) depuis les
// données embarquées de packages/core/data : 11 OPCO + aides + table IDCC + NAF + portails.
// Usage : DATASET_CHANGELOG="message" node scripts/build-example-dataset.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(monorepoRoot, 'packages', 'core', 'data');
const datasetsDir = path.join(monorepoRoot, 'datasets');
fs.mkdirSync(datasetsDir, { recursive: true });

const lire = (...segments) => JSON.parse(fs.readFileSync(path.join(dataDir, ...segments), 'utf-8'));

const OPCOS = [
  'afdas.json', 'akto.json', 'atlas.json', 'constructys.json', 'ocapiat.json', 'opco-ep.json',
  'opco-mobilites.json', 'opco-sante.json', 'opco2i.json', 'opcommerce.json', 'uniformation.json',
];
const opcos = OPCOS.map((f) => lire('opcos', f));
const aides = [...lire('aides', 'nationales.json').aides, ...lire('aides', 'regions.json').aides];
const portails = lire('aides', 'portails.json').portails;
const idcc = lire('idcc', 'idcc-opco.json');
const naf = lire('idcc', 'naf-suggestions.json');

// Version auto-incrémentée depuis le manifest courant (les apps ne téléchargent que plus récent).
const manifestPath = path.join(datasetsDir, 'manifest.json');
let version = 1;
if (fs.existsSync(manifestPath)) {
  try {
    const precedent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (Number.isInteger(precedent.version)) version = precedent.version + 1;
  } catch {
    // manifest illisible : repart à 1
  }
}

const generatedAt = new Date().toISOString();
const json = JSON.stringify({ version, generatedAt, opcos, aides, idcc, naf, portails }, null, 2);
fs.writeFileSync(path.join(datasetsDir, `v${version}.json`), json, 'utf-8');
fs.writeFileSync(path.join(datasetsDir, 'latest.json'), json, 'utf-8');

// SHA-256 des octets exacts de latest.json (ce que l'app vérifie).
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(datasetsDir, 'latest.json'))).digest('hex');
const manifest = {
  version,
  generatedAt,
  sha256,
  opcoCount: opcos.length,
  aidesCount: aides.length,
  changelog: [process.env.DATASET_CHANGELOG || `Dataset v${version} généré depuis les données embarquées`],
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

console.log(`Dataset v${version} : ${opcos.length} OPCO, ${aides.length} aides, ${Object.keys(idcc).length} IDCC, ${portails.length} portails`);
console.log(`sha256 ${sha256}`);
```

- [ ] **Step 5 : Générer le dataset v4**

Run : `DATASET_CHANGELOG="v4 : baremes OPCO reverifies (octobre 2026), table IDCC verifiee, catalogue d'aides (national, Europe, 18 regions), portails regionaux" node scripts/build-example-dataset.mjs`
Expected : `Dataset v4 : 11 OPCO, <n> aides, <m> IDCC, 18 portails`.

- [ ] **Step 6 : Aligner les données embarquées de l'app** — dans `apps/mobile/src/lib/dataset-sync.ts` : `EMBEDDED_DATASET_VERSION = 4` et `EMBEDDED_DATASET_DATE = '<date du jour AAAA-MM-JJ>'`.

- [ ] **Step 7 : Documenter le format** — dans `datasets/README.md`, remplacer l'exemple de format par :

```json
{
  "version": 4,
  "generatedAt": "2026-10-05T12:00:00.000Z",
  "opcos": [ /* 11 OpcoData */ ],
  "aides": [ /* Aide (packages/core/src/aides/types.ts) */ ],
  "idcc": { /* "1516": IdccEntree */ },
  "naf": [ /* SuggestionNaf */ ],
  "portails": [ /* PortailRegional, un par région */ ]
}
```

et ajouter la ligne `"aidesCount": 123,` dans l'exemple de manifest, avec la phrase : « Les sections `aides`, `idcc`, `naf` et `portails` sont facultatives : une app 1.2.0 les ignore et profite tout de même des barèmes OPCO à jour. »

- [ ] **Step 8 : Vérifier** — Run : `cd backend && npx vitest run && npx tsc --noEmit` puis `cd packages/core && npx vitest run` puis `cd apps/mobile && npx tsc --noEmit` — Expected : PASS / aucune erreur.

- [ ] **Step 9 : Commit**

```bash
git add scripts/build-example-dataset.mjs backend/src/publish.ts backend/src/run.ts backend/tests apps/mobile/src/lib/dataset-sync.ts datasets
git commit -m "dataset v4 : aides, table IDCC, suggestions NAF et portails publies avec les OPCO

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 20 : Contrôle des liens, workflow et documentation

**Files:**
- Create: `backend/src/check-sources.ts`, `backend/tests/check-sources.test.ts`, `docs/donnees-aides.md`, `docs/demande-licence-france-competences.md`
- Modify: `backend/package.json`, `.github/workflows/update-dataset.yml`, `backend/src/extract.ts`, `README.md`

- [ ] **Step 1 : Écrire le test qui échoue** — `backend/tests/check-sources.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { classerStatut, collecterUrls, verifierUrls } from '../src/check-sources';
import { EMBEDDED_AIDES, EMBEDDED_IDCC, EMBEDDED_OPCOS, EMBEDDED_PORTAILS } from '@opco/core';

describe('check-sources', () => {
  it('collecte les URL sans doublon, avec leurs usages', () => {
    const urls = collecterUrls({ opcos: EMBEDDED_OPCOS, aides: EMBEDDED_AIDES, portails: EMBEDDED_PORTAILS, idcc: EMBEDDED_IDCC });
    expect(urls.size).toBeGreaterThan(10);
    for (const [url, usages] of urls) {
      expect(url).toMatch(/^https?:\/\//);
      expect(usages.length).toBeGreaterThan(0);
    }
  });

  it('classe les statuts HTTP', () => {
    expect(classerStatut(200)).toBe('ok');
    expect(classerStatut(301)).toBe('ok');
    expect(classerStatut(403)).toBe('a_verifier');
    expect(classerStatut(429)).toBe('a_verifier');
    expect(classerStatut(404)).toBe('casse');
    expect(classerStatut(null)).toBe('casse');
  });

  it('vérifie les URL avec un fetch injecté', async () => {
    const faux = (async (url: string) => new Response(null, { status: url.includes('mort') ? 404 : 200 })) as typeof fetch;
    const r = await verifierUrls(new Map([['https://ok.fr', ['a']], ['https://mort.fr', ['b']]]), { fetchImpl: faux, concurrence: 2 });
    expect(r.find((x) => x.url === 'https://ok.fr')?.etat).toBe('ok');
    expect(r.find((x) => x.url === 'https://mort.fr')?.etat).toBe('casse');
  });
});
```

Run : `cd backend && npx vitest run tests/check-sources.test.ts` — Expected : FAIL (module absent).

- [ ] **Step 2 : Créer `backend/src/check-sources.ts`**

```ts
// ============================================================
// Contrôle des liens sources (OPCO, aides, portails, table IDCC).
// Usage : node --import tsx src/check-sources.ts
// Écrit backend/out/liens.json et backend/out/liens.md. Aucune clé d'API requise.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMBEDDED_AIDES, EMBEDDED_IDCC, EMBEDDED_OPCOS, EMBEDDED_PORTAILS } from '@opco/core';
import type { Aide, IdccTable, OpcoData, PortailRegional } from '@opco/core';

export type EtatLien = 'ok' | 'a_verifier' | 'casse';

export interface ResultatLien {
  url: string;
  statut: number | null;
  etat: EtatLien;
  erreur?: string;
  utilisePar: string[];
}

const CHAMPS_SOURCES = [
  'cout_horaire_inter', 'cout_horaire_intra', 'cout_horaire_metier', 'prise_en_charge_salaires', 'frais_transport',
  'frais_hebergement', 'frais_restauration', 'frais_annexes_pourcentage', 'budget_annuel_max',
] as const;

export function collecterUrls(d: { opcos: OpcoData[]; aides: Aide[]; portails: PortailRegional[]; idcc: IdccTable }): Map<string, string[]> {
  const urls = new Map<string, string[]>();
  const ajouter = (url: string | null | undefined, usage: string) => {
    if (!url || !/^https?:\/\//.test(url)) return;
    const usages = urls.get(url) ?? [];
    if (!usages.includes(usage)) usages.push(usage);
    urls.set(url, usages);
  };
  for (const o of d.opcos) {
    ajouter(o.url_finance_page, `opco:${o.slug}`);
    for (const champ of CHAMPS_SOURCES) ajouter(o[champ].source_url, `opco:${o.slug}.${champ}`);
    for (const disp of o.dispositifs_complementaires ?? []) ajouter(disp.source_url, `opco:${o.slug}.dispositif:${disp.id}`);
    for (const v of o.variantes_branche ?? []) ajouter(v.source_url, `opco:${o.slug}.variante:${v.id}`);
  }
  for (const a of d.aides) {
    ajouter(a.url_demarche, `aide:${a.id}.demarche`);
    for (const s of a.sources) ajouter(s.url, `aide:${a.id}.source`);
    for (const [region, url] of Object.entries(a.liens_par_region ?? {})) ajouter(url, `aide:${a.id}.region:${region}`);
  }
  for (const p of d.portails) for (const l of p.liens) ajouter(l.url, `portail:${p.region}`);
  for (const e of Object.values(d.idcc)) ajouter(e.source, `idcc:${e.idcc}`);
  return urls;
}

/** 401/403/429/503 : protections anti-robots ou limitation, à vérifier à la main. */
export function classerStatut(statut: number | null): EtatLien {
  if (statut == null) return 'casse';
  if (statut >= 200 && statut < 400) return 'ok';
  if (statut === 401 || statut === 403 || statut === 429 || statut === 503) return 'a_verifier';
  return 'casse';
}

async function verifierUrl(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<{ statut: number | null; erreur?: string }> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controleur.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; financement-opco-verification-liens/1.0)',
        Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8',
      },
    });
    try {
      await res.body?.cancel();
    } catch {
      // corps déjà consommé ou absent
    }
    return { statut: res.status };
  } catch (err) {
    return { statut: null, erreur: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(minuteur);
  }
}

export async function verifierUrls(
  urls: Map<string, string[]>,
  opts: { concurrence?: number; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultatLien[]> {
  const entrees = [...urls.entries()];
  const resultats: ResultatLien[] = new Array(entrees.length);
  let suivant = 0;
  const travailleur = async () => {
    while (suivant < entrees.length) {
      const i = suivant++;
      const [url, usages] = entrees[i];
      const r = await verifierUrl(url, opts.fetchImpl ?? fetch, opts.timeoutMs ?? 20_000);
      resultats[i] = { url, statut: r.statut, etat: classerStatut(r.statut), erreur: r.erreur, utilisePar: usages };
    }
  };
  await Promise.all(Array.from({ length: opts.concurrence ?? 6 }, travailleur));
  return resultats;
}

export function rapportMarkdown(resultats: ResultatLien[], date: string): string {
  const ligne = (r: ResultatLien) => `| ${r.url} | ${r.statut ?? r.erreur ?? '—'} | ${r.utilisePar.slice(0, 3).join(', ')} |`;
  const casses = resultats.filter((r) => r.etat === 'casse');
  const aVerifier = resultats.filter((r) => r.etat === 'a_verifier');
  return [
    `# Contrôle des liens sources — ${date}`,
    '',
    `${resultats.length} liens : ${resultats.length - casses.length - aVerifier.length} OK, ${aVerifier.length} à vérifier, ${casses.length} cassés.`,
    '',
    '## Liens cassés',
    '| URL | Statut | Utilisé par |',
    '|---|---|---|',
    ...casses.map(ligne),
    '',
    '## À vérifier à la main (protection anti-robots ou limitation)',
    '| URL | Statut | Utilisé par |',
    '|---|---|---|',
    ...aVerifier.map(ligne),
    '',
  ].join('\n');
}

async function principal(): Promise<void> {
  const urls = collecterUrls({ opcos: EMBEDDED_OPCOS, aides: EMBEDDED_AIDES, portails: EMBEDDED_PORTAILS, idcc: EMBEDDED_IDCC });
  const resultats = await verifierUrls(urls);
  const dossier = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'out');
  fs.mkdirSync(dossier, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(dossier, 'liens.json'), JSON.stringify(resultats, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dossier, 'liens.md'), rapportMarkdown(resultats, date), 'utf-8');
  const casses = resultats.filter((r) => r.etat === 'casse').length;
  console.log(`${resultats.length} liens vérifiés, ${casses} cassé(s). Rapport : ${path.join(dossier, 'liens.md')}`);
  process.exitCode = casses > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void principal();
}
```

Dans `backend/package.json`, ajouter le script : `"check-sources": "node --import tsx src/check-sources.ts",`.

Run : `cd backend && npx vitest run && npx tsc --noEmit` — Expected : PASS.
Run : `cd backend && npm run check-sources` — Expected : rapport écrit ; ouvrir `backend/out/liens.md`, corriger dans les données toute URL cassée (nouvelle URL officielle, extrait revérifié) puis relancer jusqu'à 0 lien cassé.

- [ ] **Step 3 : Modèles du pipeline** — invoquer d'abord le skill `claude-api` (obligatoire avant de modifier ce fichier) pour confirmer les identifiants de modèles actuels, puis dans `backend/src/extract.ts` mettre `DEFAULT_EXTRACT_MODEL = 'claude-haiku-4-5'` et `DEFAULT_VERIFY_MODEL = 'claude-opus-5-5'` (valeurs à confirmer par le skill ; mettre à jour le commentaire d'en-tête en conséquence).
Run : `cd backend && npx vitest run && npx tsc --noEmit` — Expected : PASS.

- [ ] **Step 4 : Réécrire `.github/workflows/update-dataset.yml`**

```yaml
# ============================================================
# Mise à jour planifiée du dataset OPCO (pipeline auto-correctif).
#
# SÉCURITÉ — clé API : ANTHROPIC_API_KEY est un SECRET CI (Settings > Secrets and
# variables > Actions). Elle n'est JAMAIS embarquée dans l'app ni commitée.
#
# Comportement :
#   - hebdomadaire (cron) + déclenchement manuel
#   - tests core + backend, contrôle des liens sources (rapport en artefact)
#   - si le secret existe : pipeline --live (scrape + IA), commit direct ou PR de revue
#   - si le secret manque : avertissement explicite, sans échec
# ============================================================
name: Update OPCO dataset

on:
  schedule:
    - cron: '0 6 * * 1' # tous les lundis 06:00 UTC
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  update-dataset:
    runs-on: ubuntu-latest
    env:
      HAS_ANTHROPIC_KEY: ${{ secrets.ANTHROPIC_API_KEY != '' }}
    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Node
        uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Tests core
        run: npm test

      - name: Typecheck backend
        run: npm run typecheck --workspace @opco/backend

      - name: Tests backend
        run: npm test --workspace @opco/backend

      - name: Contrôle des liens sources
        run: npm run check-sources --workspace @opco/backend
        continue-on-error: true

      - name: Rapport des liens
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: rapport-liens
          path: backend/out/liens.md
          if-no-files-found: ignore

      - name: Secret absent
        if: env.HAS_ANTHROPIC_KEY != 'true'
        run: echo "::warning::Secret ANTHROPIC_API_KEY absent : verification IA des baremes ignoree (Settings > Secrets and variables > Actions)."

      - name: Rebuild sources
        if: env.HAS_ANTHROPIC_KEY == 'true'
        run: npm run build-sources --workspace @opco/backend

      - name: Run pipeline (live)
        if: env.HAS_ANTHROPIC_KEY == 'true'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npm run live --workspace @opco/backend

      - name: Count needsReview
        if: env.HAS_ANTHROPIC_KEY == 'true'
        id: review
        run: |
          count=$(node -p "try { JSON.parse(require('fs').readFileSync('backend/out/report.json','utf8')).needsReview.length } catch (e) { 0 }")
          echo "count=$count" >> "$GITHUB_OUTPUT"

      - name: Commit dataset (aucune revue requise)
        if: env.HAS_ANTHROPIC_KEY == 'true' && steps.review.outputs.count == '0'
        run: |
          git config user.name "opco-funding-bot"
          git config user.email "opco-funding-bot@users.noreply.github.com"
          git add datasets/
          if git diff --cached --quiet; then
            echo "Aucun changement de dataset à committer."
          else
            git commit -m "chore(datasets): mise à jour automatique du dataset OPCO"
            git push
          fi

      - name: Create PR (changements à revoir)
        if: env.HAS_ANTHROPIC_KEY == 'true' && steps.review.outputs.count != '0'
        uses: peter-evans/create-pull-request@v6
        with:
          branch: bot/opco-dataset-update
          title: 'Dataset OPCO : changements à revoir manuellement'
          commit-message: 'chore(datasets): mise à jour automatique (needsReview non vide)'
          body: |
            Le pipeline hebdomadaire a détecté des variations dépassant `MAX_DELTA_PCT`.
            Ces changements n'ont pas été auto-publiés. Détail : `backend/out/report.json`.
          add-paths: |
            datasets/
            backend/out/report.json
```

- [ ] **Step 5 : `docs/donnees-aides.md`** (guide de maintenance)

```markdown
# Maintenir les données : aides, barèmes OPCO, table IDCC

## Où sont les données
| Fichier | Contenu |
|---|---|
| `packages/core/data/opcos/*.json` | Barèmes des 11 OPCO (`derniere_verification`, sources et extraits dans `note`) |
| `packages/core/data/idcc/idcc-opco.json` | Table IDCC → OPCO (titres officiels, fusions, partages, codes échappatoires) |
| `packages/core/data/idcc/naf-suggestions.json` | Suggestions d'OPCO par code NAF (sans IDCC exploitable) |
| `packages/core/data/aides/nationales.json` | Aides nationales, européennes, fonds des non-salariés, fiscalité |
| `packages/core/data/aides/regions.json` | Aides des 18 régions (identifiants `r<code région>-…`) |
| `packages/core/data/aides/portails.json` | Portails officiels « pour aller plus loin », un par région |

Le format exact est défini par `packages/core/src/aides/types.ts` et validé par `packages/core/src/schema.ts`.

## Règles
1. Sources officielles uniquement (service-public, travail-emploi, France Travail, Transitions Pro, Agefiph, Régions, OPCO, FAF, Légifrance, URSSAF, impots.gouv).
2. Chaque montant : URL + extrait mot pour mot + date de vérification. Sinon `montant.mode = "non_chiffre"` et `statut = "a_confirmer"`.
3. Un dispositif terminé ou suspendu est retiré (ou `statut = "suspendu"` le temps de la vérification).
4. Ne jamais réutiliser les tables ni les API de France Compétences sans licence (art. R. 6123-35 du code du travail).

## Mettre à jour une aide
1. Modifier l'entrée dans le fichier JSON (montant, critères, conditions, démarches, sources, `derniere_verification`).
2. `cd packages/core && npx vitest run` : les tests de données refusent une forme invalide, un identifiant en double, une source non https ou une vérification de plus de 12 mois.
3. `cd backend && npm run check-sources` : aucun lien cassé.

## Revue complète (au moins une fois par an, idéalement en janvier et en septembre)
1. Relancer les recherches selon le protocole (un agent par groupe de régions, un par thème national), puis la double vérification.
2. `node scripts/integrer-recherches.mjs <dossier>` puis lire `rapport-integration.md`.
3. Tests (core, backend) et contrôle des liens.

## Publier vers les applications installées
1. `DATASET_CHANGELOG="…" node scripts/build-example-dataset.mjs` (incrémente la version).
2. Mettre `EMBEDDED_DATASET_VERSION` et `EMBEDDED_DATASET_DATE` (`apps/mobile/src/lib/dataset-sync.ts`) à la même version et date.
3. Commit puis push sur `main` : les apps téléchargent `datasets/latest.json` (empreinte SHA-256 vérifiée) au prochain « Vérifier les mises à jour ».
```

- [ ] **Step 6 : `docs/demande-licence-france-competences.md`** (brouillon à envoyer par l'utilisateur)

```markdown
# Demande de licence de réutilisation — tables de correspondance OPCO

**À :** affaires-juridiques@francecompetences.fr
**Objet :** Demande de licence gratuite de réutilisation des tables de correspondance IDCC / APE / OPCO

Madame, Monsieur,

SFG Développement édite « Financement OPCO », une application gratuite qui aide les entreprises et les salariés à identifier les financements de leurs projets de formation, et notamment l'opérateur de compétences dont relève l'entreprise.

Conformément aux articles R. 6123-34 et R. 6123-35 du code du travail et à l'article D. 323-2-1 du code des relations entre le public et l'administration, nous sollicitons la conclusion du contrat de licence gratuite permettant la réutilisation :
- des tables de correspondance entre les identifiants de convention collective (IDCC), les codes APE et les opérateurs de compétences (arrêté du 15 juin 2022) ;
- le cas échéant, de l'information « OPCO de rattachement d'un SIRET » diffusée par le service « Quel est mon OPCO ».

Usage prévu : affichage, dans l'application, de l'OPCO de rattachement d'une entreprise à partir de son SIRET ou de son IDCC, avec mention de la source France Compétences et de la date de mise à jour ; aucune revente des données.

Nous restons à votre disposition pour tout complément.

Cordialement,
[Nom, fonction]
SFG Développement — contact@sfgdeveloppement.fr
```

- [ ] **Step 7 : `README.md`** — ajouter une section « Aides et financements (v1.3) » décrivant : les 6 étapes, le moteur (`aides/criteres`, `evaluer`, `profil`, `plan`), l'identification OPCO v2 (certitude, lien officiel, licence France Compétences à obtenir), le dataset v4, `npm run check-sources`, le guide `docs/donnees-aides.md` ; mettre à jour le tableau « Vérifications » avec le nombre réel de tests (sortie de `npx vitest run`).

- [ ] **Step 8 : Commit**

```bash
git add backend/src/check-sources.ts backend/tests/check-sources.test.ts backend/package.json backend/src/extract.ts .github/workflows/update-dataset.yml docs/donnees-aides.md docs/demande-licence-france-competences.md README.md
git commit -m "maintenance : controle des liens sources, workflow robuste sans secret, modeles a jour, guides

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 21 : Version 1.3.0 et vérification finale

**Files:**
- Modify: `apps/mobile/app.json` (`version: "1.3.0"`, `android.versionCode: 4`)
- Create: `.claude/launch.json` (serveur Expo web pour les tests dans le navigateur)

- [ ] **Step 1 : Version** — `apps/mobile/app.json` : `"version": "1.3.0"` et `"versionCode": 4`.

- [ ] **Step 2 : Vérifications automatiques**

```bash
cd packages/core && npx vitest run && npx tsc --noEmit
cd ../../backend && npx vitest run && npx tsc --noEmit
cd ../apps/mobile && npx tsc --noEmit && npx expo export --platform android --output-dir ../../.expo-export-check
```

Expected : tous les tests PASS, aucune erreur de type, export Android réussi ; supprimer ensuite `.expo-export-check`.

- [ ] **Step 3 : Parcours dans le navigateur**

Créer `.claude/launch.json` :

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "opco-mobile-web",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["expo", "start", "--web", "--port", "8081"],
      "cwd": "C:\\Users\\magdo\\Desktop\\Claude\\Claude_OPCO\\opco-mobile\\apps\\mobile",
      "port": 8081
    }
  ]
}
```

Démarrer avec l'outil `preview_start` (nom `opco-mobile-web`) et dérouler les 5 scénarios de la tâche 18 dans l'interface (recherche d'une vraie entreprise par SIREN pour le scénario 1, saisie manuelle pour les autres). Pour chacun, vérifier : OPCO et certitude affichés, étapes adaptées au projet, plan de financement cohérent (financé ≤ coût), aides groupées par financeur avec sources cliquables, portails de la région. Faire une capture du plan de financement de chaque scénario.

- [ ] **Step 4 : Commit**

```bash
git add apps/mobile/app.json .claude/launch.json
git commit -m "app 1.3.0 : aides et financements, identification OPCO fiable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5 : Rendre compte à l'utilisateur** — résumé des corrections, chiffres du catalogue, limites (aides « à confirmer », liens à vérifier), et **demander son accord** avant : (a) push de la branche, (b) publication du dataset v4 sur `main` (met à jour les APK installés). Rappeler les actions de son ressort : secret `ANTHROPIC_API_KEY` et réactivation du workflow, envoi de la demande de licence, build EAS de l'APK 1.3.0.

---

# Révision du 06/10/2026 — cible : site web financementOPCO

L'utilisateur a choisi le **site financementOPCO** (Next.js 16, export statique, Hostinger) comme support final. Le moteur et les données (`@opco/core`) ne changent pas ; les écrans sont réalisés dans le site, intégré au monorepo sous `apps/web`. L'app mobile reste en l'état et doit continuer à compiler.

## Ce qui change dans le plan

- **Annulées** : tâches 6, 7, 14, 15 (écrans de l'app mobile) et 21 (version APK).
- **Facultative** : tâche 19 (dataset v4 pour les APK), seulement si l'utilisateur veut que les APK installés reçoivent les barèmes corrigés.
- **Compatibilité mobile** (s'applique aux tâches conservées) : ne supprimer aucun export de `@opco/core` utilisé par `apps/mobile` (`SirenSearchResult`, `SirenApiResponse`, `IdccOpcoMapping`, `resolveIdccToOpco` restent, marqués dépréciés) ; ne pas modifier `WIZARD_STEPS` ni retirer `isReconversion` / `isSortieChomage` de `WizardState` ; chaque tâche du moteur garde la vérification `cd apps/mobile && npx tsc --noEmit`.
- **Ordre d'exécution** : 1 → 2 → 3 → 4 → 5 → W1 → 8 → 9 → 10 → 11 → 12 → 13 → W2 → W3 → W4 → W5 → 16 → 17 → 18 → 20 → W6.
- **Conventions du site** : composants React DOM + Tailwind 4 du site (classes existantes : `border-rule`, `bg-cobalt`, `text-ink`, `bg-paper-deep`, `marginalia`, `font-display`…), textes en français, `'use client'` pour les composants interactifs, aucune nouvelle dépendance. Avant d'écrire du code Next.js, lire le guide pertinent dans `node_modules/next/dist/docs/` (consigne de `apps/web/AGENTS.md`).
- **Global Constraints** : celles du début du plan s'appliquent ; s'y ajoute : « le site reste exportable en statique (`output: 'export'`) et déployable sur Hostinger sans serveur ».

### Task W1 : Intégrer le site dans le monorepo (`apps/web`)

**Files:** Create `apps/web/` (copie de `C:\Users\magdo\Desktop\Claude\Claude_OPCO\opco-funding` sans `node_modules`, `.next`, `out`, `.git`) ; Modify `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`.

- [ ] Copier `src/`, `public/`, `data/`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json`, `next-env.d.ts`, `package.json`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `start-app.bat`, `README.md` vers `apps/web/`. Le dossier d'origine n'est pas modifié.
- [ ] `apps/web/package.json` : `"name": "web"` ; conserver scripts et dépendances.
- [ ] `apps/web/next.config.ts` : conserver `output: 'export'`, `trailingSlash: true`, `images.unoptimized` ; `turbopack.root` = racine du monorepo (`path.resolve(__dirname, '../..')`, dépendances hissées) ; ajouter `transpilePackages: ['@opco/core']`.
- [ ] `apps/web/tsconfig.json` : ajouter dans `paths` `"@opco/core": ["../../packages/core/src/index.ts"]` (en plus de `@/*`).
- [ ] `npm install` à la racine ; `git diff --stat package-lock.json` ne doit montrer que l'ajout du workspace `web` et de ses dépendances (sinon restaurer les changements parasites).
- [ ] Vérifier : `npm run build --workspace web` → `apps/web/out/` contient `/`, `/simulateur/`, `/opco/` + 11 fiches, `/comprendre-les-opco/`, `/obligations/`, `/former-sans-budget/`, `/contact/`, `404.html`, `sitemap.xml`, `robots.txt`, `.htaccess`. `cd apps/mobile && npx tsc --noEmit` et `cd packages/core && npx vitest run` passent.
- [ ] Commit : `site : integration du site financementOPCO dans le monorepo (apps/web), sans changement fonctionnel`.

### Task W2 : Le site s'appuie sur le moteur et les données de `@opco/core`

**Dépend de :** tâches 2, 3, 4, 8 (barèmes OPCO vérifiés, pour ne pas régresser par rapport aux données de juillet du site).

**Files:** Modify `apps/web/src/components/wizard/*`, `apps/web/src/components/results/FundingBreakdown.tsx`, `apps/web/src/app/opco/page.tsx`, `apps/web/src/app/opco/[slug]/page.tsx`, `apps/web/src/hooks/useWizard.ts` ; Delete `apps/web/src/lib/calculator.ts`, `apps/web/src/lib/opco-resolver.ts`, `apps/web/data/` ; Modify `packages/core/src/types.ts` + `schema.ts` (champ facultatif `nom_complet?: string` dans `OpcoData`).

- [ ] Remplacer tous les imports du site vers `lib/calculator`, `lib/opco-resolver`, `data/opcos` et les types métier de `lib/types` par `@opco/core` (`calculateFunding`, `EMBEDDED_OPCOS`, `getEmbeddedOpcoBySlug`, `WizardState`, `createInitialWizardState`, labels). `apps/web/src/lib/types.ts` ne garde que ce qui est propre au site (ou disparaît).
- [ ] Branche : le site passe de `selectedBranche` / `baremes_par_branche` à `selectedBrancheId` / `variantes_branche` (application automatique par IDCC, choix manuel prioritaire — voir `resolveVarianteBranche`).
- [ ] Fiches OPCO : afficher depuis `OpcoData` de `@opco/core` ; `dispositifs_sans_budget` → `dispositifs_complementaires` (avec leur règle de cumul) ; `baremes_par_branche` → `variantes_branche` ; `generateStaticParams` à partir de `EMBEDDED_OPCOS`. Ajouter `nom_complet?: string` au type et au schéma (`z.string().optional()`), renseigné pour les 11 OPCO (reprendre les valeurs de `opco-funding/data/opcos/*.json` si absentes).
- [ ] `FundingBreakdown` du site : lire le `FundingResult` du moteur (lignes avec `poste`, dispositifs complémentaires, démarches) ; afficher dispositifs et démarches comme sections ; lien de contact seulement si `opcoEmail` non vide.
- [ ] Vérifier : build du site OK ; même scénario (AKTO, organismes de formation, 140 h à 4 200 €) cohérent avec les barèmes de la tâche 8 ; `cd apps/mobile && npx tsc --noEmit` ; tests core.
- [ ] Commit : `site : moteur et donnees partages (@opco/core), fiches OPCO alimentees par les baremes verifies`.

### Task W3 : Étape « Entreprise » du site

**Dépend de :** tâches 4, 5, 9.

**Files:** Modify `apps/web/src/components/wizard/StepIdentification.tsx` (réécriture), `apps/web/src/hooks/useSirenLookup.ts`, `apps/web/src/components/wizard/StepSituation.tsx`, `StepRecap.tsx`, `apps/web/src/hooks/useWizard.ts` ; Create `apps/web/src/components/ui/CertitudeBadge.tsx`, `apps/web/src/lib/etapes.ts`.

- [ ] `apps/web/src/lib/etapes.ts` : liste des étapes propre au site : `identification` « Entreprise », `situation` « Bénéficiaire », `formation`, `frais`, `recap` (la tâche W4 y ajoute `projet`). La barre de progression du site l'utilise à la place de `WIZARD_STEPS`.
- [ ] `useSirenLookup` : chaque résultat de l'API passe par `parseResultatRechercheEntreprises` → `EntrepriseInfo`.
- [ ] Réécrire l'étape avec le comportement décrit à la tâche 7 (même logique, rendu web) : recherche nom/SIREN/SIRET ; sélection → `resoudreOpco({ idccs, idccSiege, codeNaf }, EMBEDDED_IDCC, EMBEDDED_NAF)` et mise à jour de l'état (OPCO détecté, IDCC retenu, certitude, IDCC des établissements, région, département, NAF, tranche INSEE, structures, taille suggérée) ; carte entreprise ; carte OPCO avec `CertitudeBadge`, motif, avertissements, choix entre candidats, lien « Vérifier sur l'outil officiel France Compétences » (`URL_VERIFICATION_OPCO`, nouvel onglet), « Ce n'est pas mon OPCO » (liste des 11 OPCO) ; mode manuel : OPCO (facultatif pour « former le dirigeant ») + code postal → département/région ; région affichée et modifiable (`REGIONS_TRIEES`) ; taille (boutons) + effectif exact facultatif ; budget déjà consommé (déplacé depuis l'étape Situation) ; bloc des barèmes de branche.
- [ ] `canGoNext('identification')` : OPCO (sauf projet « former le dirigeant ») + région + taille.
- [ ] Vérifier : build du site, tests core, typecheck mobile ; essai dans le navigateur (`npm run dev --workspace web`) avec une vraie entreprise (ex. SIREN 814739728) : OPCO AKTO « identifié via la convention collective », région Île-de-France.
- [ ] Commit : `site : etape Entreprise (OPCO avec certitude, region, effectif, verification officielle)`.

### Task W4 : Parcours en 6 étapes du site

**Dépend de :** tâches 12, W3.

**Files:** Create `apps/web/src/components/wizard/StepProjet.tsx` ; Modify `StepSituation.tsx` (Bénéficiaire), `StepFormation.tsx`, `StepRecap.tsx`, `WizardContainer.tsx`, `apps/web/src/lib/etapes.ts`, `apps/web/src/hooks/useWizard.ts`.

- [ ] Ajouter l'étape `projet` en tête de `etapes.ts` (6 étapes) et `StepProjet` (5 choix `PROJET_LABELS`).
- [ ] « Bénéficiaire », « Formation » et « Récapitulatif » : mêmes champs, mêmes règles et mêmes libellés que les composants de la tâche 14 (versions web) — questions selon `STATUT_PAR_PROJET`, oui / non / je ne sais pas, niveau visé, éligibilité CPF, mois de début (`moisDepuisSaisie` / `saisieDepuisMois`), Qualiopi.
- [ ] `canGoNext` : règles de la tâche 14, étape 6 (par projet).
- [ ] Le site n'utilise plus `isReconversion` / `isSortieChomage` (les champs restent dans `@opco/core` pour l'app mobile).
- [ ] Vérifier : build, tests core, typecheck mobile ; parcours complet dans le navigateur pour les 5 projets.
- [ ] Commit : `site : parcours en 6 etapes (projet, entreprise, beneficiaire, formation enrichie)`.

### Task W5 : Écran « Votre plan de financement » du site

**Dépend de :** tâches 13, W4.

**Files:** Create `apps/web/src/components/results/PlanFinancement.tsx`, `AideCard.tsx`, `AidesList.tsx`, `PortailsRegionaux.tsx`, `apps/web/src/lib/format.ts` ; Modify `WizardContainer.tsx`, `FundingBreakdown.tsx`, `apps/web/src/app/simulateur/page.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/layout.tsx`.

- [ ] Calcul des résultats identique à la tâche 15 (étape 7c) : `calculateFunding` pour les projets salariés, `profilDepuisWizard`, `evaluerAides(EMBEDDED_AIDES, …, dateDeReference(…))`, `construirePlan`, portail de la région (`EMBEDDED_PORTAILS`).
- [ ] Composants web reprenant le contenu et les règles d'affichage de la tâche 15 : synthèse coût / financé / reste à charge ; financements empilés ; options au choix ; aides à l'employeur, rémunérations, avantages fiscaux et sociaux (séparés) ; montants selon dossier ; services gratuits ; aides groupées par financeur (statut, montant, libellé, raisons « à vérifier », conditions et démarches dépliables, bouton « Faire la demande », sources, date de vérification, fiabilité) ; non éligibles repliées sans les aides hors périmètre ; portails de la région ; détail OPCO ; boutons « Modifier mes informations », « Nouvelle simulation », « Imprimer / PDF » ; mise en page imprimable (`print:`).
- [ ] Textes : page simulateur et accueil présentent « tous les financements » (OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe…) ; métadonnées (`title`, `description`) mises à jour ; bouton final « Trouver mes financements ».
- [ ] Vérifier : build, tests core, typecheck mobile ; 5 scénarios dans le navigateur.
- [ ] Commit : `site : ecran Votre plan de financement (aides par financeur, plan plafonne, portails regionaux)`.

### Task W6 : Publication du site

**Dépend de :** toutes les tâches précédentes.

- [ ] `npm run build --workspace web` ; contrôle du contenu de `apps/web/out/`.
- [ ] Archive pour Hostinger : `C:\Users\magdo\Desktop\Claude\Claude_OPCO\financementOPCO-hostinger-2026-10.zip` (contenu de `out/` à la racine de l'archive, `.htaccess` inclus). Ne pas écraser l'archive de juillet.
- [ ] Workflow CI (`.github/workflows/update-dataset.yml`, tâche 20) : ajouter une étape `npm run build --workspace web` après les tests backend.
- [ ] `.claude/launch.json` : configuration `site-web` servant `apps/web/out` (`npx serve apps/web/out -l 3000`) ; dérouler les 5 scénarios de la tâche 18 dans le navigateur et capturer le plan de financement de chacun.
- [ ] `README.md` et `docs/donnees-aides.md` : le site (`apps/web`) est le support principal ; après une mise à jour des données : tests, build du site, nouvelle archive, dépôt sur Hostinger.
- [ ] Commit : `site : archive Hostinger, build du site en CI, documentation`.
- [ ] Rendre compte à l'utilisateur et demander son accord avant tout push ; rappeler les actions de son ressort (dépôt de l'archive sur Hostinger, secret `ANTHROPIC_API_KEY`, demande de licence France Compétences).

