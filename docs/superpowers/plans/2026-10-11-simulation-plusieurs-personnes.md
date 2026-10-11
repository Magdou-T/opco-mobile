# Plan d'implémentation : simulation de plusieurs personnes formées en même temps

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au simulateur du site de chiffrer la formation de plusieurs personnes en même temps, avec des profils différents, sans changer un centime pour une personne seule.

**Architecture:** Un groupe est une liste de profils, chacun avec un nombre de personnes. Le moteur de l'OPCO (`calculateFunding`) reçoit le nombre de personnes qui relèvent du plan de développement des compétences et applique le plafond annuel une seule fois à ce total. Son résultat est réparti entre les profils salariés en centimes entiers ; chaque profil construit son plan de financement par le `construirePlan` actuel, appliqué à un bloc de `nombre` personnes ; les plans et les aides des profils sont fusionnés pour l'écran. Le parcours du site gère les profils (état normalisé par des fonctions pures) et l'écran de résultats ajoute le détail par profil.

**Tech Stack:** TypeScript 5, Vitest 2.1 (cœur), `node:test` via tsx (site), Next.js 16.2.1 en export statique, React 19.2.3, Tailwind 4. Aucune dépendance nouvelle.

**Spec:** `docs/superpowers/specs/2026-10-11-simulation-plusieurs-personnes-design.md` (commit `d9d7b45`). Le plan l'applique ; l'exécutant lit les deux.

## Global Constraints

- Branche `feature/simulation-groupe` (locale, issue de `feature/integration-wordpress` au commit `c21b924`). **Aucun push, aucune PR, aucune fusion** sans accord explicite de l'utilisateur.
- Chaque commit nomme ses fichiers un par un (`git add <chemin>`), jamais `git add -A` ni `git add .`, et se termine par la ligne `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Avant la tâche 1, commiter ce plan lui-même (`git add docs/superpowers/plans/2026-10-11-simulation-plusieurs-personnes.md`, message « documents : plan d'implémentation de la simulation de plusieurs personnes ») : la garde `check:tirets` ne lit que les fichiers suivis par git.
- `@opco/core` reste **pur** : aucune E/S, aucune lecture de l'horloge. Nouveaux exports additifs seulement : l'app mobile et le backend compilent sans modification.
- **Aucun montant inventé.** L'incertitude ne s'additionne jamais : une règle qu'on ne sait pas étendre à un groupe reste prudente ou non chiffrée.
- Une personne seule donne exactement les mêmes résultats qu'avant : l'empreinte de la tâche 2 s'exécute (« 1 passed », jamais « skipped ») et reste verte, comme les suites existantes, sauf les trois mises à jour de la spécification (section 10.3).
- Charte SFG, pour tout texte et tout code du site : **jamais de tiret cadratin** (U+2014, U+2015, U+2E3A, U+2E3B, U+FE31, U+FE58), aucun émoji, ni bleu ni violet, Montserrat et Inter seulement (aucune police à chasse fixe), apostrophes droites `'` dans le code, ton direct de collègue expert (ni « il est important de noter », ni « de plus », ni « n'hésitez pas »).
- Typographie du site : espace insécable avant « : ; ? ! » et entre un nombre et son unité (`typo`, `nombreEtUnite`, `INSECABLE`, entité `&nbsp;` en JSX). Un texte JSX sur plusieurs lignes qui contient une entité commence par `{' '}` quand il suit une balise (garde `tests/jsx-espaces.test.ts`).
- Textes écrits par le moteur : nombres à point décimal et `avecUnite` (`packages/core/src/texte.ts`) ; l'écran les réécrit par `texteMoteur`.
- Pas de nouvelle dépendance npm.
- Disque presque plein : supprimer `apps/web/.next` après chaque build (environ 730 Mo), ne pas copier le dépôt, ne pas lancer `npm ci` en cours de travail.
- Les outils Bash et PowerShell gardent leur `cd` d'un appel à l'autre : écrire des chemins absolus, ou commencer chaque commande par `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile`.
- Un hook de contrôle refuse la première création de chaque fichier et toute commande contenant `rm` : énoncer les quatre faits demandés (appelants, doublon, données, consigne verbatim) puis relancer la même commande. Créer un nouveau fichier par un `Write` court (titre seul), puis le remplir par `Edit`.
- Next.js 16 : aucune API nouvelle n'est utilisée (composants clients React comme les autres étapes) ; ne rien introduire qui demande de relire `node_modules/next/dist/docs/`.

**Commandes de vérification** (chacune se lance depuis n'importe où, chemin absolu inclus) :

| Quoi | Commande |
|---|---|
| Cœur, tests | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run` |
| Cœur, un fichier | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/<fichier>.test.ts` |
| Cœur, typage | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx tsc --noEmit` |
| Site, tests | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run test:web` |
| Site, un fichier | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && node --import tsx --test apps/web/tests/<fichier>.test.ts` |
| Site, typage | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/web && npx tsc --noEmit` |
| Site, lint | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run lint --workspace web` |
| Mobile, typage | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/mobile && npx tsc --noEmit` |
| Backend | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/backend && npx vitest run && npx tsc --noEmit` |
| Charte | `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run check:charte && npm run check:tirets` |

## Review Focus

Les cinq entrées ou situations que la spécification suppose sans que les tâches nominales les éprouvent, de la plus probable à la moins probable. Chacune a son test dans la tâche qui détient le code.

1. **Compteur de personnes** : un visiteur tape 0, un nombre négatif, 3,7, « abc », 150 ou vide. Attendu : toujours un entier de 1 à 99, jamais `NaN` ni 0 (tâche 9, `lireEffectif`, `normaliserGroupe`, `definirNombre`).
2. **Groupe sans durée ni prix** (prix du groupe saisi avant la durée, ou durée effacée) : aucune division par zéro, coût horaire vide, écran de résultats en état « coût inconnu », jamais « 0 € » (tâches 9 et 11).
3. **Plafond annuel déjà épuisé ou à 0 €** avec un groupe : 0 € financé, aucun montant négatif, un seul message de budget nul (tâche 3).
4. **Groupe sans aucun salarié** (dirigeant et alternant) ou sans OPCO connu : pas de calcul de l'OPCO, notes correctes, aucune mention « pour 0 personne » (tâche 11).
5. **Changement de statut ou retrait d'un profil** en cours de saisie : aucune réponse d'un autre statut ne survit, les réponses « Je ne sais pas » d'un profil retiré disparaissent, l'identifiant d'un profil retiré peut resservir sans fuite d'état (tâches 9 et 12).

## Écarts avec la spécification

Trois précisions de forme, sans effet sur ce que voit le visiteur, puis un écart qui se voit à l'écran :

1. `AideEvaluee` reçoit un champ optionnel `profils?: ConcerneParAide[]` au lieu d'un type `AideEvalueeDuGroupe` : même contenu, un type de moins, et les composants de l'écran n'ont aucun type à élargir.
2. `calculer` utilise le résultat du moteur tel quel quand un seul profil relève de l'OPCO (aucune répartition) : c'est ce qui garantit l'identité avec le calcul actuel.
3. Les lignes de détail du groupe se lisent « Coût pour 4 personnes : … », « Financement pour 4 personnes : … » et « Pour 4 personnes : … » selon la ligne qu'elles prolongent.
4. Le résumé d'une carte de profil replié tient en une ligne (`libelleDuProfil` : statut, contrat, âge, RQTH), suivie de « À compléter : … » quand une réponse obligatoire manque, au lieu des puces de la spécification (7.2). Le diplôme et le solde CPF se lisent dans le volet déplié et au récapitulatif. Une phrase en tête du volet d'un profil de plusieurs personnes rappelle que ses réponses valent pour chacune.

## Structure des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `packages/core/src/types.ts` | Limites, `ChampsProfil`, `ProfilSupplementaire`, champs du groupe dans `WizardState`, `FundingResult.personnes` | 1, 3 |
| `packages/core/src/calculator.ts` | `calculateFunding(opco, state, personnes = 1)` | 3, 4 |
| `packages/core/src/groupe.ts` (nouveau) | Profils du groupe, effectif, état d'un profil, répartition, plan d'un bloc, fusion des plans et des aides | 5 à 8 |
| `packages/core/src/aides/types.ts` | `ConcerneParAide`, `AideEvaluee.profils?` | 8 |
| `packages/core/src/aides/plan.ts` | `LignePlan.personnes?` | 7 |
| `packages/core/src/aides/evaluer.ts` | `trierAidesEvaluees` exporté | 8 |
| `packages/core/src/index.ts` | Export de `groupe.ts` | 5 |
| `packages/core/tests/empreinte-une-personne.test.ts` (nouveau) | Garde : 3 072 calculs à une personne, empreinte inchangée | 2 |
| `packages/core/tests/calculator-groupe.test.ts` (nouveau) | Moteur pour `n` personnes | 3, 4 |
| `packages/core/tests/groupe.test.ts` (nouveau) | État du groupe, répartition, plan, fusions | 1, 5 à 8 |
| `packages/core/tests/aides-plan.test.ts` | L'assistant `resultatOpco` renseigne `personnes` | 3 |
| `apps/web/src/lib/groupe.ts` (nouveau) | État du groupe : normalisation, ajout, retrait, prix, OPCO et budget du groupe, « Je ne sais pas » par profil, prix affiché | 9, 12, 14 |
| `apps/web/src/lib/profils.ts` (nouveau) | Libellés d'un profil | 10 |
| `apps/web/src/lib/parcours.ts`, `etapes.ts`, `situation.ts` | `champsDepuisProjet`, étape « Participants », champs manquants, étiquettes | 9, 10, 12 |
| `apps/web/src/lib/resultats.ts` | `calculer` du groupe, notes de l'OPCO, détails du bandeau, tableau par profil, « concerne » | 11, 15 |
| `apps/web/src/hooks/useWizard.ts` | Actions du groupe, « Je ne sais pas » par profil | 12 |
| `apps/web/src/components/wizard/CompteurPersonnes.tsx`, `CarteProfil.tsx`, `FormulaireProfil.tsx` (nouveaux), `StepSituation.tsx`, `WizardContainer.tsx` | Étape Participants | 13 |
| `apps/web/src/components/wizard/StepFormation.tsx`, `StepFrais.tsx`, `StepRecap.tsx`, `StepIdentification.tsx` | Prix, frais, récapitulatif, OPCO et budget du groupe | 14 |
| `apps/web/src/components/results/ParProfil.tsx` (nouveau), `BandeauSynthese.tsx`, `PlanFinancement.tsx`, `AideCard.tsx`, `AidesList.tsx`, `FundingBreakdown.tsx`, `EcranResultats.tsx` | Écran de résultats du groupe | 15 |
| `apps/web/tests/groupe.test.ts`, `resultats-groupe.test.ts` (nouveaux), `parcours.test.ts` | Tests du site | 1, 9 à 12, 14, 15 |
| `apps/web/DESIGN.md`, `README.md`, `docs/deploiement-site.md` | Documentation et mesures | 16 |

---

# Partie A : le cœur (`@opco/core`)

### Task 1 : Modèle de l'état d'un groupe

**Files:**
- Modify: `packages/core/src/types.ts` (bloc du bénéficiaire de `WizardState`, après l'interface, `createInitialWizardState`)
- Create: `packages/core/tests/groupe.test.ts`
- Modify: `apps/web/tests/parcours.test.ts` (la garde qui lit `types.ts` par blocs de commentaires connaît les trois champs du groupe)

**Interfaces:**
- Consumes: rien.
- Produces: `MAX_PROFILS = 6`, `MAX_PERSONNES = 99`, `type ChampsProfil`, `interface ProfilSupplementaire { id: string; nombre: number } & ChampsProfil`, et dans `WizardState` : `nombrePersonnes: number`, `autresProfils: ProfilSupplementaire[]`, `prixDuGroupe: number | null`.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `packages/core/tests/groupe.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState } from '../src/types';
import type { WizardState } from '../src/types';

describe('état initial d’un groupe', () => {
  it('une personne, aucun profil supplémentaire, prix saisi par personne', () => {
    const etat = createInitialWizardState();
    expect(etat.nombrePersonnes).toBe(1);
    expect(etat.autresProfils).toEqual([]);
    expect(etat.prixDuGroupe).toBeNull();
  });

  it('limites du groupe : 6 profils et 99 personnes', () => {
    expect(MAX_PROFILS).toBe(6);
    expect(MAX_PERSONNES).toBe(99);
  });

  it('chaque état initial a son propre tableau de profils (aucun partage entre deux simulations)', () => {
    const a = createInitialWizardState();
    const b = createInitialWizardState();
    expect(a.autresProfils).not.toBe(b.autresProfils);
  });

  it('un état enregistré avant l’évolution reste valide une fois fusionné sur l’état initial (app mobile)', () => {
    const ancien: Partial<WizardState> = { projetType: 'formation_salarie', ageBeneficiaire: 40, soldeCpf: 800 };
    const etat = { ...createInitialWizardState(), ...ancien };
    expect(etat.nombrePersonnes).toBe(1);
    expect(etat.autresProfils).toEqual([]);
    expect(etat.ageBeneficiaire).toBe(40);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/groupe.test.ts`
Expected: FAIL (`MAX_PROFILS` n'est pas exporté, `nombrePersonnes` vaut `undefined`).

- [ ] **Step 3 : écrire le code**

Dans `packages/core/src/types.ts`, remplacer

```ts
  /** Région de résidence du bénéficiaire, si différente de celle de l'entreprise. */
  regionBeneficiaireCode: CodeRegion | null;

  // Étape 3 : formation
```

par

```ts
  /** Région de résidence du bénéficiaire, si différente de celle de l'entreprise. */
  regionBeneficiaireCode: CodeRegion | null;

  // Étape 2 bis : personnes formées (plusieurs personnes, profils différents)
  /** Personnes qui ont le profil principal (les champs de l'étape 2 ci-dessus) ; 1 par défaut. */
  nombrePersonnes: number;
  /** Profils supplémentaires du groupe, dans l'ordre de saisie ; vide par défaut. */
  autresProfils: ProfilSupplementaire[];
  /**
   * Prix de la formation pour tout le groupe (euros) ; null : `pedagogyCostTotal` est saisi par personne. Renseigné, il
   * impose `pedagogyCostTotal = prixDuGroupe / personnes` (le parcours du site le maintient) ; le moteur ne le lit jamais.
   */
  prixDuGroupe: number | null;

  // Étape 3 : formation
```

Juste après l'accolade fermante de `interface WizardState` (avant `// --- Calculation Result Types ---`), insérer :

```ts
// --- Plusieurs personnes formées en même temps ---

/** Profils au plus dans un groupe (le profil principal et cinq autres). */
export const MAX_PROFILS = 6;
/** Personnes au plus dans un groupe, tous profils confondus. */
export const MAX_PERSONNES = 99;

/** Ce qui décrit une personne formée : les réponses de l'étape « Participants », projet compris. */
export type ChampsProfil = Pick<
  WizardState,
  | 'projetType'
  | 'contractType'
  | 'anciennete_mois'
  | 'isHandicap'
  | 'ageBeneficiaire'
  | 'niveauDiplome'
  | 'typeAlternance'
  | 'inscritFranceTravail'
  | 'statutDirigeant'
  | 'microEntrepreneur'
  | 'soldeCpf'
  | 'regionBeneficiaireCode'
>;

/** Profil supplémentaire d'un groupe : ses réponses, son identifiant et le nombre de personnes qui l'ont. */
export interface ProfilSupplementaire extends ChampsProfil {
  /** 'profil-2', 'profil-3'… : stable tant que le profil existe (clé d'affichage, lien profil / aide). */
  id: string;
  /** Nombre de personnes qui ont ce profil, de 1 à MAX_PERSONNES. */
  nombre: number;
}
```

Dans `createInitialWizardState`, remplacer

```ts
    regionBeneficiaireCode: null,
    formationNom: null,
```

par

```ts
    regionBeneficiaireCode: null,
    nombrePersonnes: 1,
    autresProfils: [],
    prixDuGroupe: null,
    formationNom: null,
```

Dans `apps/web/tests/parcours.test.ts`, après la ligne `const CHAMPS_NON_POSES = ['isReconversion', 'isSortieChomage'];` ajouter

```ts
/** Champs du groupe (étape Participants) : posés par l'étape 3 pour tous les projets, jamais masqués par un projet. */
const CHAMPS_DU_GROUPE = ['nombrePersonnes', 'autresProfils', 'prixDuGroupe'];
```

et, dans le test « garde : chaque champ du bénéficiaire est commun, propre à un statut, ou non posé par le site », remplacer `const classes = [...QUESTIONS_COMMUNES, ...PROPRES, ...CHAMPS_NON_POSES];` par `const classes = [...QUESTIONS_COMMUNES, ...PROPRES, ...CHAMPS_NON_POSES, ...CHAMPS_DU_GROUPE];`. Dans le titre du test, ajouter « du groupe » : `'garde : chaque champ du bénéficiaire est commun, propre à un statut, du groupe, ou non posé par le site'`.

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run && npx tsc --noEmit`
Expected: toute la suite verte (le test de la tâche 1 passe), typage sans erreur.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/mobile && npx tsc --noEmit` puis `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/backend && npx tsc --noEmit`
Expected: aucune erreur (l'app mobile et le backend ne construisent jamais un `WizardState` complet à la main).

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run test:web`
Expected: toute la suite du site verte. La garde « chaque champ du bénéficiaire est commun, propre à un statut, du groupe, ou non posé par le site » lit `types.ts` par blocs de commentaires : sans la mise à jour ci-dessus, elle échouerait sur les trois champs nouveaux, qui tombent dans le bloc « Étape 2 » avant le commentaire `// Étape 3 : formation`.

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add packages/core/src/types.ts packages/core/tests/groupe.test.ts apps/web/tests/parcours.test.ts
git commit -m "$(cat <<'EOF'
core : état d'un groupe de personnes formées (profils, effectif, prix du groupe)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2 : Empreinte de référence « une personne »

Cette tâche s'écrit **avant** toute modification du moteur : elle fige ce que `calculateFunding` rend aujourd'hui pour une personne, pour que les tâches 3 et 4 ne puissent rien changer à ce résultat sans que la suite l'écrive.

**Files:**
- Create: `packages/core/tests/empreinte-une-personne.test.ts`

**Interfaces:**
- Consumes: `calculateFunding(opco, state)` (signature actuelle), `EMBEDDED_OPCOS`, `makeFormationState`.
- Produces: la garde `empreinte-une-personne.test.ts` (3 072 calculs, SHA-256 `18d94f96…8430`, appliquée tant que les barèmes embarqués ont l'empreinte `d235ee3f…ab2e`, dates de vérification exclues, délai de 30 s).

- [ ] **Step 1 : écrire le test (il passe dès maintenant)**

Créer `packages/core/tests/empreinte-une-personne.test.ts` :

```ts
// Garde de non-régression : pour UNE personne, le moteur de l'OPCO rend ce qu'il rendait avant l'évolution « plusieurs
// personnes ». L'empreinte (SHA-256) porte sur le JSON de 3 072 calculs : les onze OPCO, leurs branches, quatre tailles,
// quatre types de formation, sans frais puis avec frais, deux coûts, un budget déjà consommé sur trois. Elle a été relevée
// au commit c21b924, avant toute modification du moteur ; le champ `personnes` que l'évolution ajoute en est retiré.
// Elle ne couvre que cette grille (présentiel, un seul mode de transport, deux durées) : le reste repose sur les autres
// tests du cœur.
// Les barèmes embarqués sont une entrée du calcul : une mise à jour légitime des données change l'empreinte des résultats
// sans qu'aucune régression du moteur n'existe. La garde ne s'applique donc que tant que les barèmes sont ceux du commit de
// référence (empreinte des données ci-dessous, dates de vérification exclues : le contrôle de fraîcheur les renouvelle
// chaque année et le moteur ne les lit pas) ; dès que les barèmes changent, le test est ignoré (« skipped » dans la
// sortie), et celui qui met les données à jour décide de retirer cette garde ou d'en relever une nouvelle avec un moteur de
// référence. Un « skipped » n'est pas un succès : les tâches du plan exigent « 1 passed ».
// Si ce test échoue, relire d'abord la différence : une personne seule ne doit changer ni un montant ni un caractère.
// Ne remplacer l'empreinte qu'après accord de l'utilisateur, jamais pour « faire passer » la suite.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { calculateFunding } from '../src/calculator';
import { EMBEDDED_OPCOS } from '../src/data';
import type { CompanySize, FundingResult, OpcoData, TrainingType, WizardState } from '../src/types';
import { makeFormationState } from './fixtures';

const EMPREINTE_AU_COMMIT_C21B924 = '18d94f9697450f9bec1467cbdecaec8bd5ac1bb933e540be4fd3b9f7f9548430';
const EMPREINTE_DES_BAREMES_AU_COMMIT_C21B924 = 'd235ee3fbd615390ba7a46c55b7ca7e9e9b4e6950789b27383970916e1cfab2e';
const NOMBRE_DE_CALCULS = 3072;

/** Dates de vérification des barèmes : renouvelées chaque année par le contrôle de fraîcheur, jamais lues par le moteur. */
const DATES_DE_VERIFICATION = new Set(['derniere_verification', 'derniere_mise_a_jour']);
const empreinte = (valeur: unknown, ignorees: ReadonlySet<string> = new Set()): string =>
  createHash('sha256')
    .update(JSON.stringify(valeur, (cle, v: unknown) => (ignorees.has(cle) ? undefined : v)))
    .digest('hex');
/** Vrai tant que les barèmes embarqués (`EMBEDDED_OPCOS`) sont ceux du commit de référence, dates de vérification mises à part. */
const BAREMES_DE_REFERENCE = empreinte(EMBEDDED_OPCOS, DATES_DE_VERIFICATION) === EMPREINTE_DES_BAREMES_AU_COMMIT_C21B924;

const TAILLES: CompanySize[] = ['less_11', '11_49', '50_299', '300_plus'];
const TYPES: { formationType: TrainingType; certificationLevel: WizardState['certificationLevel'] }[] = [
  { formationType: 'non_certifiante', certificationLevel: 'aucune' },
  { formationType: 'cqp', certificationLevel: 'cqp' },
  { formationType: 'certification', certificationLevel: 'rncp' },
  { formationType: 'habilitation', certificationLevel: 'habilitation' },
];
const FRAIS: Partial<WizardState>[] = [
  {},
  {
    needsTransport: true,
    transportMode: 'train',
    trainingDays: 5,
    needsAccommodation: true,
    accommodationNights: 4,
    accommodationCostPerNight: 120,
    needsMeals: true,
    mealCostPerDay: 15,
  },
];
const COUTS = [
  { durationHours: 35, pedagogyCostTotal: 1400 },
  { durationHours: 140, pedagogyCostTotal: 9800 },
];

function casDeReference(): { opco: OpcoData; state: WizardState }[] {
  const cas: { opco: OpcoData; state: WizardState }[] = [];
  for (const opco of EMBEDDED_OPCOS) {
    const idccs = [null, ...(opco.variantes_branche ?? []).map((v) => v.idcc[0] ?? null)];
    for (const idcc of idccs) {
      for (const companySize of TAILLES) {
        for (const type of TYPES) {
          for (const frais of FRAIS) {
            for (const cout of COUTS) {
              const i = cas.length;
              cas.push({
                opco,
                state: makeFormationState({
                  selectedOpcoSlug: opco.slug,
                  detectedIdcc: idcc,
                  companySize,
                  trainingMode: 'presentiel',
                  ...type,
                  ...frais,
                  durationHours: cout.durationHours,
                  pedagogyCostTotal: cout.pedagogyCostTotal,
                  pedagogyCostPerHour: cout.pedagogyCostTotal / cout.durationHours,
                  budgetDejaConsomme: i % 3 === 0 ? 3000 : null,
                }),
              });
            }
          }
        }
      }
    }
  }
  return cas;
}

describe('une personne : le moteur de l’OPCO rend ce qu’il rendait avant l’évolution', () => {
  // Délai de 30 s : le calcul prend de 1 à 5 secondes selon la machine, et Vitest coupe un test à 5 secondes par défaut.
  it.skipIf(!BAREMES_DE_REFERENCE)(
    `empreinte de ${NOMBRE_DE_CALCULS} calculs`,
    () => {
      const cas = casDeReference();
      expect(cas).toHaveLength(NOMBRE_DE_CALCULS);
      const sortie = cas.map(({ opco, state }) => {
        // `personnes` n'existait pas au commit de référence : il est retiré avant de calculer l'empreinte.
        const { personnes: _personnes, ...reste } = calculateFunding(opco, state) as FundingResult & { personnes?: number };
        return reste;
      });
      expect(empreinte(sortie)).toBe(EMPREINTE_AU_COMMIT_C21B924);
    },
    30_000,
  );
});
```

- [ ] **Step 2 : vérifier qu'il passe sur le moteur actuel**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/empreinte-une-personne.test.ts`
Expected: PASS (1 test, **aucun test ignoré** : si la sortie dit « skipped », l'empreinte des barèmes ne correspond pas aux données du dépôt, il faut s'arrêter et relire `git status` et `git diff -- packages/core/data`). S'il échoue, **ne pas continuer** : l'état de départ n'est pas celui du commit `c21b924` (relire `git status` et `git diff -- packages/core/src/calculator.ts`).

- [ ] **Step 3 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add packages/core/tests/empreinte-une-personne.test.ts
git commit -m "$(cat <<'EOF'
core : empreinte de référence du moteur de l'OPCO pour une personne (3 072 calculs)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3 : Moteur de l'OPCO, première moitié (coûts pédagogiques, plafond annuel, plan fermé)

**Files:**
- Modify: `packages/core/src/types.ts` (`FundingResult`)
- Modify: `packages/core/src/calculator.ts` (helpers de texte, `calcPedagogy`, `lignesPdcFerme`, `calculateFunding`)
- Modify: `packages/core/tests/aides-plan.test.ts` (assistant `resultatOpco`)
- Modify: `packages/core/tests/fixtures.ts` (`sourced` exporté, `opcoGroupe`, `etatGroupe`)
- Create: `packages/core/tests/calculator-groupe.test.ts`

**Interfaces:**
- Consumes: `compte`, `avecUnite`, `de`, `apposition` de `packages/core/src/texte.ts` (déjà importés par `calculator.ts`).
- Produces: `calculateFunding(opco: OpcoData, state: WizardState, personnes?: number): FundingResult` ; `FundingResult.personnes: number` ; helpers privés `personnesChiffrees(personnes)`, `pourLeGroupe(n)`, `detailDeGroupe(n, parPersonne, total, debut?)` réutilisés par la tâche 4.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `packages/core/tests/fixtures.ts`, remplacer `const sourced = (value: number | null) => ({` par `export const sourced = (value: number | null) => ({` et ajouter à la fin du fichier :

```ts

/** OPCO de test pour les groupes : plafond horaire 40 €/h, salaires 12 €/h, transport 30 €/jour, nuit 100 €, repas 20 €, sans plafond annuel. */
export function opcoGroupe(over: Partial<OpcoData> = {}): OpcoData {
  return makeOpco({
    cout_horaire_inter: sourced(40),
    prise_en_charge_salaires: sourced(12),
    prise_en_charge_salaires_mode: 'euro_par_heure',
    frais_transport: sourced(30),
    frais_hebergement: sourced(100),
    frais_restauration: sourced(20),
    ...over,
  });
}

/** Formation d'UNE personne : 100 h à 5 000 € (50 €/h, au-dessus du plafond), avec déplacement, hébergement et repas. */
export function etatGroupe(over: Partial<WizardState> = {}): WizardState {
  return makeFormationState({
    durationHours: 100,
    pedagogyCostTotal: 5000,
    pedagogyCostPerHour: 50,
    needsTransport: true,
    trainingDays: 5,
    needsAccommodation: true,
    accommodationNights: 4,
    accommodationCostPerNight: 120,
    needsMeals: true,
    mealCostPerDay: 15,
    ...over,
  });
}
```

Créer `packages/core/tests/calculator-groupe.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { calculateFunding } from '../src/calculator';
import { etatGroupe, opcoGroupe, sourced } from './fixtures';

/** Espace insécable (U+00A0), construite par son code : entre un nombre et son unité dans les textes du moteur. */
const NBSP = String.fromCharCode(0xa0);

const poste = (r: ReturnType<typeof calculateFunding>, p: string) => r.lines.find((l) => l.poste === p)!;

describe('calculateFunding pour n personnes : coûts pédagogiques', () => {
  it('une personne : `personnes` vaut 1 et aucune ligne de détail ne parle de groupe', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe());
    expect(r.personnes).toBe(1);
    expect(poste(r, 'pedagogie')).toMatchObject({ requestedAmount: 5000, fundedAmount: 4000, remainder: 1000 });
    expect((poste(r, 'pedagogie').details ?? []).some((d) => d.includes('personne'))).toBe(false);
  });

  it('un appel explicite à 1 personne rend exactement le résultat de l’appel sans paramètre', () => {
    expect(calculateFunding(opcoGroupe(), etatGroupe(), 1)).toEqual(calculateFunding(opcoGroupe(), etatGroupe()));
  });

  it('quatre personnes : le coût demandé et le financement valent 4 fois ceux d’une personne', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe(), 4);
    expect(r.personnes).toBe(4);
    expect(poste(r, 'pedagogie')).toMatchObject({ requestedAmount: 20000, fundedAmount: 16000, remainder: 4000 });
  });

  it('le détail du calcul garde la ligne d’une personne et ajoute celle du groupe', () => {
    const details = poste(calculateFunding(opcoGroupe(), etatGroupe(), 4), 'pedagogie').details ?? [];
    expect(details).toContain(`Coût pour 4${NBSP}personnes : 5000.00${NBSP}€ × 4 = 20000.00${NBSP}€`);
    expect(details).toContain(`Financement pour 4${NBSP}personnes : 4000.00${NBSP}€ × 4 = 16000.00${NBSP}€`);
    expect(details).toContain(`Reste à charge pour 4${NBSP}personnes : 1000.00${NBSP}€ × 4 = 4000.00${NBSP}€`);
    expect(details).toContain(`Calcul : 40${NBSP}€/h × 100${NBSP}h = 4000.00${NBSP}€`);
  });

  it('la ligne « Coût pour » part du coût saisi, comme le coût demandé (coût horaire arrondi : 4250 € sur 140 h)', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe({ pedagogyCostTotal: 4250, pedagogyCostPerHour: 30.36, durationHours: 140 }), 4);
    expect(poste(r, 'pedagogie').requestedAmount).toBe(17000);
    expect(poste(r, 'pedagogie').details).toContain(`Coût pour 4${NBSP}personnes : 4250.00${NBSP}€ × 4 = 17000.00${NBSP}€`);
  });

  it('budget publié sans plafond horaire : le groupe est financé à hauteur du budget, une seule fois', () => {
    const opco = opcoGroupe({ cout_horaire_inter: sourced(null), budget_annuel_max: sourced(12000), budget_annuel_portee: 'pedagogie' });
    const trois = calculateFunding(opco, etatGroupe(), 3);
    expect(poste(trois, 'pedagogie')).toMatchObject({ requestedAmount: 15000, fundedAmount: 12000, remainder: 3000 });
    expect(trois.budgetCapApplied).toBe(true);
    expect(poste(calculateFunding(opco, etatGroupe(), 2), 'pedagogie')).toMatchObject({ requestedAmount: 10000, fundedAmount: 10000, remainder: 0 });
  });

  it('l’avertissement de dépassement donne le reste à charge du groupe et dit pour combien de personnes', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe(), 4);
    expect(r.warnings).toContain(
      `Le coût horaire demandé (50${NBSP}€/h) dépasse le plafond Test OPCO (40${NBSP}€/h). Le reste à charge est de 4000.00${NBSP}€ pour 4${NBSP}personnes.`,
    );
  });

  it('barème dégressif : financement et reste à charge du groupe', () => {
    const opco = opcoGroupe({
      cout_horaire_seuils: [
        { max_heures: 50, valeur: 40 },
        { max_heures: null, valeur: 20 },
      ],
      cout_horaire_seuils_mode: 'par_tranche',
    });
    const un = calculateFunding(opco, etatGroupe());
    const trois = calculateFunding(opco, etatGroupe(), 3);
    expect(poste(un, 'pedagogie')).toMatchObject({ requestedAmount: 5000, fundedAmount: 3000, remainder: 2000 });
    expect(poste(trois, 'pedagogie')).toMatchObject({ requestedAmount: 15000, fundedAmount: 9000, remainder: 6000 });
    expect(trois.warnings).toContain(
      `Le barème dégressif de Test OPCO laisse un reste à charge de 6000.00${NBSP}€ sur les coûts pédagogiques pour 3${NBSP}personnes.`,
    );
  });

  it('un nombre de personnes invalide (0, négatif, décimal, NaN, infini) est ramené à un entier d’au moins 1', () => {
    const base = calculateFunding(opcoGroupe(), etatGroupe());
    for (const n of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.4]) {
      expect(calculateFunding(opcoGroupe(), etatGroupe(), n), String(n)).toEqual(base);
    }
    expect(calculateFunding(opcoGroupe(), etatGroupe(), 3.9).personnes).toBe(3);
  });
});

describe('calculateFunding pour n personnes : plafond annuel de portée « pédagogie »', () => {
  const avecPlafond = (plafond: number) => opcoGroupe({ budget_annuel_max: sourced(plafond), budget_annuel_portee: 'pedagogie' });

  it('plafond non atteint : aucun effet', () => {
    const r = calculateFunding(avecPlafond(10000), etatGroupe(), 2);
    expect(poste(r, 'pedagogie').fundedAmount).toBe(8000);
    expect(r.budgetCapApplied).toBe(false);
  });

  it('plafond atteint par le groupe : le poste pédagogique est ramené au plafond, une seule fois', () => {
    const r = calculateFunding(avecPlafond(10000), etatGroupe(), 3);
    expect(poste(r, 'pedagogie').fundedAmount).toBe(10000);
    expect(r.budgetCapApplied).toBe(true);
    expect(r.budgetCapAmount).toBe(10000);
  });

  it('le budget déjà consommé est déduit une fois du plafond du groupe', () => {
    const r = calculateFunding(avecPlafond(10000), etatGroupe({ budgetDejaConsomme: 4000 }), 2);
    expect(poste(r, 'pedagogie').fundedAmount).toBe(6000);
    expect(r.budgetCapAmount).toBe(6000);
    expect(r.budgetDejaConsomme).toBe(4000);
  });

  it('plafond à 0 € ou déjà consommé : rien n’est financé, aucun montant négatif, un seul message de budget nul', () => {
    for (const [plafond, consomme] of [[0, null], [10000, 10000], [10000, 25000]] as const) {
      const r = calculateFunding(avecPlafond(plafond), etatGroupe({ budgetDejaConsomme: consomme }), 5);
      expect(poste(r, 'pedagogie')).toMatchObject({ requestedAmount: 25000, fundedAmount: 0, remainder: 25000 });
      expect(r.lines.every((l) => l.fundedAmount >= 0 && l.remainder >= 0)).toBe(true);
    }
    const nul = calculateFunding(avecPlafond(0), etatGroupe(), 5);
    expect(nul.warnings.filter((w) => w.includes("Aucun budget n'est disponible"))).toHaveLength(1);
  });
});

describe('calculateFunding pour n personnes : plan fermé aux 50 salariés et plus', () => {
  it('les lignes à 0 € demandent n fois le coût', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe({ companySize: '50_299' }), 4);
    expect(r.pdcFerme).toBe(true);
    expect(r.personnes).toBe(4);
    expect(poste(r, 'pedagogie')).toMatchObject({ requestedAmount: 20000, fundedAmount: 0, remainder: 20000 });
    expect(poste(r, 'hebergement')).toMatchObject({ requestedAmount: 1920, fundedAmount: 0 });
    expect(poste(r, 'restauration')).toMatchObject({ requestedAmount: 300, fundedAmount: 0 });
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/calculator-groupe.test.ts`
Expected: FAIL (`r.personnes` vaut `undefined`, les montants du groupe valent ceux d'une personne).

- [ ] **Step 3 : implémenter**

Dans `packages/core/src/types.ts`, interface `FundingResult`, après `modePaiement: string;` ajouter :

```ts
  /** Nombre de personnes chiffrées : les lignes et les totaux valent pour ce nombre de personnes (1 pour une personne seule). */
  personnes: number;
```

Dans `packages/core/tests/aides-plan.test.ts`, assistant `resultatOpco`, après la ligne `modePaiement: 'Tiers-payant',` ajouter `personnes: 1,`.

Dans `packages/core/src/calculator.ts`, appliquer les modifications suivantes (chaque `old` est unique dans le fichier).

**3a.** Après la ligne `const arrondi = (n: number): number => Math.round(n * 100) / 100;` insérer :

```ts

/** Nombre de personnes chiffrées : un entier d'au moins 1 (toute autre valeur, non finie comprise, donne 1). */
function personnesChiffrees(personnes: number): number {
  return Number.isFinite(personnes) ? Math.max(1, Math.floor(personnes)) : 1;
}

/** Fin d'une phrase qui donne le montant d'un groupe : « pour 4 personnes » (vide pour une personne seule). */
function pourLeGroupe(n: number): string {
  return n > 1 ? ` pour ${compte(n, 'personne', 'personnes')}` : '';
}

/**
 * Ligne de détail d'un calcul de groupe, à la suite de la ligne du calcul d'une personne :
 * « Pour 4 personnes : 1050.00 € × 4 = 4200.00 € ». Rien pour une personne seule.
 */
function detailDeGroupe(n: number, parPersonne: number, total: number, debut = 'Pour'): string[] {
  return n > 1
    ? [`${debut} ${compte(n, 'personne', 'personnes')} : ${avecUnite(parPersonne.toFixed(2), '€')} × ${n} = ${avecUnite(total.toFixed(2), '€')}`]
    : [];
}
```

**3b.** `calcPedagogy`, début de la fonction. Remplacer

```ts
  budgetAnnuelNul: boolean,
): { ligne: FundingLine; capApplique: boolean } {
  const hours = state.durationHours ?? 0;
  const userCostPerHour = state.pedagogyCostPerHour ?? 0;
  const requestedTotal = state.pedagogyCostTotal ?? userCostPerHour * hours;
  const details: string[] = [
    `Votre coût horaire : ${avecUnite(userCostPerHour, '€/h')} × ${avecUnite(hours, 'h')} = ${avecUnite((userCostPerHour * hours).toFixed(2), '€')}`,
  ];

  let funded: number;
```

par

```ts
  budgetAnnuelNul: boolean,
  /** Nombre de personnes chiffrées : tout montant de l'état est celui d'une personne. */
  n: number,
): { ligne: FundingLine; capApplique: boolean } {
  const hours = state.durationHours ?? 0;
  const userCostPerHour = state.pedagogyCostPerHour ?? 0;
  // Coût demandé pour UNE personne : le total saisi, à défaut coût horaire × heures (la ligne de groupe en part aussi).
  const coutParPersonne = state.pedagogyCostTotal ?? userCostPerHour * hours;
  const requestedTotal = coutParPersonne * n;
  const pour = pourLeGroupe(n);
  const details: string[] = [
    `Votre coût horaire : ${avecUnite(userCostPerHour, '€/h')} × ${avecUnite(hours, 'h')} = ${avecUnite((userCostPerHour * hours).toFixed(2), '€')}`,
    ...detailDeGroupe(n, coutParPersonne, requestedTotal, 'Coût pour'),
  ];

  // Le financement se calcule pour UNE personne, puis se multiplie par n avant le plafond annuel (celui de l'entreprise).
  let funded: number;
```

**3c.** Barème dégressif. Remplacer

```ts
    const reste = arrondi(userCostPerHour * hours - funded);
    if (reste > 0) {
      warnings.push(
        `Le barème dégressif ${de(opco.name)} laisse un reste à charge de ${avecUnite(reste.toFixed(2), '€')} sur les coûts pédagogiques.`,
      );
    }
```

par

```ts
    const reste = arrondi((userCostPerHour * hours - funded) * n);
    if (reste > 0) {
      warnings.push(
        `Le barème dégressif ${de(opco.name)} laisse un reste à charge de ${avecUnite(reste.toFixed(2), '€')} sur les coûts pédagogiques${pour}.`,
      );
    }
```

**3d.** Plafond horaire dépassé. Remplacer la ligne `        const reste = (userCostPerHour - ceiling) * hours;` par

```ts
        const resteParPersonne = (userCostPerHour - ceiling) * hours;
        const reste = resteParPersonne * n;
```

puis, dans les lignes qui suivent, quatre remplacements de texte :

- `? \`Votre coût dépasse le plafond de ${avecUnite(reste.toFixed(2), '€')} sur la formation → taux appliqué` devient `? \`Votre coût dépasse le plafond de ${avecUnite(resteParPersonne.toFixed(2), '€')} sur la formation → taux appliqué` (une personne dans le détail) ;
- `details.push(\`Reste à charge sur ce poste : ${avecUnite(reste.toFixed(2), '€')}\`);` devient `details.push(\`Reste à charge sur ce poste : ${avecUnite(resteParPersonne.toFixed(2), '€')}\`);` suivi, sur la ligne d'après, de `details.push(...detailDeGroupe(n, resteParPersonne, reste, 'Reste à charge pour'));` (le reste du groupe suit celui d'une personne, comme les lignes « Coût pour » et « Financement pour » ; rien pour une personne seule) ;
- `de ${avecUnite(reste.toFixed(2), '€')} sur la formation : ce montant reste à charge.\`` devient `de ${avecUnite(reste.toFixed(2), '€')} sur la formation${pour} : ce montant reste à charge.\`` ;
- `\`Le reste à charge est de ${avecUnite(reste.toFixed(2), '€')}.\`,` devient `\`Le reste à charge est de ${avecUnite(reste.toFixed(2), '€')}${pour}.\`,`.

**3e.** Juste avant `  let capApplique = false;` insérer :

```ts
  const financeParPersonne = funded;
  funded = financeParPersonne * n;
  if (financeParPersonne > 0) details.push(...detailDeGroupe(n, financeParPersonne, funded, 'Financement pour'));

```

**3f.** `lignesPdcFerme`. Remplacer

```ts
function lignesPdcFerme(opco: OpcoData, state: WizardState): FundingLine[] {
  const hours = state.durationHours ?? 0;
  const requested = state.pedagogyCostTotal ?? (state.pedagogyCostPerHour ?? 0) * hours;
```

par

```ts
function lignesPdcFerme(opco: OpcoData, state: WizardState, n: number): FundingLine[] {
  const hours = state.durationHours ?? 0;
  const requested = (state.pedagogyCostTotal ?? (state.pedagogyCostPerHour ?? 0) * hours) * n;
```

et, dans la même fonction, `(state.accommodationCostPerNight ?? 0) * (state.accommodationNights ?? 0), 0,` devient `(state.accommodationCostPerNight ?? 0) * (state.accommodationNights ?? 0) * n, 0,` ; `(state.mealCostPerDay ?? 0) * (state.trainingDays ?? 0), 0,` devient `(state.mealCostPerDay ?? 0) * (state.trainingDays ?? 0) * n, 0,`.

**3g.** `calculateFunding`. Remplacer

```ts
/**
 * Calculate OPCO funding estimate (plan de développement des compétences).
 * Pure function: same OpcoData + WizardState → same FundingResult.
 */
export function calculateFunding(rawOpcoData: OpcoData, state: WizardState): FundingResult {
  const earlyWarnings: string[] = [];
```

par

```ts
/**
 * Calculate OPCO funding estimate (plan de développement des compétences).
 * Pure function: same OpcoData + WizardState (+ same number of people) → same FundingResult.
 *
 * `personnes` : nombre de personnes qui suivent la même formation (1 par défaut). Tout montant de `state` (coût de la
 * formation, nuit d'hôtel, repas) est celui d'UNE personne ; les lignes et les totaux du résultat valent pour `personnes`
 * personnes, et le plafond annuel de l'OPCO, qui est celui de l'entreprise, s'applique une seule fois à ce total.
 * Le calcul ne lit ni `nombrePersonnes`, ni `autresProfils`, ni `prixDuGroupe` : l'appelant choisit qui est chiffré.
 */
export function calculateFunding(rawOpcoData: OpcoData, state: WizardState, personnes = 1): FundingResult {
  const n = personnesChiffrees(personnes);
  const earlyWarnings: string[] = [];
```

puis `allLines = lignesPdcFerme(opcoData, state);` devient `allLines = lignesPdcFerme(opcoData, state, n);` ; dans l'appel de `calcPedagogy`, ajouter `n,` après `budgetAnnuelNul,` ; enfin, à la fin de l'objet retourné, après `modePaiement: opcoData.mode_paiement,` ajouter `personnes: n,`.

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/calculator-groupe.test.ts tests/empreinte-une-personne.test.ts`
Expected: PASS. **L'empreinte doit s'exécuter et rester verte (« 1 passed », aucun « skipped »)** : c'est la preuve qu'une personne seule ne change pas.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run && npx tsc --noEmit`
Expected: suite entière verte, typage sans erreur.

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add packages/core/src/types.ts packages/core/src/calculator.ts packages/core/tests/calculator-groupe.test.ts packages/core/tests/aides-plan.test.ts packages/core/tests/fixtures.ts
git commit -m "$(cat <<'EOF'
core : calculateFunding pour n personnes (coûts pédagogiques, plafond annuel, plan fermé)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4 : Moteur de l'OPCO, seconde moitié (salaires, frais annexes, dispositifs)

**Files:**
- Modify: `packages/core/src/calculator.ts` (`calcSalary`, `calcTransport`, `calcAccommodation`, `calcMeals`, `evaluateDispositifs`, appels dans `calculateFunding`)
- Modify: `packages/core/tests/calculator-groupe.test.ts`

**Interfaces:**
- Consumes: `personnesChiffrees`, `pourLeGroupe`, `detailDeGroupe` et le paramètre `n` de la tâche 3.
- Produces: un moteur complet pour `n` personnes (toutes les lignes, le plafond annuel de portée « global », les dispositifs « par stagiaire »).

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `packages/core/tests/calculator-groupe.test.ts`, remplacer les importations du haut du fichier (jusqu'à `import { etatGroupe, opcoGroupe, sourced } from './fixtures';` compris) par

```ts
import { describe, expect, it } from 'vitest';
import { calculateFunding } from '../src/calculator';
import { EMBEDDED_OPCOS } from '../src/data';
import type { DispositifComplementaire } from '../src/types';
import { etatGroupe, makeFormationState, opcoGroupe, sourced } from './fixtures';
```

et ajouter à la fin du fichier :

```ts
describe('calculateFunding pour n personnes : salaires et frais annexes', () => {
  it('quatre personnes : chaque poste vaut 4 fois celui d’une personne', () => {
    const un = calculateFunding(opcoGroupe(), etatGroupe());
    const quatre = calculateFunding(opcoGroupe(), etatGroupe(), 4);
    // Une personne : salaires 12 €/h × 100 h ; transport 30 € × 5 jours ; nuit à 120 € plafonnée à 100 € ; repas à 15 €, sous le forfait.
    expect(poste(un, 'salaires')).toMatchObject({ requestedAmount: 1200, fundedAmount: 1200 });
    expect(poste(un, 'transport')).toMatchObject({ requestedAmount: 150, fundedAmount: 150 });
    expect(poste(un, 'hebergement')).toMatchObject({ requestedAmount: 480, fundedAmount: 400, remainder: 80 });
    expect(poste(un, 'restauration')).toMatchObject({ requestedAmount: 75, fundedAmount: 75, remainder: 0 });
    expect(un).toMatchObject({ totalRequested: 6905, totalFunded: 5825, totalRemainder: 1080 });
    expect(poste(quatre, 'salaires')).toMatchObject({ requestedAmount: 4800, fundedAmount: 4800 });
    expect(poste(quatre, 'transport')).toMatchObject({ requestedAmount: 600, fundedAmount: 600 });
    expect(poste(quatre, 'hebergement')).toMatchObject({ requestedAmount: 1920, fundedAmount: 1600, remainder: 320 });
    expect(poste(quatre, 'restauration')).toMatchObject({ requestedAmount: 300, fundedAmount: 300, remainder: 0 });
    expect(quatre).toMatchObject({ totalRequested: 27620, totalFunded: 23300, totalRemainder: 4320 });
  });

  it('le détail de chaque poste garde la ligne d’une personne et ajoute celle du groupe', () => {
    const r = calculateFunding(opcoGroupe(), etatGroupe(), 4);
    expect(poste(r, 'salaires').details).toContain(`Pour 4${NBSP}personnes : 1200.00${NBSP}€ × 4 = 4800.00${NBSP}€`);
    expect(poste(r, 'transport').details).toContain(`Pour 4${NBSP}personnes : 150.00${NBSP}€ × 4 = 600.00${NBSP}€`);
    expect(poste(r, 'hebergement').details).toContain(`Pour 4${NBSP}personnes : 400.00${NBSP}€ × 4 = 1600.00${NBSP}€`);
    expect(poste(r, 'restauration').details).toContain(`Pour 4${NBSP}personnes : 75.00${NBSP}€ × 4 = 300.00${NBSP}€`);
    expect(poste(r, 'salaires').note).toBe(`12${NBSP}€/h × 100${NBSP}h × 4${NBSP}personnes`);
    for (const p of ['salaires', 'transport', 'hebergement', 'restauration']) {
      const details = poste(calculateFunding(opcoGroupe(), etatGroupe()), p).details ?? [];
      expect(details.some((d) => d.includes('personne')), p).toBe(false);
    }
  });

  it('restauration au-dessus du forfait : le reste à charge du groupe suit celui d’une personne', () => {
    const details = poste(calculateFunding(opcoGroupe(), etatGroupe({ mealCostPerDay: 25 }), 4), 'restauration').details ?? [];
    expect(details).toContain(`Reste à charge : 25.00${NBSP}€`);
    expect(details).toContain(`Reste à charge pour 4${NBSP}personnes : 25.00${NBSP}€ × 4 = 100.00${NBSP}€`);
    const un = poste(calculateFunding(opcoGroupe(), etatGroupe({ mealCostPerDay: 25 })), 'restauration').details ?? [];
    expect(un).toContain(`Reste à charge : 25.00${NBSP}€`);
    expect(un.some((d) => d.includes('personne'))).toBe(false);
  });
});

describe('calculateFunding pour n personnes : plafond annuel de portée « global »', () => {
  const avecPlafond = (plafond: number) => opcoGroupe({ budget_annuel_max: sourced(plafond) });

  it('trois personnes sous le plafond : aucun effet', () => {
    const r = calculateFunding(avecPlafond(20000), etatGroupe(), 3);
    expect(r).toMatchObject({ totalFunded: 17475, budgetCapApplied: false, budgetCapAmount: null });
  });

  it('quatre personnes au-dessus du plafond : le total du groupe est ramené au plafond, lignes réduites du même ratio', () => {
    const r = calculateFunding(avecPlafond(20000), etatGroupe(), 4);
    expect(r).toMatchObject({ totalFunded: 20000, budgetCapApplied: true, budgetCapAmount: 20000 });
    const somme = r.lines.reduce((s, l) => s + l.fundedAmount, 0);
    expect(Math.abs(somme - 20000)).toBeLessThanOrEqual(0.03);
    expect(r.lines.every((l) => l.fundedAmount <= l.requestedAmount && l.remainder >= 0)).toBe(true);
    expect(poste(r, 'pedagogie').fundedAmount).toBeCloseTo((16000 * 20000) / 23300, 1);
  });

  it('le budget déjà consommé est déduit une seule fois du plafond du groupe', () => {
    const r = calculateFunding(avecPlafond(20000), etatGroupe({ budgetDejaConsomme: 5000 }), 3);
    expect(r).toMatchObject({ totalFunded: 15000, budgetCapApplied: true, budgetCapAmount: 15000, budgetDejaConsomme: 5000 });
  });
});

describe('calculateFunding pour n personnes : dispositifs complémentaires de l’OPCO', () => {
  const dispositif = (id: string, over: Partial<DispositifComplementaire>): DispositifComplementaire => ({
    id,
    nom: `Dispositif ${id}`,
    cumul: 'additif',
    montant_max: null,
    unite: null,
    pourcentage_couts: null,
    description: 'Dispositif fictif.',
    conditions: [],
    demarches: 'Déposer la demande.',
    tailles_eligibles: null,
    publics: null,
    confidence: 'exact',
    source_url: 'x',
    ...over,
  });
  const opco = opcoGroupe({
    dispositifs_complementaires: [
      dispositif('par-stagiaire', { cumul: 'alternatif', montant_max: 750, unite: 'par_stagiaire', pourcentage_couts: 50 }),
      dispositif('par-dossier', { montant_max: 500, unite: 'par_dossier' }),
      dispositif('par-heure', { montant_max: 10, unite: 'par_heure' }),
    ],
  });
  const montant = (r: ReturnType<typeof calculateFunding>, id: string) =>
    r.dispositifsComplementaires.find((d) => d.id === id)?.montantEstime;

  it('une personne : 50 % du coût plafonnés à 750 €, forfait de 500 €, 10 € par heure', () => {
    const r = calculateFunding(opco, etatGroupe());
    expect([montant(r, 'par-stagiaire'), montant(r, 'par-dossier'), montant(r, 'par-heure')]).toEqual([750, 500, 1000]);
  });

  it('quatre personnes : seul le plafond « par stagiaire » est multiplié', () => {
    const r = calculateFunding(opco, etatGroupe(), 4);
    // 50 % de 20 000 € = 10 000 €, plafonnés à 4 × 750 € ; les autres unités ne se multiplient pas (prudence).
    expect([montant(r, 'par-stagiaire'), montant(r, 'par-dossier'), montant(r, 'par-heure')]).toEqual([3000, 500, 1000]);
  });
});

describe('calculateFunding pour n personnes : données réelles', () => {
  it('sans plafond annuel atteint, chaque ligne du groupe vaut n fois celle d’une personne (au demi-centime par personne)', () => {
    let comparaisons = 0;
    for (const opco of EMBEDDED_OPCOS) {
      const idccs = [null, ...(opco.variantes_branche ?? []).map((v) => v.idcc[0] ?? null)];
      for (const idcc of idccs) {
        for (const taille of ['less_11', '11_49', '50_299'] as const) {
          const etat = makeFormationState({
            selectedOpcoSlug: opco.slug,
            detectedIdcc: idcc,
            companySize: taille,
            trainingMode: 'presentiel',
            formationType: 'certification',
            certificationLevel: 'rncp',
            durationHours: 35,
            pedagogyCostTotal: 1400,
            pedagogyCostPerHour: 40,
            needsTransport: true,
            trainingDays: 5,
            needsAccommodation: true,
            accommodationNights: 4,
            accommodationCostPerNight: 90,
            needsMeals: true,
            mealCostPerDay: 18,
          });
          const un = calculateFunding(opco, etat);
          for (const n of [2, 5, 12]) {
            const groupe = calculateFunding(opco, etat, n);
            expect(groupe.personnes).toBe(n);
            if (groupe.budgetCapApplied || un.budgetCapApplied) continue;
            comparaisons++;
            expect(groupe.lines.map((l) => l.poste)).toEqual(un.lines.map((l) => l.poste));
            groupe.lines.forEach((l, i) => {
              for (const champ of ['requestedAmount', 'fundedAmount', 'remainder'] as const) {
                expect(Math.abs(l[champ] - un.lines[i][champ] * n), `${opco.slug} ${idcc} ${taille} n=${n} ${l.poste} ${champ}`).toBeLessThanOrEqual(
                  0.005 * n + 0.005,
                );
              }
            });
          }
        }
      }
    }
    expect(comparaisons).toBeGreaterThan(150);
  });

  it('aucun texte du calcul d’un groupe ne promet plus que l’estimation', () => {
    const PROMESSES = /intégralement|garanti|assuré|totalité/i;
    let textes = 0;
    for (const opco of EMBEDDED_OPCOS) {
      const etat = makeFormationState({
        selectedOpcoSlug: opco.slug,
        trainingMode: 'presentiel',
        durationHours: 21,
        pedagogyCostTotal: 900,
        pedagogyCostPerHour: 900 / 21,
        needsMeals: true,
        mealCostPerDay: 12,
        trainingDays: 3,
      });
      const r = calculateFunding(opco, etat, 6);
      for (const t of [...r.lines.flatMap((l) => [l.note ?? '', ...(l.details ?? [])]), ...r.warnings]) {
        textes++;
        expect(t, opco.slug).not.toMatch(PROMESSES);
      }
    }
    expect(textes).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/calculator-groupe.test.ts`
Expected: FAIL sur les nouveaux tests (salaires, frais et dispositifs valent ceux d'une personne ; le plafond annuel de portée « global » ne se déclenche pas à 4 personnes).

- [ ] **Step 3 : implémenter**

Dans `packages/core/src/calculator.ts` :

**4a. `calcSalary`.** Remplacer la signature `function calcSalary(opco: OpcoData, state: WizardState, pedagogyFunded: number, branche: string | null): FundingLine {` par

```ts
function calcSalary(opco: OpcoData, state: WizardState, pedagogyFunded: number, branche: string | null, n: number): FundingLine {
```

Dans `case 'euro_par_heure'`, remplacer

```ts
      funded = (taux ?? 0) * hours;
      note = taux != null ? `${avecUnite(taux, '€/h')} × ${avecUnite(hours, 'h')}` : undefined;
```

par

```ts
      const parPersonne = (taux ?? 0) * hours;
      funded = parPersonne * n;
      note =
        taux != null
          ? `${avecUnite(taux, '€/h')} × ${avecUnite(hours, 'h')}${n > 1 ? ` × ${compte(n, 'personne', 'personnes')}` : ''}`
          : undefined;
```

et, quelques lignes plus bas, remplacer

```ts
        details.push(`Calcul : ${avecUnite(taux, '€/h')} × ${avecUnite(hours, 'h')} = ${avecUnite(funded.toFixed(2), '€')}`);
```

par

```ts
        details.push(`Calcul : ${avecUnite(taux, '€/h')} × ${avecUnite(hours, 'h')} = ${avecUnite(parPersonne.toFixed(2), '€')}`);
        details.push(...detailDeGroupe(n, parPersonne, funded));
```

(Le mode `pourcentage_pedagogique` ne change pas : `pedagogyFunded` est déjà le total du groupe.)

**4b. `calcTransport`.** Remplacer la signature par `function calcTransport(opco: OpcoData, state: WizardState, branche: string | null, n: number): FundingLine {` et, dans la fonction, remplacer

```ts
  if (rate != null && rate > 0) {
    const funded = rate * days;
    const calcul = `${avecUnite(rate, '€/jour')} × ${compte(days, 'jour', 'jours')}`;
    return line('transport', 'Transport', funded, funded, confidence, sourceUrl, calcul, [
      `Forfait transport journalier ${apposition(opco.name)} : ${avecUnite(rate, '€/jour')}`,
      `Calcul : ${calcul} = ${avecUnite(funded.toFixed(2), '€')}`,
    ]);
  }
```

par

```ts
  if (rate != null && rate > 0) {
    const parPersonne = rate * days;
    const funded = parPersonne * n;
    const calculParPersonne = `${avecUnite(rate, '€/jour')} × ${compte(days, 'jour', 'jours')}`;
    const calcul = n > 1 ? `${calculParPersonne} × ${compte(n, 'personne', 'personnes')}` : calculParPersonne;
    return line('transport', 'Transport', funded, funded, confidence, sourceUrl, calcul, [
      `Forfait transport journalier ${apposition(opco.name)} : ${avecUnite(rate, '€/jour')}`,
      `Calcul : ${calculParPersonne} = ${avecUnite(parPersonne.toFixed(2), '€')}`,
      ...detailDeGroupe(n, parPersonne, funded),
    ]);
  }
```

**4c. `calcAccommodation`.** Remplacer la fonction entière (de `function calcAccommodation(` jusqu'à l'accolade qui précède `function calcMeals(`) par :

```ts
function calcAccommodation(opco: OpcoData, state: WizardState, branche: string | null, n: number): FundingLine {
  if (!state.needsAccommodation) return line('hebergement', 'Hébergement', 0, 0, 'exact', opco.url_finance_page);

  const nights = state.accommodationNights ?? 0;
  const userCostPerNight = state.accommodationCostPerNight ?? 0;
  const demandeParPersonne = userCostPerNight * nights;
  const requested = demandeParPersonne * n;
  const ceiling = opco.frais_hebergement.value;
  const confidence = opco.frais_hebergement.confidence;
  const sourceUrl = opco.frais_hebergement.source_url;

  if (ceiling != null && ceiling > 0) {
    const financeParPersonne = Math.min(userCostPerNight, ceiling) * nights;
    const funded = financeParPersonne * n;
    const details = [
      `Votre coût : ${avecUnite(userCostPerNight, '€/nuit')} × ${compte(nights, 'nuit', 'nuits')} = ${avecUnite(demandeParPersonne.toFixed(2), '€')}`,
      `Plafond hébergement ${apposition(opco.name)} : ${avecUnite(ceiling, '€/nuit')}`,
    ];
    if (userCostPerNight > ceiling) {
      details.push(`Votre coût dépasse le plafond → taux appliqué : ${avecUnite(ceiling, '€/nuit')}`);
      details.push(`Calcul : ${avecUnite(ceiling, '€/nuit')} × ${compte(nights, 'nuit', 'nuits')} = ${avecUnite(financeParPersonne.toFixed(2), '€')}`);
    } else {
      details.push("Votre coût par nuit ne dépasse pas le plafond : l'estimation le retient en entier.");
    }
    details.push(...detailDeGroupe(n, financeParPersonne, funded));
    return line('hebergement', 'Hébergement', requested, funded, confidence, sourceUrl, `Plafond : ${avecUnite(ceiling, '€/nuit')}`, details);
  }

  // Aucun plafond exploitable : jamais de montant inventé, le coût saisi reste entièrement à charge.
  if (ceiling === 0) {
    return line('hebergement', 'Hébergement', requested, 0, confidence, sourceUrl, `Hébergement non pris en charge par ${dansLaPhrase(opco.name)}`, [
      `${opco.name} ne finance pas l'hébergement dans ce cadre`,
    ]);
  }

  return line(
    'hebergement',
    'Hébergement',
    requested,
    0,
    'depends_on_branche',
    sourceUrl,
    branche
      ? `Plafond hébergement non publié pour la branche ${branche} : montant à confirmer auprès ${de(opco.name)}`
      : "Plafond hébergement non publié : prise en charge selon l'accord de branche, à confirmer auprès de l'OPCO",
    [
      `${opco.name} ne publie pas de plafond hébergement`,
      "Aucun montant n'est compté tant que l'OPCO ne l'a pas confirmé",
    ],
  );
}
```

**4d. `calcMeals`.** Remplacer la fonction entière (de `function calcMeals(` jusqu'à l'accolade qui précède `function calcFraisAnnexesPourcentage(`) par :

```ts
function calcMeals(opco: OpcoData, state: WizardState, branche: string | null, n: number): FundingLine {
  if (!state.needsMeals) return line('restauration', 'Restauration', 0, 0, 'exact', opco.url_finance_page);

  const days = state.trainingDays ?? 0;
  const userCostPerDay = state.mealCostPerDay ?? 0;
  const demandeParPersonne = userCostPerDay * days;
  const requested = demandeParPersonne * n;
  const rate = opco.frais_restauration.value;
  const confidence = opco.frais_restauration.confidence;
  const sourceUrl = opco.frais_restauration.source_url;

  if (rate != null && rate > 0) {
    // Le forfait plafonne la prise en charge, il ne la garantit pas : jamais plus que le coût déclaré.
    const tauxApplique = Math.min(userCostPerDay, rate);
    const financeParPersonne = tauxApplique * days;
    const funded = financeParPersonne * n;
    // Forfait par repas : l'estimation retient un repas par jour de formation (le coût déclaré reste saisi par jour).
    const parRepas = opco.frais_restauration_unite === 'repas';
    const tarif = (montant: number): string => (parRepas ? `${avecUnite(montant, '€')} par repas` : avecUnite(montant, '€/jour'));
    const details = [
      parRepas
        ? `Forfait restauration ${apposition(opco.name)} : ${tarif(rate)} (un repas par jour de formation retenu)`
        : `Forfait restauration ${apposition(opco.name)} : ${tarif(rate)}`,
    ];
    if (userCostPerDay < rate) {
      details.push(`Votre coût (${avecUnite(userCostPerDay, '€/jour')}) est inférieur au forfait : prise en charge au coût réel`);
    }
    const calcul = `${tarif(tauxApplique)} × ${compte(days, 'jour', 'jours')}`;
    const resteParPersonne = demandeParPersonne - financeParPersonne;
    // Chaque ligne d'une personne est suivie de celle du groupe (rien pour une personne seule) : le reste à charge aussi.
    details.push(
      `Calcul : ${calcul} = ${avecUnite(financeParPersonne.toFixed(2), '€')}`,
      ...detailDeGroupe(n, financeParPersonne, funded),
      ...(demandeParPersonne > financeParPersonne
        ? [
            `Reste à charge : ${avecUnite(resteParPersonne.toFixed(2), '€')}`,
            ...detailDeGroupe(n, resteParPersonne, resteParPersonne * n, 'Reste à charge pour'),
          ]
        : ["Votre coût ne dépasse pas le forfait : l'estimation le retient en entier."]),
    );
    const note = n > 1 ? `${calcul} × ${compte(n, 'personne', 'personnes')}` : calcul;
    return line('restauration', 'Restauration', requested, funded, confidence, sourceUrl, note, details);
  }

  // Aucun forfait publié : le coût déclaré reste affiché comme demandé (comme l'hébergement), rien n'est financé.
  return line(
    'restauration',
    'Restauration',
    requested,
    0,
    'depends_on_branche',
    sourceUrl,
    branche ? `Forfait restauration non publié pour la branche ${branche}` : 'Montant restauration selon accord de branche',
    [
      `${opco.name} ne publie pas de forfait restauration fixe`,
      branche ? nonPublieePourLaBranche(opco, branche) : 'Le montant dépend de votre accord de branche',
    ],
  );
}
```

**4e. `evaluateDispositifs`.** Ajouter un dernier paramètre `n: number` après `idccDeLEntreprise: string[],`. Dans la boucle, juste avant `let montantEstime: number | null = null;`, insérer

```ts
    // Un plafond « par stagiaire » vaut n fois sa valeur ; les autres unités ne se multiplient pas (prudence).
    const plafondMax = d.montant_max != null ? d.montant_max * (d.unite === 'par_stagiaire' ? n : 1) : null;
```

remplacer `if (d.montant_max != null) montantEstime = Math.min(montantEstime, d.montant_max);` par `if (plafondMax != null) montantEstime = Math.min(montantEstime, plafondMax);` et, dans le `switch`, `default:\n          montantEstime = d.montant_max;` par `default:\n          montantEstime = plafondMax;`. Compléter le commentaire de la fonction par la phrase « Pour `n` personnes, les montants de coût sont ceux du groupe et seul un plafond d'unité `par_stagiaire` est multiplié par `n`. »

**4f. Appels dans `calculateFunding`.** `calcSalary(opcoData, state, pedagogyLine.fundedAmount, brancheAppliquee)` reçoit `, n` ; `calcTransport(opcoData, state, brancheAppliquee)`, `calcAccommodation(opcoData, state, brancheAppliquee)` et `calcMeals(opcoData, state, brancheAppliquee)` reçoivent `, n` ; l'appel `evaluateDispositifs(opcoData, state, pedagogyLine.requestedAmount, pedagogyLine.fundedAmount, idccDeLEntreprise)` reçoit `, n`.

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/calculator-groupe.test.ts tests/empreinte-une-personne.test.ts`
Expected: PASS. Si le seuil « plus de 150 comparaisons » n'est pas atteint, relever combien de calculs sautent par plafond annuel avant de toucher au seuil.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run && npx tsc --noEmit`
Expected: tout vert, **empreinte comprise et exécutée (« 1 passed », aucun « skipped »)**.

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add packages/core/src/calculator.ts packages/core/tests/calculator-groupe.test.ts
git commit -m "$(cat <<'EOF'
core : calculateFunding pour n personnes (salaires, frais annexes, plafond global, dispositifs par stagiaire)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5 : Module `groupe.ts`, profils et effectif

**Files:**
- Create: `packages/core/src/groupe.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/tests/groupe.test.ts`

**Interfaces:**
- Consumes: `ChampsProfil`, `MAX_PERSONNES`, `ProfilSupplementaire`, `WizardState` (tâche 1).
- Produces: `ID_PROFIL_PRINCIPAL = 'principal'` ; `interface ProfilDuGroupe { id: string; nombre: number; champs: ChampsProfil; principal: boolean }` ; `champsDuProfilPrincipal(state: WizardState): ChampsProfil` ; `profilsDuGroupe(state: WizardState): ProfilDuGroupe[]` ; `nombreDePersonnes(state: Pick<WizardState, 'nombrePersonnes' | 'autresProfils'>): number` ; `etatDuProfil(state: WizardState, profil: ProfilDuGroupe): WizardState`.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `packages/core/tests/groupe.test.ts`, remplacer les trois lignes d'importation du haut par

```ts
import { describe, expect, it } from 'vitest';
import { ID_PROFIL_PRINCIPAL, champsDuProfilPrincipal, etatDuProfil, nombreDePersonnes, profilsDuGroupe } from '../src/groupe';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState } from '../src/types';
import type { ProfilSupplementaire, WizardState } from '../src/types';
```

et ajouter à la fin du fichier :

```ts
/** Profil supplémentaire de test : un dirigeant artisan de 52 ans reconnu travailleur handicapé, deux personnes. */
const supplementaire = (over: Partial<ProfilSupplementaire> = {}): ProfilSupplementaire => ({
  id: 'profil-2',
  nombre: 2,
  projetType: 'formation_dirigeant',
  contractType: null,
  anciennete_mois: null,
  isHandicap: true,
  ageBeneficiaire: 52,
  niveauDiplome: 'bac',
  typeAlternance: null,
  inscritFranceTravail: null,
  statutDirigeant: 'artisan',
  microEntrepreneur: false,
  soldeCpf: 900,
  regionBeneficiaireCode: null,
  ...over,
});

/** Groupe de test : trois salariés en CDI de 35 ans (profil principal) et le profil supplémentaire ci-dessus. */
const groupe = (over: Partial<WizardState> = {}): WizardState => ({
  ...createInitialWizardState(),
  projetType: 'formation_salarie',
  contractType: 'cdi',
  ageBeneficiaire: 35,
  regionCode: '11',
  durationHours: 35,
  nombrePersonnes: 3,
  autresProfils: [supplementaire()],
  ...over,
});

const CHAMPS_D_UN_PROFIL = [
  'ageBeneficiaire',
  'anciennete_mois',
  'contractType',
  'inscritFranceTravail',
  'isHandicap',
  'microEntrepreneur',
  'niveauDiplome',
  'projetType',
  'regionBeneficiaireCode',
  'soldeCpf',
  'statutDirigeant',
  'typeAlternance',
];

describe('profils du groupe', () => {
  it('le profil principal vient d’abord, avec les champs de l’étape Participants', () => {
    const [principal, second] = profilsDuGroupe(groupe());
    expect(principal).toMatchObject({ id: ID_PROFIL_PRINCIPAL, nombre: 3, principal: true });
    expect(principal.champs).toMatchObject({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35 });
    expect(second).toMatchObject({ id: 'profil-2', nombre: 2, principal: false });
    expect(second.champs).toMatchObject({ projetType: 'formation_dirigeant', statutDirigeant: 'artisan', isHandicap: true });
  });

  it('les champs d’un profil sont exactement les douze réponses de l’étape (ni identifiant, ni effectif)', () => {
    const [principal, second] = profilsDuGroupe(groupe());
    expect(Object.keys(champsDuProfilPrincipal(groupe())).sort()).toEqual(CHAMPS_D_UN_PROFIL);
    expect(Object.keys(principal.champs).sort()).toEqual(CHAMPS_D_UN_PROFIL);
    expect(Object.keys(second.champs).sort()).toEqual(CHAMPS_D_UN_PROFIL);
  });

  it('un état sans profil supplémentaire (état ancien, tableau absent) compte un seul profil', () => {
    const ancien = { ...groupe(), autresProfils: undefined } as unknown as WizardState;
    expect(profilsDuGroupe(ancien)).toHaveLength(1);
    expect(nombreDePersonnes(ancien)).toBe(3);
  });

  it('le nombre de personnes est la somme des effectifs', () => {
    expect(nombreDePersonnes(groupe())).toBe(5);
    expect(nombreDePersonnes(createInitialWizardState())).toBe(1);
  });

  it('un effectif invalide est ramené à un entier de 1 à 99', () => {
    const valeurs: [number, number][] = [
      [0, 1],
      [-2, 1],
      [3.7, 3],
      [Number.NaN, 1],
      [150, MAX_PERSONNES],
      [Number.POSITIVE_INFINITY, 1],
    ];
    for (const [saisi, attendu] of valeurs) {
      expect(profilsDuGroupe(groupe({ nombrePersonnes: saisi, autresProfils: [] }))[0].nombre, `principal ${saisi}`).toBe(attendu);
      expect(profilsDuGroupe(groupe({ autresProfils: [supplementaire({ nombre: saisi })] }))[1].nombre, `second ${saisi}`).toBe(attendu);
    }
    expect(MAX_PROFILS).toBe(6);
  });
});

describe('état d’une personne d’un profil', () => {
  it('reprend l’entreprise, la formation et les frais, et remplace les réponses du bénéficiaire par celles du profil', () => {
    const etat = groupe();
    const [, second] = profilsDuGroupe(etat);
    const une = etatDuProfil(etat, second);
    expect(une).toMatchObject({
      regionCode: '11',
      durationHours: 35,
      projetType: 'formation_dirigeant',
      statutDirigeant: 'artisan',
      ageBeneficiaire: 52,
      isHandicap: true,
      soldeCpf: 900,
      contractType: null,
    });
    expect(une.nombrePersonnes).toBe(1);
    expect(une.autresProfils).toEqual([]);
    expect(une.prixDuGroupe).toBeNull();
  });

  it('ne modifie pas l’état reçu', () => {
    const etat = groupe();
    const avant = JSON.stringify(etat);
    etatDuProfil(etat, profilsDuGroupe(etat)[1]);
    expect(JSON.stringify(etat)).toBe(avant);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/groupe.test.ts`
Expected: FAIL (le module `../src/groupe` n'existe pas).

- [ ] **Step 3 : écrire le code**

Créer `packages/core/src/groupe.ts` :

```ts
// ============================================================
// Plusieurs personnes formées en même temps : profils du groupe, effectif, état d'une personne d'un profil.
// Fonctions pures : aucune E/S, aucune lecture de l'horloge. La répartition du résultat de l'OPCO, le plan d'un profil et
// la fusion des résultats des profils sont dans le même fichier.
// ============================================================

import { MAX_PERSONNES } from './types';
import type { ChampsProfil, WizardState } from './types';

/** Identifiant du profil principal (les champs de l'étape « Participants » de l'état). */
export const ID_PROFIL_PRINCIPAL = 'principal';

/** Un profil du groupe : son identifiant, le nombre de personnes qui l'ont et ses réponses. */
export interface ProfilDuGroupe {
  id: string;
  nombre: number;
  champs: ChampsProfil;
  principal: boolean;
}

/** Effectif ramené à un entier de 1 à MAX_PERSONNES (valeur absente, périmée ou non finie : 1). */
function effectifValide(valeur: unknown): number {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? Math.min(MAX_PERSONNES, Math.max(1, Math.floor(valeur))) : 1;
}

/** Les réponses du profil principal : les champs de l'étape « Participants » de l'état, projet compris. */
export function champsDuProfilPrincipal(state: WizardState): ChampsProfil {
  return {
    projetType: state.projetType,
    contractType: state.contractType,
    anciennete_mois: state.anciennete_mois,
    isHandicap: state.isHandicap,
    ageBeneficiaire: state.ageBeneficiaire,
    niveauDiplome: state.niveauDiplome,
    typeAlternance: state.typeAlternance,
    inscritFranceTravail: state.inscritFranceTravail,
    statutDirigeant: state.statutDirigeant,
    microEntrepreneur: state.microEntrepreneur,
    soldeCpf: state.soldeCpf,
    regionBeneficiaireCode: state.regionBeneficiaireCode,
  };
}

/**
 * Profils du groupe : le profil principal d'abord, puis les profils supplémentaires dans l'ordre de saisie. Les effectifs
 * sont ramenés à un entier de 1 à MAX_PERSONNES. Un projet non choisi reste `null` ici : l'appelant le lit comme
 * « former un salarié », comme pour une personne seule.
 */
export function profilsDuGroupe(state: WizardState): ProfilDuGroupe[] {
  const principal: ProfilDuGroupe = {
    id: ID_PROFIL_PRINCIPAL,
    nombre: effectifValide(state.nombrePersonnes),
    champs: champsDuProfilPrincipal(state),
    principal: true,
  };
  const autres = (state.autresProfils ?? []).map(
    ({ id, nombre, ...champs }): ProfilDuGroupe => ({ id, nombre: effectifValide(nombre), champs, principal: false }),
  );
  return [principal, ...autres];
}

/** Nombre de personnes du groupe : la somme des effectifs de tous les profils. */
export function nombreDePersonnes(state: Pick<WizardState, 'nombrePersonnes' | 'autresProfils'>): number {
  return (state.autresProfils ?? []).reduce((somme, p) => somme + effectifValide(p.nombre), effectifValide(state.nombrePersonnes));
}

/**
 * L'état d'UNE personne de ce profil : l'entreprise, la formation et les frais de l'état, les réponses du bénéficiaire
 * remplacées par celles du profil. Aucun groupe ni prix de groupe : c'est ce que lisent `profilDepuisWizard` et le moteur.
 */
export function etatDuProfil(state: WizardState, profil: ProfilDuGroupe): WizardState {
  return { ...state, ...profil.champs, nombrePersonnes: 1, autresProfils: [], prixDuGroupe: null };
}
```

Dans `packages/core/src/index.ts`, après la ligne `export * from './aides/plan';`, ajouter `export * from './groupe';`.

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run && npx tsc --noEmit`
Expected: tout vert.

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add packages/core/src/groupe.ts packages/core/src/index.ts packages/core/tests/groupe.test.ts
git commit -m "$(cat <<'EOF'
core : profils du groupe, effectif et état d'une personne d'un profil

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6 : Répartition du résultat de l'OPCO entre profils

**Files:**
- Modify: `packages/core/src/groupe.ts`
- Modify: `packages/core/tests/groupe.test.ts`

**Interfaces:**
- Consumes: `FundingResult` (avec `personnes`, tâche 3), `calculateFunding(..., n)`, `opcoGroupe`, `etatGroupe`, `sourced` (tâche 3).
- Produces: `repartirCentimes(total: number, effectifs: readonly number[]): number[]` ; `repartirFinancement(r: FundingResult, effectifs: readonly number[]): FundingResult[]`.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `packages/core/tests/groupe.test.ts`, remplacer les quatre lignes d'importation du haut du fichier par

```ts
import { describe, expect, it } from 'vitest';
import { calculateFunding } from '../src/calculator';
import {
  ID_PROFIL_PRINCIPAL,
  champsDuProfilPrincipal,
  etatDuProfil,
  nombreDePersonnes,
  profilsDuGroupe,
  repartirCentimes,
  repartirFinancement,
} from '../src/groupe';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState } from '../src/types';
import type { ProfilSupplementaire, WizardState } from '../src/types';
import { etatGroupe, opcoGroupe, sourced } from './fixtures';
```

et ajouter à la fin du fichier :

```ts
describe('répartition en centimes', () => {
  it('chaque part reçoit sa fraction entière, les centimes restants vont aux plus grandes parts décimales', () => {
    expect(repartirCentimes(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(repartirCentimes(100, [3, 1])).toEqual([75, 25]);
    expect(repartirCentimes(1, [1, 1])).toEqual([1, 0]);
    expect(repartirCentimes(10, [2, 3])).toEqual([4, 6]);
  });

  it('un total nul, des effectifs vides ou une somme nulle donnent des parts nulles', () => {
    expect(repartirCentimes(0, [2, 3])).toEqual([0, 0]);
    expect(repartirCentimes(500, [])).toEqual([]);
    expect(repartirCentimes(500, [0, 0])).toEqual([0, 0]);
  });

  it('1 000 répartitions tirées (graine fixe) : la somme des parts égale toujours le total, chaque part est un entier non négatif', () => {
    let graine = 12345;
    const hasard = (n: number) => {
      graine = (Math.imul(graine, 1103515245) + 12345) & 0x7fffffff;
      return graine % n;
    };
    for (let i = 0; i < 1000; i++) {
      const total = hasard(5_000_000);
      const effectifs = Array.from({ length: 1 + hasard(6) }, () => 1 + hasard(99));
      const parts = repartirCentimes(total, effectifs);
      expect(
        parts.reduce((s, p) => s + p, 0),
        `${total} ${effectifs}`,
      ).toBe(total);
      expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
    }
  });
});

describe('répartition du résultat de l’OPCO entre profils', () => {
  // 5 personnes : 5 × 5 825 € = 29 125 €, ramenés à 20 000 € par le plafond annuel : des centimes qui ne tombent pas juste.
  const resultat = () => calculateFunding(opcoGroupe({ budget_annuel_max: sourced(20000) }), etatGroupe(), 5);
  const centimes = (euros: number) => Math.round(euros * 100);

  it('deux profils (3 et 2 personnes) : pour chaque poste, la somme des parts égale le groupe au centime', () => {
    const r = resultat();
    const [a, b] = repartirFinancement(r, [3, 2]);
    expect([a.personnes, b.personnes]).toEqual([3, 2]);
    r.lines.forEach((l, i) => {
      for (const champ of ['requestedAmount', 'fundedAmount', 'remainder'] as const) {
        expect(centimes(a.lines[i][champ] + b.lines[i][champ]), `${l.poste} ${champ}`).toBe(centimes(l[champ]));
      }
      for (const part of [a, b]) {
        expect(part.lines[i].remainder).toBeGreaterThanOrEqual(0);
        expect(centimes(part.lines[i].requestedAmount - part.lines[i].fundedAmount)).toBe(centimes(part.lines[i].remainder));
      }
    });
  });

  it('les totaux de chaque part se recalculent à partir de ses lignes', () => {
    for (const part of repartirFinancement(resultat(), [3, 2])) {
      const demande = part.lines.reduce((s, l) => s + centimes(l.requestedAmount), 0);
      const finance = part.lines.reduce((s, l) => s + centimes(l.fundedAmount), 0);
      expect(centimes(part.totalRequested)).toBe(demande);
      expect(centimes(part.totalFunded)).toBe(finance);
      expect(centimes(part.totalRemainder)).toBe(demande - finance);
    }
  });

  it('un seul profil : les lignes du groupe sont rendues à l’identique', () => {
    const r = resultat();
    const [seule] = repartirFinancement(r, [5]);
    const montants = (x: typeof r) => x.lines.map((l) => [l.poste, l.requestedAmount, l.fundedAmount, l.remainder]);
    expect(montants(seule)).toEqual(montants(r));
    expect(seule.personnes).toBe(5);
  });

  it('ce qui n’est pas un montant est repris tel quel', () => {
    const r = resultat();
    for (const part of repartirFinancement(r, [3, 2])) {
      expect(part).toMatchObject({
        opcoName: r.opcoName,
        pdcFerme: r.pdcFerme,
        budgetCapApplied: r.budgetCapApplied,
        budgetCapAmount: r.budgetCapAmount,
        budgetDejaConsomme: r.budgetDejaConsomme,
      });
      expect(part.warnings).toEqual(r.warnings);
      expect(part.lines.map((l) => [l.poste, l.confidence, l.note])).toEqual(r.lines.map((l) => [l.poste, l.confidence, l.note]));
    }
  });

  it('le montant estimé de chaque dispositif et l’enveloppe maximale se répartissent aussi, au centime ; un montant inconnu reste inconnu', () => {
    const dispositif = (id: string, montant_max: number | null) => ({
      id,
      nom: id,
      cumul: 'additif' as const,
      montant_max,
      unite: 'par_dossier' as const,
      pourcentage_couts: null,
      description: 'd',
      conditions: [],
      demarches: 'm',
      tailles_eligibles: null,
      publics: null,
      confidence: 'exact' as const,
      source_url: 'x',
    });
    const opco = opcoGroupe({ dispositifs_complementaires: [dispositif('connu', 1000.01), dispositif('inconnu', null)] });
    const r = calculateFunding(opco, etatGroupe(), 5);
    const [a, b] = repartirFinancement(r, [3, 2]);
    expect(centimes(a.dispositifsComplementaires[0].montantEstime! + b.dispositifsComplementaires[0].montantEstime!)).toBe(100001);
    expect(a.dispositifsComplementaires[1].montantEstime).toBeNull();
    expect(b.dispositifsComplementaires[1].montantEstime).toBeNull();
    expect(centimes(a.enveloppeMaxPotentielle + b.enveloppeMaxPotentielle)).toBe(centimes(r.enveloppeMaxPotentielle));
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/groupe.test.ts`
Expected: FAIL (`repartirCentimes` et `repartirFinancement` ne sont pas exportés).

- [ ] **Step 3 : écrire le code**

Dans `packages/core/src/groupe.ts`, remplacer `import type { ChampsProfil, WizardState } from './types';` par `import type { ChampsProfil, FundingResult, WizardState } from './types';` et ajouter à la fin du fichier :

```ts

// --- Répartition du résultat de l'OPCO entre les profils salariés ---------------------------------------------------

const enCentimes = (euros: number): number => Math.round(euros * 100);
const enEuros = (centimes: number): number => centimes / 100;

/**
 * Répartit `total` centimes entre des parts proportionnelles aux `effectifs`, en centimes entiers : chaque part reçoit
 * `floor(total × effectif / somme)`, puis les centimes qui restent vont aux parts qui ont la plus grande part décimale
 * (à égalité, à la première de la liste). La somme des parts égale toujours `total`. Des effectifs vides ou de somme nulle
 * donnent des parts nulles.
 */
export function repartirCentimes(total: number, effectifs: readonly number[]): number[] {
  const somme = effectifs.reduce((s, e) => s + e, 0);
  if (effectifs.length === 0 || somme <= 0) return effectifs.map(() => 0);
  const signe = total < 0 ? -1 : 1;
  const montant = Math.abs(Math.round(total));
  const parts = effectifs.map((e) => Math.floor((montant * e) / somme));
  let reste = montant - parts.reduce((s, p) => s + p, 0);
  const parDecimale = effectifs
    .map((e, i) => ({ i, decimale: (montant * e) % somme }))
    .sort((a, b) => b.decimale - a.decimale || a.i - b.i);
  for (const { i } of parDecimale) {
    if (reste <= 0) break;
    parts[i] += 1;
    reste -= 1;
  }
  return parts.map((p) => (p === 0 ? 0 : signe * p));
}

/**
 * Répartit le résultat de l'OPCO d'un groupe entre ses profils salariés (`effectifs` : le nombre de personnes de chacun,
 * dans l'ordre des profils). Chaque ligne se répartit en centimes entiers, le financé et le reste à charge séparément (le
 * demandé d'une part est leur somme : il ne passe jamais sous le financé), puis le montant estimé de chaque dispositif et
 * l'enveloppe maximale. La somme des parts égale le groupe, poste par poste, au centime. Les totaux de chaque part se
 * recalculent à partir de ses lignes ; le plafond annuel, le budget déjà consommé, les textes et les drapeaux sont repris
 * tels quels ; `personnes` vaut l'effectif de la part. Les textes de détail restent ceux du groupe entier (« Coût pour
 * 5 personnes : … ») : une part ne s'affiche jamais, seul le plan de son profil en lit les montants.
 */
export function repartirFinancement(r: FundingResult, effectifs: readonly number[]): FundingResult[] {
  const lignes = r.lines.map((l) => ({
    finance: repartirCentimes(enCentimes(l.fundedAmount), effectifs),
    reste: repartirCentimes(enCentimes(l.requestedAmount) - enCentimes(l.fundedAmount), effectifs),
  }));
  const dispositifs = r.dispositifsComplementaires.map((d) =>
    d.montantEstime == null ? null : repartirCentimes(enCentimes(d.montantEstime), effectifs),
  );
  const enveloppe = repartirCentimes(enCentimes(r.enveloppeMaxPotentielle), effectifs);

  return effectifs.map((effectif, k) => {
    const lines = r.lines.map((l, j) => {
      const finance = lignes[j].finance[k];
      const reste = lignes[j].reste[k];
      return { ...l, requestedAmount: enEuros(finance + reste), fundedAmount: enEuros(finance), remainder: enEuros(reste) };
    });
    const demande = lines.reduce((s, l) => s + enCentimes(l.requestedAmount), 0);
    const finance = lines.reduce((s, l) => s + enCentimes(l.fundedAmount), 0);
    return {
      ...r,
      personnes: effectif,
      lines,
      totalRequested: enEuros(demande),
      totalFunded: enEuros(finance),
      totalRemainder: enEuros(demande - finance),
      dispositifsComplementaires: r.dispositifsComplementaires.map((d, j) => {
        const parts = dispositifs[j];
        return { ...d, montantEstime: parts == null ? null : enEuros(parts[k]) };
      }),
      enveloppeMaxPotentielle: enEuros(enveloppe[k]),
    };
  });
}
```

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run && npx tsc --noEmit`
Expected: tout vert.

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add packages/core/src/groupe.ts packages/core/tests/groupe.test.ts
git commit -m "$(cat <<'EOF'
core : répartition du résultat de l'OPCO entre les profils d'un groupe, en centimes entiers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7 : Plan d'un profil et fusion des plans

**Files:**
- Modify: `packages/core/src/aides/plan.ts` (`LignePlan`)
- Modify: `packages/core/src/groupe.ts`
- Modify: `packages/core/tests/groupe.test.ts`

**Interfaces:**
- Consumes: `construirePlan(opco, aides, profil)`, `LignePlan`, `OptionPlan`, `PlanFinancement` (`aides/plan.ts`), `ORDRE_EMPILEMENT_DEFAUT`, `AideEvaluee`, `ProfilAides` (`aides/types.ts`), `repartirFinancement` (tâche 6).
- Produces: `LignePlan.personnes?: number` ; `construirePlanDuBloc(opco: FundingResult | null, aides: readonly AideEvaluee[], profil: ProfilAides, nombre: number): PlanFinancement` ; `fusionnerPlans(plans: readonly PlanFinancement[], aides: readonly Pick<AideEvaluee, 'id' | 'ordreEmpilement'>[]): PlanFinancement`.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `packages/core/tests/groupe.test.ts`, ajouter aux importations du haut :

```ts
import { evaluerAide } from '../src/aides/evaluer';
import { construirePlan } from '../src/aides/plan';
import type { LignePlan, PlanFinancement } from '../src/aides/plan';
import type { Aide } from '../src/aides/types';
import { construirePlanDuBloc, fusionnerPlans } from '../src/groupe';
import { makeAide, makeProfil } from './fixtures-aides';
```

(`construirePlanDuBloc` et `fusionnerPlans` rejoignent l'importation de `../src/groupe` existante : fusionner les deux lignes.) Ajouter à la fin du fichier :

```ts
const AUJOURDHUI = '2026-10-05';
const forfait = (id: string, financeur: Aide['financeur'], valeur: number) =>
  makeAide({ id, financeur, montant: { ...makeAide().montant, valeur } });
/** Aide prélevée sur le solde CPF de la personne : son montant est le solde connu du profil. */
const soldeCpf = makeAide({
  id: 'nat-cpf',
  financeur: 'cpf',
  montant: { ...makeAide().montant, mode: 'solde_cpf', valeur: null, libelle: 'Solde CPF disponible' },
});

describe('plan d’un profil (bloc de personnes)', () => {
  const profil = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: 1500 });
  const evaluees = (p = profil) =>
    [soldeCpf, forfait('r11-region', 'region', 1000), forfait('nat-etat', 'etat', 3000)].map((a) => evaluerAide(a, p, AUJOURDHUI));
  const paires = (lignes: { id: string; montant: number }[]) => lignes.map((l) => [l.id, l.montant]);

  it('une personne : exactement le plan de construirePlan', () => {
    expect(construirePlanDuBloc(null, evaluees(), profil, 1)).toEqual(construirePlan(null, evaluees(), profil));
  });

  it('trois personnes sans OPCO : l’empilement vaut 3 fois celui d’une personne, chaque ligne dit pour combien', () => {
    const un = construirePlanDuBloc(null, evaluees(), profil, 1);
    const trois = construirePlanDuBloc(null, evaluees(), profil, 3);
    // Une personne : Région 1 000, État 3 000, CPF plafonné au reste (200) ; trois personnes : trois fois chaque montant.
    expect(paires(un.financements)).toEqual([['r11-region', 1000], ['nat-etat', 3000], ['nat-cpf', 200]]);
    expect(paires(trois.financements)).toEqual([['r11-region', 3000], ['nat-etat', 9000], ['nat-cpf', 600]]);
    expect(trois.financements.every((l) => l.personnes === 3)).toBe(true);
    expect(trois).toMatchObject({ coutFormation: 12600, totalFinance: 12600, resteACharge: 0 });
  });

  it('le solde CPF est celui de chaque personne : multiplié par l’effectif, jamais dépassé', () => {
    const maigre = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: 100 });
    const trois = construirePlanDuBloc(null, evaluees(maigre), maigre, 3);
    // 3 × 100 € de solde pour un reste de 600 € : le CPF finance 300 €, il reste 300 €.
    expect(paires(trois.financements).at(-1)).toEqual(['nat-cpf', 300]);
    expect(trois).toMatchObject({ totalFinance: 12300, resteACharge: 300 });
  });

  it('la part de l’OPCO est reprise telle quelle (déjà valable pour le bloc), les aides à l’employeur aussi', () => {
    const part = repartirFinancement(calculateFunding(opcoGroupe(), etatGroupe(), 3), [3])[0];
    const plan = construirePlanDuBloc(part, [], makeProfil({ coutPedagogique: 5000, coutFraisAnnexes: 555 }), 3);
    expect(plan.coutFormation).toBe(16665);
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'opco-pdc', montant: 13425, personnes: 3 })]);
    expect(plan.aidesEmployeur.map((l) => [l.id, l.montant, l.personnes])).toEqual([
      ['opco-salaires', 3600, 3],
      ['opco-transport', 450, 3],
    ]);
    expect(plan.resteACharge).toBe(3240);
  });

  it('jamais plus que le coût du bloc, jamais de reste négatif, quel que soit l’effectif', () => {
    for (const nombre of [1, 2, 7, 99]) {
      const plan = construirePlanDuBloc(null, evaluees(), profil, nombre);
      expect(plan.totalFinance).toBeLessThanOrEqual(plan.coutFormation);
      expect(plan.resteACharge).toBeGreaterThanOrEqual(0);
      expect(Math.round((plan.coutFormation - plan.resteACharge) * 100)).toBe(Math.round(plan.totalFinance * 100));
    }
  });
});

describe('fusion des plans des profils', () => {
  const ligne = (id: string, montant: number, over: Partial<LignePlan> = {}): LignePlan => ({
    id,
    nom: `Ligne ${id}`,
    financeurNom: 'Financeur',
    montant,
    confidence: 'exact',
    ...over,
  });
  const plan = (over: Partial<PlanFinancement>): PlanFinancement => ({
    coutFormation: 0,
    financements: [],
    totalFinance: 0,
    resteACharge: 0,
    aidesEmployeur: [],
    remunerations: [],
    avantagesFiscauxSociaux: [],
    options: [],
    nonChiffrees: [],
    servicesGratuits: [],
    ...over,
  });
  const ordres = [
    { id: 'nat-cpf', ordreEmpilement: 90 },
    { id: 'faf-fafcea', ordreEmpilement: 60 },
    { id: 'r11-region', ordreEmpilement: 20 },
  ];
  const aide = (id: string) => evaluerAide(makeAide({ id }), makeProfil(), '2026-10-05');

  it('un seul plan : rendu tel quel', () => {
    const seul = plan({ coutFormation: 100 });
    expect(fusionnerPlans([seul], ordres)).toBe(seul);
  });

  it('coût, financé et reste s’additionnent en centimes entiers', () => {
    const fusion = fusionnerPlans(
      [plan({ coutFormation: 0.1, totalFinance: 0.1, resteACharge: 0 }), plan({ coutFormation: 0.2, totalFinance: 0, resteACharge: 0.2 })],
      ordres,
    );
    expect(fusion).toMatchObject({ coutFormation: 0.3, totalFinance: 0.1, resteACharge: 0.2 });
  });

  it('les lignes de même identifiant s’additionnent, la fiabilité la plus faible l’emporte, les effectifs s’ajoutent', () => {
    const a = plan({ financements: [ligne('opco-pdc', 3150, { personnes: 3 }), ligne('nat-cpf', 600, { personnes: 3 })] });
    const b = plan({ financements: [ligne('faf-fafcea', 1225, { personnes: 1 }), ligne('nat-cpf', 200, { confidence: 'estimated' })] });
    const fusion = fusionnerPlans([a, b], ordres);
    expect(fusion.financements.map((l) => [l.id, l.montant, l.personnes, l.confidence])).toEqual([
      ['opco-pdc', 3150, 3, 'exact'],
      ['faf-fafcea', 1225, 1, 'exact'],
      ['nat-cpf', 800, 4, 'estimated'],
    ]);
  });

  it('tri par ordre d’empilement (OPCO 10, dispositif de l’OPCO 12, aide du catalogue), puis par montant décroissant', () => {
    const a = plan({ financements: [ligne('nat-cpf', 100), ligne('opco-catalogue', 50), ligne('opco-pdc', 10)] });
    const b = plan({ financements: [ligne('r11-region', 70), ligne('faf-fafcea', 500)] });
    expect(fusionnerPlans([a, b], ordres).financements.map((l) => l.id)).toEqual([
      'opco-pdc',
      'opco-catalogue',
      'r11-region',
      'faf-fafcea',
      'nat-cpf',
    ]);
  });

  it('aides à l’employeur, rémunérations et avantages : même fusion par identifiant', () => {
    const a = plan({ aidesEmployeur: [ligne('opco-salaires', 1200)], remunerations: [ligne('nat-rfft', 700)] });
    const b = plan({ aidesEmployeur: [ligne('opco-salaires', 300), ligne('nat-embauche', 5000)], avantagesFiscauxSociaux: [ligne('fis-credit', 475)] });
    const fusion = fusionnerPlans([a, b], ordres);
    expect(fusion.aidesEmployeur.map((l) => [l.id, l.montant])).toEqual([['opco-salaires', 1500], ['nat-embauche', 5000]]);
    expect(fusion.remunerations.map((l) => l.id)).toEqual(['nat-rfft']);
    expect(fusion.avantagesFiscauxSociaux.map((l) => l.id)).toEqual(['fis-credit']);
  });

  it('options : somme des montants connus, nulle si aucun profil n’en a ; aides sans montant et services : réunion sans doublon', () => {
    const option = (id: string, montantEstime: number | null) => ({ id, nom: id, financeurNom: 'F', montantEstime, raison: 'Au choix avec « X »' });
    const a = plan({ options: [option('o1', 100), option('o2', null)], nonChiffrees: [aide('nat-a')], servicesGratuits: [aide('nat-s')] });
    const b = plan({ options: [option('o1', 50), option('o2', null), option('o3', 20)], nonChiffrees: [aide('nat-a'), aide('nat-b')], servicesGratuits: [aide('nat-s')] });
    const fusion = fusionnerPlans([a, b], ordres);
    expect(fusion.options.map((o) => [o.id, o.montantEstime])).toEqual([['o1', 150], ['o2', null], ['o3', 20]]);
    expect(fusion.nonChiffrees.map((x) => x.id)).toEqual(['nat-a', 'nat-b']);
    expect(fusion.servicesGratuits.map((x) => x.id)).toEqual(['nat-s']);
  });

  it('plans réels de deux profils : coût moins reste égale financé, jamais de reste négatif', () => {
    const p1 = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: 1500 });
    const p2 = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: null });
    const aides1 = [forfait('nat-etat', 'etat', 3000), soldeCpf].map((a) => evaluerAide(a, p1, '2026-10-05'));
    const aides2 = [forfait('nat-etat', 'etat', 3000)].map((a) => evaluerAide(a, p2, '2026-10-05'));
    const fusion = fusionnerPlans([construirePlanDuBloc(null, aides1, p1, 3), construirePlanDuBloc(null, aides2, p2, 2)], aides1);
    expect(fusion.coutFormation).toBe(21000);
    expect(Math.round((fusion.coutFormation - fusion.resteACharge) * 100)).toBe(Math.round(fusion.totalFinance * 100));
    expect(fusion.resteACharge).toBeGreaterThanOrEqual(0);
    expect(fusion.financements.find((l) => l.id === 'nat-etat')).toMatchObject({ montant: 15000, personnes: 5 });
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/groupe.test.ts`
Expected: FAIL (`construirePlanDuBloc` et `fusionnerPlans` ne sont pas exportés).

- [ ] **Step 3 : écrire le code**

Dans `packages/core/src/aides/plan.ts`, remplacer

```ts
export interface LignePlan {
  id: string;
  nom: string;
  financeurNom: string;
  montant: number;
  confidence: Confidence;
}
```

par

```ts
export interface LignePlan {
  id: string;
  nom: string;
  financeurNom: string;
  montant: number;
  confidence: Confidence;
  /** Nombre de personnes pour lesquelles la ligne vaut : renseigné seulement à partir de deux personnes (plan d'un groupe). */
  personnes?: number;
}
```

Dans `packages/core/src/groupe.ts`, remplacer les deux lignes d'importation du haut

```ts
import { MAX_PERSONNES } from './types';
import type { ChampsProfil, FundingResult, WizardState } from './types';
```

par

```ts
import { construirePlan } from './aides/plan';
import type { LignePlan, OptionPlan, PlanFinancement } from './aides/plan';
import { ORDRE_EMPILEMENT_DEFAUT } from './aides/types';
import type { AideEvaluee, ProfilAides } from './aides/types';
import { MAX_PERSONNES } from './types';
import type { ChampsProfil, Confidence, FundingResult, WizardState } from './types';
```

et ajouter à la fin du fichier :

```ts

// --- Plan de financement d'un profil, fusion des plans --------------------------------------------------------------

/**
 * Plan de financement d'un profil du groupe : celui de `construirePlan` appliqué à un bloc de `nombre` personnes.
 * `opco` est la part de ce profil dans le résultat de l'OPCO (déjà valable pour `nombre` personnes) ; `aides` et `profil`
 * sont ceux d'UNE personne. Le coût de la formation, le solde CPF et les montants des aides sont multipliés par `nombre`
 * (une aide limitée au coût d'une personne le reste au coût du bloc), de sorte que l'empilement (ordre, plafond au reste
 * à charge, solde CPF partagé, aides « au choix ») suit les règles d'une personne, appliquées aux montants du bloc.
 * Pour une seule personne, c'est exactement `construirePlan`. Chaque ligne du plan d'un bloc de plusieurs personnes porte
 * `personnes`.
 */
export function construirePlanDuBloc(
  opco: FundingResult | null,
  aides: readonly AideEvaluee[],
  profil: ProfilAides,
  nombre: number,
): PlanFinancement {
  if (nombre <= 1) return construirePlan(opco, [...aides], profil);
  const fois = (montant: number | null): number | null => (montant == null ? null : enEuros(enCentimes(montant * nombre)));
  const plan = construirePlan(
    opco,
    aides.map((a) => ({ ...a, montantEstime: fois(a.montantEstime) })),
    {
      ...profil,
      coutPedagogique: profil.coutPedagogique == null ? null : profil.coutPedagogique * nombre,
      coutFraisAnnexes: profil.coutFraisAnnexes * nombre,
      soldeCpf: profil.soldeCpf == null ? null : profil.soldeCpf * nombre,
    },
  );
  const marquer = (lignes: LignePlan[]): LignePlan[] => lignes.map((l) => ({ ...l, personnes: nombre }));
  return {
    ...plan,
    financements: marquer(plan.financements),
    aidesEmployeur: marquer(plan.aidesEmployeur),
    remunerations: marquer(plan.remunerations),
    avantagesFiscauxSociaux: marquer(plan.avantagesFiscauxSociaux),
  };
}

const POIDS_FIABILITE: Record<Confidence, number> = { depends_on_branche: 0, estimated: 1, exact: 2 };
const plusFaible = (a: Confidence, b: Confidence): Confidence => (POIDS_FIABILITE[a] <= POIDS_FIABILITE[b] ? a : b);

/**
 * Plan du groupe : la fusion des plans de ses profils. Un seul plan : rendu tel quel. Sinon, coût, financé et reste
 * s'additionnent en centimes entiers ; les lignes de même identifiant s'additionnent (montant, `personnes`, la fiabilité
 * la plus faible l'emporte, le nom et le financeur sont ceux de la première occurrence) ; les financements sont triés par
 * ordre d'empilement (`ordreEmpilement` d'une aide de `aides`, 10 pour `opco-pdc`, 12 pour un dispositif de l'OPCO), puis
 * par montant décroissant ; les options s'additionnent (montants connus seulement, nul si aucun profil n'en a) ; les aides
 * sans montant et les services gratuits sont réunis sans doublon.
 */
export function fusionnerPlans(
  plans: readonly PlanFinancement[],
  aides: readonly Pick<AideEvaluee, 'id' | 'ordreEmpilement'>[],
): PlanFinancement {
  if (plans.length === 1) return plans[0];
  const ordreParId = new Map(aides.map((a) => [a.id, a.ordreEmpilement]));
  const ordreDe = (id: string): number =>
    ordreParId.get(id) ?? (id === 'opco-pdc' ? 10 : id.startsWith('opco-') ? 12 : ORDRE_EMPILEMENT_DEFAUT.autre);
  const somme = (valeur: (p: PlanFinancement) => number): number => enEuros(plans.reduce((s, p) => s + enCentimes(valeur(p)), 0));

  const fusionnerLignes = (listes: readonly LignePlan[][]): LignePlan[] => {
    const parId = new Map<string, LignePlan>();
    for (const l of listes.flat()) {
      const deja = parId.get(l.id);
      if (!deja) {
        parId.set(l.id, { ...l, personnes: l.personnes ?? 1 });
      } else {
        deja.montant = enEuros(enCentimes(deja.montant) + enCentimes(l.montant));
        deja.confidence = plusFaible(deja.confidence, l.confidence);
        deja.personnes = (deja.personnes ?? 1) + (l.personnes ?? 1);
      }
    }
    return [...parId.values()];
  };

  const options = new Map<string, OptionPlan>();
  for (const o of plans.flatMap((p) => p.options)) {
    const deja = options.get(o.id);
    if (!deja) options.set(o.id, { ...o });
    else if (o.montantEstime != null) {
      deja.montantEstime = deja.montantEstime == null ? o.montantEstime : enEuros(enCentimes(deja.montantEstime) + enCentimes(o.montantEstime));
    }
  }

  const uniques = (listes: readonly AideEvaluee[][]): AideEvaluee[] => {
    const vues = new Map<string, AideEvaluee>();
    for (const a of listes.flat()) if (!vues.has(a.id)) vues.set(a.id, a);
    return [...vues.values()];
  };

  return {
    coutFormation: somme((p) => p.coutFormation),
    financements: fusionnerLignes(plans.map((p) => p.financements)).sort(
      (x, y) => ordreDe(x.id) - ordreDe(y.id) || y.montant - x.montant,
    ),
    totalFinance: somme((p) => p.totalFinance),
    resteACharge: somme((p) => p.resteACharge),
    aidesEmployeur: fusionnerLignes(plans.map((p) => p.aidesEmployeur)),
    remunerations: fusionnerLignes(plans.map((p) => p.remunerations)),
    avantagesFiscauxSociaux: fusionnerLignes(plans.map((p) => p.avantagesFiscauxSociaux)),
    options: [...options.values()],
    nonChiffrees: uniques(plans.map((p) => p.nonChiffrees)),
    servicesGratuits: uniques(plans.map((p) => p.servicesGratuits)),
  };
}
```

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run && npx tsc --noEmit`
Expected: tout vert. Si le test « plans réels de deux profils » donne un autre `nat-etat` que 15 000 €, relire d'abord le plafond au reste à charge (`aides1` contient aussi le solde CPF) avant de toucher au code.

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add packages/core/src/aides/plan.ts packages/core/src/groupe.ts packages/core/tests/groupe.test.ts
git commit -m "$(cat <<'EOF'
core : plan de financement d'un profil du groupe et fusion des plans

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8 : Fusion des aides du catalogue

**Files:**
- Modify: `packages/core/src/aides/types.ts` (`ConcerneParAide`, `AideEvaluee.profils?`)
- Modify: `packages/core/src/aides/evaluer.ts` (`trierAidesEvaluees` exporté)
- Modify: `packages/core/src/groupe.ts`
- Modify: `packages/core/tests/groupe.test.ts`

**Interfaces:**
- Consumes: `ProfilDuGroupe` (tâche 5), `evaluerAide`, `evaluerAides` (`aides/evaluer.ts`).
- Produces: `interface ConcerneParAide { profilId: string; nombre: number; statut: StatutEligibilite; montantEstime: number | null }` ; `AideEvaluee.profils?: ConcerneParAide[]` ; `trierAidesEvaluees(aides: readonly AideEvaluee[]): AideEvaluee[]` ; `fusionnerAides(blocs: readonly { profil: ProfilDuGroupe; aides: readonly AideEvaluee[] }[]): AideEvaluee[]`.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `packages/core/tests/groupe.test.ts`, ajouter aux importations du haut (fusionner avec les lignes existantes de même module) :

```ts
import { evaluerAides, trierAidesEvaluees } from '../src/aides/evaluer';
import { EMBEDDED_AIDES } from '../src/data';
import { fusionnerAides } from '../src/groupe';
```

et ajouter à la fin du fichier :

```ts
describe('fusion des aides du catalogue', () => {
  const [pA, pB] = profilsDuGroupe(groupe()); // principal (3 personnes), profil-2 (2 personnes)
  const profilAidesA = makeProfil({ age: 35, rqth: false, niveauDiplome: null });
  const profilAidesB = makeProfil({
    projet: 'formation_dirigeant',
    statutBeneficiaire: 'dirigeant',
    age: 52,
    rqth: true,
    niveauDiplome: 'bac',
  });
  const ouvertes = {
    projets: ['formation_salarie', 'formation_dirigeant'],
    beneficiaires: ['salarie', 'dirigeant'],
  } satisfies Pick<Aide, 'projets' | 'beneficiaires'>;
  const evaluer = (aide: Aide) => [
    { profil: pA, aides: [evaluerAide(aide, profilAidesA, AUJOURDHUI)] },
    { profil: pB, aides: [evaluerAide(aide, profilAidesB, AUJOURDHUI)] },
  ];

  it('éligible pour un profil, non éligible pour l’autre : éligible, avec le seul profil concerné', () => {
    const [a] = fusionnerAides(evaluer(makeAide({ ...ouvertes, id: 'nat-seniors', criteres: { age_min: 50 } })));
    expect(a).toMatchObject({ id: 'nat-seniors', statut: 'eligible', raisons: [], horsPerimetre: false });
    expect(a.profils).toEqual([{ profilId: 'profil-2', nombre: 2, statut: 'eligible', montantEstime: 1000 }]);
  });

  it('éligible pour les deux profils avec des montants différents : le plus grand montant par personne, son libellé, le montant de chaque profil', () => {
    const aide = makeAide({
      ...ouvertes,
      id: 'nat-rqth',
      montant: {
        ...makeAide().montant,
        valeur: 1000,
        libelle: '1 000 €',
        majorations: [{ criteres: { rqth: true }, valeur: 2000, libelle: '2 000 € (RQTH)' }],
      },
    });
    const [a] = fusionnerAides(evaluer(aide));
    expect(a).toMatchObject({ statut: 'eligible', montantEstime: 2000, libelleMontant: '2 000 € (RQTH)' });
    expect(a.profils?.map((p) => [p.profilId, p.nombre, p.montantEstime])).toEqual([
      ['principal', 3, 1000],
      ['profil-2', 2, 2000],
    ]);
  });

  it('à vérifier pour un profil, éligible pour l’autre : éligible ; à vérifier pour les deux : à vérifier, raisons réunies sans doublon', () => {
    const exigeDiplome = makeAide({ ...ouvertes, id: 'nat-diplome', criteres: { niveaux_diplome: ['bac'] } });
    const [une] = fusionnerAides(evaluer(exigeDiplome));
    expect(une).toMatchObject({ statut: 'eligible', raisons: [] });
    const [deux] = fusionnerAides([
      { profil: pA, aides: [evaluerAide(exigeDiplome, profilAidesA, AUJOURDHUI)] },
      { profil: pB, aides: [evaluerAide(exigeDiplome, { ...profilAidesB, niveauDiplome: null }, AUJOURDHUI)] },
    ]);
    expect(deux.statut).toBe('a_verifier');
    expect(deux.raisons).toEqual(['Précisez le niveau de diplôme du bénéficiaire']);
    expect(deux.profils?.map((p) => p.statut)).toEqual(['a_verifier', 'a_verifier']);
  });

  it('non éligible pour tous : raisons réunies, aucun profil concerné ; hors périmètre seulement si tous les profils le sont', () => {
    const [a] = fusionnerAides(evaluer(makeAide({ ...ouvertes, id: 'nat-aines', criteres: { age_min: 70 } })));
    expect(a).toMatchObject({ statut: 'non_eligible', horsPerimetre: false });
    expect(a.raisons).toEqual(['Réservé aux personnes de 70 ans et plus']);
    expect(a.profils).toEqual([]);
    // Aide du seul projet salarié : hors périmètre pour le dirigeant, non éligible par l'âge pour le salarié. Elle reste
    // visible, avec la seule raison du salarié (jamais « Ne concerne pas ce type de projet » du dirigeant).
    const [b] = fusionnerAides(evaluer(makeAide({ id: 'nat-salaries', criteres: { age_min: 70 } })));
    expect(b).toMatchObject({ statut: 'non_eligible', horsPerimetre: false });
    expect(b.raisons).toEqual(['Réservé aux personnes de 70 ans et plus']);
    const [c] = fusionnerAides(evaluer(makeAide({ id: 'nat-autre', projets: ['alternance'], beneficiaires: ['alternant'] })));
    expect(c).toMatchObject({ statut: 'non_eligible', horsPerimetre: true });
  });

  it('la liste fusionnée est triée comme une liste évaluée : éligibles d’abord, montant décroissant, puis nom', () => {
    const aides = [
      makeAide({ ...ouvertes, id: 'nat-b', nom: 'B', criteres: { age_min: 70 } }),
      makeAide({ ...ouvertes, id: 'nat-a', nom: 'A', montant: { ...makeAide().montant, valeur: 500 } }),
      makeAide({ ...ouvertes, id: 'nat-c', nom: 'C', montant: { ...makeAide().montant, valeur: 1500 } }),
    ];
    const fusion = fusionnerAides([
      { profil: pA, aides: aides.map((a) => evaluerAide(a, profilAidesA, AUJOURDHUI)) },
      { profil: pB, aides: aides.map((a) => evaluerAide(a, profilAidesB, AUJOURDHUI)) },
    ]);
    expect(fusion.map((a) => a.id)).toEqual(['nat-c', 'nat-a', 'nat-b']);
  });

  it('un seul profil : la liste est rendue telle quelle, sans champ « profils »', () => {
    const liste = [evaluerAide(makeAide(), profilAidesA, AUJOURDHUI)];
    const fusion = fusionnerAides([{ profil: pA, aides: liste }]);
    expect(fusion).toEqual(liste);
    expect(fusion[0].profils).toBeUndefined();
  });

  it('catalogue entier, deux profils : une entrée par aide, jamais d’aide perdue', () => {
    const p = makeProfil();
    const q = makeProfil({ projet: 'formation_dirigeant', statutBeneficiaire: 'dirigeant', statutDirigeant: 'artisan', age: 52, rqth: true });
    const fusion = fusionnerAides([
      { profil: pA, aides: evaluerAides(EMBEDDED_AIDES, p, AUJOURDHUI) },
      { profil: pB, aides: evaluerAides(EMBEDDED_AIDES, q, AUJOURDHUI) },
    ]);
    expect(fusion).toHaveLength(EMBEDDED_AIDES.length);
    expect(new Set(fusion.map((a) => a.id)).size).toBe(EMBEDDED_AIDES.length);
    // Une aide ouverte au salarié comme au dirigeant concerne les deux profils (éligible ou à vérifier).
    expect(fusion.some((a) => (a.profils?.length ?? 0) === 2)).toBe(true);
  });
});

describe('tri d’une liste évaluée', () => {
  it('trierAidesEvaluees redonne l’ordre d’evaluerAides, quel que soit l’ordre d’entrée', () => {
    const evaluees = evaluerAides(EMBEDDED_AIDES, makeProfil(), AUJOURDHUI);
    expect(trierAidesEvaluees([...evaluees].reverse())).toEqual(evaluees);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run tests/groupe.test.ts`
Expected: FAIL (`fusionnerAides` et `trierAidesEvaluees` ne sont pas exportés).

- [ ] **Step 3 : écrire le code**

Dans `packages/core/src/aides/types.ts`, juste avant `export interface AideEvaluee {`, ajouter :

```ts
/** Profil d'un groupe concerné par une aide : son effectif, son statut et son montant estimé par personne. */
export interface ConcerneParAide {
  profilId: string;
  /** Nombre de personnes qui ont ce profil. */
  nombre: number;
  statut: StatutEligibilite;
  /** Montant estimé par personne de ce profil (nul : non chiffré). */
  montantEstime: number | null;
}

```

et, dans `AideEvaluee`, après le champ `ordreEmpilement: number;`, ajouter :

```ts
  /**
   * Groupe de plusieurs profils seulement : les profils pour lesquels l'aide est éligible ou à vérifier, avec leur effectif,
   * leur statut et leur montant par personne. Absent pour une personne seule ou un seul profil.
   */
  profils?: ConcerneParAide[];
```

Dans `packages/core/src/aides/evaluer.ts`, remplacer

```ts
/**
 * Évalue toutes les aides et les trie : éligibles, puis à vérifier, puis non éligibles ; à statut égal, montant estimé
 * décroissant (un montant non chiffré après un montant de 0 €), puis nom (sans tenir compte de la casse), puis identifiant.
 */
export function evaluerAides(aides: Aide[], p: ProfilAides, dateRef: string): AideEvaluee[] {
  return aides
    .map((a) => evaluerAide(a, p, dateRef))
    .sort(
      (a, b) =>
        RANG[a.statut] - RANG[b.statut] ||
        (b.montantEstime ?? -1) - (a.montantEstime ?? -1) ||
        comparer(a.nom.toLowerCase(), b.nom.toLowerCase()) ||
        comparer(a.id, b.id),
    );
}
```

par

```ts
/**
 * Trie une liste d'aides évaluées : éligibles, puis à vérifier, puis non éligibles ; à statut égal, montant estimé
 * décroissant (un montant non chiffré après un montant de 0 €), puis nom (sans tenir compte de la casse), puis identifiant.
 * Rend une nouvelle liste.
 */
export function trierAidesEvaluees(aides: readonly AideEvaluee[]): AideEvaluee[] {
  return [...aides].sort(
    (a, b) =>
      RANG[a.statut] - RANG[b.statut] ||
      (b.montantEstime ?? -1) - (a.montantEstime ?? -1) ||
      comparer(a.nom.toLowerCase(), b.nom.toLowerCase()) ||
      comparer(a.id, b.id),
  );
}

/** Évalue toutes les aides et les trie (`trierAidesEvaluees`). */
export function evaluerAides(aides: Aide[], p: ProfilAides, dateRef: string): AideEvaluee[] {
  return trierAidesEvaluees(aides.map((a) => evaluerAide(a, p, dateRef)));
}
```

Dans `packages/core/src/groupe.ts`, ajouter aux importations `import { trierAidesEvaluees } from './aides/evaluer';` (avant l'importation de `./aides/plan`) et remplacer `import type { AideEvaluee, ProfilAides } from './aides/types';` par `import type { AideEvaluee, ProfilAides, StatutEligibilite } from './aides/types';`, puis ajouter à la fin du fichier :

```ts

// --- Fusion des aides du catalogue ---------------------------------------------------------------------------------

const RANG_STATUT: Record<StatutEligibilite, number> = { eligible: 0, a_verifier: 1, non_eligible: 2 };

interface VueDeLAide {
  profil: ProfilDuGroupe;
  aide: AideEvaluee;
}

/** Une aide vue par plusieurs profils : le meilleur statut, le plus grand montant par personne, les profils concernés. */
function fusionnerUneAide(vues: VueDeLAide[]): AideEvaluee {
  // Meilleur statut d'abord, puis plus grand montant : c'est cette vue qui fournit tout ce qui ne dépend pas du profil.
  const meilleure = [...vues].sort(
    (a, b) => RANG_STATUT[a.aide.statut] - RANG_STATUT[b.aide.statut] || (b.aide.montantEstime ?? -1) - (a.aide.montantEstime ?? -1),
  )[0];
  const statut = meilleure.aide.statut;
  const concernees = vues.filter((v) => v.aide.statut !== 'non_eligible');
  const montants = concernees.map((v) => v.aide.montantEstime).filter((m): m is number => m != null);
  const montantMax = montants.length > 0 ? Math.max(...montants) : null;
  // Le profil qui porte le plus grand montant donne le libellé et le lien de la demande.
  const porteuse = montantMax == null ? meilleure : (concernees.find((v) => v.aide.montantEstime === montantMax) ?? meilleure);
  // Éligible : rien à confirmer. Sinon, les raisons des profils qui portent le statut retenu (jamais celles d'un profil pour
  // lequel l'aide est hors périmètre : « Ne concerne pas ce type de projet » n'a rien à faire dans la liste).
  const raisons =
    statut === 'eligible'
      ? []
      : [
          ...new Set(
            vues.filter((v) => v.aide.statut === statut && (statut !== 'non_eligible' || !v.aide.horsPerimetre)).flatMap((v) => v.aide.raisons),
          ),
        ];
  return {
    ...meilleure.aide,
    raisons,
    horsPerimetre: vues.every((v) => v.aide.horsPerimetre),
    montantEstime: statut === 'non_eligible' ? meilleure.aide.montantEstime : montantMax,
    libelleMontant: porteuse.aide.libelleMontant,
    urlDemarche: porteuse.aide.urlDemarche,
    profils: concernees.map((v) => ({
      profilId: v.profil.id,
      nombre: v.profil.nombre,
      statut: v.aide.statut,
      montantEstime: v.aide.montantEstime,
    })),
  };
}

/**
 * Aides du catalogue d'un groupe : une entrée par aide, fusion de ce que chaque profil en voit. Un seul profil : sa liste
 * telle quelle, sans champ `profils`. Plusieurs profils : le meilleur statut (éligible, puis à vérifier, puis non éligible) ;
 * `horsPerimetre` seulement si l'aide l'est pour tous les profils ; le plus grand montant PAR PERSONNE parmi les profils
 * éligibles ou à vérifier (« jusqu'à »), avec son libellé et son lien ; les raisons réunies sans doublon quand l'aide n'est
 * pas éligible ; `profils` : un élément par profil éligible ou à vérifier. La liste est triée comme une liste évaluée.
 */
export function fusionnerAides(blocs: readonly { profil: ProfilDuGroupe; aides: readonly AideEvaluee[] }[]): AideEvaluee[] {
  if (blocs.length === 1) return [...blocs[0].aides];
  const vuesParId = new Map<string, VueDeLAide[]>();
  for (const bloc of blocs) {
    for (const aide of bloc.aides) {
      const vues = vuesParId.get(aide.id);
      if (vues) vues.push({ profil: bloc.profil, aide });
      else vuesParId.set(aide.id, [{ profil: bloc.profil, aide }]);
    }
  }
  return trierAidesEvaluees([...vuesParId.values()].map(fusionnerUneAide));
}
```

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/packages/core && npx vitest run && npx tsc --noEmit`
Expected: tout vert (suites existantes comprises : l'ordre d'`evaluerAides` n'a pas changé).

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/mobile && npx tsc --noEmit` et `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/backend && npx vitest run && npx tsc --noEmit`
Expected: verts. **Fin de la partie A : le cœur est complet.**

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add packages/core/src/aides/types.ts packages/core/src/aides/evaluer.ts packages/core/src/groupe.ts packages/core/tests/groupe.test.ts
git commit -m "$(cat <<'EOF'
core : fusion des aides du catalogue d'un groupe (statut, montant par personne, profils concernés)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

# Partie B : le site (`apps/web`)

### Task 9 : État d'un groupe dans le parcours du site

**Files:**
- Create: `apps/web/src/lib/groupe.ts`
- Modify: `apps/web/src/lib/parcours.ts` (`champsDepuisProjet`, `etatDepuisProjet`)
- Create: `apps/web/tests/groupe.test.ts`

**Interfaces:**
- Consumes: `ID_PROFIL_PRINCIPAL`, `MAX_PERSONNES`, `MAX_PROFILS`, `champsDuProfilPrincipal`, `createInitialWizardState`, `nombreDePersonnes`, `profilsDuGroupe` de `@opco/core` ; `opcoRequis`, `ouvreBudgetOpco` (`lib/entreprise.ts`) ; `coutsDeFormation` (`lib/parcours.ts`).
- Produces (`lib/groupe.ts`) : `lireEffectif(texte): number | null` ; `normaliserGroupe(etat)` ; `prochainIdProfil(etat)` ; `nouveauProfil(etat): ProfilSupplementaire` ; `ajouterProfil(etat)` ; `retirerProfil(etat, id)` ; `majProfil(etat, id, maj: Partial<ChampsProfil>)` ; `changerProjetDuProfil(etat, id, projet)` ; `definirNombre(etat, id, nombre)` ; `etatDepuisPrix(etat, saisie, heures, pourLeGroupe)` ; `basculerModePrix(etat, versGroupe)` ; `projetsDuGroupe(etat)` ; `opcoRequisPourLeGroupe(etat)` ; `ouvreBudgetPourLeGroupe(etat)`. Et dans `lib/parcours.ts` : `champsDepuisProjet(champs: ChampsProfil, projet): Partial<ChampsProfil>`.

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `apps/web/tests/groupe.test.ts` :

```ts
// État d'un groupe de personnes formées (lib/groupe.ts) : saisie du nombre, bornes, ajout et retrait de profils,
// changement de statut, prix du groupe, OPCO et budget du groupe. Fonctions pures ; attentes écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState, nombreDePersonnes } from '@opco/core';
import type { ProfilSupplementaire, WizardState } from '@opco/core';
import {
  ajouterProfil,
  basculerModePrix,
  changerProjetDuProfil,
  definirNombre,
  etatDepuisPrix,
  lireEffectif,
  majProfil,
  normaliserGroupe,
  nouveauProfil,
  opcoRequisPourLeGroupe,
  ouvreBudgetPourLeGroupe,
  prochainIdProfil,
  retirerProfil,
} from '../src/lib/groupe';
import { etatDepuisProjet } from '../src/lib/parcours';

const etat = (maj: Partial<WizardState> = {}): WizardState => ({
  ...createInitialWizardState(),
  projetType: 'formation_salarie',
  ...maj,
});
const extra = (id: string, maj: Partial<ProfilSupplementaire> = {}): ProfilSupplementaire => ({
  ...nouveauProfil(etat()),
  id,
  ...maj,
});

describe('saisie du nombre de personnes (lireEffectif)', () => {
  test('un entier de 1 à 99 est lu tel quel, les espaces autour sont ignorés', () => {
    assert.equal(lireEffectif('3'), 3);
    assert.equal(lireEffectif(' 12 '), 12);
    assert.equal(lireEffectif('0005'), 5);
    assert.equal(lireEffectif('99'), 99);
  });

  test('au-delà de 99 : 99', () => {
    assert.equal(lireEffectif('150'), MAX_PERSONNES);
    assert.equal(lireEffectif('9999'), MAX_PERSONNES);
  });

  test('zéro, vide, négatif, décimal, texte, notation scientifique, nombre trop long : refusés (null), jamais NaN', () => {
    for (const saisie of ['0', '0000', '', ' ', '-3', '3,7', '3.7', 'abc', '1e2', '1 2', '12345']) {
      assert.equal(lireEffectif(saisie), null, JSON.stringify(saisie));
    }
  });
});

describe('normaliserGroupe', () => {
  test("un état d'une personne n'est pas touché", () => {
    const initial = etat();
    assert.deepEqual(normaliserGroupe(initial), initial);
  });

  test('effectifs ramenés à un entier de 1 à 99', () => {
    const cas: [number, number][] = [
      [0, 1],
      [-4, 1],
      [3.9, 3],
      [Number.NaN, 1],
      [200, 99],
    ];
    for (const [saisi, attendu] of cas) {
      assert.equal(normaliserGroupe(etat({ nombrePersonnes: saisi })).nombrePersonnes, attendu, String(saisi));
    }
    assert.equal(normaliserGroupe(etat({ autresProfils: [extra('profil-2', { nombre: 0 })] })).autresProfils[0].nombre, 1);
  });

  test('au plus 5 profils supplémentaires', () => {
    const sept = Array.from({ length: 7 }, (_, i) => extra(`profil-${i + 2}`));
    assert.deepEqual(
      normaliserGroupe(etat({ autresProfils: sept })).autresProfils.map((p) => p.id),
      ['profil-2', 'profil-3', 'profil-4', 'profil-5', 'profil-6'],
    );
    assert.equal(MAX_PROFILS - 1, 5);
  });

  test('au plus 99 personnes : le surplus est retiré du dernier profil, puis des précédents, puis du profil principal', () => {
    const a = normaliserGroupe(
      etat({ nombrePersonnes: 60, autresProfils: [extra('profil-2', { nombre: 30 }), extra('profil-3', { nombre: 30 })] }),
    );
    assert.deepEqual([a.nombrePersonnes, ...a.autresProfils.map((p) => p.nombre)], [60, 30, 9]);
    const cinq = Array.from({ length: 5 }, (_, i) => extra(`profil-${i + 2}`, { nombre: 99 }));
    const b = normaliserGroupe(etat({ nombrePersonnes: 99, autresProfils: cinq }));
    assert.deepEqual([b.nombrePersonnes, ...b.autresProfils.map((p) => p.nombre)], [94, 1, 1, 1, 1, 1]);
    assert.equal(nombreDePersonnes(b), 99);
  });

  test("le prix du groupe n'a de sens qu'à partir de 2 personnes", () => {
    assert.equal(normaliserGroupe(etat({ prixDuGroupe: 5600, pedagogyCostTotal: 5600 })).prixDuGroupe, null);
    assert.equal(normaliserGroupe(etat({ nombrePersonnes: 2, prixDuGroupe: 5600 })).prixDuGroupe, 5600);
  });

  test("prix du groupe renseigné : le coût d'une personne et le coût horaire suivent, y compris quand l'effectif change", () => {
    const deux = normaliserGroupe(etat({ nombrePersonnes: 2, prixDuGroupe: 5600, durationHours: 35 }));
    assert.equal(deux.pedagogyCostTotal, 2800);
    assert.equal(deux.pedagogyCostPerHour, 80);
    const quatre = normaliserGroupe({ ...deux, nombrePersonnes: 4 });
    assert.equal(quatre.pedagogyCostTotal, 1400);
    assert.equal(quatre.pedagogyCostPerHour, 40);
  });

  test('sans durée (vide ou nulle) : coût horaire vide, jamais NaN ni infini', () => {
    for (const durationHours of [null, 0]) {
      const r = normaliserGroupe(etat({ nombrePersonnes: 3, prixDuGroupe: 900, durationHours }));
      assert.equal(r.pedagogyCostTotal, 300);
      assert.equal(r.pedagogyCostPerHour, null, String(durationHours));
    }
  });

  test('idempotente', () => {
    const x = etat({ nombrePersonnes: 3, durationHours: 21, prixDuGroupe: 1000, autresProfils: [extra('profil-2', { nombre: 2 })] });
    assert.deepEqual(normaliserGroupe(normaliserGroupe(x)), normaliserGroupe(x));
  });
});

describe('profils : ajout, retrait, changement', () => {
  test("ajouter : un profil d'une personne, du statut du profil principal, sans autre réponse", () => {
    const e = ajouterProfil(etat({ projetType: 'formation_dirigeant', statutDirigeant: 'artisan', ageBeneficiaire: 40 }));
    assert.equal(e.autresProfils.length, 1);
    const p = e.autresProfils[0];
    assert.deepEqual([p.id, p.nombre, p.projetType], ['profil-2', 1, 'formation_dirigeant']);
    assert.equal(p.statutDirigeant, null);
    assert.equal(p.ageBeneficiaire, null);
  });

  test("identifiants : le plus petit libre à partir de profil-2 ; un identifiant retiré resservit avec des réponses vides", () => {
    let e = ajouterProfil(ajouterProfil(etat()));
    assert.deepEqual(e.autresProfils.map((p) => p.id), ['profil-2', 'profil-3']);
    e = majProfil(e, 'profil-2', { ageBeneficiaire: 52, isHandicap: true });
    e = retirerProfil(e, 'profil-2');
    assert.deepEqual(e.autresProfils.map((p) => p.id), ['profil-3']);
    e = ajouterProfil(e);
    assert.deepEqual(e.autresProfils.map((p) => p.id), ['profil-3', 'profil-2']);
    const neuf = e.autresProfils.find((p) => p.id === 'profil-2')!;
    assert.equal(neuf.ageBeneficiaire, null);
    assert.equal(neuf.isHandicap, false);
    assert.equal(prochainIdProfil(e), 'profil-4');
  });

  test('limites : 6 profils, 99 personnes ; retirer le profil principal ou un profil inconnu ne fait rien', () => {
    let e = etat();
    for (let i = 0; i < 8; i++) e = ajouterProfil(e);
    assert.equal(e.autresProfils.length, MAX_PROFILS - 1);
    assert.equal(ajouterProfil(etat({ nombrePersonnes: 99 })).autresProfils.length, 0);
    assert.equal(retirerProfil(e, 'principal').autresProfils.length, 5);
    assert.equal(retirerProfil(e, 'profil-42').autresProfils.length, 5);
  });

  test("majProfil : un profil supplémentaire change seul ; le profil principal change les champs de l'état", () => {
    const e = ajouterProfil(etat({ ageBeneficiaire: 30 }));
    const apres = majProfil(majProfil(e, 'profil-2', { ageBeneficiaire: 58 }), 'principal', { isHandicap: true });
    assert.equal(apres.ageBeneficiaire, 30);
    assert.equal(apres.isHandicap, true);
    assert.equal(apres.autresProfils[0].ageBeneficiaire, 58);
    assert.equal(apres.autresProfils[0].isHandicap, false);
  });

  test('statut changé : seules les réponses du nouveau statut et les questions communes restent', () => {
    let e = ajouterProfil(etat());
    e = majProfil(e, 'profil-2', {
      projetType: 'formation_dirigeant',
      statutDirigeant: 'artisan',
      microEntrepreneur: false,
      soldeCpf: 800,
      ageBeneficiaire: 52,
      niveauDiplome: 'bac',
      isHandicap: true,
    });
    e = changerProjetDuProfil(e, 'profil-2', 'formation_salarie');
    const salarie = e.autresProfils[0];
    assert.equal(salarie.projetType, 'formation_salarie');
    assert.equal(salarie.statutDirigeant, null);
    assert.equal(salarie.microEntrepreneur, null);
    assert.equal(salarie.soldeCpf, 800); // le salarié garde le solde CPF
    assert.deepEqual([salarie.ageBeneficiaire, salarie.niveauDiplome, salarie.isHandicap], [52, 'bac', true]); // questions communes
    e = changerProjetDuProfil(e, 'profil-2', 'alternance');
    assert.equal(e.autresProfils[0].soldeCpf, null);
    assert.equal(e.autresProfils[0].contractType, null); // pas encore de type de contrat d'alternance
    assert.deepEqual(changerProjetDuProfil(e, 'profil-42', 'formation_dirigeant'), e);
  });

  test("definirNombre : borné à la place qui reste, jamais 0 ni NaN ; un profil inconnu ne change rien", () => {
    const e = etat({ nombrePersonnes: 10, autresProfils: [extra('profil-2', { nombre: 50 })] });
    assert.equal(definirNombre(e, 'principal', 80).nombrePersonnes, 49);
    assert.equal(definirNombre(e, 'principal', 0).nombrePersonnes, 1);
    assert.equal(definirNombre(e, 'principal', Number.NaN).nombrePersonnes, 1);
    assert.equal(definirNombre(e, 'profil-2', 7.9).autresProfils[0].nombre, 7);
    assert.deepEqual(definirNombre(e, 'profil-42', 5), e);
  });

  test("changer le projet du profil principal garde le budget déjà consommé tant qu'un profil relève d'un projet salarié", () => {
    const groupe = ajouterProfil(etat({ budgetDejaConsomme: 2000 })); // profil-2 est salarié aussi
    assert.equal({ ...groupe, ...etatDepuisProjet(groupe, 'formation_dirigeant') }.budgetDejaConsomme, 2000);
    const seul = etat({ budgetDejaConsomme: 2000 });
    assert.equal({ ...seul, ...etatDepuisProjet(seul, 'formation_dirigeant') }.budgetDejaConsomme, null);
  });
});

describe('prix de la formation', () => {
  test("par personne : le coût d'une personne est le prix saisi", () => {
    const e = etatDepuisPrix(etat({ nombrePersonnes: 3 }), 2800, 35, false);
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour, e.prixDuGroupe, e.durationHours], [2800, 80, null, 35]);
  });

  test("pour le groupe : le coût d'une personne est le prix divisé par l'effectif", () => {
    const e = etatDepuisPrix(etat({ nombrePersonnes: 4 }), 11200, 35, true);
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour, e.prixDuGroupe], [2800, 80, 11200]);
  });

  test('pour le groupe avec une seule personne : ignoré', () => {
    const e = etatDepuisPrix(etat(), 2800, 35, true);
    assert.deepEqual([e.pedagogyCostTotal, e.prixDuGroupe], [2800, null]);
  });

  test('prix effacé ou durée absente : jamais NaN ni infini', () => {
    for (const pourLeGroupe of [false, true]) {
      const efface = etatDepuisPrix(etat({ nombrePersonnes: 2 }), null, 35, pourLeGroupe);
      assert.deepEqual([efface.pedagogyCostTotal, efface.pedagogyCostPerHour, efface.prixDuGroupe], [null, null, null]);
      assert.equal(etatDepuisPrix(etat({ nombrePersonnes: 2 }), 5600, null, pourLeGroupe).pedagogyCostPerHour, null);
    }
  });

  test('bascule de mode : le coût réel est gardé, converti et non ressaisi', () => {
    const base = etatDepuisPrix(etat({ nombrePersonnes: 4 }), 2800, 35, false);
    const groupe = basculerModePrix(base, true);
    assert.deepEqual([groupe.prixDuGroupe, groupe.pedagogyCostTotal, groupe.pedagogyCostPerHour], [11200, 2800, 80]);
    const retour = basculerModePrix(groupe, false);
    assert.deepEqual([retour.prixDuGroupe, retour.pedagogyCostTotal], [null, 2800]);
    // Aucun prix saisi : rien à convertir. Une seule personne : pas de prix de groupe.
    assert.deepEqual(basculerModePrix(etat({ nombrePersonnes: 4 }), true), etat({ nombrePersonnes: 4 }));
    assert.equal(basculerModePrix(etatDepuisPrix(etat(), 2800, 35, false), true).prixDuGroupe, null);
  });
});

describe('OPCO et budget du groupe', () => {
  const avec = (...projets: WizardState['projetType'][]): WizardState => {
    const [principal, ...autres] = projets;
    return etat({ projetType: principal, autresProfils: autres.map((p, i) => extra(`profil-${i + 2}`, { projetType: p })) });
  };

  test('dirigeant seul : OPCO facultatif, aucun budget', () => {
    assert.equal(opcoRequisPourLeGroupe(avec('formation_dirigeant')), false);
    assert.equal(ouvreBudgetPourLeGroupe(avec('formation_dirigeant')), false);
  });

  test('un salarié dans le groupe : OPCO requis, budget ouvert, quel que soit son rang', () => {
    for (const projets of [
      ['formation_dirigeant', 'formation_salarie'],
      ['formation_salarie', 'formation_dirigeant'],
      ['formation_dirigeant', 'reconversion_salarie'],
    ] as const) {
      assert.equal(opcoRequisPourLeGroupe(avec(...projets)), true, projets.join());
      assert.equal(ouvreBudgetPourLeGroupe(avec(...projets)), true, projets.join());
    }
  });

  test("alternance et demandeur d'emploi : OPCO requis, aucun budget", () => {
    assert.equal(opcoRequisPourLeGroupe(avec('alternance', 'recrutement_demandeur_emploi')), true);
    assert.equal(ouvreBudgetPourLeGroupe(avec('alternance', 'recrutement_demandeur_emploi')), false);
  });

  test('projet non choisi : requis et ouvert, comme pour une personne seule', () => {
    assert.equal(opcoRequisPourLeGroupe(avec(null)), true);
    assert.equal(ouvreBudgetPourLeGroupe(avec(null)), true);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && node --import tsx --test apps/web/tests/groupe.test.ts`
Expected: FAIL (le module `../src/lib/groupe` n'existe pas).

- [ ] **Step 3 : écrire le code**

Dans `apps/web/src/lib/parcours.ts`, ajouter `ChampsProfil` à l'importation de types de `@opco/core` (`import type { ChampsProfil, OpcoData, ProjetType, ... } from '@opco/core';`) et remplacer la fonction `etatDepuisProjet` et son commentaire (de `/**\n * Mise à jour quand l'utilisateur choisit un projet.` jusqu'à l'accolade fermante de la fonction) par :

```ts
/**
 * Réponses d'un profil (le profil principal ou un profil supplémentaire) quand son projet change. Celles qui répondent à
 * une question propre à un autre statut reviennent à leur valeur initiale ; les questions communes (âge, diplôme, RQTH) et
 * celles du nouveau statut sont gardées. Le type de contrat suit le statut : « alternance » n'existe que pour l'alternant,
 * qui l'obtient en choisissant son type de contrat ; un salarié ne garde jamais « alternance ».
 */
export function champsDepuisProjet(champs: ChampsProfil, projet: ProjetType): Partial<ChampsProfil> {
  const statut = STATUT_PAR_PROJET[projet];
  const gardees = new Set(QUESTIONS_PAR_STATUT[statut]);
  const initial = createInitialWizardState();
  const maj: Partial<ChampsProfil> = { projetType: projet };
  const remettre = <K extends keyof ChampsProfil>(champ: K) => {
    maj[champ] = initial[champ];
  };
  for (const champ of QUESTIONS_PROPRES) if (!gardees.has(champ)) remettre(champ as keyof ChampsProfil);
  if (statut === 'alternant') maj.contractType = champs.typeAlternance ? 'alternance' : null;
  else if (statut === 'salarie' && champs.contractType === 'alternance') maj.contractType = null;
  return maj;
}

/**
 * Mise à jour quand l'utilisateur choisit le projet du profil principal : `champsDepuisProjet`, plus le budget. Le budget
 * déjà consommé auprès de l'OPCO, que l'étape Entreprise ne montre qu'aux projets qui ouvrent ce budget
 * (`ouvreBudgetOpco`), revient à vide quand aucun profil du groupe ne relève d'un tel projet.
 */
export function etatDepuisProjet(state: WizardState, projet: ProjetType): Partial<WizardState> {
  const maj: Partial<WizardState> = champsDepuisProjet(state, projet);
  const projetsDuGroupe = [projet, ...state.autresProfils.map((p) => p.projetType)];
  if (!projetsDuGroupe.some(ouvreBudgetOpco)) maj.budgetDejaConsomme = createInitialWizardState().budgetDejaConsomme;
  return maj;
}
```

Créer `apps/web/src/lib/groupe.ts` :

```ts
// ============================================================
// État d'un groupe de personnes formées dans le parcours du site : nombre de personnes, profils supplémentaires, prix de
// la formation par personne ou pour le groupe, OPCO et budget du groupe. Fonctions pures (ni React ni effet de bord) ;
// `useWizard` applique `normaliserGroupe` après chaque mise à jour. Le calcul (@opco/core) ne lit que le coût d'UNE
// personne : `pedagogyCostTotal` ; le prix du groupe n'est qu'une saisie dont ce coût découle.
// ============================================================

import {
  ID_PROFIL_PRINCIPAL,
  MAX_PERSONNES,
  MAX_PROFILS,
  champsDuProfilPrincipal,
  createInitialWizardState,
  nombreDePersonnes,
  profilsDuGroupe,
} from '@opco/core';
import type { ChampsProfil, ProfilSupplementaire, ProjetType, WizardState } from '@opco/core';
import { opcoRequis, ouvreBudgetOpco } from './entreprise';
import { champsDepuisProjet, coutsDeFormation } from './parcours';

// --- Saisie du nombre de personnes --------------------------------------------------------------------------------

/**
 * Lit le nombre de personnes saisi : un entier de 1 à 99. Au-delà de 99, 99. Vide, zéro, négatif, décimal, texte ou
 * notation scientifique : null (la saisie est refusée, l'état garde sa valeur). Jamais NaN.
 */
export function lireEffectif(texte: string): number | null {
  const propre = texte.trim();
  if (!/^\d{1,4}$/.test(propre)) return null;
  const n = Number(propre);
  return n < 1 ? null : Math.min(n, MAX_PERSONNES);
}

// --- Cohérence de l'état ------------------------------------------------------------------------------------------

const borner = (n: number): number => (Number.isFinite(n) ? Math.min(MAX_PERSONNES, Math.max(1, Math.floor(n))) : 1);

/**
 * Ramène l'état d'un groupe à ses invariants : effectifs entiers de 1 à 99, au plus 5 profils supplémentaires, au plus 99
 * personnes (le surplus se retire du dernier profil, puis des précédents, puis du profil principal), prix du groupe vidé sous
 * deux personnes, coût d'une personne et coût horaire recalculés quand le prix du groupe est renseigné. Idempotente.
 */
export function normaliserGroupe(etat: WizardState): WizardState {
  const autres = etat.autresProfils.slice(0, MAX_PROFILS - 1).map((p) => ({ ...p, nombre: borner(p.nombre) }));
  let principal = borner(etat.nombrePersonnes);
  let exces = principal + autres.reduce((somme, p) => somme + p.nombre, 0) - MAX_PERSONNES;
  for (let i = autres.length - 1; i >= 0 && exces > 0; i--) {
    const retrait = Math.min(exces, autres[i].nombre - 1);
    autres[i] = { ...autres[i], nombre: autres[i].nombre - retrait };
    exces -= retrait;
  }
  if (exces > 0) principal -= exces;
  const personnes = principal + autres.reduce((somme, p) => somme + p.nombre, 0);
  let suite: WizardState = { ...etat, nombrePersonnes: principal, autresProfils: autres };
  if (personnes < 2) suite = { ...suite, prixDuGroupe: null };
  if (suite.prixDuGroupe != null) {
    suite = { ...suite, ...coutsDeFormation(suite.prixDuGroupe / personnes, suite.durationHours) };
  }
  return suite;
}

// --- Profils ------------------------------------------------------------------------------------------------------

/** Identifiant du prochain profil supplémentaire : le plus petit « profil-N » libre à partir de N = 2. */
export function prochainIdProfil(etat: WizardState): string {
  const pris = new Set(etat.autresProfils.map((p) => p.id));
  for (let n = 2; ; n++) if (!pris.has(`profil-${n}`)) return `profil-${n}`;
}

/** Un profil neuf : une personne, le projet du profil principal (« former un salarié » sans projet), aucune autre réponse. */
export function nouveauProfil(etat: WizardState): ProfilSupplementaire {
  const vides = champsDuProfilPrincipal(createInitialWizardState());
  return { ...vides, projetType: etat.projetType ?? 'formation_salarie', id: prochainIdProfil(etat), nombre: 1 };
}

/** Ajoute un profil neuf ; sans effet à 6 profils ou à 99 personnes. */
export function ajouterProfil(etat: WizardState): WizardState {
  if (etat.autresProfils.length >= MAX_PROFILS - 1 || nombreDePersonnes(etat) >= MAX_PERSONNES) return etat;
  return normaliserGroupe({ ...etat, autresProfils: [...etat.autresProfils, nouveauProfil(etat)] });
}

/** Retire un profil supplémentaire ; le profil principal et un identifiant inconnu ne changent rien. */
export function retirerProfil(etat: WizardState, id: string): WizardState {
  return normaliserGroupe({ ...etat, autresProfils: etat.autresProfils.filter((p) => p.id !== id) });
}

/** Met à jour les réponses d'un profil : l'identifiant `principal` désigne les champs de l'état. */
export function majProfil(etat: WizardState, id: string, maj: Partial<ChampsProfil>): WizardState {
  if (id === ID_PROFIL_PRINCIPAL) return normaliserGroupe({ ...etat, ...maj });
  return normaliserGroupe({ ...etat, autresProfils: etat.autresProfils.map((p) => (p.id === id ? { ...p, ...maj } : p)) });
}

/** Change le projet d'un profil : seules les réponses du nouveau statut et les questions communes restent (`champsDepuisProjet`). */
export function changerProjetDuProfil(etat: WizardState, id: string, projet: ProjetType): WizardState {
  const champs = profilsDuGroupe(etat).find((p) => p.id === id)?.champs;
  return champs ? majProfil(etat, id, champsDepuisProjet(champs, projet)) : etat;
}

/** Fixe le nombre de personnes d'un profil, borné à la place qui reste (1 au moins, jamais NaN) ; un identifiant inconnu ne change rien. */
export function definirNombre(etat: WizardState, id: string, nombre: number): WizardState {
  const profils = profilsDuGroupe(etat);
  if (!profils.some((p) => p.id === id)) return etat;
  const autres = profils.reduce((somme, p) => somme + (p.id === id ? 0 : p.nombre), 0);
  const borne = Math.max(1, Math.min(Number.isFinite(nombre) ? Math.floor(nombre) : 1, MAX_PERSONNES - autres));
  if (id === ID_PROFIL_PRINCIPAL) return normaliserGroupe({ ...etat, nombrePersonnes: borne });
  return normaliserGroupe({ ...etat, autresProfils: etat.autresProfils.map((p) => (p.id === id ? { ...p, nombre: borne } : p)) });
}

// --- Prix de la formation -----------------------------------------------------------------------------------------

/**
 * Saisie du prix et de la durée. Par personne, `saisie` est le coût d'une personne. Pour le groupe (à partir de deux
 * personnes), c'est le prix de tout le groupe : l'état garde ce prix et en tire le coût d'une personne. Un prix effacé ou
 * une durée absente donnent un coût (ou un coût horaire) vide, jamais NaN.
 */
export function etatDepuisPrix(etat: WizardState, saisie: number | null, heures: number | null, pourLeGroupe: boolean): WizardState {
  const personnes = nombreDePersonnes(etat);
  if (pourLeGroupe && personnes >= 2) {
    return { ...etat, ...coutsDeFormation(saisie == null ? null : saisie / personnes, heures), prixDuGroupe: saisie };
  }
  return { ...etat, ...coutsDeFormation(saisie, heures), prixDuGroupe: null };
}

/**
 * Bascule entre « par personne » et « pour le groupe » en gardant le coût réel : le nombre affiché est converti, pas
 * ressaisi. Vers le groupe, le prix est celui d'une personne multiplié par l'effectif, au centime ; sans prix saisi ou
 * avec une seule personne, rien n'est converti.
 */
export function basculerModePrix(etat: WizardState, versGroupe: boolean): WizardState {
  const personnes = nombreDePersonnes(etat);
  if (!versGroupe || personnes < 2) return { ...etat, prixDuGroupe: null };
  if (etat.pedagogyCostTotal == null) return etat;
  return normaliserGroupe({ ...etat, prixDuGroupe: Math.round(etat.pedagogyCostTotal * personnes * 100) / 100 });
}

// --- OPCO et budget du groupe -------------------------------------------------------------------------------------

/** Projet de chaque profil du groupe (le profil principal d'abord). */
export const projetsDuGroupe = (etat: WizardState): (ProjetType | null)[] => profilsDuGroupe(etat).map((p) => p.champs.projetType);

/** L'OPCO est requis dès qu'un profil n'est pas un dirigeant (`opcoRequis`). */
export const opcoRequisPourLeGroupe = (etat: WizardState): boolean => projetsDuGroupe(etat).some((p) => opcoRequis(p));

/** Le budget déjà consommé s'affiche et se garde tant qu'un profil relève d'un projet salarié (`ouvreBudgetOpco`). */
export const ouvreBudgetPourLeGroupe = (etat: WizardState): boolean => projetsDuGroupe(etat).some((p) => ouvreBudgetOpco(p));
```

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run test:web`
Expected: toute la suite du site verte, `groupe.test.ts` compris.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/web && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add apps/web/src/lib/groupe.ts apps/web/src/lib/parcours.ts apps/web/tests/groupe.test.ts
git commit -m "$(cat <<'EOF'
site : état d'un groupe de personnes formées (profils, effectif, prix du groupe, OPCO et budget)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10 : Étape « Participants », champs manquants, libellés de profils, étiquettes

**Files:**
- Modify: `apps/web/src/lib/etapes.ts`
- Create: `apps/web/src/lib/profils.ts`
- Modify: `apps/web/src/lib/situation.ts`
- Modify: `apps/web/tests/parcours.test.ts` (libellé de l'étape, garde de complétude de `ChampsProfil`)
- Modify: `apps/web/tests/groupe.test.ts`

**Interfaces:**
- Consumes: `profilsDuGroupe`, `nombreDePersonnes`, `CONTRACT_TYPE_LABELS` de `@opco/core` ; `opcoRequisPourLeGroupe` (tâche 9) ; `nombreEtUnite` (`lib/format.ts`).
- Produces: `ETAPES[2] = { key: 'situation', label: 'Participants' }` ; `manquantsDuProfil(champs: ChampsProfil): string[]` ; `champsManquants` prenant en compte tous les profils ; `STATUT_DU_PROFIL: Record<ProjetType, string>` et `libelleDuProfil(champs: ChampsProfil): string` (`lib/profils.ts`) ; une étiquette de groupe dans `etiquettesDeSituation`.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `apps/web/tests/parcours.test.ts`, remplacer `test("six étapes dans l'ordre : Projet, Entreprise, Bénéficiaire, Formation, Frais, Récapitulatif", () => {` par `test("six étapes dans l'ordre : Projet, Entreprise, Participants, Formation, Frais, Récapitulatif", () => {` et `['situation', 'Bénéficiaire'],` par `['situation', 'Participants'],`.

Dans le même fichier, ajouter `champsDuProfilPrincipal` à l'importation de `@opco/core`, puis, juste après le test « garde : chaque champ du bénéficiaire est commun, propre à un statut, du groupe, ou non posé par le site » (dans le même `describe`, où `CHAMPS_BENEFICIAIRE` est lu), ajouter :

```ts
  test('garde : un profil reprend toutes les questions de l’étape Participants (une question ajoutée à l’état sans l’ajouter au profil serait lue sur le profil principal pour tout le groupe)', () => {
    const attendus = [
      ...CHAMPS_BENEFICIAIRE.filter((c) => !CHAMPS_NON_POSES.includes(c) && !CHAMPS_DU_GROUPE.includes(c)),
      'projetType', // posé à l'étape 0 dans types.ts, réponse de chaque profil
    ];
    assert.deepEqual(Object.keys(champsDuProfilPrincipal(createInitialWizardState())).sort(), attendus.sort());
  });
```

Dans `apps/web/tests/groupe.test.ts`, ajouter aux importations :

```ts
import { champsDuProfilPrincipal } from '@opco/core';
import type { ChampsProfil } from '@opco/core';
import { champsManquants, manquantsDuProfil } from '../src/lib/etapes';
import { INSECABLE } from '../src/lib/insecable';
import { libelleDuProfil } from '../src/lib/profils';
import { etiquettesDeSituation } from '../src/lib/situation';
```

(`champsDuProfilPrincipal` rejoint l'importation de `@opco/core` existante.) Ajouter à la fin du fichier :

```ts
describe('champs manquants d’un groupe (étape Participants)', () => {
  test('un seul profil : les textes d’une personne seule, sans nom de profil, quel que soit l’effectif', () => {
    assert.deepEqual(champsManquants('situation', etat()), ['le type de contrat']);
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi' })), []);
    assert.deepEqual(champsManquants('situation', etat({ nombrePersonnes: 4, contractType: 'cdi' })), []);
  });

  test('plusieurs profils : chaque manque nomme son profil', () => {
    const e = etat({
      contractType: null,
      autresProfils: [extra('profil-2', { projetType: 'formation_dirigeant' }), extra('profil-3', { projetType: 'alternance' })],
    });
    assert.deepEqual(champsManquants('situation', e), [
      'le type de contrat (profil 1)',
      'le statut du dirigeant (profil 2)',
      "le type de contrat d'alternance (profil 3)",
      "l'âge de l'alternant (profil 3)",
    ]);
  });

  test('un profil supplémentaire incomplet empêche de continuer, un profil complet non', () => {
    const complet = extra('profil-2', { contractType: 'cdd' });
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi', autresProfils: [complet] })), []);
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi', autresProfils: [extra('profil-2')] })), [
      'le type de contrat (profil 2)',
    ]);
  });

  test('OPCO : requis dès qu’un profil n’est pas un dirigeant', () => {
    const dirigeantSeul = etat({ projetType: 'formation_dirigeant', regionCode: '11', companySize: 'less_11' });
    assert.deepEqual(champsManquants('identification', dirigeantSeul), []);
    assert.deepEqual(champsManquants('identification', { ...dirigeantSeul, autresProfils: [extra('profil-2')] }), ["l'OPCO"]);
  });

  test('manquantsDuProfil : un projet non choisi manque au profil', () => {
    assert.deepEqual(manquantsDuProfil({ ...champsDuProfilPrincipal(createInitialWizardState()), projetType: null }), ['votre projet (étape 1)']);
  });
});

describe('libellé d’un profil', () => {
  const champs = (maj: Partial<ChampsProfil>): ChampsProfil => ({ ...champsDuProfilPrincipal(createInitialWizardState()), ...maj });

  test('statut, puis ce qui le précise, l’âge et la reconnaissance de travailleur handicapé', () => {
    assert.equal(libelleDuProfil(champs({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35 })), `Salarié en CDI, 35${INSECABLE}ans`);
    assert.equal(
      libelleDuProfil(champs({ projetType: 'formation_dirigeant', statutDirigeant: 'artisan', ageBeneficiaire: 52, isHandicap: true })),
      `Dirigeant artisan, 52${INSECABLE}ans, RQTH`,
    );
    assert.equal(libelleDuProfil(champs({ projetType: 'reconversion_salarie', contractType: 'cdd' })), 'Salarié en reconversion, CDD');
    assert.equal(libelleDuProfil(champs({ projetType: 'formation_salarie', contractType: 'interim' })), 'Salarié en intérim');
    assert.equal(
      libelleDuProfil(champs({ projetType: 'alternance', typeAlternance: 'apprentissage', ageBeneficiaire: 19 })),
      `Alternant en apprentissage, 19${INSECABLE}ans`,
    );
    assert.equal(
      libelleDuProfil(champs({ projetType: 'alternance', typeAlternance: 'professionnalisation' })),
      'Alternant en contrat de professionnalisation',
    );
    assert.equal(libelleDuProfil(champs({ projetType: 'recrutement_demandeur_emploi' })), "Demandeur d'emploi");
  });

  test('projet non choisi ou contrat « alternance » d’un reste de saisie : « Salarié » seul', () => {
    assert.equal(libelleDuProfil(champs({ projetType: null })), 'Salarié');
    assert.equal(libelleDuProfil(champs({ projetType: 'formation_salarie', contractType: 'alternance' })), 'Salarié');
  });
});

describe('étiquettes de la situation d’un groupe', () => {
  test('rien pour une personne ; « N personnes » avec un profil ; « N personnes · M profils » avec plusieurs', () => {
    assert.deepEqual(etiquettesDeSituation(etat()), ['Former un salarié']);
    assert.deepEqual(etiquettesDeSituation(etat({ nombrePersonnes: 3 })), ['Former un salarié', `3${INSECABLE}personnes`]);
    assert.deepEqual(
      etiquettesDeSituation(etat({ nombrePersonnes: 3, autresProfils: [extra('profil-2', { nombre: 2 })] })),
      ['Former un salarié', `5${INSECABLE}personnes · 2${INSECABLE}profils`],
    );
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && node --import tsx --test apps/web/tests/groupe.test.ts apps/web/tests/parcours.test.ts`
Expected: FAIL (module `lib/profils` absent, libellé de l'étape encore « Bénéficiaire », champs manquants d'un seul profil). La garde de complétude du profil ajoutée plus haut passe dès maintenant : elle verrouille l'existant, elle ne fait pas partie des échecs attendus.

- [ ] **Step 3 : écrire le code**

Dans `apps/web/src/lib/etapes.ts` :

1. Remplacer les importations

```ts
import type { WizardState } from '@opco/core';
import { opcoRequis } from './entreprise';
```

par

```ts
import { profilsDuGroupe } from '@opco/core';
import type { ChampsProfil, WizardState } from '@opco/core';
import { opcoRequisPourLeGroupe } from './groupe';
```

2. Remplacer `  { key: 'situation', label: 'Bénéficiaire' },` par `  { key: 'situation', label: 'Participants' },`.

3. Remplacer le commentaire et la fonction `champsManquants` (de `/**\n * Ce qui manque pour passer à l'étape suivante` jusqu'à l'accolade fermante de la fonction) par :

```ts
/**
 * Ce qui manque à UN profil pour quitter l'étape Participants, dans l'ordre des champs à l'écran : salarié, le type de
 * contrat (et l'ancienneté pour une reconversion) ; demandeur d'emploi, l'inscription à France Travail ; alternance, le
 * type de contrat d'alternance et l'âge ; dirigeant, son statut. Un projet non choisi manque au profil.
 */
export function manquantsDuProfil(champs: ChampsProfil): string[] {
  const manquants: string[] = [];
  switch (champs.projetType) {
    case 'formation_salarie':
    case 'reconversion_salarie':
      // « Alternance » n'est pas un contrat proposé au salarié : un reste d'un autre projet ne compte pas.
      if (champs.contractType == null || champs.contractType === 'alternance') manquants.push('le type de contrat');
      if (champs.projetType === 'reconversion_salarie' && champs.anciennete_mois == null) manquants.push("l'ancienneté");
      break;
    case 'recrutement_demandeur_emploi':
      if (champs.inscritFranceTravail == null) manquants.push("l'inscription à France Travail");
      break;
    case 'alternance':
      if (champs.typeAlternance == null) manquants.push("le type de contrat d'alternance");
      if (champs.ageBeneficiaire == null) manquants.push("l'âge de l'alternant");
      break;
    case 'formation_dirigeant':
      if (champs.statutDirigeant == null) manquants.push('le statut du dirigeant');
      break;
    default:
      manquants.push('votre projet (étape 1)');
  }
  return manquants;
}

/**
 * Ce qui manque pour passer à l'étape suivante, dans l'ordre des champs à l'écran (vide : l'étape est complète).
 * Une seule source pour l'activation du bouton « Suivant » et pour le texte qui dit ce qui manque.
 * - Projet : le projet.
 * - Entreprise : l'OPCO (choisi ou détecté ; facultatif tant que tous les profils sont des dirigeants), la région, la taille.
 * - Participants : ce que `manquantsDuProfil` demande à chaque profil ; avec plusieurs profils, chaque manque nomme son
 *   profil (« le type de contrat (profil 2) »), avec un seul les textes restent ceux d'une personne seule.
 * - Formation : le type, le mode, la durée et le coût total (durée et coût supérieurs à zéro).
 * - Frais et récapitulatif : rien d'obligatoire.
 */
export function champsManquants(etape: EtapeSite, state: WizardState): string[] {
  const manquants: string[] = [];
  switch (etape) {
    case 'projet':
      if (state.projetType == null) manquants.push('votre projet');
      break;
    case 'identification':
      if (opcoRequisPourLeGroupe(state) && !(state.selectedOpcoSlug || state.detectedOpcoSlug)) manquants.push("l'OPCO");
      if (state.regionCode == null) manquants.push('la région');
      if (state.companySize == null) manquants.push("la taille de l'entreprise");
      break;
    case 'situation': {
      const profils = profilsDuGroupe(state);
      profils.forEach((profil, i) => {
        const manques = manquantsDuProfil(profil.champs);
        manquants.push(...(profils.length > 1 ? manques.map((m) => `${m} (profil ${i + 1})`) : manques));
      });
      break;
    }
    case 'formation':
      if (!state.formationType) manquants.push('le type de formation');
      if (!state.trainingMode) manquants.push('le mode de formation');
      if (!state.durationHours) manquants.push('la durée');
      if (!state.pedagogyCostTotal) manquants.push('le coût total');
      break;
    case 'frais':
    case 'recap':
      break;
  }
  return manquants;
}
```

Créer `apps/web/src/lib/profils.ts` :

```ts
// ============================================================
// Libellés d'un profil du groupe (étape Participants, récapitulatif, tableau « Par profil », cartes d'aides). Fonctions
// pures. Le statut se dit en un ou deux mots ; le libellé complet l'accompagne de ce qui le précise, de l'âge et de la
// reconnaissance de travailleur handicapé : « Salarié en CDI, 35 ans », « Dirigeant artisan, 52 ans, RQTH ».
// ============================================================

import type { ChampsProfil, ContractType, ProjetType, StatutDirigeant } from '@opco/core';
import { nombreEtUnite } from './format';

/** Le statut du profil, en un ou deux mots (boutons de choix du statut, résumé du profil). */
export const STATUT_DU_PROFIL: Record<ProjetType, string> = {
  formation_salarie: 'Salarié',
  reconversion_salarie: 'Salarié en reconversion',
  recrutement_demandeur_emploi: "Demandeur d'emploi",
  alternance: 'Alternant',
  formation_dirigeant: 'Dirigeant',
};

const CONTRAT_COURT: Record<Exclude<ContractType, 'alternance'>, string> = { cdi: 'CDI', cdd: 'CDD', interim: 'intérim' };

const STATUT_DIRIGEANT_COURT: Record<StatutDirigeant, string> = {
  commercant: 'commerçant',
  artisan: 'artisan',
  profession_liberale: 'profession libérale',
  exploitant_agricole: 'exploitant agricole',
  assimile_salarie: 'assimilé salarié',
};

/**
 * Libellé d'un profil : le statut (« Salarié en CDI », « Salarié en reconversion, CDD », « Alternant en apprentissage »,
 * « Dirigeant artisan », « Demandeur d'emploi »), puis l'âge (« 35 ans », espace insécable) et « RQTH ». Un projet non
 * choisi se lit « Salarié », comme partout ; le contrat « alternance » d'un salarié (reste d'une saisie) est ignoré.
 */
export function libelleDuProfil(champs: ChampsProfil): string {
  const projet = champs.projetType ?? 'formation_salarie';
  const contrat = champs.contractType && champs.contractType !== 'alternance' ? CONTRAT_COURT[champs.contractType] : null;
  let tete = STATUT_DU_PROFIL[projet];
  if (projet === 'formation_salarie' && contrat) tete += ` en ${contrat}`;
  else if (projet === 'reconversion_salarie' && contrat) tete += `, ${contrat}`;
  else if (projet === 'alternance' && champs.typeAlternance) {
    tete += champs.typeAlternance === 'apprentissage' ? ' en apprentissage' : ' en contrat de professionnalisation';
  } else if (projet === 'formation_dirigeant' && champs.statutDirigeant) tete += ` ${STATUT_DIRIGEANT_COURT[champs.statutDirigeant]}`;
  return [tete, champs.ageBeneficiaire != null ? nombreEtUnite(champs.ageBeneficiaire, 'ans') : null, champs.isHandicap ? 'RQTH' : null]
    .filter((morceau): morceau is string => !!morceau)
    .join(', ');
}
```

Dans `apps/web/src/lib/situation.ts`, remplacer l'importation `import { PROJET_LABELS, REGIONS, estCodeRegion, getEmbeddedOpcoBySlug } from '@opco/core';` par `import { PROJET_LABELS, REGIONS, estCodeRegion, getEmbeddedOpcoBySlug, nombreDePersonnes } from '@opco/core';`, puis remplacer la fonction et son commentaire (de `/**\n * Étiquettes de la situation` jusqu'à la fin du fichier) par :

```ts
/**
 * Étiquettes de la situation : projet, OPCO retenu, région de l'entreprise, durée de la formation, puis le groupe quand il
 * compte plusieurs personnes (« 5 personnes », « 5 personnes · 2 profils »). Mêmes règles que le calcul de l'écran
 * (`calculer`, lib/resultats.ts) : projet non choisi « Former un salarié », OPCO choisi sinon détecté, région reconnue par
 * le moteur seulement ; une donnée absente n'a pas d'étiquette. La durée s'écrit comme au récapitulatif (`nombreEtUnite` :
 * « 1 500 h »).
 */
export function etiquettesDeSituation(
  state: Pick<
    WizardState,
    'projetType' | 'selectedOpcoSlug' | 'detectedOpcoSlug' | 'regionCode' | 'durationHours' | 'nombrePersonnes' | 'autresProfils'
  >,
): string[] {
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const projet = state.projetType ?? 'formation_salarie';
  const personnes = nombreDePersonnes(state);
  const profils = 1 + (state.autresProfils?.length ?? 0);
  return [
    PROJET_LABELS[projet].label,
    opco?.name,
    estCodeRegion(state.regionCode) ? REGIONS[state.regionCode] : null,
    state.durationHours ? nombreEtUnite(state.durationHours, 'h') : null,
    personnes > 1
      ? `${nombreEtUnite(personnes, 'personnes')}${profils > 1 ? ` · ${nombreEtUnite(profils, 'profils')}` : ''}`
      : null,
  ].filter((e): e is string => !!e);
}
```

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run test:web`
Expected: toute la suite du site verte.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/web && npx tsc --noEmit`
Expected: aucune erreur (les composants lisent encore l'ancien état, qui reste valide).

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add apps/web/src/lib/etapes.ts apps/web/src/lib/profils.ts apps/web/src/lib/situation.ts apps/web/tests/groupe.test.ts apps/web/tests/parcours.test.ts
git commit -m "$(cat <<'EOF'
site : étape Participants, champs manquants par profil, libellés de profils, étiquette du groupe

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11 : Calcul de l'écran de résultats pour un groupe

**Files:**
- Modify: `apps/web/src/lib/resultats.ts` (`calculer`, notes de l'OPCO, détails du bandeau, tableau par profil, « concerne »)
- Create: `apps/web/tests/resultats-groupe.test.ts`

**Interfaces:**
- Consumes: `construirePlanDuBloc`, `etatDuProfil`, `fusionnerAides`, `fusionnerPlans`, `profilsDuGroupe`, `repartirFinancement`, `ProfilDuGroupe` (cœur, tâches 5 à 8) ; `libelleDuProfil` (tâche 10) ; `nombreEtUnite`, `formatEuro` (`lib/format.ts`).
- Produces (`lib/resultats.ts`) : `interface BlocResultat { profil: ProfilDuGroupe; profilAides: ProfilAides; aides: AideEvaluee[]; funding: FundingResult | null; plan: PlanFinancement }` ; `interface ResultatGroupe { personnes: number; personnesPdc: number; blocs: BlocResultat[] }` ; `calculer(state, aujourdhui)` rend en plus `groupe: ResultatGroupe` ; `notesOpco(projets, sansOpco): NoteOpco[]` ; `detailsDuBandeau(plan, personnes): { cout: string | null; reste: string | null }` ; `pourPersonnes(n): string` ; `mentionOpcoDuGroupe(personnesPdc, personnes): string | null` ; `lignesParProfil(blocs)` ; `libellesDesProfils(profils): Map<string, string>` ; `concerneParAide(aide, libelles): string[]`.

- [ ] **Step 1 : écrire les tests qui échouent**

Créer `apps/web/tests/resultats-groupe.test.ts` :

```ts
// Écran de résultats d'un groupe (lib/resultats.ts) : identité pour une personne seule, plan du groupe, répartition entre
// profils, notes de l'OPCO, détails du bandeau, tableau par profil. Les attentes sont écrites à la main ; les tirages au
// hasard ont une graine fixe.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMBEDDED_AIDES,
  EMBEDDED_PORTAILS,
  calculateFunding,
  construirePlan,
  createInitialWizardState,
  dateDeReference,
  evaluerAides,
  getEmbeddedOpcoBySlug,
  profilDepuisWizard,
  profilsDuGroupe,
  resolveVarianteBranche,
} from '@opco/core';
import type { PlanFinancement, ProjetType, WizardState } from '@opco/core';
import { ouvreBudgetOpco } from '../src/lib/entreprise';
import { formatEuro, texteMoteur } from '../src/lib/format';
import { INSECABLE } from '../src/lib/insecable';
import { ajouterProfil, changerProjetDuProfil, definirNombre, majProfil } from '../src/lib/groupe';
import { coutsDeFormation } from '../src/lib/parcours';
import {
  calculer,
  concerneParAide,
  detailsDuBandeau,
  etatEnTete,
  groupesAidesVisibles,
  libellesDesProfils,
  lignesParProfil,
  mentionOpcoDuGroupe,
  notesOpco,
  pourPersonnes,
} from '../src/lib/resultats';
import { encadreSansFinancement, planFermeDe } from '../src/lib/encadres-resultats';

const nb = INSECABLE;
const DATE = '2026-10-07';
const etat = (over: Partial<WizardState>): WizardState => ({ ...createInitialWizardState(), trainingMode: 'presentiel', ...over });

const SCENARIOS: Record<string, Partial<WizardState>> = {
  akto: {
    projetType: 'formation_salarie', selectedOpcoSlug: 'akto', detectedIdcc: '1516', regionCode: '11', departementCode: '95',
    companySize: 'less_11', contractType: 'cdi', ageBeneficiaire: 35, certificationLevel: 'rncp', formationType: 'certification',
    eligibleCpf: true, durationHours: 140, pedagogyCostTotal: 4200, pedagogyCostPerHour: 30,
  },
  grande: {
    projetType: 'formation_salarie', selectedOpcoSlug: 'atlas', regionCode: '84', companySize: '50_299', effectif: 120,
    contractType: 'cdi', formationType: 'non_certifiante', durationHours: 35, pedagogyCostTotal: 1400, pedagogyCostPerHour: 40,
  },
  demandeur: {
    projetType: 'recrutement_demandeur_emploi', selectedOpcoSlug: 'akto', regionCode: '76', companySize: '11_49',
    inscritFranceTravail: true, ageBeneficiaire: 28, formationType: 'qualification', durationHours: 280, pedagogyCostTotal: 3500,
  },
  apprenti: {
    projetType: 'alternance', selectedOpcoSlug: 'akto', regionCode: '32', companySize: '11_49', typeAlternance: 'apprentissage',
    ageBeneficiaire: 19, niveauFormationVise: 4, formationType: 'qualification', durationHours: 800, pedagogyCostTotal: 7000,
  },
  artisan: {
    projetType: 'formation_dirigeant', regionCode: '53', companySize: 'less_11', statutDirigeant: 'artisan',
    microEntrepreneur: false, ageBeneficiaire: 45, formationType: 'non_certifiante', organismeQualiopi: true, ...coutsDeFormation(900, 21),
  },
};

/** mulberry32 : tirages indépendants et reproductibles. */
function generateur(graine: number) {
  let s = graine;
  return (n: number) => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

/** Le calcul de l'écran tel qu'il était avant les groupes (copie de l'ancien `calculer`) : l'oracle de l'identité pour une personne. */
function ancienCalcul(state: WizardState, aujourdhui: string) {
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const effectiveState =
    !state.trainingDays && state.durationHours ? { ...state, trainingDays: Math.ceil(state.durationHours / 7) } : state;
  const projet = effectiveState.projetType ?? 'formation_salarie';
  const avecPdc = opco != null && ouvreBudgetOpco(projet);
  const funding = avecPdc ? calculateFunding(opco, effectiveState) : null;
  const variante = opco ? resolveVarianteBranche(opco, effectiveState) : null;
  const profil = profilDepuisWizard(effectiveState, slug);
  const aidesEvaluees = evaluerAides(EMBEDDED_AIDES, profil, dateDeReference(effectiveState.dateDebutFormation, aujourdhui));
  const plan = construirePlan(funding, aidesEvaluees, profil);
  const portail = EMBEDDED_PORTAILS.find((p) => p.region === profil.regionEntreprise) ?? null;
  return { opco, projet, funding, variante, profil, aidesEvaluees, plan, portail };
}

const PROJETS: ProjetType[] = ['formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi', 'alternance', 'formation_dirigeant'];
const OPCOS = ['akto', 'atlas', 'afdas', 'constructys', 'ocapiat', 'opco-ep', 'opco-mobilites', 'opco-sante', 'opco2i', 'opcommerce', 'uniformation'];

/** Un état de groupe tiré au hasard : projet, OPCO, taille, formation, puis 0 à 3 profils supplémentaires de 1 à 5 personnes. */
function groupeAleatoire(hasard: (n: number) => number): WizardState {
  const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
  const projet = un(PROJETS);
  let e = etat({
    projetType: projet,
    selectedOpcoSlug: hasard(6) === 0 ? null : un(OPCOS),
    regionCode: un(['11', '53', '76', '84'] as const),
    companySize: un(['less_11', '11_49', '50_299'] as const),
    ageBeneficiaire: un([19, 35, 58]),
    contractType: projet === 'alternance' ? 'alternance' : un(['cdi', 'cdd'] as const),
    typeAlternance: un(['apprentissage', 'professionnalisation'] as const),
    inscritFranceTravail: un([true, false]),
    statutDirigeant: un(['artisan', 'commercant', 'assimile_salarie'] as const),
    microEntrepreneur: un([null, false]),
    soldeCpf: un([null, 0, 800]),
    formationType: un(['non_certifiante', 'certification', 'cqp'] as const),
    eligibleCpf: un([null, true]),
    organismeQualiopi: un([null, true]),
    budgetDejaConsomme: un([null, 0, 3000]),
    ...coutsDeFormation(un([null, 900, 3500, 7000]), un([7, 21, 35, 140])),
  });
  e = definirNombre(e, 'principal', 1 + hasard(5));
  for (let i = hasard(4); i > 0; i--) {
    e = ajouterProfil(e);
    const id = e.autresProfils[e.autresProfils.length - 1].id;
    e = changerProjetDuProfil(e, id, un(PROJETS));
    e = majProfil(e, id, { ageBeneficiaire: un([19, 35, 58]), isHandicap: hasard(3) === 0, soldeCpf: un([null, 800]) });
    e = definirNombre(e, id, 1 + hasard(5));
  }
  return e;
}

const centimes = (euros: number) => Math.round(euros * 100);
const plan = (over: Partial<PlanFinancement>): PlanFinancement => ({
  coutFormation: 0,
  financements: [],
  totalFinance: 0,
  resteACharge: 0,
  aidesEmployeur: [],
  remunerations: [],
  avantagesFiscauxSociaux: [],
  options: [],
  nonChiffrees: [],
  servicesGratuits: [],
  ...over,
});

describe('une personne : le calcul de l’écran rend ce qu’il rendait avant les groupes', () => {
  test('les cinq scénarios', () => {
    for (const [nom, parcours] of Object.entries(SCENARIOS)) {
      const { groupe, ...apres } = calculer(etat(parcours), DATE);
      assert.deepEqual(apres, ancienCalcul(etat(parcours), DATE), nom);
      assert.equal(groupe.personnes, 1, nom);
      assert.equal(groupe.blocs.length, 1, nom);
    }
  });

  test('400 états tirés au hasard (graine 5), un seul profil d’une personne', () => {
    const hasard = generateur(5);
    for (let i = 0; i < 400; i++) {
      const e = groupeAleatoire(hasard);
      const seul = { ...e, nombrePersonnes: 1, autresProfils: [] };
      const { groupe, ...apres } = calculer(seul, DATE);
      assert.deepEqual(apres, ancienCalcul(seul, DATE), JSON.stringify(seul));
      assert.equal(groupe.blocs[0].plan, apres.plan);
    }
  });
});

describe('un groupe de profils identiques', () => {
  const quatre = () => calculer(etat({ ...SCENARIOS.akto, nombrePersonnes: 4 }), DATE);
  const une = () => calculer(etat(SCENARIOS.akto), DATE);

  test('quatre salariés : un profil, quatre personnes, le calcul de l’OPCO pour quatre', () => {
    const r = quatre();
    assert.deepEqual([r.groupe.personnes, r.groupe.personnesPdc, r.groupe.blocs.length], [4, 4, 1]);
    assert.equal(r.funding?.personnes, 4);
    assert.equal(r.plan.coutFormation, 4 * une().plan.coutFormation);
    assert.ok(r.plan.financements.length > 0);
    assert.ok(r.plan.financements.every((l) => l.personnes === 4));
  });

  test('sans plafond annuel atteint, le financement de l’OPCO vaut 4 fois celui d’une personne ; sinon il ne le dépasse pas', () => {
    const pdc = (r: ReturnType<typeof calculer>) => r.plan.financements.find((l) => l.id === 'opco-pdc')!.montant;
    if (quatre().funding?.budgetCapApplied) assert.ok(pdc(quatre()) <= 4 * pdc(une()) + 0.01);
    else assert.equal(pdc(quatre()), 4 * pdc(une()));
  });

  test('une aide du catalogue : son montant par personne est celui d’une personne, le plan le multiplie', () => {
    const r = quatre();
    const cpf = r.aidesEvaluees.find((a) => a.id === 'nat-cpf');
    const seul = une().aidesEvaluees.find((a) => a.id === 'nat-cpf');
    assert.equal(cpf?.montantEstime, seul?.montantEstime);
    assert.equal(cpf?.profils, undefined); // un seul profil : aucun champ « profils »
  });
});

describe('un groupe mixte : trois salariés et un dirigeant artisan', () => {
  const mixte = () => {
    let e = etat({
      ...SCENARIOS.artisan,
      selectedOpcoSlug: 'akto',
      projetType: 'formation_salarie',
      contractType: 'cdi',
      statutDirigeant: null,
      microEntrepreneur: null,
      ageBeneficiaire: 35,
      nombrePersonnes: 3,
    });
    e = ajouterProfil(e);
    e = changerProjetDuProfil(e, 'profil-2', 'formation_dirigeant');
    return majProfil(e, 'profil-2', { statutDirigeant: 'artisan', microEntrepreneur: false, ageBeneficiaire: 45 });
  };

  test('l’OPCO est calculé pour les trois salariés seulement, le dirigeant passe par ses aides', () => {
    const r = calculer(mixte(), DATE);
    assert.deepEqual([r.groupe.personnes, r.groupe.personnesPdc, r.groupe.blocs.length], [4, 3, 2]);
    assert.equal(r.funding?.personnes, 3);
    assert.equal(r.groupe.blocs[0].funding?.personnes, 3);
    assert.equal(r.groupe.blocs[1].funding, null);
    assert.equal(r.plan.coutFormation, 3600); // 4 × 900 €
  });

  test('le plan du groupe cumule la ligne de l’OPCO (3 personnes) et le fonds du dirigeant (1 personne)', () => {
    const r = calculer(mixte(), DATE);
    assert.equal(r.plan.financements.find((l) => l.id === 'opco-pdc')?.personnes, 3);
    assert.deepEqual(
      r.groupe.blocs[1].plan.financements.map((l) => [l.id, l.montant]),
      [['faf-fafcea', 735]],
    );
    assert.equal(r.groupe.blocs[0].plan.financements.some((l) => l.id === 'faf-fafcea'), false);
    assert.equal(r.plan.financements.find((l) => l.id === 'faf-fafcea')?.personnes, 1);
  });

  test('les aides du catalogue indiquent les profils concernés', () => {
    const r = calculer(mixte(), DATE);
    const faf = r.aidesEvaluees.find((a) => a.id === 'faf-fafcea');
    assert.deepEqual(faf?.profils?.map((p) => [p.profilId, p.nombre, p.statut, p.montantEstime]), [['profil-2', 1, 'eligible', 735]]);
  });
});

describe('situations limites d’un groupe', () => {
  test('aucun salarié (dirigeant et alternant) : pas de calcul de l’OPCO, même avec un OPCO connu', () => {
    let e = etat({ ...SCENARIOS.artisan, selectedOpcoSlug: 'akto', nombrePersonnes: 2 });
    e = ajouterProfil(e);
    e = changerProjetDuProfil(e, 'profil-2', 'alternance');
    e = majProfil(e, 'profil-2', { typeAlternance: 'apprentissage', ageBeneficiaire: 19 });
    const r = calculer(e, DATE);
    assert.equal(r.funding, null);
    assert.equal(r.groupe.personnesPdc, 0);
    assert.ok(r.groupe.blocs.every((b) => b.funding === null));
    assert.equal(r.groupe.personnes, 3);
  });

  test('sans OPCO connu : pas de calcul de l’OPCO pour les salariés non plus', () => {
    const r = calculer(etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 3 }), DATE);
    assert.equal(r.opco, undefined);
    assert.equal(r.funding, null);
    assert.equal(r.groupe.personnesPdc, 0);
  });

  test('coût de la formation inconnu : coût nul, état « coût inconnu », aucun nombre invalide', () => {
    const r = calculer(etat({ ...SCENARIOS.akto, nombrePersonnes: 3, ...coutsDeFormation(null, 140) }), DATE);
    assert.equal(r.plan.coutFormation, 0);
    assert.equal(etatEnTete(r.plan), 'cout_inconnu');
    assert.deepEqual(detailsDuBandeau(r.plan, r.groupe.personnes), { cout: null, reste: null });
    for (const n of [r.plan.coutFormation, r.plan.totalFinance, r.plan.resteACharge]) assert.ok(Number.isFinite(n));
  });

  test('plafond annuel épuisé par le budget déjà consommé : rien de financé par l’OPCO pour le groupe, jamais de montant négatif', () => {
    const r = calculer(etat({ ...SCENARIOS.akto, nombrePersonnes: 5, budgetDejaConsomme: 10_000_000 }), DATE);
    assert.equal(r.plan.financements.find((l) => l.id === 'opco-pdc'), undefined);
    assert.ok(r.plan.resteACharge >= 0 && r.plan.totalFinance >= 0);
  });
});

describe('1 000 groupes tirés au hasard (graine 17) : cohérence du plan, des parts et des textes', () => {
  test('les profils s’additionnent en centimes, aucun plan ne dépasse son coût, rien n’est invalide', () => {
    const hasard = generateur(17);
    let avecPlusieursProfils = 0;
    let avecPlusieursSalaries = 0;
    for (let i = 0; i < 1000; i++) {
      const e = groupeAleatoire(hasard);
      const r = calculer(e, DATE);
      const contexte = JSON.stringify(e);
      const { blocs, personnes } = r.groupe;
      assert.equal(personnes, blocs.reduce((s, b) => s + b.profil.nombre, 0), contexte);
      for (const champ of ['coutFormation', 'totalFinance', 'resteACharge'] as const) {
        assert.equal(centimes(r.plan[champ]), blocs.reduce((s, b) => s + centimes(b.plan[champ]), 0), `${champ} ${contexte}`);
        assert.ok(Number.isFinite(r.plan[champ]) && r.plan[champ] >= 0, `${champ} ${contexte}`);
      }
      assert.equal(centimes(r.plan.coutFormation - r.plan.resteACharge), centimes(r.plan.totalFinance), contexte);
      for (const b of blocs) {
        assert.ok(b.plan.totalFinance <= b.plan.coutFormation + 0.001, contexte);
        assert.ok(b.plan.resteACharge >= 0, contexte);
      }
      if (blocs.length > 1) {
        avecPlusieursProfils++;
        const lignes = [...r.plan.financements, ...r.plan.aidesEmployeur, ...r.plan.remunerations, ...r.plan.avantagesFiscauxSociaux];
        assert.ok(lignes.every((l) => l.personnes != null && l.personnes >= 1), contexte);
      }
      // Les parts de l'OPCO s'additionnent au résultat du groupe, poste par poste, au centime.
      const parts = blocs.filter((b) => b.funding);
      if (r.funding && parts.length > 1) {
        avecPlusieursSalaries++;
        r.funding.lines.forEach((l, j) => {
          assert.equal(centimes(l.fundedAmount), parts.reduce((s, b) => s + centimes(b.funding!.lines[j].fundedAmount), 0), contexte);
          assert.equal(centimes(l.requestedAmount), parts.reduce((s, b) => s + centimes(b.funding!.lines[j].requestedAmount), 0), contexte);
        });
      }
      if (r.funding) assert.equal(r.funding.personnes, r.groupe.personnesPdc, contexte);
    }
    assert.ok(avecPlusieursProfils >= 300, String(avecPlusieursProfils));
    assert.ok(avecPlusieursSalaries >= 60, String(avecPlusieursSalaries));
  });

  test('les textes du calcul d’un groupe, une fois rendus, ne contiennent aucun nombre à point (hors adresses et citations)', () => {
    const hasard = generateur(23);
    let textes = 0;
    for (let i = 0; i < 300; i++) {
      const { funding } = calculer(groupeAleatoire(hasard), DATE);
      if (!funding) continue;
      for (const t of [...funding.lines.flatMap((l) => [l.note ?? '', ...(l.details ?? [])]), ...funding.warnings]) {
        const lu = texteMoteur(t).replace(/https?:\S+/g, '').replace(/«[^»]*»/g, '');
        textes++;
        assert.doesNotMatch(lu, /\d\.\d/, t);
      }
    }
    assert.ok(textes > 1000, String(textes));
  });

  test('l’encadré « aucun financement chiffré » ne dit rien de faux sur un groupe', () => {
    const hasard = generateur(29);
    let controles = 0;
    for (let i = 0; i < 600; i++) {
      const { plan: p, aidesEvaluees, funding, portail } = calculer(groupeAleatoire(hasard), DATE);
      if (etatEnTete(p) !== 'aucun_financement_chiffre') continue;
      controles++;
      const { texte, rappels, aidesAVerifier } = encadreSansFinancement(p, aidesEvaluees, portail != null, planFermeDe(funding));
      const listees = groupesAidesVisibles(aidesEvaluees).flatMap((g) => g.aides);
      const aVerifier = listees.filter((a) => a.statut === 'a_verifier');
      if (texte.includes('aucune autre aide à montant')) assert.ok(!listees.some((a) => (a.montantEstime ?? 0) > 0), texte);
      if (texte.includes('Voici les aides identifiées')) assert.ok(rappels.length > 0, texte);
      if (texte.includes('à vérifier')) assert.ok(aVerifier.length > 0, texte);
      if (aidesAVerifier) assert.equal(aidesAVerifier.nombre, aVerifier.length, texte);
      if (texte.includes('après étude du dossier')) assert.ok(p.nonChiffrees.length > 0 || p.options.some((o) => o.montantEstime == null), texte);
    }
    assert.ok(controles >= 100, String(controles));
  });
});

describe('notes sous le bandeau pour un groupe (notesOpco)', () => {
  test('un seul projet : les notes d’une personne seule', () => {
    assert.deepEqual(notesOpco(['formation_salarie'], true), [{ genre: 'sans-opco', titre: 'Aucun OPCO renseigné' }]);
    assert.deepEqual(notesOpco(['formation_salarie', 'formation_salarie'], false), []);
    assert.deepEqual(notesOpco(['formation_dirigeant'], true), [
      { genre: 'dirigeant', titre: 'Pas de calcul du plan de développement des compétences pour ce projet' },
    ]);
    assert.deepEqual(notesOpco(['formation_dirigeant', 'formation_dirigeant'], false), [
      { genre: 'dirigeant', titre: 'OPCO non compté pour un dirigeant' },
    ]);
    assert.deepEqual(notesOpco(['alternance'], true), []);
    assert.deepEqual(notesOpco([null], true), [{ genre: 'sans-opco', titre: 'Aucun OPCO renseigné' }]);
  });

  test('plusieurs projets : chaque note qui s’applique, une fois', () => {
    assert.deepEqual(notesOpco(['formation_salarie', 'formation_dirigeant'], false), [
      { genre: 'dirigeant', titre: 'OPCO non compté pour le dirigeant du groupe' },
    ]);
    assert.deepEqual(notesOpco(['formation_dirigeant', 'formation_salarie'], true), [
      { genre: 'sans-opco', titre: 'Aucun OPCO renseigné' },
      { genre: 'dirigeant', titre: 'OPCO non compté pour le dirigeant du groupe' },
    ]);
    assert.deepEqual(notesOpco(['alternance', 'recrutement_demandeur_emploi'], true), []);
    assert.deepEqual(notesOpco(['alternance', 'formation_dirigeant'], true), [
      { genre: 'dirigeant', titre: 'OPCO non compté pour le dirigeant du groupe' },
    ]);
  });
});

describe('détails du bandeau, mentions et tableau par profil', () => {
  test('detailsDuBandeau : rien pour une personne ou un coût inconnu ; sinon le coût par personne et le reste moyen', () => {
    assert.deepEqual(detailsDuBandeau({ coutFormation: 2800, resteACharge: 1750 }, 1), { cout: null, reste: null });
    assert.deepEqual(detailsDuBandeau({ coutFormation: 0, resteACharge: 0 }, 4), { cout: null, reste: null });
    assert.deepEqual(detailsDuBandeau({ coutFormation: 11200, resteACharge: 6825 }, 4), {
      cout: `4${nb}×${nb}${formatEuro(2800)}`,
      reste: `${formatEuro(1706.25)} par personne en moyenne`,
    });
    assert.equal(detailsDuBandeau({ coutFormation: 11200, resteACharge: 0 }, 4).reste, null);
  });

  test('pourPersonnes : « pour 3 personnes », « pour 1 personne », espace insécable', () => {
    assert.equal(pourPersonnes(3), `pour 3${nb}personnes`);
    assert.equal(pourPersonnes(1), `pour 1${nb}personne`);
  });

  test('mentionOpcoDuGroupe : pour qui le calcul est fait ; rien pour une personne ou sans salarié', () => {
    assert.equal(mentionOpcoDuGroupe(3, 1), null);
    assert.equal(mentionOpcoDuGroupe(0, 4), null);
    assert.equal(mentionOpcoDuGroupe(4, 4), `Calcul pour les 4${nb}personnes du groupe.`);
    assert.equal(mentionOpcoDuGroupe(3, 5), `Calcul pour les 3${nb}salariés du groupe (5${nb}personnes au total).`);
    assert.equal(mentionOpcoDuGroupe(1, 5), `Calcul pour le salarié du groupe (5${nb}personnes au total).`);
  });

  test('lignesParProfil : une ligne par profil, le total en centimes', () => {
    let e = etat({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35, nombrePersonnes: 3 });
    e = ajouterProfil(e);
    e = changerProjetDuProfil(e, 'profil-2', 'formation_dirigeant');
    e = majProfil(e, 'profil-2', { statutDirigeant: 'artisan', ageBeneficiaire: 52, isHandicap: true });
    const [p1, p2] = profilsDuGroupe(e);
    const { lignes, total } = lignesParProfil([
      { profil: p1, plan: plan({ coutFormation: 8400, totalFinance: 3150, resteACharge: 5250 }) },
      { profil: p2, plan: plan({ coutFormation: 2800, totalFinance: 1225, resteACharge: 1575 }) },
    ]);
    assert.deepEqual(lignes.map((l) => [l.rang, l.nombre, l.cout, l.finance, l.reste]), [
      [1, 3, 8400, 3150, 5250],
      [2, 1, 2800, 1225, 1575],
    ]);
    assert.equal(lignes[0].libelle, `Salarié en CDI, 35${nb}ans`);
    assert.equal(lignes[1].libelle, `Dirigeant artisan, 52${nb}ans, RQTH`);
    assert.deepEqual(total, { nombre: 4, cout: 11200, finance: 4375, reste: 6825 });
  });

  test('concerneParAide : une ligne par profil concerné, avec son effectif et son statut', () => {
    let e = etat({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35, nombrePersonnes: 3 });
    e = ajouterProfil(e);
    const libelles = libellesDesProfils(profilsDuGroupe(e));
    assert.equal(libelles.get('principal'), `Profil 1 · Salarié en CDI, 35${nb}ans`);
    assert.deepEqual(
      concerneParAide(
        {
          profils: [
            { profilId: 'principal', nombre: 3, statut: 'eligible', montantEstime: 1000 },
            { profilId: 'profil-2', nombre: 1, statut: 'a_verifier', montantEstime: null },
          ],
        },
        libelles,
      ),
      [`Profil 1 · Salarié en CDI, 35${nb}ans, 3${nb}personnes${nb}: éligible`, `Profil 2 · Salarié, 1${nb}personne${nb}: à vérifier`],
    );
    assert.deepEqual(concerneParAide({}, libelles), []);
  });
});
```

Le test « plafond annuel épuisé » suppose que l'OPCO du scénario (AKTO) publie un plafond annuel pour cette taille : si les données changent, choisir un OPCO qui en a un plutôt que d'assouplir l'assertion.

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && node --import tsx --test apps/web/tests/resultats-groupe.test.ts`
Expected: FAIL (`groupe`, `notesOpco`, `detailsDuBandeau`… ne sont pas exportés).

- [ ] **Step 3 : écrire le code**

Dans `apps/web/src/lib/resultats.ts` :

**11a.** Remplacer le bloc d'importations de `@opco/core` et de `./format` (de `import {\n  EMBEDDED_AIDES,` jusqu'à `import { SIGLES, citeLeSigle } from './sigles';`) par :

```ts
import {
  EMBEDDED_AIDES,
  EMBEDDED_PORTAILS,
  FINANCEUR_LABELS,
  calculateFunding,
  construirePlanDuBloc,
  dateDeReference,
  etatDuProfil,
  evaluerAides,
  fusionnerAides,
  fusionnerPlans,
  getEmbeddedOpcoBySlug,
  profilDepuisWizard,
  profilsDuGroupe,
  repartirFinancement,
  resolveVarianteBranche,
} from '@opco/core';
import type {
  AideEvaluee,
  Confidence,
  DispositifEligible,
  Financeur,
  FundingLine,
  FundingResult,
  LignePlan,
  OptionPlan,
  PlanFinancement,
  ProfilAides,
  ProfilDuGroupe,
  SourceAide,
  VarianteBranche,
  WizardState,
} from '@opco/core';
import { ouvreBudgetOpco } from './entreprise';
import { formatEuro, horsCitations, nombreEtUnite } from './format';
import { INSECABLE } from './insecable';
import { libelleDuProfil } from './profils';
import { SIGLES, citeLeSigle } from './sigles';
```

**11b.** Remplacer le commentaire et la fonction `calculer` (de `/**\n * Calcul de l'écran de résultats` jusqu'à l'accolade fermante de la fonction) par :

```ts
/** Ce que l'écran sait d'un profil du groupe. */
export interface BlocResultat {
  profil: ProfilDuGroupe;
  /** Profil évalué par le moteur d'aides : celui d'UNE personne de ce profil. */
  profilAides: ProfilAides;
  /** Aides du catalogue évaluées pour UNE personne de ce profil. */
  aides: AideEvaluee[];
  /** Part de ce profil dans le calcul de l'OPCO (valable pour ses personnes) ; null s'il ne relève pas de ce plan. */
  funding: FundingResult | null;
  /** Plan du profil, pour toutes ses personnes. */
  plan: PlanFinancement;
}

/** Le groupe vu par l'écran de résultats. */
export interface ResultatGroupe {
  personnes: number;
  /** Personnes qui relèvent du plan de développement des compétences de l'OPCO (les salariés, avec un OPCO connu). */
  personnesPdc: number;
  blocs: BlocResultat[];
}

/**
 * Calcul de l'écran de résultats, dérivation pure de l'état du parcours. `aujourdhui` (AAAA-MM-JJ) est la date du jour,
 * lue par l'écran (jamais dans @opco/core) : référence de validité des aides, sauf début de formation futur.
 * - OPCO retenu : le choix de l'utilisateur, sinon celui détecté (même règle que les étapes Entreprise et Formation).
 * - Jours de formation non saisis : 7 heures par jour.
 * - Le plan de développement des compétences de l'OPCO ne finance que les projets salariés (former un salarié,
 *   reconversion : `ouvreBudgetOpco`) ; le dirigeant, l'alternance et le recrutement d'un demandeur d'emploi passent par
 *   les aides, même avec un OPCO connu. Projet non choisi : « former un salarié ».
 * - `variante` : le barème de branche que le moteur applique (`resolveVarianteBranche`, la même règle que lui), ou null.
 * - Groupe : le moteur de l'OPCO est appelé UNE fois, pour les personnes des profils salariés (le plafond annuel est celui
 *   de l'entreprise) ; son résultat se répartit entre ces profils en centimes entiers ; chaque profil construit son plan
 *   (`construirePlanDuBloc`) ; `plan` et `aidesEvaluees` sont les fusions de ceux des profils. `funding` est le calcul de
 *   l'OPCO du groupe entier. Pour une personne seule, tout est ce que l'écran calculait avant les groupes.
 */
export function calculer(state: WizardState, aujourdhui: string) {
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const effectiveState =
    !state.trainingDays && state.durationHours ? { ...state, trainingDays: Math.ceil(state.durationHours / 7) } : state;
  const projet = effectiveState.projetType ?? 'formation_salarie';
  const profils = profilsDuGroupe(effectiveState);
  const profilsPdc = profils.filter((p) => opco != null && ouvreBudgetOpco(p.champs.projetType));
  const personnesPdc = profilsPdc.reduce((somme, p) => somme + p.nombre, 0);
  const funding = opco && personnesPdc > 0 ? calculateFunding(opco, effectiveState, personnesPdc) : null;
  // Un seul profil relève du plan : sa part est le résultat entier (aucune répartition).
  const parts = funding
    ? profilsPdc.length === 1
      ? [funding]
      : repartirFinancement(
          funding,
          profilsPdc.map((p) => p.nombre),
        )
    : [];
  const variante = opco ? resolveVarianteBranche(opco, effectiveState) : null;
  const dateRef = dateDeReference(effectiveState.dateDebutFormation, aujourdhui);
  const blocs: BlocResultat[] = profils.map((profil) => {
    const profilAides = profilDepuisWizard(etatDuProfil(effectiveState, profil), slug);
    const aides = evaluerAides(EMBEDDED_AIDES, profilAides, dateRef);
    const rang = profilsPdc.indexOf(profil);
    const part = rang >= 0 ? parts[rang] : null;
    return { profil, profilAides, aides, funding: part, plan: construirePlanDuBloc(part, aides, profilAides, profil.nombre) };
  });
  const aidesEvaluees = fusionnerAides(blocs.map((b) => ({ profil: b.profil, aides: b.aides })));
  const plan = fusionnerPlans(
    blocs.map((b) => b.plan),
    aidesEvaluees,
  );
  const profil = blocs[0].profilAides;
  const portail = EMBEDDED_PORTAILS.find((p) => p.region === profil.regionEntreprise) ?? null;
  const groupe: ResultatGroupe = {
    personnes: profils.reduce((somme, p) => somme + p.nombre, 0),
    personnesPdc,
    blocs,
  };
  return { opco, projet, funding, variante, profil, aidesEvaluees, plan, portail, groupe };
}
```

**11c.** À la fin du fichier, ajouter :

```ts

// --- Groupe de plusieurs personnes --------------------------------------------------------------------------------

export interface NoteOpco {
  genre: 'dirigeant' | 'sans-opco';
  titre: string;
}

/**
 * Notes posées sous le bandeau quand le plan ne compte pas le plan de développement des compétences de l'OPCO, pour les
 * projets du groupe (`projets` : celui de chaque profil). Un seul projet distinct : la note d'une personne seule
 * (`titreNoteOpco`). Plusieurs : chaque note qui s'applique, une fois (« Aucun OPCO renseigné » quand un projet salarié est
 * sans OPCO, « OPCO non compté pour le dirigeant du groupe » quand il y a un dirigeant).
 */
export function notesOpco(projets: readonly WizardState['projetType'][], sansOpco: boolean): NoteOpco[] {
  const distincts = [...new Set(projets)];
  if (distincts.length <= 1) {
    const projet = distincts[0] ?? null;
    const titre = titreNoteOpco(projet, sansOpco);
    return titre == null ? [] : [{ genre: projet === 'formation_dirigeant' ? 'dirigeant' : 'sans-opco', titre }];
  }
  const notes: NoteOpco[] = [];
  if (sansOpco && distincts.some((p) => ouvreBudgetOpco(p))) notes.push({ genre: 'sans-opco', titre: 'Aucun OPCO renseigné' });
  if (distincts.includes('formation_dirigeant')) {
    notes.push({ genre: 'dirigeant', titre: 'OPCO non compté pour le dirigeant du groupe' });
  }
  return notes;
}

/**
 * Détails sous les chiffres du bandeau pour un groupe : « 4 × 2 800 € » sous le coût, « 1 706,25 € par personne en moyenne »
 * sous le reste à charge. Rien pour une personne seule ni pour un coût inconnu ; pas de moyenne sans reste à charge.
 */
export function detailsDuBandeau(
  plan: Pick<PlanFinancement, 'coutFormation' | 'resteACharge'>,
  personnes: number,
): { cout: string | null; reste: string | null } {
  if (personnes < 2 || !(plan.coutFormation > 0)) return { cout: null, reste: null };
  const parPersonne = Math.round((plan.coutFormation / personnes) * 100) / 100;
  const resteMoyen = Math.round((plan.resteACharge / personnes) * 100) / 100;
  return {
    cout: `${personnes}${INSECABLE}×${INSECABLE}${formatEuro(parPersonne)}`,
    reste: plan.resteACharge > 0 ? `${formatEuro(resteMoyen)} par personne en moyenne` : null,
  };
}

/** « pour 3 personnes » (espace insécable entre le nombre et l'unité) : sous le nom du financeur d'une ligne du plan d'un groupe. */
export function pourPersonnes(n: number): string {
  return `pour ${nombreEtUnite(n, n > 1 ? 'personnes' : 'personne')}`;
}

/**
 * Mention du détail de l'estimation de l'OPCO pour un groupe : pour qui le calcul est fait. Null pour une personne seule ou
 * quand aucune personne ne relève de ce plan.
 */
export function mentionOpcoDuGroupe(personnesPdc: number, personnes: number): string | null {
  if (personnes < 2 || personnesPdc < 1) return null;
  if (personnesPdc === personnes) return `Calcul pour les ${nombreEtUnite(personnes, 'personnes')} du groupe.`;
  const qui = personnesPdc === 1 ? 'le salarié' : `les ${nombreEtUnite(personnesPdc, 'salariés')}`;
  return `Calcul pour ${qui} du groupe (${nombreEtUnite(personnes, 'personnes')} au total).`;
}

/** Une ligne du tableau « Détail par profil » : le rang du profil, son libellé, son effectif et ses trois montants. */
export interface LigneParProfil {
  id: string;
  rang: number;
  libelle: string;
  nombre: number;
  cout: number;
  finance: number;
  reste: number;
}

/** Lignes du tableau « Détail par profil » (chiffres du plan de chaque profil, jamais recalculés) et leur total en centimes. */
export function lignesParProfil(blocs: readonly Pick<BlocResultat, 'profil' | 'plan'>[]): {
  lignes: LigneParProfil[];
  total: Pick<LigneParProfil, 'nombre' | 'cout' | 'finance' | 'reste'>;
} {
  const lignes = blocs.map((b, i) => ({
    id: b.profil.id,
    rang: i + 1,
    libelle: libelleDuProfil(b.profil.champs),
    nombre: b.profil.nombre,
    cout: b.plan.coutFormation,
    finance: b.plan.totalFinance,
    reste: b.plan.resteACharge,
  }));
  const somme = (champ: 'cout' | 'finance' | 'reste') => lignes.reduce((s, l) => s + Math.round(l[champ] * 100), 0) / 100;
  return {
    lignes,
    total: { nombre: lignes.reduce((s, l) => s + l.nombre, 0), cout: somme('cout'), finance: somme('finance'), reste: somme('reste') },
  };
}

/** « Profil 1 · Salarié en CDI, 35 ans » pour chaque profil, par identifiant. */
export function libellesDesProfils(profils: readonly ProfilDuGroupe[]): Map<string, string> {
  return new Map(profils.map((p, i) => [p.id, `Profil ${i + 1} · ${libelleDuProfil(p.champs)}`]));
}

/**
 * Lignes du bloc « Concerne » d'une carte d'aide d'un groupe, une par profil éligible ou à vérifier :
 * « Profil 1 · Salarié en CDI, 35 ans, 3 personnes : éligible ». Vide pour une aide sans `profils`.
 */
export function concerneParAide(aide: Pick<AideEvaluee, 'profils'>, libelles: ReadonlyMap<string, string>): string[] {
  return (aide.profils ?? []).map(
    (p) =>
      `${libelles.get(p.profilId) ?? p.profilId}, ${nombreEtUnite(p.nombre, p.nombre > 1 ? 'personnes' : 'personne')}${INSECABLE}: ${
        p.statut === 'eligible' ? 'éligible' : 'à vérifier'
      }`,
  );
}
```

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run test:web`
Expected: tout vert, `resultats-groupe.test.ts` compris. Si le test des cinq scénarios échoue sur l'égalité avec l'ancien calcul, **s'arrêter** : c'est la preuve qu'une personne seule a changé ; comparer champ par champ (`funding`, `plan`, `aidesEvaluees`) avant toute autre chose. Si un seuil des tests tirés au hasard n'est pas atteint (`avecPlusieursProfils >= 300`, `avecPlusieursSalaries >= 60`, `controles >= 100`), relever d'abord le tirage réel avant de baisser le seuil.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/web && npx tsc --noEmit && cd .. && cd .. && npm run lint --workspace web`
Expected: aucune erreur de type ; le lint ne signale rien de nouveau.

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add apps/web/src/lib/resultats.ts apps/web/tests/resultats-groupe.test.ts
git commit -m "$(cat <<'EOF'
site : calcul de l'écran de résultats pour un groupe (plan fusionné, parts de l'OPCO, notes, détail par profil)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12 : Crochet du parcours, actions du groupe et réponses « Je ne sais pas » par profil

**Files:**
- Modify: `apps/web/src/lib/parcours.ts` (type `QuestionDeProfil`)
- Modify: `apps/web/src/lib/groupe.ts` (`InconnuesParProfil`, `inconnuesApresMaj`, `inconnuesSansProfil`)
- Modify: `apps/web/src/hooks/useWizard.ts`
- Modify: `apps/web/tests/groupe.test.ts`

**Interfaces:**
- Consumes: toutes les fonctions de la tâche 9 ; `reponsesInconnuesApres` (`lib/parcours.ts`).
- Produces: `type QuestionDeProfil = Extract<QuestionAvecInconnu, keyof ChampsProfil>` ; `type InconnuesParProfil = Readonly<Record<string, ReadonlySet<QuestionAvecInconnu>>>` ; `inconnuesApresMaj(avant, id, maj, inconnue?)` ; `inconnuesSansProfil(avant, id)` ; `interface ActionsDuGroupe` ; `useWizard()` rend en plus `inconnuesProfils` et `groupe: ActionsDuGroupe`, et `updateFormationCosts(saisie, heures, pourLeGroupe?)`.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `apps/web/tests/groupe.test.ts`, ajouter aux importations `inconnuesApresMaj` et `inconnuesSansProfil` (de `../src/lib/groupe`), `champsDepuisProjet` (de `../src/lib/parcours`, avec `etatDepuisProjet`) et `champsDuProfilPrincipal` (de `@opco/core`, avec `createInitialWizardState`), et ajouter à la fin du fichier :

```ts
describe('réponses « Je ne sais pas » par profil', () => {
  const vides = champsDuProfilPrincipal(createInitialWizardState());

  test('une réponse « Je ne sais pas » s’ajoute au profil concerné, sans toucher aux autres', () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    assert.deepEqual([...a['profil-2']], ['inscritFranceTravail']);
    const b = inconnuesApresMaj(a, 'profil-3', { microEntrepreneur: null }, 'microEntrepreneur');
    assert.deepEqual([...b['profil-3']], ['microEntrepreneur']);
    assert.deepEqual([...b['profil-2']], ['inscritFranceTravail']);
  });

  test('répondre ensuite oui ou non efface la réponse « Je ne sais pas »', () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    assert.equal(inconnuesApresMaj(a, 'profil-2', { inscritFranceTravail: true })['profil-2'].has('inscritFranceTravail'), false);
  });

  test('un changement de statut efface les réponses des questions remises à vide', () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    const vers = inconnuesApresMaj(a, 'profil-2', champsDepuisProjet(vides, 'formation_dirigeant'));
    assert.equal(vers['profil-2'].has('inscritFranceTravail'), false);
  });

  test('retirer un profil efface ses réponses ; son identifiant peut resservir sans rien garder', () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    const b = inconnuesApresMaj(a, 'profil-3', { microEntrepreneur: null }, 'microEntrepreneur');
    const sans = inconnuesSansProfil(b, 'profil-2');
    assert.equal('profil-2' in sans, false);
    assert.equal('profil-3' in sans, true);
    assert.equal(inconnuesSansProfil(sans, 'profil-42'), sans);
    // Un profil neuf qui reprend l'identifiant libéré n'a aucune réponse « Je ne sais pas ».
    assert.equal(sans['profil-2'], undefined);
  });

  test('une mise à jour qui ne touche aucune question rend le même objet', () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    assert.equal(inconnuesApresMaj(a, 'profil-4', { ageBeneficiaire: 30 }), a);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && node --import tsx --test apps/web/tests/groupe.test.ts`
Expected: FAIL (`inconnuesApresMaj` et `inconnuesSansProfil` ne sont pas exportés).

- [ ] **Step 3 : écrire le code**

Dans `apps/web/src/lib/parcours.ts`, après la ligne `export type QuestionAvecInconnu = (typeof QUESTIONS_AVEC_INCONNU)[number];`, ajouter :

```ts
/** Questions à réponse « Je ne sais pas » qui portent sur une personne et non sur la formation : celles de chaque profil. */
export type QuestionDeProfil = Extract<QuestionAvecInconnu, keyof ChampsProfil>;
```

Dans `apps/web/src/lib/groupe.ts`, ajouter à l'importation `import { champsDepuisProjet, coutsDeFormation } from './parcours';` le nom `reponsesInconnuesApres` et le type `QuestionAvecInconnu`, `QuestionDeProfil` :

```ts
import { champsDepuisProjet, coutsDeFormation, reponsesInconnuesApres } from './parcours';
import type { QuestionAvecInconnu, QuestionDeProfil } from './parcours';
```

et ajouter à la fin du fichier :

```ts

// --- Réponses « Je ne sais pas » de chaque profil -----------------------------------------------------------------

/**
 * Réponses « Je ne sais pas » de chaque profil supplémentaire, par identifiant. Celles du profil principal restent avec
 * celles de la formation, dans `useWizard` : la valeur reste null pour le moteur, le site retient seulement que
 * l'utilisateur a répondu.
 */
export type InconnuesParProfil = Readonly<Record<string, ReadonlySet<QuestionAvecInconnu>>>;

const AUCUNE_REPONSE: ReadonlySet<QuestionAvecInconnu> = new Set();

/**
 * Réponses « Je ne sais pas » d'un profil après une mise à jour `maj` de ses réponses : toute écriture d'une de ces
 * questions efface la sienne, `inconnue` ajoute la question à laquelle l'utilisateur vient de répondre « Je ne sais pas ».
 * Rend l'objet reçu, inchangé, quand rien ne change.
 */
export function inconnuesApresMaj(
  avant: InconnuesParProfil,
  id: string,
  maj: Partial<ChampsProfil>,
  inconnue?: QuestionDeProfil,
): InconnuesParProfil {
  const courant = avant[id] ?? AUCUNE_REPONSE;
  const suite = reponsesInconnuesApres(courant, maj, inconnue);
  return suite === courant ? avant : { ...avant, [id]: suite };
}

/** Le profil retiré perd ses réponses « Je ne sais pas » : son identifiant peut resservir sans rien garder. */
export function inconnuesSansProfil(avant: InconnuesParProfil, id: string): InconnuesParProfil {
  if (!(id in avant)) return avant;
  const suite = { ...avant };
  delete suite[id];
  return suite;
}
```

Remplacer **tout le contenu** de `apps/web/src/hooks/useWizard.ts` par :

```ts
'use client';

import { useState, useCallback, useMemo } from 'react';
import { ID_PROFIL_PRINCIPAL, champsDuProfilPrincipal, createInitialWizardState } from '@opco/core';
import type { ChampsProfil, ProjetType, WizardState } from '@opco/core';
import { ETAPES, champsManquants, indexPrecedent, indexSuivant } from '@/lib/etapes';
import type { EtapeSite } from '@/lib/etapes';
import {
  ajouterProfil,
  basculerModePrix,
  changerProjetDuProfil,
  definirNombre,
  etatDepuisPrix,
  inconnuesApresMaj,
  inconnuesSansProfil,
  majProfil,
  normaliserGroupe,
  retirerProfil,
} from '@/lib/groupe';
import type { InconnuesParProfil } from '@/lib/groupe';
import { champsDepuisProjet, reponsesInconnuesApres } from '@/lib/parcours';
import type { QuestionAvecInconnu, QuestionDeProfil } from '@/lib/parcours';

/** Aucune réponse « Je ne sais pas » (état de départ et nouvelle simulation). */
const AUCUNE_REPONSE_INCONNUE: ReadonlySet<QuestionAvecInconnu> = new Set();
const AUCUNE_INCONNUE_DE_PROFIL: InconnuesParProfil = {};
/** Réponses d'un profil vide : un changement de statut en tire les réponses « Je ne sais pas » à remettre à vide. */
const REPONSES_VIDES = champsDuProfilPrincipal(createInitialWizardState());

/** Actions du groupe : étape Participants (profils, effectifs) et prix de la formation (par personne ou pour le groupe). */
export interface ActionsDuGroupe {
  ajouterProfil: () => void;
  /** Retire un profil supplémentaire. */
  retirerProfil: (id: string) => void;
  /** Met à jour les réponses d'un profil (l'identifiant `principal` désigne le profil principal). */
  majProfil: (id: string, maj: Partial<ChampsProfil>) => void;
  /** Change le statut d'un profil : seules les réponses du nouveau statut et les questions communes restent. */
  changerProjetProfil: (id: string, projet: ProjetType) => void;
  definirNombre: (id: string, nombre: number) => void;
  /** Réponse à une question qui admet « Je ne sais pas » : `null` est cette réponse, retenue par le profil. */
  repondreProfil: <K extends QuestionDeProfil>(id: string, question: K, valeur: ChampsProfil[K]) => void;
  /** Passe de « par personne » à « pour le groupe » (et inversement) en gardant le coût réel. */
  basculerModePrix: (versGroupe: boolean) => void;
}

export function useWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(createInitialWizardState);
  const [showResults, setShowResults] = useState(false);
  // État propre au site : les questions auxquelles l'utilisateur a répondu « Je ne sais pas » (la valeur reste null pour
  // le moteur). Toute écriture d'une de ces questions par `updateState` efface sa réponse (`reponsesInconnuesApres`).
  const [reponsesInconnues, setReponsesInconnues] = useState(AUCUNE_REPONSE_INCONNUE);
  // Les mêmes réponses pour chaque profil supplémentaire, par identifiant (`inconnuesApresMaj`).
  const [inconnuesProfils, setInconnuesProfils] = useState(AUCUNE_INCONNUE_DE_PROFIL);

  const currentStep = ETAPES[currentStepIndex];

  // Chaque mise à jour passe par `normaliserGroupe` : effectifs bornés, prix du groupe et coût d'une personne cohérents.
  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => normaliserGroupe({ ...prev, ...updates }));
    setReponsesInconnues((prev) => reponsesInconnuesApres(prev, updates));
  }, []);

  /** Réponse à une question qui admet « Je ne sais pas » : `null` est cette réponse, retenue par le site. */
  const repondre = useCallback(<K extends QuestionAvecInconnu>(question: K, valeur: WizardState[K]) => {
    const maj = { [question]: valeur } as Partial<WizardState>;
    setState((prev) => normaliserGroupe({ ...prev, ...maj }));
    setReponsesInconnues((prev) => reponsesInconnuesApres(prev, maj, valeur == null ? question : undefined));
  }, []);

  const groupe = useMemo<ActionsDuGroupe>(
    () => ({
      ajouterProfil: () => setState((prev) => ajouterProfil(prev)),
      retirerProfil: (id) => {
        setState((prev) => retirerProfil(prev, id));
        setInconnuesProfils((prev) => inconnuesSansProfil(prev, id));
      },
      majProfil: (id, maj) => {
        if (id === ID_PROFIL_PRINCIPAL) {
          updateState(maj);
          return;
        }
        setState((prev) => majProfil(prev, id, maj));
        setInconnuesProfils((prev) => inconnuesApresMaj(prev, id, maj));
      },
      changerProjetProfil: (id, projet) => {
        setState((prev) => changerProjetDuProfil(prev, id, projet));
        setInconnuesProfils((prev) => inconnuesApresMaj(prev, id, champsDepuisProjet(REPONSES_VIDES, projet)));
      },
      definirNombre: (id, nombre) => setState((prev) => definirNombre(prev, id, nombre)),
      repondreProfil: (id, question, valeur) => {
        if (id === ID_PROFIL_PRINCIPAL) {
          repondre(question, valeur);
          return;
        }
        const maj = { [question]: valeur } as Partial<ChampsProfil>;
        setState((prev) => majProfil(prev, id, maj));
        setInconnuesProfils((prev) => inconnuesApresMaj(prev, id, maj, valeur == null ? question : undefined));
      },
      basculerModePrix: (versGroupe) => setState((prev) => basculerModePrix(prev, versGroupe)),
    }),
    [updateState, repondre],
  );

  /** Ce qui manque pour quitter l'étape affichée (vide : « Suivant » est actif). Voir `champsManquants`. */
  const manquants = useMemo(() => champsManquants(currentStep.key, state), [currentStep.key, state]);

  // L'étape « Frais » est sautée, dans les deux sens, pour une formation entièrement à distance.
  const goNext = useCallback(() => {
    if (manquants.length > 0) return;
    setCurrentStepIndex((index) => indexSuivant(index, state));
  }, [manquants, state]);

  const goPrev = useCallback(() => {
    setCurrentStepIndex((index) => indexPrecedent(index, state));
  }, [state]);

  const goToStep = useCallback((step: EtapeSite) => {
    const index = ETAPES.findIndex((s) => s.key === step);
    if (index >= 0) {
      setCurrentStepIndex(index);
      setShowResults(false);
    }
  }, []);

  const calculate = useCallback(() => {
    setShowResults(true);
  }, []);

  const reset = useCallback(() => {
    setState(createInitialWizardState());
    setReponsesInconnues(AUCUNE_REPONSE_INCONNUE);
    setInconnuesProfils(AUCUNE_INCONNUE_DE_PROFIL);
    setCurrentStepIndex(0);
    setShowResults(false);
  }, []);

  // Coût horaire recalculé quand le prix ou la durée change, sans arrondi (`etatDepuisPrix`). `saisie` est le prix saisi :
  // celui d'une personne, ou celui de tout le groupe quand `pourLeGroupe` (à partir de deux personnes).
  const updateFormationCosts = useCallback((saisie: number | null, hours: number | null, pourLeGroupe = false) => {
    setState((prev) => etatDepuisPrix(prev, saisie, hours, pourLeGroupe));
  }, []);

  return {
    currentStep,
    currentStepIndex,
    state,
    showResults,
    manquants,
    reponsesInconnues,
    inconnuesProfils,
    updateState,
    repondre,
    groupe,
    goNext,
    goPrev,
    goToStep,
    calculate,
    reset,
    updateFormationCosts,
  };
}
```

- [ ] **Step 4 : vérifier que tout passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run test:web`
Expected: tout vert.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/web && npx tsc --noEmit`
Expected: aucune erreur (les composants gardent leurs propriétés actuelles ; `updateFormationCosts` accepte un troisième paramètre facultatif).

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run lint --workspace web`
Expected: aucune erreur ni avertissement.

- [ ] **Step 5 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add apps/web/src/lib/parcours.ts apps/web/src/lib/groupe.ts apps/web/src/hooks/useWizard.ts apps/web/tests/groupe.test.ts
git commit -m "$(cat <<'EOF'
site : actions du groupe dans le crochet du parcours, réponses « Je ne sais pas » par profil

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13 : Étape « Participants » (compteur, cartes de profils, formulaire d'un profil)

**Files:**
- Create: `apps/web/src/components/wizard/CompteurPersonnes.tsx`
- Create: `apps/web/src/components/wizard/FormulaireProfil.tsx`
- Create: `apps/web/src/components/wizard/CarteProfil.tsx`
- Modify (réécriture): `apps/web/src/components/wizard/StepSituation.tsx`
- Modify: `apps/web/src/components/wizard/WizardContainer.tsx`

**Interfaces:**
- Consumes: `ActionsDuGroupe`, `useWizard` (tâche 12) ; `lireEffectif`, `prochainIdProfil`, `InconnuesParProfil` (`lib/groupe.ts`) ; `manquantsDuProfil`, `enumeration` (`lib/etapes.ts`) ; `libelleDuProfil`, `STATUT_DU_PROFIL` (`lib/profils.ts`) ; `QuestionDeProfil` (`lib/parcours.ts`) ; les champs de `components/ui/forms.tsx`.
- Produces: `CompteurPersonnes({ label, valeur, max?, onChange, aide? })` ; `FormulaireProfil({ champs, nombre, regionEntreprise, maj, inconnues, repondre, changerProjet? })` ; `CarteProfil({ profil, rang, resume, manquants, ouvert, onBasculer, onNombre, max, onRetirer?, children })` et `idTitreProfil(id)` ; `StepSituation({ state, reponsesInconnues, inconnuesProfils, groupe })`.

Il n'y a pas de test de composant dans ce dépôt (les suites testent des fonctions pures) : la garantie vient du typage, du lint, des gardes de charte et de la vérification dans le navigateur de l'étape 4.

- [ ] **Step 1 : le compteur de personnes**

Créer `apps/web/src/components/wizard/CompteurPersonnes.tsx` :

```tsx
'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { MAX_PERSONNES } from '@opco/core';
import { CHAMP } from '@/components/ui/Champ';
import { cx } from '@/lib/cx';
import { nombreEtUnite } from '@/lib/format';
import { lireEffectif } from '@/lib/groupe';

/** Bouton rond de 44 px (40 px au-delà de 1 024 px) ; grisé par `aria-disabled` sans quitter l'ordre du clavier. */
const BOUTON =
  'grid size-11 shrink-0 place-items-center rounded-full border-2 border-filet-fort bg-white text-texte transition-colors hover:border-texte-doux aria-disabled:cursor-not-allowed aria-disabled:border-filet aria-disabled:text-texte-discret aria-disabled:hover:border-filet lg:size-10';

/** Moins (un trait) ou plus (un trait et sa croix), dessinés en CSS : le jeu d'icônes du site n'en compte pas de plus. */
function Signe({ plus = false }: { plus?: boolean }) {
  return (
    <span aria-hidden="true" className="relative block size-3.5">
      <span className="absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 rounded-full bg-current" />
      {plus && <span className="absolute top-0 left-1/2 h-full w-0.5 -translate-x-1/2 rounded-full bg-current" />}
    </span>
  );
}

/**
 * Nombre de personnes d'un profil : un champ entier entouré de « Retirer une personne » et « Ajouter une personne ».
 * Une saisie qui n'est pas un entier de 1 à `max` est refusée sans bruit (`lireEffectif`) : le champ garde ce qui est tapé
 * jusqu'à ce qu'on le quitte, puis reprend la valeur retenue. Les boutons ne disparaissent pas aux bornes : ils portent
 * `aria-disabled`, pour que le focus ne se perde pas. Un message poli annonce le nombre retenu.
 */
export function CompteurPersonnes({
  label,
  valeur,
  max = MAX_PERSONNES,
  onChange,
  aide,
}: {
  label: ReactNode;
  valeur: number;
  max?: number;
  onChange: (nombre: number) => void;
  aide?: ReactNode;
}) {
  const id = useId();
  const [texte, setTexte] = useState(String(valeur));
  const [valeurVue, setValeurVue] = useState(valeur);
  if (valeur !== valeurVue) {
    // Valeur changée hors du champ (boutons, plafond de 99 personnes) : le texte la suit.
    setValeurVue(valeur);
    setTexte(String(valeur));
  }
  const retirer = () => {
    if (valeur > 1) onChange(valeur - 1);
  };
  const ajouter = () => {
    if (valeur < max) onChange(valeur + 1);
  };
  return (
    <div role="group" aria-labelledby={`${id}-titre`} aria-describedby={aide ? `${id}-aide` : undefined}>
      <p id={`${id}-titre`} className="text-sm leading-snug font-semibold text-texte">
        {label}
      </p>
      {aide && (
        <p id={`${id}-aide`} className="mt-1 text-sm leading-relaxed text-texte-discret">
          {aide}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={retirer} aria-disabled={valeur <= 1 || undefined} className={BOUTON}>
          <Signe />
          <span className="sr-only">Retirer une personne</span>
        </button>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-labelledby={`${id}-titre`}
          value={texte}
          onChange={(e) => {
            const saisie = e.target.value;
            const n = lireEffectif(saisie);
            setTexte(n == null ? saisie : String(Math.min(n, max)));
            if (n != null) onChange(Math.min(n, max));
          }}
          onBlur={() => setTexte(String(valeur))}
          className={cx(CHAMP, 'max-w-[5rem] text-center')}
        />
        <button type="button" onClick={ajouter} aria-disabled={valeur >= max || undefined} className={BOUTON}>
          <Signe plus />
          <span className="sr-only">Ajouter une personne</span>
        </button>
      </div>
      <p role="status" className="sr-only">
        {nombreEtUnite(valeur, valeur > 1 ? 'personnes' : 'personne')}
      </p>
    </div>
  );
}
```

- [ ] **Step 2 : le formulaire d'un profil**

Créer `apps/web/src/components/wizard/FormulaireProfil.tsx` (les questions de l'ancienne étape, factorisées pour un profil quelconque) :

```tsx
'use client';

import {
  CONTRACT_TYPE_LABELS,
  NIVEAU_DIPLOME_LABELS,
  REGIONS,
  STATUT_DIRIGEANT_LABELS,
  STATUT_PAR_PROJET,
  TYPE_ALTERNANCE_LABELS,
} from '@opco/core';
import type {
  ChampsProfil,
  CodeRegion,
  ContractType,
  NiveauDiplome,
  ProjetType,
  StatutBeneficiaire,
  StatutDirigeant,
  TypeAlternance,
} from '@opco/core';
import { ChampRegion, CheckboxRow, ChoiceButton, ChoiceGroup, NumberField, OuiNonChoix } from '@/components/ui/forms';
import { INSECABLE } from '@/lib/insecable';
import type { QuestionAvecInconnu, QuestionDeProfil } from '@/lib/parcours';
import { STATUT_DU_PROFIL } from '@/lib/profils';

interface Props {
  champs: ChampsProfil;
  /** Nombre de personnes de ce profil : au-delà d'une, les réponses valent pour chacune. */
  nombre: number;
  /** Région de l'entreprise : région de résidence par défaut. */
  regionEntreprise: CodeRegion | null;
  maj: (updates: Partial<ChampsProfil>) => void;
  /** Questions auxquelles l'utilisateur a répondu « Je ne sais pas » (la valeur reste null). */
  inconnues: ReadonlySet<QuestionAvecInconnu>;
  repondre: <K extends QuestionDeProfil>(question: K, valeur: ChampsProfil[K]) => void;
  /** Profil supplémentaire : le statut se choisit ici (le profil principal a choisi son projet à l'étape 1). */
  changerProjet?: (projet: ProjetType) => void;
}

/** Libellé de l'âge selon la personne concernée par le projet. */
const LIBELLE_AGE: Record<StatutBeneficiaire, string> = {
  salarie: 'Âge du salarié',
  demandeur_emploi: 'Âge de la personne',
  alternant: "Âge de l'alternant",
  dirigeant: 'Âge du dirigeant',
};

/** Contrats proposés au salarié : l'alternance est un projet à part entière. */
const CONTRATS_SALARIE = (Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).filter(
  ([contrat]) => contrat !== 'alternance',
);

/**
 * Région de résidence (demandeur d'emploi, alternant) : les aides régionales dépendent de la région où vit la
 * personne, pas de celle de l'entreprise. Par défaut, celle de l'entreprise (le moteur fait de même).
 */
function RegionDeResidence({
  label,
  champs,
  regionEntreprise,
  maj,
}: {
  label: string;
  champs: ChampsProfil;
  regionEntreprise: CodeRegion | null;
  maj: (updates: Partial<ChampsProfil>) => void;
}) {
  return (
    <ChampRegion
      label={label}
      valeur={champs.regionBeneficiaireCode ?? regionEntreprise}
      onChange={(code: CodeRegion) => maj({ regionBeneficiaireCode: code })}
      aide={regionEntreprise ? `Par défaut, celle de l'entreprise (${REGIONS[regionEntreprise]}).` : undefined}
    />
  );
}

/**
 * Les questions d'un profil : statut (profil supplémentaire seulement), questions propres au statut, puis âge, diplôme,
 * RQTH et solde CPF. Les mêmes pour le profil principal et pour les profils supplémentaires.
 */
export function FormulaireProfil({ champs, nombre, regionEntreprise, maj, inconnues, repondre, changerProjet }: Props) {
  const projet = champs.projetType ?? 'formation_salarie';
  const statut = STATUT_PAR_PROJET[projet];
  const avecSoldeCpf = statut === 'salarie' || statut === 'dirigeant';

  return (
    <div className="space-y-8">
      {nombre > 1 && (
        <p className="text-sm leading-relaxed text-texte-doux">
          {`Ces réponses valent pour chacune des ${nombre}${INSECABLE}personnes de ce profil. Si elles diffèrent (âge, contrat, handicap, solde CPF), ajoutez un profil.`}
        </p>
      )}

      {changerProjet && (
        <ChoiceGroup label="Statut de ces personnes" required>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(STATUT_DU_PROFIL) as ProjetType[]).map((p) => (
              <ChoiceButton key={p} label={STATUT_DU_PROFIL[p]} selected={projet === p} onClick={() => changerProjet(p)} compact />
            ))}
          </div>
        </ChoiceGroup>
      )}

      <div className="space-y-7">
        {statut === 'salarie' && (
          <>
            <ChoiceGroup label="Type de contrat" required>
              <div className="grid gap-2 sm:grid-cols-3">
                {CONTRATS_SALARIE.map(([contrat, libelle]) => (
                  <ChoiceButton
                    key={contrat}
                    label={libelle}
                    selected={champs.contractType === contrat}
                    onClick={() => maj({ contractType: contrat })}
                    compact
                  />
                ))}
              </div>
            </ChoiceGroup>
            <NumberField
              label="Ancienneté dans l'entreprise (en mois)"
              required={projet === 'reconversion_salarie'}
              facultatif={projet !== 'reconversion_salarie'}
              value={champs.anciennete_mois}
              onChange={(anciennete_mois) => maj({ anciennete_mois })}
              placeholder="Ex&nbsp;: 24"
            />
          </>
        )}

        {statut === 'demandeur_emploi' && (
          <>
            <OuiNonChoix
              label="Inscrit(e) à France Travail"
              value={champs.inscritFranceTravail}
              onChange={(inscritFranceTravail) => repondre('inscritFranceTravail', inscritFranceTravail)}
              required
            />
            <RegionDeResidence label="Région de résidence" champs={champs} regionEntreprise={regionEntreprise} maj={maj} />
          </>
        )}

        {statut === 'alternant' && (
          <>
            <ChoiceGroup label="Type de contrat" required>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(TYPE_ALTERNANCE_LABELS) as [TypeAlternance, string][]).map(([type, libelle]) => (
                  <ChoiceButton
                    key={type}
                    label={libelle}
                    selected={champs.typeAlternance === type}
                    onClick={() => maj({ typeAlternance: type, contractType: 'alternance' })}
                  />
                ))}
              </div>
            </ChoiceGroup>
            <OuiNonChoix
              label="Actuellement inscrit(e) à France Travail"
              value={champs.inscritFranceTravail}
              inconnu={inconnues.has('inscritFranceTravail')}
              onChange={(inscritFranceTravail) => repondre('inscritFranceTravail', inscritFranceTravail)}
              avecInconnu
            />
            <RegionDeResidence
              label="Région de résidence de l'alternant"
              champs={champs}
              regionEntreprise={regionEntreprise}
              maj={maj}
            />
          </>
        )}

        {statut === 'dirigeant' && (
          <>
            <ChoiceGroup label="Statut du dirigeant" required>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(STATUT_DIRIGEANT_LABELS) as [StatutDirigeant, string][]).map(([s, libelle]) => (
                  <ChoiceButton
                    key={s}
                    label={libelle}
                    selected={champs.statutDirigeant === s}
                    onClick={() => maj({ statutDirigeant: s })}
                  />
                ))}
              </div>
            </ChoiceGroup>
            <OuiNonChoix
              label="Micro-entrepreneur"
              value={champs.microEntrepreneur}
              inconnu={inconnues.has('microEntrepreneur')}
              onChange={(microEntrepreneur) => repondre('microEntrepreneur', microEntrepreneur)}
              avecInconnu
            />
          </>
        )}
      </div>

      <div className="space-y-7 border-t border-filet pt-8">
        <NumberField
          label={LIBELLE_AGE[statut]}
          required={statut === 'alternant'}
          facultatif={statut !== 'alternant'}
          value={champs.ageBeneficiaire}
          onChange={(ageBeneficiaire) => maj({ ageBeneficiaire })}
          min={14}
          max={99}
          placeholder="Ex&nbsp;: 19"
        />

        <ChoiceGroup label="Diplôme le plus élevé" facultatif>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.entries(NIVEAU_DIPLOME_LABELS) as [NiveauDiplome, string][]).map(([niveau, libelle]) => (
              <ChoiceButton
                key={niveau}
                label={libelle}
                selected={champs.niveauDiplome === niveau}
                // Choix facultatif : un second clic le retire.
                onClick={() => maj({ niveauDiplome: champs.niveauDiplome === niveau ? null : niveau })}
                compact
              />
            ))}
          </div>
        </ChoiceGroup>

        <CheckboxRow
          label="Reconnaissance de travailleur handicapé (RQTH ou équivalent)"
          description="Ouvre droit à des aides spécifiques (Agefiph, CPF majoré…)"
          checked={champs.isHandicap}
          onToggle={(isHandicap) => maj({ isHandicap })}
        />

        {avecSoldeCpf && (
          <NumberField
            label="Solde CPF (€)"
            facultatif
            decimal
            euros
            value={champs.soldeCpf}
            onChange={(soldeCpf) => maj({ soldeCpf })}
            placeholder="Ex&nbsp;: 1200"
            helper={
              nombre > 1
                ? `Consultable sur moncompteformation.gouv.fr. Sans solde, le CPF est indiqué sans montant. Même solde retenu pour chaque personne de ce profil${INSECABLE}: prenez le plus bas, ou créez un profil par solde.`
                : 'Consultable sur moncompteformation.gouv.fr. Sans solde, le CPF est indiqué sans montant.'
            }
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : la carte d'un profil**

Créer `apps/web/src/components/wizard/CarteProfil.tsx` :

```tsx
'use client';

import type { ReactNode } from 'react';
import type { ProfilDuGroupe } from '@opco/core';
import { Card } from '@/components/ui/Card';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { enumeration } from '@/lib/etapes';
import { STATUT_DU_PROFIL } from '@/lib/profils';
import { CompteurPersonnes } from './CompteurPersonnes';

/** Identifiant du titre d'un profil : le focus y va à l'ajout et au retrait d'un profil. */
export const idTitreProfil = (id: string) => `titre-profil-${id}`;

interface Props {
  profil: ProfilDuGroupe;
  /** Position du profil dans la liste, à partir de 1 : « Profil 2 ». */
  rang: number;
  /** Libellé du profil (`libelleDuProfil`), en résumé sous le titre. */
  resume: string;
  /** Ce qui manque encore à ce profil (`manquantsDuProfil`) ; dit sur la carte repliée. */
  manquants: string[];
  ouvert: boolean;
  onBasculer: () => void;
  onNombre: (nombre: number) => void;
  /** Effectif maximal de ce profil : la place que les autres profils laissent sous 99 personnes. */
  max: number;
  /** Retire le profil ; absent pour le profil principal. */
  onRetirer?: () => void;
  children: ReactNode;
}

/**
 * Carte d'un profil du groupe : titre (focalisable par programme), statut, résumé, compteur de personnes, puis les questions
 * du profil dans un volet qui se replie sur son résumé. Le volet reste dans la page quand il est replié (`hidden`) : les
 * champs gardent leur état. Le profil principal ne se retire pas.
 */
export function CarteProfil({
  profil,
  rang,
  resume,
  manquants,
  ouvert,
  onBasculer,
  onNombre,
  max,
  onRetirer,
  children,
}: Props) {
  const idCorps = `corps-profil-${profil.id}`;
  return (
    <Card as="section" aria-labelledby={idTitreProfil(profil.id)} padding="none">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3
              id={idTitreProfil(profil.id)}
              tabIndex={-1}
              className="rounded-md font-display text-lg leading-snug font-bold text-texte"
            >
              Profil {rang}
            </h3>
            <Etiquette tone="turquoise">{STATUT_DU_PROFIL[profil.champs.projetType ?? 'formation_salarie']}</Etiquette>
          </div>
          <p className="mt-1 text-sm leading-snug text-texte-doux">{resume}</p>
          {!ouvert && manquants.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-orange-deep">
              <Icon name="info" className="mt-0.5 size-4 shrink-0" />
              <span>À compléter&nbsp;: {enumeration(manquants)}.</span>
            </p>
          )}
        </div>
        <CompteurPersonnes label="Personnes de ce profil" valeur={profil.nombre} max={max} onChange={onNombre} />
      </div>

      <div className="flex flex-wrap gap-x-5 border-t border-filet px-4 py-1 sm:px-5">
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={idCorps}
          onClick={onBasculer}
          className="lien inline-flex min-h-11 items-center gap-1.5 text-left text-sm lg:min-h-9"
        >
          <Icon
            name="chevron"
            className={cx('size-4 shrink-0 transition-transform duration-200', ouvert && 'rotate-90')}
            strokeWidth={2}
          />
          {ouvert ? 'Replier' : 'Modifier'}
          <span className="sr-only"> le profil {rang}</span>
        </button>
        {onRetirer && (
          <button
            type="button"
            onClick={onRetirer}
            className="lien inline-flex min-h-11 items-center gap-1.5 text-left text-sm lg:min-h-9"
          >
            <Icon name="fermer" className="size-4 shrink-0" strokeWidth={2} />
            Retirer ce profil
            <span className="sr-only"> {rang}</span>
          </button>
        )}
      </div>

      <div id={idCorps} hidden={!ouvert} className="border-t border-filet p-4 sm:p-5">
        {children}
      </div>
    </Card>
  );
}
```

- [ ] **Step 4 : l'étape Participants**

Remplacer **tout le contenu** de `apps/web/src/components/wizard/StepSituation.tsx` par :

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { ID_PROFIL_PRINCIPAL, MAX_PERSONNES, MAX_PROFILS, STATUT_PAR_PROJET, nombreDePersonnes, profilsDuGroupe } from '@opco/core';
import type { ProfilDuGroupe, StatutBeneficiaire, WizardState } from '@opco/core';
import { Button } from '@/components/ui/Button';
import type { ActionsDuGroupe } from '@/hooks/useWizard';
import { manquantsDuProfil } from '@/lib/etapes';
import { nombreEtUnite } from '@/lib/format';
import { prochainIdProfil } from '@/lib/groupe';
import type { InconnuesParProfil } from '@/lib/groupe';
import { INSECABLE } from '@/lib/insecable';
import type { QuestionAvecInconnu } from '@/lib/parcours';
import { libelleDuProfil } from '@/lib/profils';
import { CarteProfil, idTitreProfil } from './CarteProfil';
import { CompteurPersonnes } from './CompteurPersonnes';
import { EnTeteEtape } from './EnTeteEtape';
import { FormulaireProfil } from './FormulaireProfil';

interface Props {
  state: WizardState;
  /** Questions auxquelles l'utilisateur a répondu « Je ne sais pas » (profil principal et formation ; la valeur reste null). */
  reponsesInconnues: ReadonlySet<QuestionAvecInconnu>;
  /** Les mêmes réponses pour chaque profil supplémentaire. */
  inconnuesProfils: InconnuesParProfil;
  /** Actions du groupe ; `repondreProfil` couvre aussi le profil principal (identifiant `principal`). */
  groupe: ActionsDuGroupe;
}

/** Titre et introduction de l'étape pour une seule personne, selon le statut du projet. */
const ENTETES: Record<StatutBeneficiaire, { titre: string; chapeau: string }> = {
  salarie: {
    titre: 'Le salarié concerné',
    chapeau: "Ces informations déterminent les aides ouvertes au salarié et à l'entreprise.",
  },
  demandeur_emploi: {
    titre: 'La personne à recruter',
    chapeau: "Les aides au recrutement dépendent de la situation du demandeur d'emploi.",
  },
  alternant: {
    titre: "L'alternant",
    chapeau: "Le type de contrat et l'âge conditionnent la plupart des aides à l'alternance.",
  },
  dirigeant: {
    titre: 'Le dirigeant',
    chapeau: 'Le statut du dirigeant détermine son fonds de formation et ses avantages fiscaux.',
  },
};

/** Introduction de l'étape dès qu'il y a plusieurs personnes ou plusieurs profils. */
const CHAPEAU_GROUPE = `Indiquez combien de personnes suivent la formation. Ajoutez un profil quand certaines ont une situation différente${INSECABLE}: statut, contrat, âge, handicap ou solde CPF.`;

const AUCUNE_REPONSE: ReadonlySet<QuestionAvecInconnu> = new Set();
const ID_AJOUT = 'ajouter-profil';

/**
 * Étape 3 : les personnes formées. Avec un seul profil, l'étape garde son allure d'une personne seule (les questions du
 * statut) et ajoute un compteur et le bouton « Ajouter un profil différent ». Dès qu'il y a plusieurs profils, une carte
 * par profil (statut, compteur, questions) ; un seul profil est déplié à la fois. À l'ajout d'un profil, le focus va à son
 * titre ; au retrait, au titre du profil précédent (ou au bouton d'ajout quand il ne reste qu'un profil). Une zone polie
 * annonce le nombre de personnes.
 */
export function StepSituation({ state, reponsesInconnues, inconnuesProfils, groupe }: Props) {
  const profils = profilsDuGroupe(state);
  const total = nombreDePersonnes(state);
  const [ouvert, setOuvert] = useState(ID_PROFIL_PRINCIPAL);
  const [annonce, setAnnonce] = useState('');
  // Élément qui prend le focus au rendu qui suit un ajout ou un retrait : le titre d'un profil, ou le bouton d'ajout.
  const aFocaliser = useRef<string | null>(null);
  useEffect(() => {
    if (aFocaliser.current) {
      document.getElementById(aFocaliser.current)?.focus();
      aFocaliser.current = null;
    }
  });

  const limite =
    profils.length >= MAX_PROFILS
      ? `Vous avez atteint les ${MAX_PROFILS}${INSECABLE}profils au plus.`
      : total >= MAX_PERSONNES
        ? `Vous avez atteint les ${MAX_PERSONNES}${INSECABLE}personnes au plus.`
        : null;

  const ajouter = () => {
    if (limite) return;
    const id = prochainIdProfil(state);
    groupe.ajouterProfil();
    setOuvert(id);
    aFocaliser.current = idTitreProfil(id);
    setAnnonce(`Profil ${profils.length + 1} ajouté. ${nombreEtUnite(total + 1, 'personnes')} au total.`);
  };

  const retirer = (id: string, rang: number) => {
    const retire = profils.find((p) => p.id === id);
    if (!retire) return;
    const precedent = profils[rang - 2]?.id ?? ID_PROFIL_PRINCIPAL;
    groupe.retirerProfil(id);
    if (ouvert === id) setOuvert(precedent);
    aFocaliser.current = profils.length === 2 ? ID_AJOUT : idTitreProfil(precedent);
    const reste = total - retire.nombre;
    setAnnonce(`Profil ${rang} retiré. ${nombreEtUnite(reste, reste > 1 ? 'personnes' : 'personne')} au total.`);
  };

  const formulaire = (profil: ProfilDuGroupe) => (
    <FormulaireProfil
      champs={profil.champs}
      nombre={profil.nombre}
      regionEntreprise={state.regionCode}
      maj={(maj) => groupe.majProfil(profil.id, maj)}
      inconnues={profil.principal ? reponsesInconnues : (inconnuesProfils[profil.id] ?? AUCUNE_REPONSE)}
      repondre={(question, valeur) => groupe.repondreProfil(profil.id, question, valeur)}
      changerProjet={profil.principal ? undefined : (projet) => groupe.changerProjetProfil(profil.id, projet)}
    />
  );

  const boutonAjout = (
    <div>
      <Button
        id={ID_AJOUT}
        variant="secondary"
        icone="recrutement"
        onClick={limite ? undefined : ajouter}
        aria-disabled={limite != null || undefined}
        aria-describedby={limite ? 'aide-ajouter-profil' : undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      >
        Ajouter un profil différent
      </Button>
      {limite && (
        <p id="aide-ajouter-profil" className="mt-2 text-sm text-texte-discret">
          {limite}
        </p>
      )}
    </div>
  );
  const zoneAnnonce = (
    <p role="status" className="sr-only">
      {annonce}
    </p>
  );

  if (profils.length === 1) {
    const principal = profils[0];
    const entete = ENTETES[STATUT_PAR_PROJET[principal.champs.projetType ?? 'formation_salarie']];
    return (
      <div className="space-y-8">
        <EnTeteEtape
          etape="situation"
          titre={total > 1 ? 'Les personnes formées' : entete.titre}
          chapeau={total > 1 ? CHAPEAU_GROUPE : entete.chapeau}
          obligatoires
        />
        <CompteurPersonnes
          label="Nombre de personnes"
          aide="Indiquez combien de personnes suivent cette formation. Si certaines ont une situation différente, ajoutez ensuite un profil."
          valeur={principal.nombre}
          max={MAX_PERSONNES}
          onChange={(n) => groupe.definirNombre(ID_PROFIL_PRINCIPAL, n)}
        />
        <div className="border-t border-filet pt-8">{formulaire(principal)}</div>
        {boutonAjout}
        {zoneAnnonce}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <EnTeteEtape etape="situation" titre="Les personnes formées" chapeau={CHAPEAU_GROUPE} obligatoires />
      <ul role="list" className="space-y-4">
        {profils.map((profil, i) => {
          const rang = i + 1;
          return (
            <li key={profil.id}>
              <CarteProfil
                profil={profil}
                rang={rang}
                resume={libelleDuProfil(profil.champs)}
                manquants={manquantsDuProfil(profil.champs)}
                ouvert={ouvert === profil.id}
                onBasculer={() => setOuvert(ouvert === profil.id ? '' : profil.id)}
                onNombre={(n) => groupe.definirNombre(profil.id, n)}
                max={MAX_PERSONNES - (total - profil.nombre)}
                onRetirer={profil.principal ? undefined : () => retirer(profil.id, rang)}
              >
                {formulaire(profil)}
              </CarteProfil>
            </li>
          );
        })}
      </ul>
      {boutonAjout}
      <p className="text-sm font-semibold text-texte">
        {nombreEtUnite(total, 'personnes')} · {nombreEtUnite(profils.length, 'profils')}
      </p>
      {zoneAnnonce}
    </div>
  );
}
```

Dans `apps/web/src/components/wizard/WizardContainer.tsx` : ajouter `inconnuesProfils,` après `reponsesInconnues,` et `groupe,` après `repondre,` dans la liste déstructurée de `useWizard()`, et remplacer le bloc

```tsx
          {currentStep.key === 'situation' && (
            <StepSituation
              state={state}
              updateState={updateState}
              reponsesInconnues={reponsesInconnues}
              repondre={repondre}
            />
          )}
```

par

```tsx
          {currentStep.key === 'situation' && (
            <StepSituation
              state={state}
              reponsesInconnues={reponsesInconnues}
              inconnuesProfils={inconnuesProfils}
              groupe={groupe}
            />
          )}
```

- [ ] **Step 5 : vérifier le typage, le lint et les gardes**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/web && npx tsc --noEmit`
Expected: aucune erreur. Si `groupe.repondreProfil(profil.id, question, valeur)` ou la fonction `repondre` du crochet est refusée par le typage (`ChampsProfil[K]` contre `WizardState[K]`), préciser le type de `valeur` par un transtypage local ; ne pas assouplir les types publics.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run lint --workspace web && npm run check:charte && npm run test:web`
Expected: tout vert (les gardes `jsx-espaces` et de charte relisent les nouveaux composants).

- [ ] **Step 6 : vérifier dans le navigateur**

Démarrer le serveur de développement du dépôt (`mcp__Claude_Browser__preview_start`, configuration `site-dev`, port 3100), ouvrir `http://localhost:3100/simulateur/`, puis :

1. Étape 1 : « Former un salarié ». Étape 2 : « Saisir l'OPCO et la région à la main », OPCO AKTO, région Île-de-France, taille « Moins de 11 salariés ». Étape 3 : l'étape ressemble à l'ancienne (« Le salarié concerné ») avec, en plus, « Nombre de personnes » à 1 et le bouton « Ajouter un profil différent ».
2. Porter le compteur à 3 (bouton « Ajouter une personne », puis saisie au clavier) : le titre devient « Les personnes formées », la note « Ces réponses valent pour chacune des 3 personnes de ce profil… » apparaît ; taper `0`, `abc`, `150` : le champ ne passe jamais sous 1 ni au-dessus de 99 et reprend la valeur retenue en le quittant.
3. « Ajouter un profil différent » : deux cartes (« Profil 1 », « Profil 2 »), le focus sur le titre du profil 2, le profil 1 replié sur son résumé (« Salarié… », « À compléter : le type de contrat (…) » tant que le contrat manque). Choisir le statut « Dirigeant » du profil 2 : les questions du dirigeant apparaissent ; changer pour « Salarié » puis revenir à « Dirigeant » : les réponses du statut quitté sont vides.
4. « Retirer ce profil » : le focus revient au bouton « Ajouter un profil différent » ; le compteur total est annoncé (lire la zone `role="status"` dans l'arbre d'accessibilité).
5. 375 px de large (`resize_window`, préréglage mobile) : aucune coupure de mot, aucun défilement horizontal, cibles de 44 px.

Noter toute différence avec cette liste avant de poursuivre ; arrêter le serveur de développement ensuite (`preview_stop`).

- [ ] **Step 7 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add apps/web/src/components/wizard/CompteurPersonnes.tsx apps/web/src/components/wizard/FormulaireProfil.tsx apps/web/src/components/wizard/CarteProfil.tsx apps/web/src/components/wizard/StepSituation.tsx apps/web/src/components/wizard/WizardContainer.tsx
git commit -m "$(cat <<'EOF'
site : étape Participants (nombre de personnes, cartes de profils, formulaire d'un profil)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14 : Prix par personne ou pour le groupe, frais, entreprise et récapitulatif

**Files:**
- Modify: `apps/web/src/lib/groupe.ts` (`coutDuGroupe`, `aideDuPrix`)
- Modify: `apps/web/tests/groupe.test.ts`
- Modify: `apps/web/src/components/wizard/StepFormation.tsx`
- Modify: `apps/web/src/components/wizard/StepFrais.tsx`
- Modify: `apps/web/src/components/wizard/StepIdentification.tsx`
- Modify (réécriture): `apps/web/src/components/wizard/StepRecap.tsx`
- Modify: `apps/web/src/components/wizard/WizardContainer.tsx`

**Interfaces:**
- Consumes: `ActionsDuGroupe` (tâche 12) ; `ouvreBudgetPourLeGroupe`, `opcoRequisPourLeGroupe`, `InconnuesParProfil` (tâches 9 et 12) ; `STATUT_DU_PROFIL` (tâche 10) ; `ID_PROFIL_PRINCIPAL`, `nombreDePersonnes`, `profilsDuGroupe` (cœur).
- Produces: `coutDuGroupe(etat: Pick<WizardState, 'prixDuGroupe' | 'pedagogyCostTotal' | 'nombrePersonnes' | 'autresProfils'>): number | null` ; `aideDuPrix(personnes: number, coutParPersonne: number | null, pourLeGroupe: boolean): string | null` ; `StepFormation` reçoit `groupe: Pick<ActionsDuGroupe, 'basculerModePrix'>` ; `StepRecap` reçoit `inconnuesProfils: InconnuesParProfil`.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `apps/web/tests/groupe.test.ts`, ajouter aux importations `aideDuPrix` et `coutDuGroupe` (de `../src/lib/groupe`), `import { formatEuro } from '../src/lib/format';` et `import { INSECABLE } from '../src/lib/insecable';`, puis ajouter à la fin du fichier :

```ts
describe('prix du groupe : coutDuGroupe et aideDuPrix', () => {
  const nb = INSECABLE;
  const avec = (over: Partial<WizardState>): WizardState => ({ ...createInitialWizardState(), ...over });

  test('coutDuGroupe : le prix saisi pour le groupe, sinon le coût d’une personne multiplié par l’effectif, au centime', () => {
    assert.equal(coutDuGroupe(avec({ pedagogyCostTotal: 933.33, nombrePersonnes: 6 })), 5599.98);
    assert.equal(coutDuGroupe(avec({ pedagogyCostTotal: 933.3333333333334, nombrePersonnes: 6, prixDuGroupe: 5600 })), 5600);
    assert.equal(coutDuGroupe(avec({ pedagogyCostTotal: null, nombrePersonnes: 6 })), null);
    const deuxProfils = definirNombre(ajouterProfil(avec({ pedagogyCostTotal: 1000, nombrePersonnes: 2 })), 'profil-2', 3);
    assert.equal(coutDuGroupe(deuxProfils), 5000);
  });

  test('aideDuPrix : le prix de l’autre mode ; rien sous deux personnes, sans prix ou avec un prix invalide', () => {
    assert.equal(aideDuPrix(6, 933.33, false), `Soit ${formatEuro(5599.98)} pour les 6${nb}personnes.`);
    assert.equal(aideDuPrix(6, 933.3333333333334, true), `Soit ${formatEuro(933.33)} par personne.`);
    assert.equal(aideDuPrix(4, 2800, false), `Soit ${formatEuro(11200)} pour les 4${nb}personnes.`);
    assert.equal(aideDuPrix(1, 2800, false), null);
    assert.equal(aideDuPrix(4, null, true), null);
    assert.equal(aideDuPrix(4, 0, false), null);
    assert.equal(aideDuPrix(4, Number.NaN, true), null);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && node --import tsx --test apps/web/tests/groupe.test.ts`
Expected: FAIL (`coutDuGroupe` et `aideDuPrix` ne sont pas exportés).

- [ ] **Step 3 : écrire les fonctions**

Dans `apps/web/src/lib/groupe.ts`, ajouter après la ligne `import { opcoRequis, ouvreBudgetOpco } from './entreprise';` la ligne

```ts
import { formatEuro, nombreEtUnite } from './format';
```

puis ajouter à la fin du fichier :

```ts

// --- Prix de la formation à l'écran ----------------------------------------------------------------------------------

/**
 * Prix de toute la formation pour le groupe, au centime : celui qui a été saisi pour le groupe, sinon le coût d'une personne
 * multiplié par l'effectif. Null tant qu'aucun coût n'est saisi.
 */
export function coutDuGroupe(
  etat: Pick<WizardState, 'prixDuGroupe' | 'pedagogyCostTotal' | 'nombrePersonnes' | 'autresProfils'>,
): number | null {
  if (etat.prixDuGroupe != null) return etat.prixDuGroupe;
  if (etat.pedagogyCostTotal == null) return null;
  return Math.round(etat.pedagogyCostTotal * nombreDePersonnes(etat) * 100) / 100;
}

/**
 * Aide sous le champ du prix à partir de deux personnes : le prix de l'autre mode. Prix saisi pour le groupe : « Soit
 * 933,33 € par personne. » ; saisi par personne : « Soit 5 600 € pour les 6 personnes. ». Null sous deux personnes, sans
 * coût ou avec un coût invalide.
 */
export function aideDuPrix(personnes: number, coutParPersonne: number | null, pourLeGroupe: boolean): string | null {
  if (personnes < 2 || coutParPersonne == null || !(coutParPersonne > 0)) return null;
  return pourLeGroupe
    ? `Soit ${formatEuro(coutParPersonne)} par personne.`
    : `Soit ${formatEuro(Math.round(coutParPersonne * personnes * 100) / 100)} pour les ${nombreEtUnite(personnes, 'personnes')}.`;
}
```

- [ ] **Step 4 : vérifier que les tests passent**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && node --import tsx --test apps/web/tests/groupe.test.ts`
Expected: PASS.

- [ ] **Step 5 : les composants de l'étape Formation**

Dans `apps/web/src/components/wizard/StepFormation.tsx` :

1. Dans l'importation de `@opco/core`, ajouter `nombreDePersonnes,` entre `moisDepuisSaisie,` et `saisieDepuisMois,`.

2. Remplacer les deux lignes

```tsx
import { ouvreBudgetOpco } from '@/lib/entreprise';
import { de, formatEuro } from '@/lib/format';
```

par

```tsx
import type { ActionsDuGroupe } from '@/hooks/useWizard';
import { de, formatEuro } from '@/lib/format';
import { aideDuPrix, ouvreBudgetPourLeGroupe } from '@/lib/groupe';
import { INSECABLE } from '@/lib/insecable';
```

3. Remplacer, dans `interface Props`,

```tsx
  updateFormationCosts: (total: number | null, hours: number | null) => void;
  /** Questions auxquelles l'utilisateur a répondu « Je ne sais pas » ou « Ne sait pas » (la valeur reste null). */
  reponsesInconnues: ReadonlySet<QuestionAvecInconnu>;
  repondre: Repondre;
}
```

par

```tsx
  /** Prix et durée de la formation ; `pourLeGroupe` : `saisie` est le prix de tout le groupe (à partir de deux personnes). */
  updateFormationCosts: (saisie: number | null, hours: number | null, pourLeGroupe?: boolean) => void;
  /** Questions auxquelles l'utilisateur a répondu « Je ne sais pas » ou « Ne sait pas » (la valeur reste null). */
  reponsesInconnues: ReadonlySet<QuestionAvecInconnu>;
  repondre: Repondre;
  /** Bascule entre le prix par personne et le prix du groupe, qui garde le coût réel. */
  groupe: Pick<ActionsDuGroupe, 'basculerModePrix'>;
}
```

4. Remplacer le commentaire et la signature

```tsx
/** Étape 4 : la formation. Type, mode, durée et coût sont obligatoires ; le reste affine la recherche des aides. */
export function StepFormation({ state, updateState, updateFormationCosts, reponsesInconnues, repondre }: Props) {
```

par

```tsx
/**
 * Étape 4 : la formation. Type, mode, durée et coût sont obligatoires ; le reste affine la recherche des aides. À partir de
 * deux personnes, le prix se saisit par personne ou pour le groupe (le coût réel est gardé quand on change de mode). Le coût
 * horaire, le plafond indicatif et l'avertissement de dépassement sont ceux d'UNE personne.
 */
export function StepFormation({ state, updateState, updateFormationCosts, reponsesInconnues, repondre, groupe }: Props) {
```

5. Remplacer

```tsx
  const erreurDebut = debutQuitte ? erreurDuMoisDeDebut(saisieDebut) : null;

  // Plafond horaire indicatif du barème appliqué, pour les projets qui passent par le budget de l'OPCO.
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const plafond = ouvreBudgetOpco(state.projetType) ? plafondHoraireIndicatif(opco, state) : null;
```

par

```tsx
  const erreurDebut = debutQuitte ? erreurDuMoisDeDebut(saisieDebut) : null;

  // Prix par personne ou pour le groupe. Le nombre de personnes se règle à l'étape Participants, qui démonte celle-ci : il ne
  // change pas pendant l'étape. À l'ouverture, « pour le groupe » si un prix de groupe est déjà saisi ; une bascule sans prix
  // saisi n'écrit rien dans l'état, le choix reste donc ici.
  const personnes = nombreDePersonnes(state);
  const plusieurs = personnes >= 2;
  const [groupeChoisi, setGroupeChoisi] = useState(() => state.prixDuGroupe != null);
  const pourLeGroupe = plusieurs && groupeChoisi;
  const prixSaisi = pourLeGroupe ? state.prixDuGroupe : state.pedagogyCostTotal;
  const libellePrix = pourLeGroupe
    ? 'Coût total HT pour le groupe (€)'
    : plusieurs
      ? 'Coût total HT par personne (€)'
      : 'Coût total HT (€)';
  const choisirMode = (versGroupe: boolean) => {
    if (versGroupe === pourLeGroupe) return;
    setGroupeChoisi(versGroupe);
    groupe.basculerModePrix(versGroupe);
  };

  // Plafond horaire indicatif du barème appliqué, pour les projets qui passent par le budget de l'OPCO (un profil au moins).
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const plafond = ouvreBudgetPourLeGroupe(state) ? plafondHoraireIndicatif(opco, state) : null;
```

6. Remplacer le bloc des deux champs (durée et coût)

```tsx
        <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2">
          <NumberField
            label="Durée (en heures)"
            required
            value={state.durationHours}
            onChange={(heures) => updateFormationCosts(state.pedagogyCostTotal, heures)}
            min={1}
            placeholder="Ex&nbsp;: 140"
            largeur="pleine"
          />
          <NumberField
            label="Coût total HT (€)"
            required
            decimal
            euros
            value={state.pedagogyCostTotal}
            onChange={(total) => updateFormationCosts(total, state.durationHours)}
            min={1}
            placeholder="Ex&nbsp;: 5600"
            largeur="pleine"
          />
        </div>
```

par

```tsx
        {plusieurs && (
          <ChoiceGroup
            label="Le prix saisi est"
            aide={`Le groupe compte ${personnes}${INSECABLE}personnes. Passer d'un mode à l'autre convertit le prix, sans le ressaisir.`}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <ChoiceButton label="Par personne" selected={!pourLeGroupe} onClick={() => choisirMode(false)} compact />
              <ChoiceButton label="Pour le groupe" selected={pourLeGroupe} onClick={() => choisirMode(true)} compact />
            </div>
          </ChoiceGroup>
        )}

        <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2">
          <NumberField
            label="Durée (en heures)"
            required
            value={state.durationHours}
            onChange={(heures) => updateFormationCosts(prixSaisi, heures, pourLeGroupe)}
            min={1}
            placeholder="Ex&nbsp;: 140"
            largeur="pleine"
          />
          <NumberField
            label={libellePrix}
            required
            decimal
            euros
            value={prixSaisi}
            onChange={(saisie) => updateFormationCosts(saisie, state.durationHours, pourLeGroupe)}
            min={1}
            placeholder="Ex&nbsp;: 5600"
            helper={aideDuPrix(personnes, state.pedagogyCostTotal, pourLeGroupe) ?? undefined}
            largeur="pleine"
          />
        </div>
```

7. Remplacer `Coût horaire calculé&nbsp;:{' '}` par `Coût horaire calculé{plusieurs ? ', par personne' : ''}&nbsp;:{' '}`, et `Plafond indicatif {de(opco.name)}&nbsp;:{' '}` par `Plafond indicatif {de(opco.name)}{plusieurs ? ', par personne' : ''}&nbsp;:{' '}`.

8. Remplacer `{`Le coût horaire (${parHeure(coutHoraire)}) dépasse` par `{`Le coût horaire${plusieurs ? ' par personne' : ''} (${parHeure(coutHoraire)}) dépasse` (le reste de la phrase ne change pas).

Dans `apps/web/src/components/wizard/StepFrais.tsx` :

1. Remplacer `import type { TransportMode, WizardState } from '@opco/core';` par

```tsx
import { nombreDePersonnes } from '@opco/core';
import type { TransportMode, WizardState } from '@opco/core';
```

2. Remplacer

```tsx
/** Étape 5 (sautée pour une formation à distance) : frais de déplacement, d'hébergement et de repas, tous facultatifs. */
export function StepFrais({ state, updateState }: Props) {
  // Jours de formation estimés sur une base de 7 heures par jour, retenus quand le champ reste vide.
  const joursEstimes = state.durationHours ? Math.ceil(state.durationHours / 7) : 0;
  const joursRetenus = joursEstimes > 1 ? 'jours sont retenus' : 'jour est retenu';

  return (
    <div className="space-y-8">
      <EnTeteEtape
        etape="frais"
        titre="Frais annexes"
        chapeau="Si la formation oblige à se déplacer, indiquez les frais prévus. Certains OPCO prennent en charge tout ou partie de ces frais."
      />
```

par

```tsx
const CHAPEAU =
  'Si la formation oblige à se déplacer, indiquez les frais prévus. Certains OPCO prennent en charge tout ou partie de ces frais.';

/**
 * Étape 5 (sautée pour une formation à distance) : frais de déplacement, d'hébergement et de repas, tous facultatifs. Pour
 * plusieurs personnes, les montants saisis sont ceux d'une personne : le moteur les compte pour chacune.
 */
export function StepFrais({ state, updateState }: Props) {
  // Jours de formation estimés sur une base de 7 heures par jour, retenus quand le champ reste vide.
  const joursEstimes = state.durationHours ? Math.ceil(state.durationHours / 7) : 0;
  const joursRetenus = joursEstimes > 1 ? 'jours sont retenus' : 'jour est retenu';
  const personnes = nombreDePersonnes(state);

  return (
    <div className="space-y-8">
      <EnTeteEtape
        etape="frais"
        titre="Frais annexes"
        chapeau={
          personnes > 1
            ? `${CHAPEAU} Indiquez les montants pour une seule personne${INSECABLE}: ils sont comptés pour chacune des ${personnes}${INSECABLE}personnes.`
            : CHAPEAU
        }
      />
```

Dans `apps/web/src/components/wizard/StepIdentification.tsx` :

1. Remplacer

```tsx
  etatSansEntreprise,
  opcoRequis,
  ouvreBudgetOpco,
  preselectionParNaf,
  texteDuResolveur,
} from '@/lib/entreprise';
import { texteFr } from '@/lib/format';
import { INSECABLE } from '@/lib/insecable';
```

par

```tsx
  etatSansEntreprise,
  preselectionParNaf,
  texteDuResolveur,
} from '@/lib/entreprise';
import { texteFr } from '@/lib/format';
import { opcoRequisPourLeGroupe, ouvreBudgetPourLeGroupe } from '@/lib/groupe';
import { INSECABLE } from '@/lib/insecable';
```

2. Remplacer les deux `opcoRequis(state.projetType)` du `ChoiceGroup` « Votre OPCO » par `opcoRequisPourLeGroupe(state)`, et les deux `ouvreBudgetOpco(state.projetType)` du bloc « Budget formation déjà consommé » (`{(ouvreBudgetOpco(state.projetType) || opco) && (` puis `{ouvreBudgetOpco(state.projetType) && (`) par `ouvreBudgetPourLeGroupe(state)`. Aucun autre texte ne change : l'OPCO est requis dès qu'un profil n'est pas un dirigeant, le budget se montre tant qu'un profil relève d'un projet salarié.

Remplacer **tout le contenu** de `apps/web/src/components/wizard/StepRecap.tsx` par :

```tsx
'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';
import {
  CERTIFICATION_LABELS,
  COMPANY_SIZE_LABELS,
  CONTRACT_TYPE_LABELS,
  EMBEDDED_OPCO_LIST,
  ID_PROFIL_PRINCIPAL,
  NIVEAU_CERTIFICATION_LABELS,
  NIVEAU_DIPLOME_LABELS,
  PROJET_LABELS,
  REGIONS,
  STATUT_DIRIGEANT_LABELS,
  STATUT_PAR_PROJET,
  TRAINING_MODE_LABELS,
  TRAINING_TYPE_LABELS,
  TYPE_ALTERNANCE_LABELS,
  getEmbeddedOpcoBySlug,
  nombreDePersonnes,
  profilsDuGroupe,
  resolveVarianteBranche,
  saisieDepuisMois,
} from '@opco/core';
import type { ChampsProfil, CodeRegion, WizardState } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import type { EtapeSite } from '@/lib/etapes';
import { formatEuro, nombreEtUnite } from '@/lib/format';
import { coutDuGroupe, ouvreBudgetPourLeGroupe } from '@/lib/groupe';
import type { InconnuesParProfil } from '@/lib/groupe';
import { INSECABLE } from '@/lib/insecable';
import type { QuestionAvecInconnu } from '@/lib/parcours';
import { STATUT_DU_PROFIL } from '@/lib/profils';
import { numeroLisible } from '@/lib/recherche';
import { EnTeteEtape } from './EnTeteEtape';
import { ICONES_PROJET, TRANSPORT_LABELS } from './libelles';

interface Props {
  state: WizardState;
  onEdit: (step: EtapeSite) => void;
  /** Questions auxquelles l'utilisateur a répondu « Je ne sais pas » ou « Ne sait pas » : écrites telles quelles. */
  reponsesInconnues: ReadonlySet<QuestionAvecInconnu>;
  /** Les mêmes réponses pour chaque profil supplémentaire. */
  inconnuesProfils: InconnuesParProfil;
}

/** Ligne du récapitulatif : une valeur nulle s'affiche « Non renseigné ». */
type Ligne = [libelle: string, valeur: ReactNode | null | undefined];

/** Nombre et unité liés par une espace insécable (« 35 h », « 1 500 h », « 24 mois ») : `nombreEtUnite`, comme l'en-tête des résultats. */
const avecUnite = nombreEtUnite;
const pluriel = (n: number, un: string, plusieurs: string): string => avecUnite(n, n > 1 ? plusieurs : un);

const AUCUNE_REPONSE: ReadonlySet<QuestionAvecInconnu> = new Set();

/** « Oui », « Non » ou « Je ne sais pas » (réponse retenue) ; null quand la question n'a pas de réponse. */
const reponseOuiNon =
  (inconnues: ReadonlySet<QuestionAvecInconnu>) =>
  (question: QuestionAvecInconnu, valeur: boolean | null): string | null =>
    valeur == null ? (inconnues.has(question) ? 'Je ne sais pas' : null) : valeur ? 'Oui' : 'Non';

/** Section du récapitulatif : en-tête iconifié, bouton « Modifier » qui rouvre l'étape, lignes libellé / valeur. */
function Section({
  titre,
  icone,
  onEdit,
  lignes,
}: {
  titre: string;
  icone: IconName;
  onEdit: () => void;
  lignes: Ligne[];
}) {
  const id = useId();
  return (
    <Card as="section" aria-labelledby={id} padding="none">
      <div className="flex items-center justify-between gap-4 border-b border-filet px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-turquoise-soft text-turquoise-deep"
          >
            <Icon name={icone} className="size-[18px]" />
          </span>
          <h3 id={id} className="text-lg leading-snug font-bold tracking-[-0.01em] text-texte">
            {titre}
          </h3>
        </div>
        <Button variant="ghost" icone="crayon" onClick={onEdit} aria-label={`Modifier la section ${titre}`}>
          Modifier
        </Button>
      </div>
      <dl className="divide-y divide-filet px-4 sm:px-6">
        {lignes.map(([libelle, valeur]) => (
          <div key={libelle} className="grid gap-0.5 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-6">
            <dt className="text-sm text-texte-doux">{libelle}</dt>
            <dd className="text-sm font-medium break-words text-texte">
              {valeur == null || valeur === '' ? (
                <span className="font-normal text-texte-discret">Non renseigné</span>
              ) : (
                valeur
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * Réponses d'un profil, ligne par ligne, selon son statut. `inconnues` : les questions auxquelles le profil a répondu « Je
 * ne sais pas » ; `regionEntreprise` : région de résidence par défaut (celle de l'entreprise, comme le moteur).
 */
function lignesDuProfil(
  champs: ChampsProfil,
  inconnues: ReadonlySet<QuestionAvecInconnu>,
  regionEntreprise: CodeRegion | null,
): Ligne[] {
  const statut = STATUT_PAR_PROJET[champs.projetType ?? 'formation_salarie'];
  const ouiNon = reponseOuiNon(inconnues);
  const regionResidence: Ligne = [
    'Région de résidence',
    champs.regionBeneficiaireCode
      ? REGIONS[champs.regionBeneficiaireCode]
      : regionEntreprise
        ? `${REGIONS[regionEntreprise]} (celle de l'entreprise)`
        : null,
  ];
  const communes: Ligne[] = [
    ['Âge', champs.ageBeneficiaire != null ? pluriel(champs.ageBeneficiaire, 'an', 'ans') : null],
    ['Diplôme le plus élevé', champs.niveauDiplome ? NIVEAU_DIPLOME_LABELS[champs.niveauDiplome] : null],
    ['Reconnaissance de travailleur handicapé', champs.isHandicap ? 'Oui' : 'Non'],
  ];
  const soldeCpf: Ligne = ['Solde CPF', champs.soldeCpf != null ? formatEuro(champs.soldeCpf) : null];
  switch (statut) {
    case 'salarie':
      return [
        [
          'Contrat',
          champs.contractType && champs.contractType !== 'alternance' ? CONTRACT_TYPE_LABELS[champs.contractType] : null,
        ],
        ['Ancienneté', champs.anciennete_mois != null ? avecUnite(champs.anciennete_mois, 'mois') : null],
        ...communes,
        soldeCpf,
      ];
    case 'demandeur_emploi':
      return [
        ['Inscription à France Travail', ouiNon('inscritFranceTravail', champs.inscritFranceTravail)],
        regionResidence,
        ...communes,
      ];
    case 'alternant':
      return [
        ["Type de contrat d'alternance", champs.typeAlternance ? TYPE_ALTERNANCE_LABELS[champs.typeAlternance] : null],
        ['Inscription à France Travail', ouiNon('inscritFranceTravail', champs.inscritFranceTravail)],
        regionResidence,
        ...communes,
      ];
    case 'dirigeant':
      return [
        ['Statut du dirigeant', champs.statutDirigeant ? STATUT_DIRIGEANT_LABELS[champs.statutDirigeant] : null],
        ['Micro-entrepreneur', ouiNon('microEntrepreneur', champs.microEntrepreneur)],
        ...communes,
        soldeCpf,
      ];
  }
}

/**
 * Étape 6 : tout ce qui a été saisi, section par section, avant de lancer la recherche des financements. Une réponse
 * « Je ne sais pas » est écrite telle quelle ; « Non renseigné » reste réservé aux questions sans réponse. Un groupe de
 * plusieurs profils a une section « Participants » (le total) puis une section par profil ; le prix de la formation s'écrit
 * par personne et pour le groupe.
 */
export function StepRecap({ state, onEdit, reponsesInconnues, inconnuesProfils }: Props) {
  const projet = state.projetType ?? 'formation_salarie';
  const profils = profilsDuGroupe(state);
  const personnes = nombreDePersonnes(state);
  const groupe = personnes > 1;
  const ouiNon = reponseOuiNon(reponsesInconnues);
  /** Choix d'une liste dont l'option vide se lit « Ne sait pas ». */
  const choix = (question: QuestionAvecInconnu, libelle: string | null): string | null =>
    libelle ?? (reponsesInconnues.has(question) ? 'Ne sait pas' : null);
  const inconnuesDe = (id: string): ReadonlySet<QuestionAvecInconnu> =>
    id === ID_PROFIL_PRINCIPAL ? reponsesInconnues : (inconnuesProfils[id] ?? AUCUNE_REPONSE);

  // OPCO et barème de branche appliqué par le moteur : choix manuel, sinon variante qui couvre l'IDCC détecté, sinon
  // barème général (la ligne n'existe que pour un OPCO qui a des barèmes par branche).
  const opcoSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = opcoSlug ? EMBEDDED_OPCO_LIST.find((o) => o.slug === opcoSlug) : null;
  const opcoComplet = opcoSlug ? getEmbeddedOpcoBySlug(opcoSlug) : null;
  const variante = opcoComplet ? resolveVarianteBranche(opcoComplet, state) : null;
  const aDesVariantes = (opcoComplet?.variantes_branche?.length ?? 0) > 0;
  const brancheNom = variante
    ? variante.id === state.selectedBrancheId
      ? variante.branche_nom
      : `${variante.branche_nom} (détectée d'après l'IDCC ${state.detectedIdcc})`
    : 'Barème général';

  const entreprise: Ligne[] = [
    ...(state.detectedCompanyName && state.sirenNumber
      ? ([['Entreprise', `${state.detectedCompanyName} (SIREN ${numeroLisible(state.sirenNumber)})`]] as Ligne[])
      : []),
    ['OPCO', opco ? `${opco.name}${state.selectedOpcoSlug ? ' (choisi manuellement)' : ''}` : null],
    ...(aDesVariantes ? ([['Accord de branche', brancheNom]] as Ligne[]) : []),
    ['Région', state.regionCode ? REGIONS[state.regionCode] : null],
    [
      'Taille',
      state.companySize
        ? `${COMPANY_SIZE_LABELS[state.companySize]}${state.effectif != null ? " (déduite de l'effectif)" : ''}`
        : null,
    ],
    ['Effectif exact', state.effectif != null ? pluriel(state.effectif, 'salarié', 'salariés') : null],
    ...(ouvreBudgetPourLeGroupe(state)
      ? ([
          ['Budget déjà consommé', state.budgetDejaConsomme != null ? formatEuro(state.budgetDejaConsomme) : null],
        ] as Ligne[])
      : []),
  ];

  // Une seule personne ou un seul profil : la section « Participants » porte les réponses. Plusieurs profils : le total dans
  // « Participants », puis une section par profil (nombre de personnes, statut, réponses).
  const sectionsDesPersonnes: { titre: string; lignes: Ligne[] }[] =
    profils.length === 1
      ? [
          {
            titre: 'Participants',
            lignes: [
              ...(groupe ? ([['Personnes', pluriel(personnes, 'personne', 'personnes')]] as Ligne[]) : []),
              ...lignesDuProfil(profils[0].champs, inconnuesDe(profils[0].id), state.regionCode),
            ],
          },
        ]
      : [
          {
            titre: 'Participants',
            lignes: [
              ['Personnes', `${pluriel(personnes, 'personne', 'personnes')}, ${pluriel(profils.length, 'profil', 'profils')}`],
            ],
          },
          ...profils.map((p, i) => ({
            titre: `Profil ${i + 1}`,
            lignes: [
              ['Personnes', pluriel(p.nombre, 'personne', 'personnes')],
              ['Statut', STATUT_DU_PROFIL[p.champs.projetType ?? 'formation_salarie']],
              ...lignesDuProfil(p.champs, inconnuesDe(p.id), state.regionCode),
            ] as Ligne[],
          })),
        ];

  const coutGroupe = coutDuGroupe(state);
  const formation: Ligne[] = [
    // « Intitulé » : la ligne « Formation » d'une section Formation se lisait comme une formation absente.
    ['Intitulé', state.formationNom],
    ['Type', state.formationType ? TRAINING_TYPE_LABELS[state.formationType] : null],
    [
      'Certification visée',
      choix('certificationLevel', state.certificationLevel ? CERTIFICATION_LABELS[state.certificationLevel] : null),
    ],
    [
      'Niveau visé',
      choix(
        'niveauFormationVise',
        state.niveauFormationVise ? NIVEAU_CERTIFICATION_LABELS[state.niveauFormationVise] : null,
      ),
    ],
    ['Éligible au CPF', ouiNon('eligibleCpf', state.eligibleCpf)],
    ['Mode', state.trainingMode ? TRAINING_MODE_LABELS[state.trainingMode] : null],
    ['Durée', state.durationHours ? avecUnite(state.durationHours, 'h') : null],
    ...(groupe
      ? ([
          ['Coût total HT par personne', state.pedagogyCostTotal ? formatEuro(state.pedagogyCostTotal) : null],
          ['Coût total HT pour le groupe', coutGroupe ? formatEuro(coutGroupe) : null],
        ] as Ligne[])
      : ([['Coût total HT', state.pedagogyCostTotal ? formatEuro(state.pedagogyCostTotal) : null]] as Ligne[])),
    [
      groupe ? 'Coût horaire par personne' : 'Coût horaire',
      state.pedagogyCostPerHour ? `${formatEuro(state.pedagogyCostPerHour)}/h` : null,
    ],
    ['Début prévu', saisieDepuisMois(state.dateDebutFormation) || null],
    ['Organisme', state.organismeFormation],
    ['Organisme certifié Qualiopi', ouiNon('organismeQualiopi', state.organismeQualiopi)],
  ];

  const joursEstimes = state.durationHours ? Math.ceil(state.durationHours / 7) : 0;
  const avecFrais = state.needsTransport || state.needsAccommodation || state.needsMeals;
  const frais: Ligne[] = [
    ...(state.needsTransport
      ? ([
          ['Transport', state.transportMode ? TRANSPORT_LABELS[state.transportMode] : 'Oui'],
          ['Distance', state.transportDistanceKm != null ? avecUnite(state.transportDistanceKm, 'km') : null],
        ] as Ligne[])
      : []),
    ...(state.needsAccommodation
      ? ([
          ['Hébergement', state.accommodationNights ? pluriel(state.accommodationNights, 'nuit', 'nuits') : 'Oui'],
          ['Coût par nuit', state.accommodationCostPerNight != null ? formatEuro(state.accommodationCostPerNight) : null],
        ] as Ligne[])
      : []),
    ...(state.needsMeals
      ? ([['Restauration', state.mealCostPerDay != null ? `${formatEuro(state.mealCostPerDay)} par jour` : 'Oui']] as Ligne[])
      : []),
    [
      'Jours de formation',
      state.trainingDays
        ? pluriel(state.trainingDays, 'jour', 'jours')
        : joursEstimes > 0
          ? `${pluriel(joursEstimes, 'jour', 'jours')} (estimation, 7${INSECABLE}heures par jour)`
          : null,
    ],
  ];

  return (
    <div className="space-y-8">
      <EnTeteEtape
        etape="recap"
        titre="Récapitulatif"
        chapeau="Vérifiez vos informations avant de lancer la recherche de financements."
      />

      <div className="space-y-4">
        {/* « Objectif » plutôt que « Projet » : la ligne répétait le titre de la section. */}
        <Section
          titre="Projet"
          icone={ICONES_PROJET[projet]}
          onEdit={() => onEdit('projet')}
          lignes={[['Objectif', state.projetType ? PROJET_LABELS[state.projetType].label : null]]}
        />
        <Section titre="Entreprise" icone="batiment" onEdit={() => onEdit('identification')} lignes={entreprise} />
        {sectionsDesPersonnes.map((s) => (
          <Section key={s.titre} titre={s.titre} icone="personne" onEdit={() => onEdit('situation')} lignes={s.lignes} />
        ))}
        <Section titre="Formation" icone="livre" onEdit={() => onEdit('formation')} lignes={formation} />
        {avecFrais && <Section titre="Frais annexes" icone="euro" onEdit={() => onEdit('frais')} lignes={frais} />}
      </div>
    </div>
  );
}
```

Dans `apps/web/src/components/wizard/WizardContainer.tsx`, ajouter `groupe={groupe}` après `repondre={repondre}` dans l'appel de `StepFormation`, et remplacer

```tsx
            <StepRecap state={state} onEdit={goToStep} reponsesInconnues={reponsesInconnues} />
```

par

```tsx
            <StepRecap
              state={state}
              onEdit={goToStep}
              reponsesInconnues={reponsesInconnues}
              inconnuesProfils={inconnuesProfils}
            />
```

- [ ] **Step 6 : vérifier le typage, le lint et les gardes**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/web && npx tsc --noEmit`
Expected: aucune erreur. Un oubli fréquent : l'ancienne importation `ouvreBudgetOpco` de `StepFormation.tsx` ou de `StepRecap.tsx` (le typage la signale si elle reste inutilisée avec `noUnusedLocals`, le lint sinon).

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run lint --workspace web && npm run check:charte && npm run test:web`
Expected: tout vert.

- [ ] **Step 7 : vérifier dans le navigateur**

Démarrer le serveur de développement (`site-dev`, port 3100), puis, dans `http://localhost:3100/simulateur/` :

1. Une personne (parcours d'avant) : étapes Formation, Frais et Récapitulatif identiques à l'ancien (aucun « Le prix saisi est », « Coût total HT (€) », section « Participants » avec les mêmes lignes que l'ancienne section « Bénéficiaire »).
2. Trois salariés (étape Participants, compteur à 3) : à l'étape Formation, « Le prix saisi est » avec « Par personne » choisi et le champ « Coût total HT par personne (€) ». Saisir `2800` : l'aide dit « Soit 8 400 € pour les 3 personnes. ». Choisir « Pour le groupe » : le champ montre 8 400, le libellé devient « Coût total HT pour le groupe (€) », l'aide dit « Soit 2 800 € par personne. ». Revenir à « Par personne » : 2 800. Saisir une durée de 35 : « Coût horaire calculé, par personne : 80 €/h ».
3. Étape Frais : le chapeau cite les 3 personnes.
4. Étape Entreprise avec un groupe « 1 salarié + 1 dirigeant » : l'OPCO est requis (astérisque) et le budget déjà consommé s'affiche ; avec deux dirigeants : l'OPCO est facultatif.
5. Récapitulatif d'un groupe de deux profils : une section « Participants » (« 5 personnes, 2 profils »), « Profil 1 » et « Profil 2 » (personnes, statut, réponses), la section Formation avec « Coût total HT par personne » et « Coût total HT pour le groupe » ; « Modifier » mène à l'étape Participants.
6. 375 px de large : aucun défilement horizontal, aucun mot coupé.

Noter toute différence avant de poursuivre ; arrêter le serveur ensuite.

- [ ] **Step 8 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add apps/web/src/lib/groupe.ts apps/web/tests/groupe.test.ts apps/web/src/components/wizard/StepFormation.tsx apps/web/src/components/wizard/StepFrais.tsx apps/web/src/components/wizard/StepIdentification.tsx apps/web/src/components/wizard/StepRecap.tsx apps/web/src/components/wizard/WizardContainer.tsx
git commit -m "$(cat <<'EOF'
site : prix par personne ou pour le groupe, frais, entreprise et récapitulatif d'un groupe

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15 : Écran de résultats d'un groupe (bandeau, plan, détail par profil, aides, détail de l'OPCO)

**Files:**
- Modify: `apps/web/src/lib/resultats.ts` (`concerneAAfficher`)
- Modify: `apps/web/tests/resultats-groupe.test.ts`
- Create: `apps/web/src/components/results/ParProfil.tsx`
- Modify: `apps/web/src/components/results/BandeauSynthese.tsx`
- Modify: `apps/web/src/components/results/PlanFinancement.tsx`
- Modify: `apps/web/src/components/results/AideCard.tsx`
- Modify: `apps/web/src/components/results/AidesList.tsx`
- Modify: `apps/web/src/components/results/FundingBreakdown.tsx`
- Modify (réécriture): `apps/web/src/components/results/EcranResultats.tsx`

**Interfaces:**
- Consumes (`lib/resultats.ts`, tâche 11) : `BlocResultat`, `LigneParProfil`, `NoteOpco`, `calculer(...).groupe`, `notesOpco`, `detailsDuBandeau`, `pourPersonnes`, `mentionOpcoDuGroupe`, `lignesParProfil`, `libellesDesProfils`, `concerneParAide` ; `LignePlan.personnes?`, `FundingResult.personnes`, `AideEvaluee.profils?` (cœur).
- Produces: `concerneAAfficher(aide: Pick<AideEvaluee, 'profils' | 'statut'>, nombreDeProfils: number, libelles: ReadonlyMap<string, string>): string[]` ; `ParProfil({ blocs })` ; propriétés facultatives `personnes?: number` sur `BandeauSynthese`, `PlanFinancementCard` et `AidesList`, `libelles?` sur `AidesList`, `parPersonne?` et `concerne?` sur `AideCard`.

L'écran garde ses composants : un groupe n'ajoute que le détail par profil, des mentions « pour N personnes » et le bloc « Concerne ». Pour une personne seule, aucune de ces mentions n'apparaît (`personnes` vaut 1, `profils` est absent des aides, un seul bloc).

- [ ] **Step 1 : écrire le test qui échoue**

Dans `apps/web/tests/resultats-groupe.test.ts`, ajouter `concerneAAfficher` à l'importation de `../src/lib/resultats`, puis ajouter à la fin du fichier :

```ts
describe('bloc « Concerne » d’une carte d’aide (concerneAAfficher)', () => {
  const libelles = new Map([
    ['principal', 'Profil 1 · Salarié en CDI'],
    ['profil-2', 'Profil 2 · Dirigeant artisan'],
  ]);
  const vue = (profilId: string, nombre: number, statut: 'eligible' | 'a_verifier') => ({ profilId, nombre, statut, montantEstime: null });

  test('rien sans champ profils (un seul profil), ni quand tous les profils sont concernés au même statut', () => {
    assert.deepEqual(concerneAAfficher({ statut: 'eligible' }, 1, libelles), []);
    assert.deepEqual(
      concerneAAfficher({ statut: 'eligible', profils: [vue('principal', 3, 'eligible'), vue('profil-2', 1, 'eligible')] }, 2, libelles),
      [],
    );
  });

  test('un profil au moins n’est pas concerné : le bloc nomme les profils concernés', () => {
    assert.deepEqual(concerneAAfficher({ statut: 'eligible', profils: [vue('profil-2', 1, 'eligible')] }, 2, libelles), [
      `Profil 2 · Dirigeant artisan, 1${nb}personne${nb}: éligible`,
    ]);
  });

  test('tous les profils sont concernés mais pas au même statut : le bloc dit le statut de chacun', () => {
    assert.deepEqual(
      concerneAAfficher({ statut: 'eligible', profils: [vue('principal', 3, 'eligible'), vue('profil-2', 1, 'a_verifier')] }, 2, libelles),
      [`Profil 1 · Salarié en CDI, 3${nb}personnes${nb}: éligible`, `Profil 2 · Dirigeant artisan, 1${nb}personne${nb}: à vérifier`],
    );
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && node --import tsx --test apps/web/tests/resultats-groupe.test.ts`
Expected: FAIL (`concerneAAfficher` n'est pas exporté).

- [ ] **Step 3 : écrire la fonction**

Dans `apps/web/src/lib/resultats.ts`, ajouter à la fin du fichier :

```ts

/**
 * Lignes du bloc « Concerne » d'une carte d'aide d'un groupe de `nombreDeProfils` profils : vides quand l'aide vaut, au
 * statut qu'affiche la carte, pour tous les profils (rien à préciser) ; sinon une ligne par profil concerné
 * (`concerneParAide`).
 */
export function concerneAAfficher(
  aide: Pick<AideEvaluee, 'profils' | 'statut'>,
  nombreDeProfils: number,
  libelles: ReadonlyMap<string, string>,
): string[] {
  const profils = aide.profils ?? [];
  const partout = profils.length === nombreDeProfils && profils.every((p) => p.statut === aide.statut);
  return profils.length === 0 || partout ? [] : concerneParAide(aide, libelles);
}
```

- [ ] **Step 4 : vérifier que le test passe**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && node --import tsx --test apps/web/tests/resultats-groupe.test.ts`
Expected: PASS.

- [ ] **Step 5 : le détail par profil**

Créer `apps/web/src/components/results/ParProfil.tsx` :

```tsx
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { formatEuro, nombreEtUnite, typo } from '@/lib/format';
import { lignesParProfil } from '@/lib/resultats';
import type { BlocResultat, LigneParProfil } from '@/lib/resultats';

const ID_TITRE = 'titre-par-profil';

const personnes = (n: number): string => nombreEtUnite(n, n > 1 ? 'personnes' : 'personne');

/** Les trois montants d'un profil sous 640 px : coût, financé, reste à charge. */
function Montants({ ligne }: { ligne: Pick<LigneParProfil, 'cout' | 'finance' | 'reste'> }) {
  return (
    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <div>
        <dt className="text-texte-discret">Coût</dt>
        <dd className="amount mt-0.5 text-texte">{formatEuro(ligne.cout)}</dd>
      </div>
      <div>
        <dt className="text-texte-discret">Financé</dt>
        <dd className="amount mt-0.5 text-turquoise-deep">{formatEuro(ligne.finance)}</dd>
      </div>
      <div>
        <dt className="text-texte-discret">Reste à charge</dt>
        <dd className="amount mt-0.5 text-orange-deep">{formatEuro(ligne.reste)}</dd>
      </div>
    </dl>
  );
}

/**
 * Détail par profil d'un groupe de plusieurs profils : coût, financé et reste à charge de chacun, puis le total. Les
 * chiffres sont ceux du plan de chaque profil (`lignesParProfil`), jamais recalculés ici. À partir de 640 px et à
 * l'impression, un tableau (une ligne ne se coupe pas entre deux pages) ; en dessous, un bloc empilé par profil. Un seul
 * profil : rien (le bandeau dit déjà tout).
 */
export function ParProfil({ blocs }: { blocs: readonly Pick<BlocResultat, 'profil' | 'plan'>[] }) {
  if (blocs.length < 2) return null;
  const { lignes, total } = lignesParProfil(blocs);
  return (
    <section aria-labelledby={ID_TITRE} className="space-y-6">
      <SectionTitle
        as="h2"
        taille="sous-section"
        id={ID_TITRE}
        surtitre="Groupe"
        titre="Détail par profil"
        chapeau="Coût, financement et reste à charge de chaque profil, pour toutes ses personnes."
      />
      <Card padding="none" className="overflow-hidden break-inside-avoid">
        <ul role="list" className="divide-y divide-filet sm:hidden print:hidden">
          {lignes.map((l) => (
            <li key={l.id} className="px-4 py-4">
              <p className="font-semibold text-texte">
                Profil {l.rang}, {personnes(l.nombre)}
              </p>
              <p className="mt-0.5 text-sm text-texte-doux">{typo(l.libelle)}</p>
              <Montants ligne={l} />
            </li>
          ))}
          <li className="bg-lin-soft px-4 py-4">
            <p className="font-semibold text-texte">Total, {personnes(total.nombre)}</p>
            <Montants ligne={total} />
          </li>
        </ul>

        <table className="hidden w-full border-collapse text-sm sm:table print:table">
          <caption className="sr-only">Coût, financement et reste à charge de chaque profil du groupe</caption>
          <thead>
            <tr className="border-b border-filet text-xs tracking-[0.08em] text-texte-discret uppercase">
              <th scope="col" className="px-6 py-3 text-left font-semibold">
                Profil
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Personnes
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Coût
              </th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">
                Financé
              </th>
              <th scope="col" className="px-6 py-3 text-right font-semibold">
                Reste à charge
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-filet">
            {lignes.map((l) => (
              <tr key={l.id} className="break-inside-avoid">
                <th scope="row" className="px-6 py-4 text-left align-top font-normal">
                  <span className="block font-semibold text-texte">Profil {l.rang}</span>
                  <span className="mt-0.5 block text-texte-doux">{typo(l.libelle)}</span>
                </th>
                <td className="amount px-3 py-4 text-right align-top text-texte">{l.nombre}</td>
                <td className="amount px-3 py-4 text-right align-top text-texte">{formatEuro(l.cout)}</td>
                <td className="amount px-3 py-4 text-right align-top text-turquoise-deep">{formatEuro(l.finance)}</td>
                <td className="amount px-6 py-4 text-right align-top text-orange-deep">{formatEuro(l.reste)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="break-inside-avoid border-t-2 border-filet-fort bg-lin-soft">
              <th scope="row" className="px-6 py-4 text-left font-semibold text-texte">
                Total
              </th>
              <td className="amount px-3 py-4 text-right text-texte">{total.nombre}</td>
              <td className="amount px-3 py-4 text-right text-texte">{formatEuro(total.cout)}</td>
              <td className="amount px-3 py-4 text-right text-turquoise-deep">{formatEuro(total.finance)}</td>
              <td className="amount px-6 py-4 text-right text-orange-deep">{formatEuro(total.reste)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </section>
  );
}
```

- [ ] **Step 6 : le bandeau et les lignes du plan**

Dans `apps/web/src/components/results/BandeauSynthese.tsx` :

1. Remplacer `import { partFinancee, partsBarre } from '@/lib/resultats';` par `import { detailsDuBandeau, partFinancee, partsBarre } from '@/lib/resultats';`.

2. Dans la signature de `BandeauSynthese`, remplacer

```tsx
  planFerme,
  avecPortail,
  onModifierFormation,
}: {
```

par

```tsx
  planFerme,
  avecPortail,
  personnes = 1,
  onModifierFormation,
}: {
```

et remplacer

```tsx
  avecPortail: boolean;
  onModifierFormation?: () => void;
}) {
  // Coût inconnu ou plan chiffré par d'autres financeurs : la raison du plan fermé dans un encadré à part.
```

par

```tsx
  avecPortail: boolean;
  /** Personnes du groupe : à partir de deux, le coût et le reste à charge portent un détail par personne (`detailsDuBandeau`). */
  personnes?: number;
  onModifierFormation?: () => void;
}) {
  // Coût inconnu ou plan chiffré par d'autres financeurs : la raison du plan fermé dans un encadré à part.
```

3. Remplacer

```tsx
          <AucunFinancementChiffre plan={plan} aides={aides} avecPortail={avecPortail} planFerme={planFerme} />
```

par

```tsx
          <AucunFinancementChiffre
            plan={plan}
            aides={aides}
            avecPortail={avecPortail}
            planFerme={planFerme}
            personnes={personnes}
          />
```

et remplacer

```tsx
            relais={relais}
            encadreFerme={encadreFerme}
          />
```

par

```tsx
            relais={relais}
            encadreFerme={encadreFerme}
            personnes={personnes}
          />
```

4. Dans `AucunFinancementChiffre`, remplacer

```tsx
  avecPortail,
  planFerme,
}: {
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  avecPortail: boolean;
  planFerme: PlanFerme | null;
}) {
```

par

```tsx
  avecPortail,
  planFerme,
  personnes,
}: {
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  avecPortail: boolean;
  planFerme: PlanFerme | null;
  personnes: number;
}) {
```

et remplacer

```tsx
        <Chiffre libelle="Coût de la formation" valeur={formatEuro(plan.coutFormation)} />
      </dl>
      <Callout tone="info" className="mt-5">
```

par

```tsx
        <Chiffre
          libelle="Coût de la formation"
          valeur={formatEuro(plan.coutFormation)}
          detail={detailsDuBandeau(plan, personnes).cout ?? undefined}
        />
      </dl>
      <Callout tone="info" className="mt-5">
```

5. Dans `PlanChiffre`, remplacer

```tsx
  relais,
  encadreFerme,
}: {
  plan: PlanFinancement;
  parts: PartBarre[];
```

par

```tsx
  relais,
  encadreFerme,
  personnes,
}: {
  plan: PlanFinancement;
  parts: PartBarre[];
```

remplacer

```tsx
  encadreFerme: ReactNode;
}) {
  const part = partFinancee(parts);
```

par

```tsx
  encadreFerme: ReactNode;
  personnes: number;
}) {
  const part = partFinancee(parts);
  const details = detailsDuBandeau(plan, personnes);
```

remplacer

```tsx
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
        <Chiffre libelle="Coût de la formation" valeur={formatEuro(plan.coutFormation)} />
```

par

```tsx
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
        <Chiffre
          libelle="Coût de la formation"
          valeur={formatEuro(plan.coutFormation)}
          detail={details.cout ?? undefined}
        />
```

et remplacer

```tsx
        <Chiffre libelle="Reste à charge" valeur={formatEuro(plan.resteACharge)} couleur="text-orange-deep" />
```

par

```tsx
        <Chiffre
          libelle="Reste à charge"
          valeur={formatEuro(plan.resteACharge)}
          detail={details.reste ?? undefined}
          couleur="text-orange-deep"
        />
```

Dans `apps/web/src/components/results/PlanFinancement.tsx` :

1. Remplacer `import { cartesDuPlan, confianceDOption, etatEnTete, financeurDeLigne, libellesDeLigne } from '@/lib/resultats';` par

```tsx
import {
  cartesDuPlan,
  confianceDOption,
  etatEnTete,
  financeurDeLigne,
  libellesDeLigne,
  pourPersonnes,
} from '@/lib/resultats';
```

2. Dans `PlanFinancementCard`, remplacer

```tsx
  avecPortail = false,
  apresBandeau,
  onModifierFormation,
}: {
```

par

```tsx
  avecPortail = false,
  personnes = 1,
  apresBandeau,
  onModifierFormation,
}: {
```

remplacer

```tsx
  avecPortail?: boolean;
  /** Note posée juste après le bandeau
```

par

```tsx
  avecPortail?: boolean;
  /** Personnes du groupe : au-dessus de 1, le bandeau détaille par personne et la carte des options dit que ses montants sont ceux du groupe. */
  personnes?: number;
  /** Note posée juste après le bandeau
```

remplacer

```tsx
        avecPortail={avecPortail}
        onModifierFormation={onModifierFormation}
      />
      {apresBandeau}
```

par

```tsx
        avecPortail={avecPortail}
        personnes={personnes}
        onModifierFormation={onModifierFormation}
      />
      {apresBandeau}
```

et remplacer

```tsx
          relais={relais}
          style={delai(120 + i * 70)}
        />
```

par

```tsx
          relais={relais}
          groupe={personnes > 1}
          style={delai(120 + i * 70)}
        />
```

3. Dans `CarteDuPlan`, remplacer

```tsx
  dispositifs,
  relais,
  style,
}: {
  carte: CartePlan;
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  dispositifs: readonly DispositifEligible[];
  relais: RelaisPlanConventionnel | null;
  style: CSSProperties;
}) {
  const { titre, icone, aide } = CARTES[carte];
```

par

```tsx
  dispositifs,
  relais,
  groupe,
  style,
}: {
  carte: CartePlan;
  plan: PlanFinancement;
  aides: readonly AideEvaluee[];
  dispositifs: readonly DispositifEligible[];
  relais: RelaisPlanConventionnel | null;
  /** Le plan est celui d'un groupe de plusieurs personnes. */
  groupe: boolean;
  style: CSSProperties;
}) {
  const { titre, icone, aide } = CARTES[carte];
  // Les options n'ont pas de ligne « pour N personnes » : leur carte dit que ses montants sont ceux de tout le groupe.
  const aideAffichee = carte === 'options' && groupe ? `${aide} Les montants sont ceux de tout le groupe.` : aide;
```

et remplacer `<p className="mt-1 text-sm leading-relaxed text-texte-doux">{typo(aide)}</p>` par `<p className="mt-1 text-sm leading-relaxed text-texte-doux">{typo(aideAffichee)}</p>`.

4. Remplacer la fonction `Identite` et son commentaire (de `/** Nom, financeur et fiabilité d'une ligne chiffrée. */` jusqu'à l'accolade fermante de la fonction) par :

```tsx
/** Nom, financeur, nombre de personnes (plan d'un groupe) et fiabilité d'une ligne chiffrée. */
function Identite({
  nom,
  financeurNom,
  confidence,
  personnes,
}: {
  nom: string;
  financeurNom: string;
  confidence?: Confidence;
  /** Pour combien de personnes la ligne vaut : renseigné seulement dans le plan d'un groupe. */
  personnes?: number;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="leading-snug font-semibold text-texte">{typo(nom)}</p>
      <p className="mt-0.5 text-sm leading-snug text-texte-doux">{typo(financeurNom)}</p>
      {personnes != null && <p className="mt-0.5 text-sm leading-snug text-texte-discret">{pourPersonnes(personnes)}</p>}
      {confidence && <Fiabilite confidence={confidence} />}
    </div>
  );
}
```

5. Remplacer `<Identite {...libellesDeLigne(l, relais)} confidence={l.confidence} />` par `<Identite {...libellesDeLigne(l, relais)} confidence={l.confidence} personnes={l.personnes} />`, et `<Identite nom={l.nom} financeurNom={l.financeurNom} confidence={l.confidence} />` par `<Identite nom={l.nom} financeurNom={l.financeurNom} confidence={l.confidence} personnes={l.personnes} />`.

- [ ] **Step 7 : les cartes d'aides et le détail de l'OPCO**

Dans `apps/web/src/components/results/AideCard.tsx` :

1. Remplacer

```tsx
export function AideCard({
  aide,
  nomParId,
  sigles,
}: {
  aide: AideEvaluee;
  nomParId: ReadonlyMap<string, string>;
  /** Sigles à définir dans le titre (`siglesDesTitres` : une seule carte par écran pour chaque sigle). */
  sigles?: Readonly<Record<string, string>>;
}) {
```

par

```tsx
export function AideCard({
  aide,
  nomParId,
  sigles,
  parPersonne = false,
  concerne = [],
}: {
  aide: AideEvaluee;
  nomParId: ReadonlyMap<string, string>;
  /** Sigles à définir dans le titre (`siglesDesTitres` : une seule carte par écran pour chaque sigle). */
  sigles?: Readonly<Record<string, string>>;
  /** Le groupe compte plusieurs personnes : le montant de l'aide est dit « par personne ». */
  parPersonne?: boolean;
  /** Bloc « Concerne » (`concerneAAfficher`) : un profil par ligne ; vide, pas de bloc. */
  concerne?: readonly string[];
}) {
```

2. Remplacer `{montant && <MontantDeLAide montant={montant} />}` par `{montant && <MontantDeLAide montant={montant} parPersonne={parPersonne} />}`.

3. Remplacer

```tsx
        {aide.description && <p className="mt-2 text-sm leading-relaxed text-texte-doux">{texte(aide.description)}</p>}

        {aide.statut === 'a_verifier' && aide.raisons.length > 0 && (
```

par

```tsx
        {aide.description && <p className="mt-2 text-sm leading-relaxed text-texte-doux">{texte(aide.description)}</p>}

        {concerne.length > 0 && (
          <div className="mt-4 rounded-champ border border-filet bg-lin-soft px-4 py-3">
            <p className="text-sm font-semibold text-texte">Concerne</p>
            <ul className="mt-1.5 space-y-0.5">
              {concerne.map((ligne) => (
                <li key={ligne} className="flex gap-2.5 text-sm leading-relaxed text-texte-doux">
                  <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-texte-doux" />
                  <span className={TEXTE_SOUPLE}>{ligne}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {aide.statut === 'a_verifier' && aide.raisons.length > 0 && (
```

4. Remplacer la fonction `MontantDeLAide` (de `function MontantDeLAide(` jusqu'à l'accolade fermante de la fonction) par :

```tsx
function MontantDeLAide({ montant, parPersonne }: { montant: MontantAffiche; parPersonne: boolean }) {
  if (montant.genre === 'jusqua') {
    return (
      <p className="shrink-0 sm:text-right">
        <span className="block text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">jusqu&apos;à</span>
        <span className="amount mt-0.5 block text-2xl text-texte sm:text-[1.75rem]">{formatEuro(montant.montant)}</span>
        {parPersonne && <span className="mt-0.5 block text-xs font-medium text-texte-discret">par personne</span>}
      </p>
    );
  }
  return (
    <p className="shrink-0 text-sm leading-snug font-semibold text-texte-doux sm:max-w-[11rem] sm:text-right">
      {montant.genre === 'selon_dossier' ? 'Montant selon dossier' : 'Aucun montant estimé pour ce profil'}
    </p>
  );
}
```

Dans `apps/web/src/components/results/AidesList.tsx` :

1. Remplacer `import { aidesNonEligiblesAffichees, groupesAidesVisibles, siglesDesTitres } from '@/lib/resultats';` par

```tsx
import { aidesNonEligiblesAffichees, concerneAAfficher, groupesAidesVisibles, siglesDesTitres } from '@/lib/resultats';
```

2. Remplacer `import { PastilleFinanceur } from './Financeur';` par

```tsx
import { PastilleFinanceur } from './Financeur';

/** Aucun profil à nommer : une personne seule ou un seul profil. */
const AUCUN_LIBELLE: ReadonlyMap<string, string> = new Map();
```

3. Remplacer `export function AidesList({ aides, avecPortail }: { aides: readonly AideEvaluee[]; avecPortail: boolean }) {` par

```tsx
export function AidesList({
  aides,
  avecPortail,
  personnes = 1,
  libelles = AUCUN_LIBELLE,
}: {
  aides: readonly AideEvaluee[];
  avecPortail: boolean;
  /** Personnes du groupe : au-dessus de 1, le montant d'une aide est dit « par personne ». */
  personnes?: number;
  /** Libellé de chaque profil (`libellesDesProfils`) : avec plusieurs profils, une carte précise lesquels elle concerne. */
  libelles?: ReadonlyMap<string, string>;
}) {
```

4. Remplacer

```tsx
            sigles={sigles}
            style={delai(i * 60, 360)}
          />
```

par

```tsx
            sigles={sigles}
            personnes={personnes}
            libelles={libelles}
            style={delai(i * 60, 360)}
          />
```

5. Remplacer

```tsx
  nomParId,
  sigles,
  style,
}: {
  groupe: GroupeAides;
  nomParId: ReadonlyMap<string, string>;
  sigles: ReadonlyMap<string, Readonly<Record<string, string>>>;
  style: CSSProperties;
}) {
```

par

```tsx
  nomParId,
  sigles,
  personnes,
  libelles,
  style,
}: {
  groupe: GroupeAides;
  nomParId: ReadonlyMap<string, string>;
  sigles: ReadonlyMap<string, Readonly<Record<string, string>>>;
  personnes: number;
  libelles: ReadonlyMap<string, string>;
  style: CSSProperties;
}) {
```

6. Remplacer `<AideCard aide={a} nomParId={nomParId} sigles={sigles.get(a.id)} />` par

```tsx
            <AideCard
              aide={a}
              nomParId={nomParId}
              sigles={sigles.get(a.id)}
              parPersonne={personnes > 1}
              concerne={concerneAAfficher(a, libelles.size, libelles)}
            />
```

Dans `apps/web/src/components/results/FundingBreakdown.tsx` : remplacer `import { dispositifAffiche, lignesDuDetail, sansMontantEstime } from '@/lib/resultats';` par `import { dispositifAffiche, lignesDuDetail, pourPersonnes, sansMontantEstime } from '@/lib/resultats';`, puis remplacer

```tsx
            <p className="text-sm font-semibold text-texte-doux">Total estimé, tous postes</p>
```

par

```tsx
            <p className="text-sm font-semibold text-texte-doux">
              Total estimé, tous postes{result.personnes > 1 ? `, ${pourPersonnes(result.personnes)}` : ''}
            </p>
```

Remplacer **tout le contenu** de `apps/web/src/components/results/EcranResultats.tsx` par :

```tsx
'use client';

import { useEffect, useMemo } from 'react';
import { EMBEDDED_OPCOS } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { dateFr, moisAnneeFr, typo, verificationLaPlusRecente } from '@/lib/format';
import { ID_DETAIL_OPCO, fondsEpuisesSurLePlan, planFermeDe } from '@/lib/encadres-resultats';
import {
  calculer,
  chapeauDetailOpco,
  libellesDesProfils,
  mentionOpcoDuGroupe,
  notesOpco,
  relaisDuPlanConventionnel,
} from '@/lib/resultats';
import type { NoteOpco } from '@/lib/resultats';
import { AidesList } from './AidesList';
import { EnTeteResultats, ID_TITRE_RESULTATS, focaliserTitreResultats } from './EtatsResultats';
import type { ProprietesEcranResultats } from './EtatsResultats';
import { FundingBreakdown } from './FundingBreakdown';
import { ParProfil } from './ParProfil';
import { PlanFinancementCard } from './PlanFinancement';
import { PortailsRegionaux } from './PortailsRegionaux';

/**
 * Écran « Votre plan de financement », chargé à la demande par le parcours (`next/dynamic`) : le catalogue d'aides
 * (environ 149 Ko gzip) et tout le calcul restent hors du lot initial du simulateur. Le parcours ne lui passe que l'état
 * et deux actions ; le calcul est une dérivation pure de l'état (aucune mise à jour d'état pendant le rendu). Un groupe de
 * plusieurs personnes ajoute à l'écran le détail par profil, les mentions « pour N personnes » et le bloc « Concerne » des
 * aides ; pour une personne seule, l'écran est celui d'avant les groupes.
 */

/** Date du jour à l'heure locale (AAAA-MM-JJ) : référence de validité des aides et date de la simulation imprimée. */
function aujourdhuiLocal(): string {
  const d = new Date();
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** Vérification la plus récente des barèmes des OPCO, la même que le pied de page. */
const VERIFICATION_OPCO = verificationLaPlusRecente(EMBEDDED_OPCOS);

export function EcranResultats({ state, onEdit, onReset }: ProprietesEcranResultats) {
  // Le titre n'existait pas quand le parcours a affiché les résultats (code chargé à la demande) : l'écran pose le focus
  // sur son titre dès son montage.
  useEffect(focaliserTitreResultats, []);

  // Calcul (lib/resultats.ts) : dérivation pure de l'état, à la date du jour lue ici.
  const { opco, funding, variante, aidesEvaluees, plan, portail, groupe, aujourdhui } = useMemo(() => {
    const jour = aujourdhuiLocal();
    return { ...calculer(state, jour), aujourdhui: jour };
  }, [state]);

  // Chapeau du détail de l'OPCO : seulement avec le tableau des postes (jamais quand le plan est fermé), suivi, pour un
  // groupe, de pour qui le calcul est fait.
  const chapeauOpco = funding ? chapeauDetailOpco(funding) : null;
  const mentionGroupe = mentionOpcoDuGroupe(groupe.personnesPdc, groupe.personnes);
  const chapeauDetail = [chapeauOpco, mentionGroupe].filter((t): t is string => t != null).join(' ');
  // Plan conventionnel de la branche en relais d'un plan de développement des compétences épuisé (AKTO, organismes de
  // formation) ; plan fermé aux 50 salariés et plus. Le bandeau dit l'un et l'autre.
  const relais = relaisDuPlanConventionnel({ funding, variante });
  const profils = groupe.blocs.map((b) => b.profil);
  const libelles = libellesDesProfils(profils);
  const notes = notesOpco(
    profils.map((p) => p.champs.projetType),
    !opco,
  );
  const assimileSalarie = profils.some(
    (p) => p.champs.projetType === 'formation_dirigeant' && p.champs.statutDirigeant === 'assimile_salarie',
  );

  return (
    <div className="space-y-12 sm:space-y-14">
      <section aria-labelledby={ID_TITRE_RESULTATS} className="space-y-6">
        {/* Même en-tête que l'attente du chargement (EtatsResultats.tsx) : rien ne bouge quand l'écran arrive. */}
        <EnTeteResultats state={state} onEdit={onEdit} />

        <PlanFinancementCard
          plan={plan}
          aides={aidesEvaluees}
          personnes={groupe.personnes}
          fondsEpuises={funding ? { opco: funding.opcoName, branches: fondsEpuisesSurLePlan(plan, funding.alertes) } : null}
          relais={relais}
          planFerme={planFermeDe(funding)}
          dispositifs={funding?.dispositifsComplementaires ?? []}
          avecPortail={portail != null}
          apresBandeau={<NotesOpco notes={notes} assimileSalarie={assimileSalarie} onEdit={onEdit} />}
          onModifierFormation={() => onEdit('formation')}
        />
      </section>

      <ParProfil blocs={groupe.blocs} />

      <AidesList aides={aidesEvaluees} avecPortail={portail != null} personnes={groupe.personnes} libelles={libelles} />

      {funding && (
        <section aria-labelledby={ID_DETAIL_OPCO} className="space-y-6">
          <SectionTitle
            as="h2"
            taille="sous-section"
            id={ID_DETAIL_OPCO}
            surtitre={typo(`Votre OPCO : ${funding.opcoName}`)}
            titre="Détail de l'estimation OPCO"
            chapeau={chapeauDetail ? typo(chapeauDetail) : undefined}
          />
          <FundingBreakdown result={funding} relais={relais} />
        </section>
      )}

      {portail && <PortailsRegionaux portail={portail} />}

      <div className="space-y-6 border-t border-filet pt-8">
        <div className="space-y-2">
          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-texte-doux">
            <Icon name="bouclier" className="mt-0.5 size-[18px] shrink-0 text-turquoise-deep" />
            <span>
              Estimation indicative fondée sur les règles publiées par chaque financeur&nbsp;: seul le financeur décide,
              après étude du dossier.
            </span>
          </p>
          <p className="text-xs text-texte-discret">
            Simulation du {dateFr(aujourdhui)}
            {VERIFICATION_OPCO && <> · barèmes des OPCO vérifiés en {moisAnneeFr(VERIFICATION_OPCO)}</>}.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap print:hidden">
          <Button variant="secondary" icone="crayon" onClick={() => onEdit('recap')}>
            Modifier mes informations
          </Button>
          <Button onClick={onReset}>Nouvelle simulation</Button>
          <Button variant="secondary" icone="document" onClick={() => window.print()}>
            Imprimer / PDF
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Notes posées sous le bandeau quand le plan ne compte pas le plan de développement des compétences de l'OPCO pour tout ou
 * partie du groupe (`notesOpco`, chaque note une fois) : soit l'OPCO d'un projet salarié manque (« Aucun OPCO renseigné »,
 * avec le retour à l'étape Entreprise), soit le groupe compte un dirigeant, que ce plan ne finance pas (fonds d'assurance
 * formation ; cas de l'assimilé salarié non calculé).
 */
function NotesOpco({
  notes,
  assimileSalarie,
  onEdit,
}: {
  notes: readonly NoteOpco[];
  assimileSalarie: boolean;
  onEdit: ProprietesEcranResultats['onEdit'];
}) {
  return (
    <>
      {notes.map((note) =>
        note.genre === 'dirigeant' ? (
          <Callout key={note.genre} tone="info" titre={note.titre}>
            {assimileSalarie ? (
              <>
                Un dirigeant assimilé salarié peut relever du plan de développement des compétences de sa branche, que le
                simulateur ne calcule pas&nbsp;: interrogez l&apos;OPCO de l&apos;entreprise.
              </>
            ) : (
              <>
                Le plan de développement des compétences d&apos;un OPCO finance la formation des salariés. Celle d&apos;un
                dirigeant non salarié relève de son fonds d&apos;assurance formation, compté dans le plan quand son aide
                est éligible.
              </>
            )}
          </Callout>
        ) : (
          <Callout key={note.genre} tone="info" titre={note.titre}>
            <p>
              Le plan ne compte pas encore le plan de développement des compétences de l&apos;OPCO, souvent le premier
              financeur d&apos;une formation de salarié. Indiquez l&apos;OPCO de l&apos;entreprise pour l&apos;estimer.
            </p>
            <div className="mt-3 print:hidden">
              <Button variant="secondary" icone="batiment" onClick={() => onEdit('identification')}>
                Indiquer l&apos;OPCO
              </Button>
            </div>
          </Callout>
        ),
      )}
    </>
  );
}
```

- [ ] **Step 8 : vérifier le typage, le lint et les gardes**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/web && npx tsc --noEmit`
Expected: aucune erreur. `profil`, `projet` et `NoteOpco` (ancien composant) ne sont plus utilisés dans `EcranResultats.tsx` : le typage signale tout reste.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && npm run lint --workspace web && npm run check:charte && npm run test:web`
Expected: tout vert, y compris `modules.test.ts` (une seule définition des briques partagées : le compteur réutilise `CHAMP`, aucune copie) et `jsx-espaces.test.ts`. Le catalogue d'aides reste hors du lot initial tant que seuls `EcranResultats` et ses composants importent `lib/resultats` : `ParProfil` n'est importé que par `EcranResultats`, et la mesure du build (tâche 16) le confirme.

- [ ] **Step 9 : vérifier dans le navigateur**

Démarrer le serveur de développement (`site-dev`, port 3100), puis dans `http://localhost:3100/simulateur/` :

1. **Une personne** (AKTO, Île-de-France, moins de 11 salariés, CDI, 35 ans, certification, 140 h, 4 200 €) : l'écran est celui d'avant (aucun « 4 × », aucun « pour N personnes », aucune section « Détail par profil », aucun « par personne » sur les aides). Comparer à une capture du site de la branche `feature/aides-financements` si un doute subsiste.
2. **Quatre salariés identiques** : sous « Coût de la formation », « 4 × 4 200 € » ; sous « Reste à charge », « … par personne en moyenne » ; chaque ligne du plan dit « pour 4 personnes » sous le nom du financeur ; les cartes d'aides disent « par personne » sous « jusqu'à » ; le chapeau du détail de l'OPCO dit « Calcul pour les 4 personnes du groupe. » et la carte de total « Total estimé, tous postes, pour 4 personnes » ; pas de section « Détail par profil » (un seul profil).
3. **Trois salariés et un dirigeant artisan** : section « Détail par profil » (tableau Profil / Personnes / Coût / Financé / Reste à charge et ligne « Total ») ; la note « OPCO non compté pour le dirigeant du groupe » ; la carte FAFCEA porte le bloc « Concerne » (« Profil 2 · Dirigeant artisan, … 1 personne : éligible ») ; le chapeau du détail de l'OPCO dit « Calcul pour les 3 salariés du groupe (4 personnes au total). ».
4. **Groupe sans OPCO connu** : la note « Aucun OPCO renseigné » et son bouton « Indiquer l'OPCO » (un clic ramène à l'étape Entreprise).
5. **Largeurs** : 320, 375, 768 et 1 280 px (`resize_window`) : aucun défilement horizontal ; sous 640 px le détail par profil est une liste de blocs empilés (coût, financé, reste), au-delà un tableau.
6. **Impression** : émuler le média d'impression si l'outil le permet (outil `emulate` de Chrome DevTools) et vérifier que le tableau « Détail par profil » est entier et qu'aucune ligne ne se coupe ; sinon, le dire dans le compte rendu de la tâche.
7. **Clavier et arbre d'accessibilité** : le tableau a une légende (« Coût, financement et reste à charge de chaque profil du groupe »), ses en-têtes de colonne et de ligne ; le bloc « Concerne » est une liste.

Noter toute différence avant de poursuivre ; arrêter le serveur ensuite.

- [ ] **Step 10 : commit**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add apps/web/src/lib/resultats.ts apps/web/tests/resultats-groupe.test.ts apps/web/src/components/results/ParProfil.tsx apps/web/src/components/results/BandeauSynthese.tsx apps/web/src/components/results/PlanFinancement.tsx apps/web/src/components/results/AideCard.tsx apps/web/src/components/results/AidesList.tsx apps/web/src/components/results/FundingBreakdown.tsx apps/web/src/components/results/EcranResultats.tsx
git commit -m "$(cat <<'EOF'
site : écran de résultats d'un groupe (détail par profil, mentions pour N personnes, bloc Concerne, notes de l'OPCO)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16 : Documentation, vérifications complètes et passage final dans le navigateur

**Files:**
- Modify: `apps/web/DESIGN.md` (sections 14 et 15)
- Modify: `README.md` (parcours, nouvelle sous-section, tableau « Vérifications », limites connues)
- Modify: `docs/deploiement-site.md` (liste de contrôle du simulateur)
- Modify: `apps/web/src/lib/parcours.ts` et `apps/web/tests/parcours.test.ts` (deux commentaires qui disent encore « Bénéficiaire »)

**Interfaces:** aucune. Cette tâche ne change aucun comportement ; elle met les documents à jour, mesure et vérifie.

- [ ] **Step 1 : le vocabulaire des commentaires**

Dans `apps/web/src/lib/parcours.ts`, remplacer `Questions de l'étape « Bénéficiaire » propres à un statut` par `Questions de l'étape « Participants » propres à un statut`. Dans `apps/web/tests/parcours.test.ts`, remplacer `(étape Bénéficiaire)` par `(étape Participants)`.

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && grep -rn "Bénéficiaire" apps/web/src apps/web/tests packages/core/src README.md apps/web/DESIGN.md docs/deploiement-site.md docs/integration-wordpress.md docs/donnees-aides.md apps/web/README.md`
Expected: plus aucune occurrence du mot comme nom d'étape du site. Le mot « bénéficiaire » (minuscule) reste dans le moteur et les données, où il désigne la personne formée : ne pas le renommer.

- [ ] **Step 2 : `apps/web/DESIGN.md`, section 14 (parcours du simulateur)**

Vérifier l'unicité de chaque ligne d'ancrage avec `grep -n` avant de la remplacer.

1. Avant la ligne `- **Largeurs étroites** : sous 360 px, les grilles de choix courts à deux colonnes (régions, modes de transport) passent`, insérer (même retrait que les autres puces) :

```
- **Étape Participants** (`StepSituation`, `CarteProfil`, `FormulaireProfil`, `CompteurPersonnes`) : avec un seul
  profil, l'étape garde l'allure d'une personne seule (les questions de son statut) et ajoute le compteur « Nombre de
  personnes » et le bouton secondaire « Ajouter un profil différent ». Dès qu'il y a plusieurs profils, une `Card` par
  profil : titre `h3` que le focus atteint par programme (« Profil 2 »), étiquette du statut, résumé d'une ligne
  (`libelleDuProfil` : « Salarié en CDI, 35 ans »), compteur, puis les questions dans un volet qui se replie sur son
  résumé (`aria-expanded` ; le volet reste dans la page, `hidden`, et ses champs gardent leur état). Un seul profil est
  déplié à la fois ; replié, un profil dit ce qui lui manque (« À compléter : le type de contrat », `manquantsDuProfil`).
  Le compteur est un champ texte entier de 1 à 99 entre deux boutons ronds de 44 px (« Retirer une personne », « Ajouter
  une personne », `aria-disabled` aux bornes pour que le focus ne se perde pas) ; une saisie refusée (vide, zéro,
  négatif, décimal, texte) laisse la valeur retenue, que le champ reprend en le quittant (`lireEffectif`). Une zone
  `role="status"` annonce « Profil 2 ajouté. 4 personnes au total. » ; le focus va au titre du profil ajouté puis, au
  retrait, à celui du profil précédent (au bouton d'ajout quand il ne reste qu'un profil). À 6 profils ou 99 personnes,
  le bouton porte `aria-disabled` et une phrase dit la limite. Un profil supplémentaire commence par le choix de son
  statut ; en changer remet à vide les réponses du statut quitté (`champsDepuisProjet`).
- **Prix d'un groupe** (étape Formation) : à partir de deux personnes, « Le prix saisi est » propose « Par personne »
  (par défaut) et « Pour le groupe » ; le libellé du coût suit le mode et une aide donne le prix de l'autre
  (`aideDuPrix` : « Soit 2 800 € par personne. »). Changer de mode convertit le prix sans le ressaisir
  (`basculerModePrix`). Le coût horaire, le plafond indicatif et l'avertissement de dépassement sont ceux d'une personne
  et le disent. L'état garde `prixDuGroupe` tant qu'un prix de groupe est saisi ; `pedagogyCostTotal` reste le coût
  d'une personne, que le moteur lit (`normaliserGroupe`, `etatDepuisPrix`, `lib/groupe.ts`). Les frais annexes saisis
  sont ceux d'une personne, comptés pour chacune.
```

2. Remplacer la ligne `  (\`etatDepuisProjet\`), besoins de frais et nombre de jours quand l'étape Frais est sautée (\`etatDepuisModeFormation\`).` par :

```
  (`etatDepuisProjet` pour le profil principal, `champsDepuisProjet` pour chaque profil ; le budget reste tant qu'un
  profil relève d'un projet salarié), besoins de frais et nombre de jours quand l'étape Frais est sautée
  (`etatDepuisModeFormation`). Un prix de groupe ne survit pas à un groupe réduit à une personne (`normaliserGroupe`).
```

3. Remplacer la ligne `  l'écran de résultats s'y précharge (section 15).` par :

```
  l'écran de résultats s'y précharge (section 15). Un groupe de plusieurs profils a une section « Participants » (le
  total des personnes et des profils) puis une section « Profil N » par profil (personnes, statut, réponses), et la
  section Formation écrit le coût par personne et pour le groupe.
```

- [ ] **Step 3 : `apps/web/DESIGN.md`, section 15 (écran de résultats)**

1. Remplacer `` `PlanFinancement`, `BandeauSynthese`, `BarreEmpilee` ; `` par `` `PlanFinancement`, `BandeauSynthese`, `BarreEmpilee`, `ParProfil` ; `` et `` (tests : `tests/resultats.test.ts`, `tests/prechargement.test.ts`) `` par `` (tests : `tests/resultats.test.ts`, `tests/resultats-groupe.test.ts`, `tests/prechargement.test.ts`) ``.

2. Dans la puce **Ordre**, remplacer la ligne `  l'OPCO s'il y a lieu, cartes du plan, aides par financeur (\`h2\`), détail de l'estimation OPCO (\`h2\`), portails de la` par :

```
  l'OPCO s'il y a lieu, cartes du plan, détail par profil (`h2`, plusieurs profils seulement), aides par financeur
  (`h2`), détail de l'estimation OPCO (`h2`), portails de la
```

3. Avant la ligne `- **Promesses** : aucune phrase plus forte que le moteur`, insérer :

```
- **Groupe de plusieurs personnes** (`calculer(...).groupe`, `lib/resultats.ts` ; `ParProfil`) : le moteur de l'OPCO est
  appelé une fois pour les personnes qui relèvent du plan de développement des compétences (un seul plafond annuel),
  son résultat est réparti entre les profils au centime, et le plan du groupe fusionne ceux des profils. L'étiquette
  « 4 personnes · 2 profils » suit la durée dans la situation. Les trois chiffres du bandeau sont ceux du groupe, avec
  « 4 × 2 800 € » sous le coût et « 1 706,25 € par personne en moyenne » sous le reste à charge (`detailsDuBandeau` :
  rien pour une personne seule ni pour un coût inconnu). Chaque ligne chiffrée du plan dit pour combien de personnes elle
  vaut, sous le nom du financeur (« pour 3 personnes », `pourPersonnes`) ; la carte des options, dont les lignes n'ont
  pas cette mention, dit que ses montants sont ceux de tout le groupe. Avec plusieurs profils, une section `h2` « Détail
  par profil » suit le plan : tableau Profil / Personnes / Coût / Financé / Reste à charge et ligne « Total » à partir de
  640 px et à l'impression (aucune ligne ne se coupe, `break-inside-avoid`), un bloc empilé par profil en dessous ; les
  chiffres sont ceux du plan de chaque profil (`lignesParProfil`), jamais recalculés. Les aides du catalogue sont
  fusionnées (`fusionnerAides` : meilleur statut, plus grand montant par personne, « jusqu'à … par personne ») ; une
  carte dont l'aide ne vaut pas, au même statut, pour tous les profils porte un bloc « Concerne » (`concerneAAfficher` :
  « Profil 2 · Dirigeant artisan, 52 ans, 1 personne : éligible »). Le détail de l'OPCO est un calcul unique, dont le
  chapeau dit pour qui (`mentionOpcoDuGroupe` : « Calcul pour les 3 salariés du groupe (4 personnes au total). ») et dont
  la carte de total dit « pour 3 personnes ». Les notes sous le bandeau s'additionnent, une fois chacune (`notesOpco` :
  « Aucun OPCO renseigné », « OPCO non compté pour le dirigeant du groupe »). Fonds épuisés, relais du plan conventionnel
  et plan fermé aux 50 salariés et plus sont jugés une fois, pour l'entreprise. Tests : `tests/resultats-groupe.test.ts`
  (identité avec l'ancien calcul pour une personne, 1 000 groupes tirés, graine 17).
```

- [ ] **Step 4 : `README.md` et `docs/deploiement-site.md`**

Dans `README.md` :

1. Remplacer `(Projet, Entreprise, Bénéficiaire, Formation, Frais, Récapitulatif)` par `(Projet, Entreprise, Participants, Formation, Frais, Récapitulatif)`.

2. Remplacer la ligne `3. **Bénéficiaire** : questions adaptées au projet (contrat, ancienneté, âge, RQTH, niveau de diplôme, solde CPF, statut du dirigeant).` par :

```
3. **Participants** : combien de personnes suivent la formation, puis, pour chaque profil, des questions adaptées au projet (contrat, ancienneté, âge, RQTH, niveau de diplôme, solde CPF, statut du dirigeant).
```

3. Après la ligne `Le calcul reste pur : mêmes entrées, mêmes sorties.`, ajouter :

```

### Former plusieurs personnes à la fois

Le site simule une formation suivie par plusieurs personnes : un nombre de personnes pour le profil principal et jusqu'à 5 profils supplémentaires (statut, contrat, âge, handicap et solde CPF propres à chacun), 99 personnes au plus. Le moteur de l'OPCO (`calculateFunding(opco, état, personnes)`) est appelé une fois pour les personnes qui relèvent du plan de développement des compétences, avec un seul plafond annuel ; `packages/core/src/groupe.ts` répartit son résultat entre les profils au centime, construit le plan de chaque profil et fusionne plans et aides en un plan du groupe. Pour une seule personne, le résultat est celui d'avant : une empreinte de 3 072 calculs le vérifie (`packages/core/tests/empreinte-une-personne.test.ts`). L'application mobile n'est pas concernée.
```

4. Avant la ligne qui commence par `- **Pipeline IA** : une fois activé`, insérer :

```
- **Groupe de plusieurs personnes** : une simulation vaut pour une seule formation (même prix, mêmes dates, mêmes frais pour tous) ; les profils d'un groupe se distinguent par le statut, le contrat, l'âge, le handicap et le solde CPF, pas par la formation. Un profil a un seul solde CPF pour toutes ses personnes (un profil par solde sinon). Les dispositifs de l'OPCO dont l'unité n'est pas « par stagiaire » ne sont pas multipliés par le nombre de personnes : l'estimation de l'OPCO peut être prudente. Les plafonds « par entreprise » cités dans le texte de quelques aides ne sont pas modélisés : le montant d'une aide est toujours par personne.
```

Dans `docs/deploiement-site.md`, remplacer `Former le dirigeant. À l'étape Entreprise, une recherche` par `Former le dirigeant. Un groupe de plusieurs personnes (étape Participants, avec des profils différents) mène au même écran, qui ajoute le détail par profil. À l'étape Entreprise, une recherche`.

- [ ] **Step 5 : les vérifications complètes**

Run, dans cet ordre (chaque commande doit réussir avant la suivante) :

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
(cd packages/core && npx vitest run && npx tsc --noEmit)
(cd backend && npx vitest run && npx tsc --noEmit)
npm run test:web
(cd apps/web && npx tsc --noEmit)
npm run lint --workspace web
(cd apps/mobile && npx tsc --noEmit)
npm run check:charte
node scripts/check-charte-sfg.mjs --self-test
npm run check:tirets
```

Expected: tout vert. Relever pour le README : le nombre de tests et de fichiers du cœur (la sortie de `vitest run`), du backend, du site (`npm run test:web` : tests et suites), le nombre de fichiers lus par `check:charte` et par `check:tirets`, le nombre de cas de l'autotest.

Aucun test existant n'a été modifié sauf ceux que le plan nomme (`tests/parcours.test.ts` : libellé de l'étape et gardes ; `packages/core/tests/aides-plan.test.ts` : champ `personnes` de l'assistant). Si une autre suite échoue, **s'arrêter** : c'est un défaut du code, pas du test.

- [ ] **Step 6 : le build, les mesures de poids et le ménage**

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
npm run build --workspace web
```

Expected: 24 pages annoncées, aucune erreur. Mesurer le JavaScript chargé d'emblée par `/simulateur/` avec le script ci-dessous, à écrire dans le dossier de travail temporaire (hors dépôt) sous le nom `measure-bundle.mjs` :

```js
// Poids gzip (niveau 9) des fichiers JavaScript référencés par la page HTML d'une route de l'export statique.
// Usage : node measure-bundle.mjs <dossier out> <route> [<route>...]
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const [, , out, ...routes] = process.argv;
for (const route of routes) {
  const rel = route === '/' ? 'index.html' : join(route.replace(/^\/|\/$/g, ''), 'index.html');
  const html = readFileSync(join(out, rel), 'utf8');
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)) refs.add(m[1]);
  let total = 0;
  let catalogue = 0;
  for (const ref of refs) {
    const chemin = join(out, ref.replace(/^\//, ''));
    if (!existsSync(chemin)) continue;
    const buf = readFileSync(chemin);
    total += gzipSync(buf, { level: 9 }).length;
    if (buf.includes('nat-poei')) catalogue += 1;
  }
  console.log(`${route} : ${refs.size} fichiers JavaScript, ${total} octets gzip ; fichiers contenant le catalogue d'aides : ${catalogue}`);
}
```

```bash
MSYS_NO_PATHCONV=1 node <chemin du script> C:/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile/apps/web/out / /simulateur/
node -e "const fs=require('fs'),z=require('zlib'),p=require('path');const d='apps/web/out/_next/static/chunks';for(const f of fs.readdirSync(d)){if(!f.endsWith('.js'))continue;const b=fs.readFileSync(p.join(d,f));if(b.includes('nat-poei'))console.log(f,b.length,z.gzipSync(b,{level:9}).length)}"
```

Expected: pour `/simulateur/`, **zéro fichier contenant le catalogue d'aides** (aucun test ne le garantit : cette mesure est la vérification) et un poids proche des 345 776 octets de départ (le README donne la référence) : la hausse vient de `lib/groupe.ts` et des nouveaux composants de l'étape Participants, quelques kilo-octets. Si la hausse dépasse 15 000 octets gzip, la dire à l'utilisateur au lieu de la passer sous silence. Le lot du catalogue (deuxième commande) était de 798 691 octets bruts et 150 418 compressés ; il grossit du détail par profil et des autres composants de l'écran de résultats.

Relever aussi `apps/web/out` (nombre de fichiers et octets : `find apps/web/out -type f | wc -l` et `du -sb apps/web/out`). Ne pas recréer l'archive de dépôt : son dépôt chez l'hébergeur reste la décision de l'utilisateur, et l'archive `financementOPCO-hostinger.zip` ne doit pas être écrasée.

Libérer le disque une fois les mesures prises : supprimer le dossier `apps/web/.next` (environ 730 Mo, régénérable ; la commande est destructive, le contrôle demande d'énoncer ce qu'elle touche).

- [ ] **Step 7 : le tableau « Vérifications » du `README.md`**

Remplacer la phrase d'introduction (`Mesures du 09/10/2026 au commit ...`) par la date du jour et le hash court du dernier commit de code (`git rev-parse --short HEAD`, relevé **avant** le commit de documentation), puis mettre à jour chaque ligne du tableau avec les nombres relevés aux étapes 5 et 6 : tests et fichiers du cœur, du backend et du site, fichiers lus par les gardes, pages et octets du build, JavaScript chargé d'emblée par `/simulateur/` (nombre de fichiers compris), lot du catalogue. La ligne « Archive pour Hostinger » et la ligne « Données embarquées » ne changent pas (aucune donnée, aucune archive refaite) : y garder les mesures d'origine, avec leur commit d'origine. Aucun nombre n'est écrit sans avoir été lu dans la sortie d'une commande lancée pendant cette tâche.

- [ ] **Step 8 : passage final dans le navigateur**

Reconstruire n'est pas nécessaire : démarrer le serveur de développement (`site-dev`, port 3100). Le passage reprend les cinq entrées que le plan a retenues comme les plus susceptibles de casser, en plus des scénarios des tâches 13 à 15 :

1. **Compteur** : dans l'étape Participants, saisir `0`, `-3`, `2,5`, `abc`, `150` puis quitter le champ à chaque fois ; au clavier seul (Tab, Espace, Entrée) ajouter et retirer des personnes. Le total reste entre 1 et 99, le champ reprend la valeur retenue, aucun message d'erreur ne gêne, les boutons gardent le focus aux bornes.
2. **Groupe sans durée ni prix** : à l'étape Formation, laisser durée et coût vides : « Suivant » reste indisponible et dit ce qui manque ; saisir seulement le coût, puis seulement la durée : même comportement ; aucun `NaN` ni « Infinity » dans le coût horaire.
3. **Plafond annuel épuisé** : à l'étape Entreprise, saisir un budget déjà consommé très grand (par exemple `10000000`) avec un groupe de salariés : l'écran de résultats ne compte aucune ligne de l'OPCO, aucun montant négatif, le reste à charge ne dépasse pas le coût.
4. **Groupe sans salarié ou sans OPCO** : deux dirigeants (OPCO facultatif, aucun calcul de l'OPCO, note sur le dirigeant) ; trois salariés sans OPCO (note « Aucun OPCO renseigné », bouton « Indiquer l'OPCO » qui ramène à l'étape Entreprise).
5. **Changement de statut et retrait de profil** : sur un profil supplémentaire, changer de statut trois fois de suite, puis le retirer et en ajouter un autre : le nouveau profil est vide (aucune réponse « Je ne sais pas » ni valeur de l'ancien) ; retirer le profil du milieu d'un groupe de trois ne décale pas les réponses des autres.

Terminer par les largeurs 320, 375, 768 et 1 280 px sur l'écran de résultats d'un groupe de deux profils : aucun défilement horizontal, aucune coupure de mot. Noter tout écart et le corriger dans la tâche concernée avant de continuer ; arrêter le serveur ensuite.

- [ ] **Step 9 : relecture du diff et commit de la documentation**

Run: `cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile && git status --short && git diff --stat c21b924..HEAD`
Expected: seuls les fichiers que les tâches 1 à 15 nomment ; aucun fichier de `docs/specifications/`, aucun `.next`, aucun fichier de `datasets/`.

```bash
cd /c/Users/magdo/Desktop/Claude/Claude_OPCO/opco-mobile
git add apps/web/DESIGN.md README.md docs/deploiement-site.md apps/web/src/lib/parcours.ts apps/web/tests/parcours.test.ts
git commit -m "$(cat <<'EOF'
documents : simulation de plusieurs personnes (guide de design, README, mesures, liste de contrôle du dépôt)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
EOF
)"
```

Rien n'est poussé : ni branche, ni pull request, ni fusion. Les six documents de `docs/specifications/` (non suivis par git) décrivent le commit `c21b924` : les corriger et régénérer leurs PDF reste une proposition à faire à l'utilisateur, avec son accord (lot WP-B5). La session qui pilote met aussi à jour sa mémoire de projet (hors dépôt) : branche `feature/simulation-groupe`, plan, état d'avancement.

