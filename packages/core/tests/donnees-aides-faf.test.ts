// ============================================================
// Fonds d'assurance formation des non-salariés (FAF) : AGEFICE (commerçants), FAFCEA (artisans), FIF PL (professions libérales)
// et FAF PM (médecins libéraux). La restriction de cumul de ces quatre fonds ne porte que sur le CPF : aucune de leurs sources
// ne dit qu'ils ne se cumulent pas avec les autres financements. Le catalogue les modélise donc cumulables, et :
//   - AGEFICE, FAFCEA, FIF PL : au choix avec le CPF (alternatives nat-cpf et nat-vae, les deux aides du CPF ouvertes à un
//     dirigeant), parce que leurs sources écartent les formations financées par le CPF ;
//   - FAF PM : limité aux formations non certifiantes (critère types_formation), parce que ses sources écartent les formations
//     « diplômantes ou certifiantes », qui relèvent du CPF ; sans alternative.
// Déclarés non cumulables, les quatre fonds n'étaient jamais empilés : un artisan dont le FAFCEA était le seul financement voyait
// « Financé 0 € ». Contrôles :
//   1. la modélisation de chaque fonds, et ce qu'elle laisse de côté (abondement de l'employeur, CléA, bilan de compétences) ;
//   2. le plan quand le fonds est le seul financement du dirigeant : il est empilé (ou listé sans montant pour le FIF PL) ;
//   3. le plan avec le CPF : une seule des deux aides est retenue, l'autre est proposée « au choix », jamais additionnées ;
//   4. le FAF PM selon le type de formation.
// Les valeurs attendues sont calculées à la main à partir des barèmes vérifiés (octobre 2026) : le calcul est en commentaire.
// ============================================================

import { describe, it, expect } from 'vitest';
import { evaluerAide, evaluerAides } from '../src/aides/evaluer';
import { construirePlan, type PlanFinancement } from '../src/aides/plan';
import { profilDepuisWizard } from '../src/aides/profil';
import type { Aide } from '../src/aides/types';
import { EMBEDDED_AIDES } from '../src/data';
import { createInitialWizardState, TRAINING_TYPE_LABELS, type TrainingType, type WizardState } from '../src/types';

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
  it("AGEFICE (commerçant) : 42 €/h en présentiel x 21 h = 882 €, sous l'enveloppe annuelle de 3 000 € et sous le coût ; reste 1 200 - 882 = 318 €", () => {
    const { plan } = jouer({ ...FORMATION_COURTE, statutDirigeant: 'commercant' });
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'faf-agefice', montant: 882, confidence: 'exact' })]);
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

  describe('FAFCEA, VAE de 24 h à 3 000 € (125 €/h) : le FAFCEA, nat-cpf et nat-vae sont deux à deux au choix', () => {
    // FAFCEA : 35 €/h x 24 h = 840 €, sous le coût de 3 000 €. nat-cpf et nat-vae prélèvent sur le même solde CPF : chacun vaut
    // le solde (aucun des deux ne dépasse 3 000 €).
    const parcours: Partial<WizardState> = {
      ...FORMATION_RNCP, formationType: 'vae', durationHours: 24, statutDirigeant: 'artisan', pedagogyCostTotal: 3000, pedagogyCostPerHour: 125,
    };

    it("solde CPF de 500 € : le FAFCEA (840 €) l'emporte sur le solde (500 €) ; nat-cpf et nat-vae sont deux options ; financé 840 €, reste 2 160 €", () => {
      const { aides, plan } = jouer({ ...parcours, soldeCpf: 500 });
      for (const id of ['faf-fafcea', 'nat-cpf', 'nat-vae']) expect(aides.find((a) => a.id === id), id).toMatchObject({ statut: 'eligible' });
      expect(plan.financements).toEqual([expect.objectContaining({ id: 'faf-fafcea', montant: 840 })]);
      const nom = aide('faf-fafcea').nom;
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'nat-cpf', montantEstime: 500, raison: `Au choix avec « ${nom} »` }));
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'nat-vae', montantEstime: 500, raison: `Au choix avec « ${nom} »` }));
      uneSeuleLigne(plan, ['nat-cpf', 'nat-vae', 'faf-fafcea']);
      expect(plan.totalFinance).toBe(840);
      expect(plan.resteACharge).toBe(2160);
      coutRespecte(plan, 3000);
    });

    it("solde CPF de 2 000 € : le solde (2 000 €) l'emporte sur le FAFCEA (840 €), nat-cpf avant nat-vae à montants égaux ; nat-vae et le FAFCEA sont deux options ; financé 2 000 €, reste 1 000 €", () => {
      const { plan } = jouer({ ...parcours, soldeCpf: 2000 });
      expect(plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 2000 })]);
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'nat-vae', raison: `Au choix avec « ${nomCpf} »` }));
      expect(plan.options).toContainEqual(expect.objectContaining({ id: 'faf-fafcea', montantEstime: 840, raison: `Au choix avec « ${nomCpf} »` }));
      uneSeuleLigne(plan, ['nat-cpf', 'nat-vae', 'faf-fafcea']);
      expect(plan.totalFinance).toBe(2000);
      expect(plan.resteACharge).toBe(1000);
      coutRespecte(plan, 3000);
    });
  });
});

describe("plan : une VAE financée par le CPF écarte aussi le fonds, même quand nat-vae est mieux chiffrée que nat-cpf", () => {
  // VAE de 24 h à 9 000 €, solde CPF de 6 000 €. nat-cpf est limité à 5 000 € de droits utilisables, nat-vae non : nat-vae (6 000 €)
  // passe devant nat-cpf (5 000 €) et devant chaque fonds (AGEFICE : 42 x 24 h = 1 008 € ; FAFCEA : 35 x 24 h = 840 € ; FIF PL : non
  // chiffré). Sans la déclaration de nat-vae par le fonds, celui-ci serait empilé en plus : 6 000 + 1 008 = 7 008 € pour l'AGEFICE.
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
