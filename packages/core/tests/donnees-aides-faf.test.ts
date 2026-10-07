// ============================================================
// Fonds d'assurance formation des non-salariés (FAF) : AGEFICE (commerçants), FAFCEA (artisans), FIF PL (professions libérales)
// et FAF PM (médecins libéraux). La restriction de cumul de ces quatre fonds ne porte que sur le CPF : aucune de leurs sources
// ne dit qu'ils ne se cumulent pas avec les autres financements. Le catalogue les modélise donc cumulables, et :
//   - AGEFICE, FAFCEA, FIF PL : au choix avec le CPF (alternatives nat-cpf et nat-vae, les deux aides du CPF ouvertes à un
//     dirigeant), parce que leurs sources écartent les formations financées par le CPF ;
//   - FAFCEA : pour la VAE et les formations RNCP (et le bilan de compétences, que le parcours ne permet pas de désigner), il
//     n'intervient qu'en cas de refus du CPF, avec ses propres plafonds. Le plan ne compte alors pas son montant : deux
//     majorations sans valeur le laissent « selon dossier ». Pour une formation technique, il finance 35 €/h jusqu'à 100 h ;
//   - FIF PL : les reconversions professionnelles ne sont pas prises en charge (critère types_formation, tous les types sauf la
//     reconversion) ;
//   - FAF PM : limité aux formations non certifiantes (critère types_formation), parce que ses sources écartent les formations
//     « diplômantes ou certifiantes », qui relèvent du CPF ; sans alternative.
// Déclarés non cumulables, les quatre fonds n'étaient jamais empilés : un artisan dont le FAFCEA était le seul financement voyait
// « Financé 0 € ». Contrôles :
//   1. la modélisation de chaque fonds, et ce qu'elle laisse de côté (abondement de l'employeur, CléA, bilan de compétences) ;
//   2. le plan quand le fonds est le seul financement du dirigeant : il est empilé (ou listé sans montant pour le FIF PL) ;
//   3. le plan avec le CPF : une seule des deux aides est retenue, l'autre est proposée « au choix », jamais additionnées ;
//   4. le FAF PM selon le type de formation ;
//   5. le FAFCEA : jamais empilé pour la VAE et les formations RNCP, toujours chiffré pour une formation technique ;
//   6. le FIF PL selon le type de formation, et sa limite connue pour un médecin.
// Les valeurs attendues sont calculées à la main à partir des barèmes vérifiés (octobre 2026) : le calcul est en commentaire.
// ============================================================

import { describe, it, expect } from 'vitest';
import { evaluerAide, evaluerAides } from '../src/aides/evaluer';
import { construirePlan, type PlanFinancement } from '../src/aides/plan';
import { profilDepuisWizard } from '../src/aides/profil';
import type { Aide } from '../src/aides/types';
import { EMBEDDED_AIDES } from '../src/data';
import {
  CERTIFICATION_LABELS,
  createInitialWizardState,
  TRAINING_TYPE_LABELS,
  type CertificationType,
  type TrainingType,
  type WizardState,
} from '../src/types';

/** Date de référence de l'évaluation (fixe : le résultat ne dépend pas du jour où les tests s'exécutent). */
const DATE = '2026-10-07';

const aideParId = new Map<string, Aide>(EMBEDDED_AIDES.map((a) => [a.id, a]));

function aide(id: string): Aide {
  const trouvee = aideParId.get(id);
  if (!trouvee) throw new Error(`Aide absente du catalogue embarqué : ${id}`);
  return trouvee;
}

const centimes = (n: number): number => Math.round(n * 100);

/** Les quatre fonds d'assurance formation des non-salariés qui limitaient leur cumul au CPF. */
const FONDS = ['faf-agefice', 'faf-fafcea', 'faf-fifpl', 'faf-fafpm'] as const;
/** Ceux dont les sources écartent les formations financées par le CPF : ils sont au choix avec lui. */
const FONDS_AU_CHOIX_AVEC_LE_CPF = ['faf-agefice', 'faf-fafcea', 'faf-fifpl'] as const;

// --- 1. Modélisation ------------------------------------------------------------------------------------------------

describe("modélisation des fonds d'assurance formation : la restriction de cumul ne porte que sur le CPF", () => {
  it.each(FONDS)("%s est cumulable : aucune source ne l'exclut de tous les autres financements", (id) => {
    expect(aide(id).cumul.cumulable).toBe(true);
  });

  it.each(FONDS_AU_CHOIX_AVEC_LE_CPF)(
    "%s est au choix avec les deux aides du CPF ouvertes à un dirigeant (nat-cpf, et nat-vae pour une VAE financée par le CPF)",
    (id) => {
      expect(aide(id).cumul.alternatives).toEqual(['nat-cpf', 'nat-vae']);
      expect(aide(id).cumul.note).toMatch(/^Au choix avec le CPF/);
    },
  );

  it("les aides du CPF déclarées sont exactement celles qui prélèvent sur le solde CPF et peuvent financer la formation d'un dirigeant", () => {
    for (const id of FONDS_AU_CHOIX_AVEC_LE_CPF) {
      const fonds = aide(id);
      const concernees = EMBEDDED_AIDES.filter(
        (a) =>
          a.montant.mode === 'solde_cpf' &&
          a.projets.some((p) => fonds.projets.includes(p)) &&
          a.beneficiaires.some((b) => fonds.beneficiaires.includes(b)),
      ).map((a) => a.id);
      expect(concernees.sort(), id).toEqual([...(fonds.cumul.alternatives ?? [])].sort());
    }
    // CléA (salariés et demandeurs d'emploi) et le bilan de compétences (reconversion d'un salarié) ne concernent pas un dirigeant.
    for (const id of ['nat-clea', 'nat-bilan-competences']) {
      expect(aide(id).projets, id).not.toContain('formation_dirigeant');
      expect(aide(id).beneficiaires, id).not.toContain('dirigeant');
    }
  });

  it("l'abondement de l'employeur sur le CPF n'est déclaré par aucun fonds : un dirigeant non salarié n'a pas d'employeur", () => {
    const abondement = aide('nat-cpf-abondement-employeur');
    expect(abondement.projets).not.toContain('formation_dirigeant');
    expect(abondement.beneficiaires).toEqual(['salarie']);
    for (const id of FONDS) {
      expect(aide(id).projets, id).toEqual(['formation_dirigeant']);
      expect(aide(id).beneficiaires, id).toEqual(['dirigeant']);
      expect(aide(id).cumul.alternatives ?? [], id).not.toContain('nat-cpf-abondement-employeur');
    }
  });

  it("le FAF PM n'est pas au choix avec le CPF : il est limité aux formations non certifiantes", () => {
    const fafpm = aide('faf-fafpm');
    expect(fafpm.cumul.alternatives).toBeUndefined();
    expect(fafpm.criteres.types_formation).toEqual(['non_certifiante']);
    expect(fafpm.cumul.note).toContain('diplômantes ou certifiantes');
  });

  it("chaque règle liée au CPF s'appuie sur un extrait de source qui le cite", () => {
    for (const id of FONDS_AU_CHOIX_AVEC_LE_CPF) {
      expect(
        aide(id).sources.some((s) => /CPF/.test(s.extrait)),
        id,
      ).toBe(true);
    }
    const sourcesFafpm = aide('faf-fafpm').sources.map((s) => s.extrait);
    expect(sourcesFafpm.some((e) => /Diplômantes ou certifiantes/.test(e))).toBe(true);
    expect(sourcesFafpm.some((e) => /CPF/.test(e))).toBe(true);
  });

  it("le montant de l'AGEFICE et celui du FAFCEA dépendent de la contribution versée : aucun des deux n'est « exact », et les deux tranches sont dans le libellé", () => {
    // AGEFICE : 3 000 € d'enveloppe annuelle avec une CFP d'au moins 7 €, 600 € au-dessous (page « Les plafonds financiers pour
    // l'année 2026 ») ; le montant chiffré par le plan suppose la première tranche : c'est une estimation.
    const agefice = aide('faf-agefice');
    expect(agefice.confidence).toBe('estimated');
    expect(agefice.montant.libelle).toContain("3 000 € si la CFP versée est d'au moins 7 €");
    expect(agefice.montant.libelle).toContain('600 € par an si la CFP est inférieure à 7 €');
    expect(agefice.sources.some((s) => /Cotisant < 7€ .* 600€/.test(s.extrait))).toBe(true);
    // FAFCEA : 600 € par an et par entreprise avec une CFP d'au plus 85 € (formations à compter du 1er septembre 2026) ; sa confiance,
    // « depends_on_branche », est déjà la plus faible : l'aide dépend aussi du secteur (alimentation, bâtiment, services et fabrication).
    const fafcea = aide('faf-fafcea');
    expect(fafcea.confidence).toBe('depends_on_branche');
    expect(fafcea.montant.libelle).toContain('Si la CFP est inférieure ou égale à 85 € : 600 € maximum par an et par entreprise');
    expect(fafcea.conditions.some((c) => c.includes('CFP est inférieure ou égale à 85 € : 600 € maximum par an et par entreprise'))).toBe(true);
  });
});

// --- Parcours et plan -------------------------------------------------------------------------------------------------

/** Dirigeant d'une TPE bretonne dont l'organisme de formation est certifié Qualiopi ; statut et formation sont précisés par chaque cas. */
const DIRIGEANT: Partial<WizardState> = {
  projetType: 'formation_dirigeant', regionCode: '53', companySize: 'less_11', microEntrepreneur: false, ageBeneficiaire: 45,
  organismeQualiopi: true,
};

/** Formation courte non certifiante de 21 h à 1 200 € (le CPF n'est pas évoqué : éligibilité et solde inconnus). */
const FORMATION_COURTE: Partial<WizardState> = {
  formationType: 'non_certifiante', durationHours: 21, pedagogyCostTotal: 1200, pedagogyCostPerHour: 57.14,
};

/** Formation RNCP de 140 h, éligible au CPF ; le coût, le type et le solde CPF sont précisés par chaque cas. */
const FORMATION_RNCP: Partial<WizardState> = {
  formationType: 'certification', certificationLevel: 'rncp', niveauFormationVise: 5, eligibleCpf: true, durationHours: 140,
};

function jouer(over: Partial<WizardState>) {
  const state: WizardState = { ...createInitialWizardState(), trainingMode: 'presentiel', ...DIRIGEANT, ...over };
  const profil = profilDepuisWizard(state, null);
  const aides = evaluerAides(EMBEDDED_AIDES, profil, DATE);
  return { profil, aides, plan: construirePlan(null, aides, profil) };
}

/** Le financé et le reste à charge redonnent le coût de la formation au centime. */
function coutRespecte(plan: PlanFinancement, cout: number): void {
  expect(plan.coutFormation).toBe(cout);
  expect(centimes(plan.totalFinance + plan.resteACharge)).toBe(centimes(cout));
}

const lignes = (plan: PlanFinancement): string[] => plan.financements.map((l) => l.id);
const options = (plan: PlanFinancement): string[] => plan.options.map((o) => o.id);

// --- 2. Seul financement : le fonds est empilé ------------------------------------------------------------------------

describe("plan : quand le fonds est le seul financement du dirigeant, il est empilé contre le coût de la formation", () => {
  // Formation courte de 21 h à 1 200 €, CPF inconnu (formation « à vérifier » pour le CPF : jamais compté).
  // Le montant de l'AGEFICE est une estimation : il suppose une CFP d'au moins 7 € (au-dessous, l'enveloppe annuelle tombe à 600 €)
  // et une formation en présentiel (35 €/h en distanciel synchrone, 20 €/h en distanciel asynchrone). La ligne du plan porte donc la
  // confiance « estimated », pas « exact ».
  it("AGEFICE (commerçant) : 42 €/h en présentiel x 21 h = 882 €, sous l'enveloppe annuelle de 3 000 € et sous le coût ; reste 1 200 - 882 = 318 €", () => {
    const { plan } = jouer({ ...FORMATION_COURTE, statutDirigeant: 'commercant' });
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'faf-agefice', montant: 882, confidence: 'estimated' })]);
    expect(options(plan)).not.toContain('faf-agefice');
    expect(plan.totalFinance).toBe(882);
    expect(plan.resteACharge).toBe(318);
    coutRespecte(plan, 1200);
  });

  it('FAFCEA (artisan) : 35 €/h x 21 h = 735 €, sous la limite de 100 h et sous le coût ; reste 1 200 - 735 = 465 €', () => {
    const { plan } = jouer({ ...FORMATION_COURTE, statutDirigeant: 'artisan' });
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'faf-fafcea', montant: 735, confidence: 'depends_on_branche' })]);
    expect(options(plan)).not.toContain('faf-fafcea');
    expect(plan.totalFinance).toBe(735);
    expect(plan.resteACharge).toBe(465);
    coutRespecte(plan, 1200);
  });

  it('FAF PM (médecin) : 100 % des frais pédagogiques (1 200 €) plafonnés à 400 € pour une formation suivie à titre individuel ; reste 1 200 - 400 = 800 €', () => {
    const { plan } = jouer({ ...FORMATION_COURTE, statutDirigeant: 'profession_liberale', codeNaf: '86.21Z' });
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'faf-fafpm', montant: 400, confidence: 'exact' })]);
    expect(options(plan)).not.toContain('faf-fafpm');
    expect(plan.totalFinance).toBe(400);
    expect(plan.resteACharge).toBe(800);
    coutRespecte(plan, 1200);
  });

  it("FIF PL (avocat) : le plafond de la profession n'est pas chiffré par le catalogue, l'aide est listée sans montant et rien n'est déduit du coût", () => {
    const { plan } = jouer({ ...FORMATION_COURTE, statutDirigeant: 'profession_liberale', codeNaf: '69.10Z' });
    expect(plan.nonChiffrees.map((a) => a.id)).toContain('faf-fifpl');
    expect(lignes(plan)).not.toContain('faf-fifpl');
    expect(options(plan)).not.toContain('faf-fifpl');
    expect(plan.totalFinance).toBe(0);
    expect(plan.resteACharge).toBe(1200);
    coutRespecte(plan, 1200);
  });
});

// --- 3. Avec le CPF : au choix, jamais additionnés ------------------------------------------------------------------------

describe('plan : avec le CPF, le plan retient une seule des deux aides et propose l\'autre au choix', () => {
  const nomCpf = aide('nat-cpf').nom;
  /** Le fonds est une option au choix avec le CPF, ou l'inverse : jamais les deux dans les lignes empilées. */
  const uneSeuleLigne = (plan: PlanFinancement, ids: string[]) => expect(plan.financements.filter((l) => ids.includes(l.id))).toHaveLength(1);

  describe('AGEFICE, formation RNCP de 140 h à 9 000 € (64,29 €/h)', () => {
    // AGEFICE : 42 €/h x 140 h = 5 880 €, ramené à l'enveloppe de 5 000 € pour une formation RNCP (CFP d'au moins 7 €) ; 5 000 € est
    // sous le coût de 9 000 €. CPF : le solde du titulaire, dans la limite de 5 000 € de droits.
    const parcours: Partial<WizardState> = {
      ...FORMATION_RNCP, statutDirigeant: 'commercant', pedagogyCostTotal: 9000, pedagogyCostPerHour: 64.29,
    };

    it("solde CPF de 800 € : l'AGEFICE (5 000 €) est mieux chiffré que le CPF (800 €) ; financé 5 000 €, reste 4 000 € (additionnés : 5 800 €)", () => {
      const { aides, plan } = jouer({ ...parcours, soldeCpf: 800 });
      expect(aides.find((a) => a.id === 'faf-agefice')).toMatchObject({ statut: 'eligible', montantEstime: 5000 });
      expect(aides.find((a) => a.id === 'nat-cpf')).toMatchObject({ statut: 'eligible', montantEstime: 800 });
      expect(plan.financements).toEqual([expect.objectContaining({ id: 'faf-agefice', montant: 5000 })]);
      expect(plan.options).toContainEqual(
        expect.objectContaining({ id: 'nat-cpf', montantEstime: 800, raison: `Au choix avec « ${aide('faf-agefice').nom} »` }),
      );
      uneSeuleLigne(plan, ['nat-cpf', 'faf-agefice']);
      expect(plan.totalFinance).toBe(5000);
      expect(plan.resteACharge).toBe(4000);
      coutRespecte(plan, 9000);
    });

    it("solde CPF de 5 000 € : à montants égaux (5 000 €), le CPF, que les autres aides citent comme alternative, l'emporte ; financé 5 000 €, reste 4 000 € (additionnés : 9 000 €)", () => {
      const { plan } = jouer({ ...parcours, soldeCpf: 5000 });
      expect(plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 5000 })]);
      expect(plan.options).toContainEqual(
        expect.objectContaining({ id: 'faf-agefice', montantEstime: 5000, raison: `Au choix avec « ${nomCpf} »` }),
      );
      uneSeuleLigne(plan, ['nat-cpf', 'faf-agefice']);
      expect(plan.totalFinance).toBe(5000);
      expect(plan.resteACharge).toBe(4000);
      coutRespecte(plan, 9000);
    });

    it("solde CPF inconnu : l'AGEFICE, seul chiffré, est retenu ; le CPF est proposé au choix", () => {
      const { plan } = jouer(parcours);
      expect(plan.financements).toEqual([expect.objectContaining({ id: 'faf-agefice', montant: 5000 })]);
      expect(options(plan)).toContain('nat-cpf');
      expect(plan.nonChiffrees.map((a) => a.id)).not.toContain('nat-cpf');
      coutRespecte(plan, 9000);
    });
  });

  describe('FIF PL (avocat), formation RNCP de 140 h à 4 200 € (30 €/h)', () => {
    const parcours: Partial<WizardState> = {
      ...FORMATION_RNCP, statutDirigeant: 'profession_liberale', codeNaf: '69.10Z', pedagogyCostTotal: 4200, pedagogyCostPerHour: 30,
    };

    it("solde CPF de 800 € : le CPF, chiffré, est retenu ; le FIF PL, sans montant, est une option au choix et n'est plus listé parmi les aides non chiffrées ; financé 800 €, reste 3 400 €", () => {
      const { plan } = jouer({ ...parcours, soldeCpf: 800 });
      expect(plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 800 })]);
      expect(plan.options).toContainEqual(
        expect.objectContaining({ id: 'faf-fifpl', montantEstime: null, raison: `Au choix avec « ${nomCpf} »` }),
      );
      expect(plan.nonChiffrees.map((a) => a.id)).not.toContain('faf-fifpl');
      expect(plan.totalFinance).toBe(800);
      expect(plan.resteACharge).toBe(3400);
      coutRespecte(plan, 4200);
    });

    it("solde CPF inconnu : ni l'un ni l'autre n'est chiffré, le CPF (aide citée par le fonds) est retenu sans montant et le FIF PL est une option au choix ; rien n'est déduit", () => {
      const { plan } = jouer(parcours);
      expect(plan.financements).toEqual([]);
      expect(plan.nonChiffrees.map((a) => a.id)).toContain('nat-cpf');
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'faf-fifpl', raison: `Au choix avec « ${nomCpf} »` }));
      expect(plan.totalFinance).toBe(0);
      expect(plan.resteACharge).toBe(4200);
      coutRespecte(plan, 4200);
    });
  });

  describe('FAFCEA, VAE de 24 h à 3 000 € (125 €/h) : nat-cpf et nat-vae prélèvent sur le solde CPF, le FAFCEA n\'intervient qu\'après un refus du CPF', () => {
    // FAFCEA : pour une VAE, la ligne des critères du 1er septembre 2026 est « Prise en charge dans le cas d’un refus de prise en
    // charge du CPF plafonnée à 24h dans la limite d’un coût horaire maximum de 50€ » : le fonds n'intervient qu'en cas de refus du
    // CPF, son montant n'est pas compté (il serait de 24 h x 50 €/h = 1 200 € au plus, jamais de 35 x 24 = 840 € : ce tarif est celui de
    // la formation technique). nat-cpf et nat-vae prélèvent sur le même solde CPF : chacun vaut le solde (aucun des deux ne dépasse
    // 3 000 €). Le plan retient le CPF, nat-cpf avant nat-vae à montants égaux (les deux autres aides citent nat-cpf).
    const parcours: Partial<WizardState> = {
      ...FORMATION_RNCP, formationType: 'vae', durationHours: 24, statutDirigeant: 'artisan', pedagogyCostTotal: 3000, pedagogyCostPerHour: 125,
    };

    it("solde CPF de 500 € : le CPF finance 500 € ; nat-vae et le FAFCEA (sans montant) sont deux options ; financé 500 €, reste 3 000 - 500 = 2 500 €", () => {
      const { aides, plan } = jouer({ ...parcours, soldeCpf: 500 });
      for (const id of ['faf-fafcea', 'nat-cpf', 'nat-vae']) expect(aides.find((a) => a.id === id), id).toMatchObject({ statut: 'eligible' });
      expect(aides.find((a) => a.id === 'faf-fafcea')!.montantEstime).toBeNull();
      expect(plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 500 })]);
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'nat-vae', montantEstime: 500, raison: `Au choix avec « ${nomCpf} »` }));
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'faf-fafcea', montantEstime: null, raison: `Au choix avec « ${nomCpf} »` }));
      expect(plan.nonChiffrees.map((a) => a.id)).not.toContain('faf-fafcea');
      uneSeuleLigne(plan, ['nat-cpf', 'nat-vae', 'faf-fafcea']);
      expect(plan.totalFinance).toBe(500);
      expect(plan.resteACharge).toBe(2500);
      coutRespecte(plan, 3000);
    });

    it("solde CPF de 2 000 € : le CPF finance 2 000 € ; nat-vae et le FAFCEA (sans montant) sont deux options ; financé 2 000 €, reste 3 000 - 2 000 = 1 000 €", () => {
      const { plan } = jouer({ ...parcours, soldeCpf: 2000 });
      expect(plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 2000 })]);
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'nat-vae', raison: `Au choix avec « ${nomCpf} »` }));
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'faf-fafcea', montantEstime: null, raison: `Au choix avec « ${nomCpf} »` }));
      uneSeuleLigne(plan, ['nat-cpf', 'nat-vae', 'faf-fafcea']);
      expect(plan.totalFinance).toBe(2000);
      expect(plan.resteACharge).toBe(1000);
      coutRespecte(plan, 3000);
    });

    it("solde CPF inconnu : ni le CPF ni le FAFCEA ne sont chiffrés, rien n'est déduit ; le FAFCEA reste une option au choix avec le CPF", () => {
      const { plan } = jouer(parcours);
      expect(plan.financements).toEqual([]);
      expect(plan.nonChiffrees.map((a) => a.id)).toContain('nat-cpf');
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'faf-fafcea', montantEstime: null }));
      expect(plan.totalFinance).toBe(0);
      expect(plan.resteACharge).toBe(3000);
      coutRespecte(plan, 3000);
    });

  });
});

describe("plan : une VAE financée par le CPF écarte aussi le fonds, même quand nat-vae est mieux chiffrée que nat-cpf", () => {
  // VAE de 24 h à 9 000 €, solde CPF de 6 000 €. nat-cpf est limité à 5 000 € de droits utilisables, nat-vae non : nat-vae (6 000 €)
  // passe devant nat-cpf (5 000 €) et devant chaque fonds (AGEFICE : 42 x 24 h = 1 008 € ; FAFCEA et FIF PL : non chiffrés, le FAFCEA
  // n'intervenant pour une VAE qu'en cas de refus du CPF). Sans la déclaration de nat-vae par le fonds, celui-ci serait empilé en plus :
  // 6 000 + 1 008 = 7 008 € pour l'AGEFICE.
  // Financé : 6 000 € (nat-vae seul) ; reste à charge : 9 000 - 6 000 = 3 000 €.
  const parcours: Partial<WizardState> = {
    ...FORMATION_RNCP, formationType: 'vae', durationHours: 24, pedagogyCostTotal: 9000, pedagogyCostPerHour: 375, soldeCpf: 6000,
  };
  const nomVae = aide('nat-vae').nom;

  it.each([
    { id: 'faf-agefice', profil: { statutDirigeant: 'commercant' } as Partial<WizardState> },
    { id: 'faf-fafcea', profil: { statutDirigeant: 'artisan' } as Partial<WizardState> },
    { id: 'faf-fifpl', profil: { statutDirigeant: 'profession_liberale', codeNaf: '69.10Z' } as Partial<WizardState> },
  ])('$id : nat-vae est retenue, nat-cpf et le fonds sont deux options au choix avec elle', ({ id, profil }) => {
    const { aides, plan } = jouer({ ...parcours, ...profil });
    expect(aides.find((a) => a.id === 'nat-cpf')).toMatchObject({ statut: 'eligible', montantEstime: 5000 });
    expect(aides.find((a) => a.id === 'nat-vae')).toMatchObject({ statut: 'eligible', montantEstime: 6000 });
    expect(aides.find((a) => a.id === id)).toMatchObject({ statut: 'eligible' });
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'nat-vae', montant: 6000 })]);
    expect(plan.options).toContainEqual(expect.objectContaining({ id: 'nat-cpf', raison: `Au choix avec « ${nomVae} »` }));
    expect(plan.options).toContainEqual(expect.objectContaining({ id, raison: `Au choix avec « ${nomVae} »` }));
    expect(plan.nonChiffrees.map((a) => a.id)).not.toContain(id);
    expect(plan.totalFinance).toBe(6000);
    expect(plan.resteACharge).toBe(3000);
    coutRespecte(plan, 9000);
  });
});

// --- 4. FAF PM : seule la formation non certifiante est dans le périmètre --------------------------------------------------

describe('FAF PM : les formations diplômantes ou certifiantes ne sont pas prises en charge à titre individuel', () => {
  const fafpm = aide('faf-fafpm');
  const medecin = (typeFormation: TrainingType | null) =>
    profilDepuisWizard(
      {
        ...createInitialWizardState(), ...DIRIGEANT, ...FORMATION_COURTE, statutDirigeant: 'profession_liberale', codeNaf: '86.21Z',
        formationType: typeFormation,
      },
      null,
    );
  const AUTRES_TYPES = (Object.keys(TRAINING_TYPE_LABELS) as TrainingType[]).filter((t) => t !== 'non_certifiante');
  const RAISON = `Réservé aux formations de type : ${TRAINING_TYPE_LABELS.non_certifiante}`;

  it('formation non certifiante : éligible (aucune autre condition du profil ne manque)', () => {
    expect(evaluerAide(fafpm, medecin('non_certifiante'), DATE)).toMatchObject({ statut: 'eligible', horsPerimetre: false, raisons: [] });
  });

  it.each(AUTRES_TYPES)(
    'type %s : ni éligible ni à vérifier, hors périmètre, pour le seul motif du type de formation',
    (type) => {
      expect(evaluerAide(fafpm, medecin(type), DATE)).toMatchObject({ statut: 'non_eligible', horsPerimetre: true, raisons: [RAISON] });
    },
  );

  it('type de formation inconnu : à vérifier, jamais éligible ni hors périmètre', () => {
    expect(evaluerAide(fafpm, medecin(null), DATE)).toMatchObject({
      statut: 'a_verifier', horsPerimetre: false, raisons: ['Précisez le type de formation'],
    });
  });

  it("pour un DU (formation certifiante éligible au CPF, solde de 800 €), le FAF PM n'est pas dans le plan : le CPF finance 800 €, reste 1 200 - 800 = 400 €", () => {
    const { aides, plan } = jouer({
      ...FORMATION_RNCP, statutDirigeant: 'profession_liberale', codeNaf: '86.21Z', durationHours: 21, pedagogyCostTotal: 1200, soldeCpf: 800,
    });
    expect(aides.find((a) => a.id === 'faf-fafpm')).toMatchObject({ statut: 'non_eligible', horsPerimetre: true });
    expect(lignes(plan)).toEqual(['nat-cpf']);
    expect([...lignes(plan), ...options(plan), ...plan.nonChiffrees.map((a) => a.id)]).not.toContain('faf-fafpm');
    expect(plan.totalFinance).toBe(800);
    expect(plan.resteACharge).toBe(400);
    coutRespecte(plan, 1200);
  });
});

// --- 5. FAFCEA : la VAE et les formations RNCP ne sont prises en charge qu'en cas de refus du CPF ---------------------------

describe("FAFCEA : pour la VAE et les formations RNCP, le fonds n'intervient qu'en cas de refus du CPF ; la formation technique reste chiffrée", () => {
  const fafcea = aide('faf-fafcea');
  const majorations = fafcea.montant.majorations ?? [];

  // Les critères de prise en charge du 1er septembre 2026 (secteurs Services et Fabrication, Bâtiment, Alimentation) ont une ligne
  // propre pour la VAE (« ... plafonnée à 24h dans la limite d’un coût horaire maximum de 50€ »), une pour le bilan de compétences
  // (« ... à hauteur de 20h minimum et dans la limite de 2000€ maximum une fois tous les 5 ans par stagiaire ») et une pour les
  // « Formations diplômantes et certifiantes inscrites au RNCP » (« ... à hauteur de 7 500€ par action dans la limite d’un coût
  // horaire maximum de 30€, après avis des commissions techniques et validation par le Conseil d’Administration »). Les trois
  // commencent par « Prise en charge dans le cas d’un refus de prise en charge du CPF » : le FAFCEA est un repli, pas un financement
  // ordinaire. Le parcours ne permet pas de désigner un bilan de compétences (aucun type de formation ni niveau de certification
  // « bilan ») : seules la VAE (type vae) et les formations RNCP (type certification, ou niveau de certification rncp ou diplome)
  // sont reconnues. Pour elles, les plafonds de la ligne des critères sont écrits dans un libellé, et le plan ne compte aucun montant.
  const TYPES_EN_REPLI: TrainingType[] = ['vae', 'certification'];
  const CERTIFICATIONS_EN_REPLI: CertificationType[] = ['rncp', 'diplome'];
  const TOUS_LES_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
  const TOUTES_LES_CERTIFICATIONS = Object.keys(CERTIFICATION_LABELS) as CertificationType[];

  describe('modélisation : deux majorations sans valeur', () => {
    it('la première couvre la VAE et les formations de type certification, la seconde les certifications rncp et diplome', () => {
      expect(majorations.map((m) => m.criteres)).toEqual([
        { types_formation: ['vae', 'certification'] },
        { certifications: ['rncp', 'diplome'] },
      ]);
      expect(majorations.map((m) => m.valeur)).toEqual([null, null]);
      expect(majorations.map((m) => m.pourcentage)).toEqual([undefined, undefined]);
    });

    it("la note de cumul dit que le fonds n'intervient qu'en cas de refus du CPF et que son montant n'est pas compté dans le plan", () => {
      const note = fafcea.cumul.note ?? '';
      expect(note).toMatch(/^Au choix avec le CPF/);
      expect(note).toContain("le FAFCEA n'intervient qu'en cas de refus de prise en charge par le CPF");
      expect(note).toContain("son montant n'est donc pas compté dans le plan");
      for (const motif of ['la VAE', 'le bilan de compétences', 'les formations RNCP']) expect(note).toContain(motif);
    });

    it("chaque libellé cite le refus du CPF et les plafonds de la ligne des critères, sans le tarif de la formation technique", () => {
      expect(majorations[0].libelle).toContain('24 h au plus, dans la limite de 50 €/h');
      expect(majorations[0].libelle).toContain('7 500 € par action dans la limite de 30 €/h');
      expect(majorations[1].libelle).toContain('7 500 € par action dans la limite de 30 €/h');
      for (const { libelle } of majorations) {
        expect(libelle).toContain('seulement en cas de refus de prise en charge par le CPF');
        expect(libelle).toContain("après avis des commissions techniques et validation par le Conseil d'Administration");
        expect(libelle).not.toMatch(/35 €|3 500|100 h/);
      }
    });

    it("aucun chiffre des libellés n'est inventé : chaque durée et chaque montant figure dans un extrait mot pour mot des critères du FAFCEA", () => {
      const sansEspaces = (texte: string) => texte.replace(/\s/g, '');
      const extraits = sansEspaces(fafcea.sources.map((s) => s.extrait).join(' '));
      for (const { libelle } of majorations) {
        const chiffres = [...libelle.matchAll(/(\d(?:[\d\s]*\d)?)\s*(h\b|€)/g)].map((m) => `${sansEspaces(m[1])}${m[2]}`);
        expect(chiffres.length, libelle).toBeGreaterThanOrEqual(2);
        for (const chiffre of chiffres) expect(extraits, `« ${chiffre} » dans « ${libelle} »`).toContain(chiffre);
      }
    });

    it("limite connue : le bilan de compétences n'est pas reconnu, aucun type de formation ni niveau de certification du parcours ne le désigne", () => {
      // Sa ligne des critères (« ... à hauteur de 20h minimum et dans la limite de 2000€ maximum une fois tous les 5 ans par stagiaire »)
      // n'a donc aucune majoration : seules la condition et la note de l'aide disent qu'il n'est pris en charge qu'après un refus du CPF.
      // Si le parcours reçoit un type « bilan de compétences », ce test échoue : ajouter alors au FAFCEA une majoration sans valeur pour
      // ce type, avec la ligne du bilan en extrait mot pour mot (20h minimum, 2000€ maximum, une fois tous les 5 ans).
      const noms = [
        ...Object.keys(TRAINING_TYPE_LABELS), ...Object.values(TRAINING_TYPE_LABELS),
        ...Object.keys(CERTIFICATION_LABELS), ...Object.values(CERTIFICATION_LABELS),
      ];
      expect(noms.filter((nom) => /bilan/i.test(nom))).toEqual([]);
      expect(fafcea.conditions.some((c) => c.includes('bilan de compétences') && c.includes('refus du CPF'))).toBe(true);
      expect(fafcea.cumul.note).toContain('Le simulateur ne distingue pas le bilan de compétences');
    });

    it('les lignes VAE, bilan de compétences et formations RNCP des critères sont citées mot pour mot dans les sources, avec leurs plafonds', () => {
      const extraits = fafcea.sources.map((s) => s.extrait);
      const cite = (debut: string, ...fins: string[]) => {
        const extrait = extraits.find((e) => e.startsWith(debut));
        expect(extrait, debut).toBeDefined();
        for (const fin of fins) expect(extrait, debut).toContain(fin);
      };
      cite('VAE comprenant l’accompagnement', 'refus de prise en charge du CPF plafonnée à 24h dans la limite d’un coût horaire maximum de 50€');
      cite('Bilan de compétences', 'refus de prise en charge du CPF');
      cite(
        'Formations diplômantes et certifiantes inscrites au RNCP Prise en charge',
        'refus de prise en charge du CPF à hauteur de 7 500€ par action dans la limite d’un coût horaire maximum de 30€',
        'après avis des commissions techniques et validation par le Conseil d’Administration',
      );
    });
  });

  describe("plan : jamais dans les financements pour la VAE, ni pour les types et les niveaux de certification des deux majorations", () => {
    const SOLDES_CPF = [null, 0, 800, 5000];
    const ELIGIBILITES_CPF = [true, false, null];
    /** [coût pédagogique, durée en heures] */
    const COUTS: [number, number][] = [[900, 21], [4200, 140], [9000, 140]];

    const combinaisons = [...TOUS_LES_TYPES, null].flatMap((typeFormation) =>
      [...TOUTES_LES_CERTIFICATIONS, null]
        .filter(
          (certificationLevel) =>
            (typeFormation !== null && TYPES_EN_REPLI.includes(typeFormation)) ||
            (certificationLevel !== null && CERTIFICATIONS_EN_REPLI.includes(certificationLevel)),
        )
        .map((certificationLevel) => ({ typeFormation, certificationLevel })),
    );

    it('28 combinaisons de type de formation et de certification relèvent d\'une des deux majorations', () => {
      // vae et certification avec les 7 niveaux de certification et l'absence de niveau (2 x 8), les 6 autres types (dont le type
      // inconnu) avec rncp ou diplome (6 x 2).
      expect(combinaisons).toHaveLength(2 * 8 + 6 * 2);
    });

    it("le FAFCEA est éligible mais sans montant, jamais empilé ni compté dans le total, quels que soient le solde CPF, l'éligibilité au CPF et le coût", () => {
      const ecarts: string[] = [];
      for (const { typeFormation, certificationLevel } of combinaisons) {
        for (const soldeCpf of SOLDES_CPF) {
          for (const eligibleCpf of ELIGIBILITES_CPF) {
            for (const [cout, heures] of COUTS) {
              const quand = `type ${typeFormation}, certification ${certificationLevel}, éligible au CPF ${eligibleCpf}, solde ${soldeCpf}, ${heures} h à ${cout} €`;
              const { aides, plan } = jouer({
                statutDirigeant: 'artisan', formationType: typeFormation, certificationLevel, eligibleCpf, soldeCpf,
                durationHours: heures, pedagogyCostTotal: cout, pedagogyCostPerHour: cout / heures,
              });
              const evalue = aides.find((a) => a.id === 'faf-fafcea')!;
              if (evalue.statut !== 'eligible' || evalue.montantEstime !== null) {
                ecarts.push(`${quand} : ${evalue.statut}, montant ${evalue.montantEstime}`);
              }
              if (lignes(plan).includes('faf-fafcea')) ecarts.push(`${quand} : empilé dans le plan`);
              // Il est listé quand même : en option si une aide du CPF qui peut payer la formation est éligible (elle est retenue),
              // parmi les aides sans montant sinon.
              const cpfEligible = aides.some((a) => (a.id === 'nat-cpf' || a.id === 'nat-vae') && a.statut === 'eligible');
              const listeAttendue = cpfEligible ? options(plan) : plan.nonChiffrees.map((a) => a.id);
              if (!listeAttendue.includes('faf-fafcea')) ecarts.push(`${quand} : absent de ${cpfEligible ? 'options' : 'nonChiffrees'}`);
              if (centimes(plan.financements.reduce((somme, l) => somme + l.montant, 0)) !== centimes(plan.totalFinance)) {
                ecarts.push(`${quand} : le total financé n'est pas la somme des lignes`);
              }
            }
          }
        }
      }
      expect(ecarts.slice(0, 10)).toEqual([]);
    });

    it("formation RNCP non éligible au CPF (le CPF est refusé) : le FAFCEA, seul financeur possible, est listé sans montant ; rien n'est déduit, reste 4 200 €", () => {
      // Le CPF est refusé : le FAFCEA peut alors intervenir (7 500 € par action au plus, 30 €/h au plus, après avis des commissions
      // techniques), mais son montant dépend du dossier : il n'est pas compté. 30 €/h x 140 h = 4 200 €, sous les 7 500 € de la ligne.
      const { aides, plan } = jouer({
        ...FORMATION_RNCP, statutDirigeant: 'artisan', eligibleCpf: false, soldeCpf: 800, pedagogyCostTotal: 4200, pedagogyCostPerHour: 30,
      });
      expect(aides.find((a) => a.id === 'nat-cpf')).toMatchObject({ statut: 'non_eligible' });
      expect(aides.find((a) => a.id === 'faf-fafcea')).toMatchObject({ statut: 'eligible', montantEstime: null });
      expect(plan.financements).toEqual([]);
      expect(plan.nonChiffrees.map((a) => a.id)).toContain('faf-fafcea');
      expect(options(plan)).not.toContain('faf-fafcea');
      expect(plan.totalFinance).toBe(0);
      expect(plan.resteACharge).toBe(4200);
      coutRespecte(plan, 4200);
    });

    it("le libellé affiché est celui de la première majoration dont les critères sont remplis : type vae ou certification d'abord, puis niveau rncp ou diplome", () => {
      const libelle = (over: Partial<WizardState>) =>
        jouer({ statutDirigeant: 'artisan', ...over }).aides.find((a) => a.id === 'faf-fafcea')!.libelleMontant;
      expect(libelle({ formationType: 'vae', certificationLevel: 'rncp' })).toBe(majorations[0].libelle);
      expect(libelle({ formationType: 'certification', certificationLevel: null })).toBe(majorations[0].libelle);
      expect(libelle({ formationType: 'qualification', certificationLevel: 'diplome' })).toBe(majorations[1].libelle);
      expect(libelle({ formationType: null, certificationLevel: 'rncp' })).toBe(majorations[1].libelle);
      expect(libelle({ formationType: 'non_certifiante', certificationLevel: null })).toBe(fafcea.montant.libelle);
    });
  });

  describe('formation technique : 35 €/h dans la limite de 100 h, puis dans la limite du coût de la formation', () => {
    // Ligne « Technique » des critères du 1er septembre 2026 (secteurs Services et Fabrication, Bâtiment) : « Durée maximale (par
    // stagiaire et par an) 100h, coût horaire maximum 35 € » : au plus 100 h x 35 € = 3 500 € par stagiaire et par an. Une formation
    // technique n'est pas en concurrence avec le CPF : aucun refus préalable n'est demandé. Hypothèse : contribution à la formation
    // (CFP) supérieure à 85 € (au plus 85 €, le FAFCEA plafonne à 600 € par an et par entreprise). Le secteur Alimentation a ses propres
    // tarifs (60 €/h, 54 h) : la confiance de l'aide reste « depends_on_branche ».
    const CAS = [
      { heures: 7, cout: 400, attendu: 245, calcul: '7 h à 400 € : 35 x 7 h = 245 €, sous le coût ; reste 155 €' },
      { heures: 21, cout: 900, attendu: 735, calcul: '21 h à 900 € : 35 x 21 h = 735 €, sous le coût ; reste 165 €' },
      { heures: 100, cout: 5000, attendu: 3500, calcul: '100 h à 5 000 € : 35 x 100 h = 3 500 €, la limite de 100 h ; reste 1 500 €' },
      { heures: 140, cout: 9000, attendu: 3500, calcul: '140 h à 9 000 € : 35 x 140 h = 4 900 €, ramené à 100 h x 35 € = 3 500 € ; reste 5 500 €' },
      { heures: 140, cout: 3000, attendu: 3000, calcul: '140 h à 3 000 € : 4 900 € ramené à 3 500 €, puis au coût de la formation = 3 000 € ; reste 0 €' },
    ];
    /** Niveaux de certification qui ne déclenchent aucune majoration (le type non certifiante n'en déclenche aucune non plus). */
    const SANS_REPLI: (CertificationType | null)[] = [null, 'rs', 'cqp', 'habilitation', 'aucune', 'autre'];

    it.each(CAS)('$calcul', ({ heures, cout, attendu }) => {
      for (const certificationLevel of SANS_REPLI) {
        const { aides, plan } = jouer({
          statutDirigeant: 'artisan', formationType: 'non_certifiante', certificationLevel, durationHours: heures,
          pedagogyCostTotal: cout, pedagogyCostPerHour: cout / heures,
        });
        const quand = `certification ${certificationLevel}`;
        expect(aides.find((a) => a.id === 'faf-fafcea'), quand).toMatchObject({ statut: 'eligible', montantEstime: attendu });
        expect(plan.financements, quand).toEqual([expect.objectContaining({ id: 'faf-fafcea', montant: attendu })]);
        expect(plan.totalFinance, quand).toBe(attendu);
        expect(plan.resteACharge, quand).toBe(cout - attendu);
        expect(options(plan), quand).not.toContain('faf-fafcea');
        coutRespecte(plan, cout);
      }
    });
  });
});

// --- 6. FIF PL : les reconversions professionnelles ne sont pas prises en charge ----------------------------------------------

describe('FIF PL : les reconversions professionnelles ne sont pas prises en charge', () => {
  const fifpl = aide('faf-fifpl');
  const avocat = (typeFormation: TrainingType | null) =>
    profilDepuisWizard(
      {
        ...createInitialWizardState(), ...DIRIGEANT, ...FORMATION_COURTE, statutDirigeant: 'profession_liberale', codeNaf: '69.10Z',
        formationType: typeFormation,
      },
      null,
    );
  const TOUS_LES_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
  const TYPES_PRIS_EN_CHARGE = TOUS_LES_TYPES.filter((t) => t !== 'reconversion');

  // Page « Qu'est-ce qui peut être pris en charge ? » de fifpl.fr, rubrique « Ce qui n’est pas pris en charge » : « Les bilans de
  // compétences et les reconversions professionnelles ». Le critère types_formation liste donc tous les types de formation du
  // parcours sauf la reconversion professionnelle.
  it('le critère types_formation liste tous les types de formation sauf la reconversion professionnelle', () => {
    expect([...(fifpl.criteres.types_formation ?? [])].sort()).toEqual([...TYPES_PRIS_EN_CHARGE].sort());
    expect(fifpl.criteres.types_formation).not.toContain('reconversion');
  });

  it("une source cite l'exclusion des bilans de compétences et des reconversions professionnelles, mot pour mot", () => {
    const source = fifpl.sources.find((s) => s.extrait.includes('reconversions professionnelles'));
    expect(source?.url).toBe('https://fifpl.fr/professions-liberales/quest-ce-qui-peut-etre-pris-en-charge/');
    expect(source?.extrait).toContain('Ce qui n’est pas pris en charge Les bilans de compétences et les reconversions professionnelles');
  });

  it.each(TYPES_PRIS_EN_CHARGE)('type %s : éligible, dans le périmètre', (type) => {
    expect(evaluerAide(fifpl, avocat(type), DATE)).toMatchObject({ statut: 'eligible', horsPerimetre: false, raisons: [] });
  });

  it('reconversion professionnelle : ni éligible ni à vérifier, hors périmètre, pour le seul motif du type de formation', () => {
    const r = evaluerAide(fifpl, avocat('reconversion'), DATE);
    expect(r).toMatchObject({ statut: 'non_eligible', horsPerimetre: true });
    expect(r.raisons).toHaveLength(1);
    expect(r.raisons[0]).toMatch(/^Réservé aux formations de type : /);
    expect(r.raisons[0]).not.toContain(TRAINING_TYPE_LABELS.reconversion);
  });

  it('type de formation inconnu : à vérifier, jamais éligible ni hors périmètre', () => {
    expect(evaluerAide(fifpl, avocat(null), DATE)).toMatchObject({
      statut: 'a_verifier', horsPerimetre: false, raisons: ['Précisez le type de formation'],
    });
  });

  it("pour un avocat en reconversion (formation certifiante éligible au CPF, solde de 800 €), le FIF PL n'est dans aucune liste du plan : le CPF finance 800 €, reste 1 200 - 800 = 400 €", () => {
    const { aides, plan } = jouer({
      ...FORMATION_RNCP, formationType: 'reconversion', statutDirigeant: 'profession_liberale', codeNaf: '69.10Z', durationHours: 21,
      pedagogyCostTotal: 1200, soldeCpf: 800,
    });
    expect(aides.find((a) => a.id === 'faf-fifpl')).toMatchObject({ statut: 'non_eligible', horsPerimetre: true });
    expect(lignes(plan)).toEqual(['nat-cpf']);
    expect([...lignes(plan), ...options(plan), ...plan.nonChiffrees.map((a) => a.id)]).not.toContain('faf-fifpl');
    expect(plan.totalFinance).toBe(800);
    expect(plan.resteACharge).toBe(400);
    coutRespecte(plan, 1200);
  });

  it("limite connue : un médecin (NAF 86.21Z) voit aussi le FIF PL ; l'aide n'a pas de montant, le plan ne compte que le FAF PM (400 €)", () => {
    // La description du FIF PL dit « hors médecins » et ses conditions renvoient les médecins au FAF PM, mais les critères du moteur
    // n'ont que `naf_prefixes`, une liste positive : aucun moyen d'exclure les codes NAF 86.21 et 86.22. Le FIF PL, non chiffré,
    // n'ajoute qu'une fiche sans montant et jamais un euro au plan. Avec un critère NAF négatif dans le moteur, ce test deviendrait
    // l'exclusion du FIF PL pour un médecin.
    expect(fifpl.criteres.naf_prefixes).toBeUndefined();
    expect(fifpl.description).toContain('hors médecins');
    expect(fifpl.conditions.some((c) => c.includes('les médecins relèvent du FAF PM'))).toBe(true);
    const { aides, plan } = jouer({ ...FORMATION_COURTE, statutDirigeant: 'profession_liberale', codeNaf: '86.21Z' });
    expect(aides.find((a) => a.id === 'faf-fifpl')).toMatchObject({ statut: 'eligible', montantEstime: null });
    expect(plan.nonChiffrees.map((a) => a.id)).toContain('faf-fifpl');
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'faf-fafpm', montant: 400 })]);
    expect(plan.totalFinance).toBe(400);
    expect(plan.resteACharge).toBe(800);
  });
});
