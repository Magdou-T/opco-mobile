// ============================================================
// CPF, CléA et dotation de l'employeur sur les données réelles embarquées. Trois défauts de modélisation relevés par la revue
// finale, visibles par un utilisateur qui lit un montant :
//   1. CléA (nat-clea) était proposé pour toute formation éligible au CPF et empilé avec le solde entier : une formation RNCP
//      était financée par « Certificat CléA » au lieu du CPF. CléA n'est plus proposé que pour une certification du répertoire
//      spécifique (CléA en fait partie), sans montant : il n'est jamais empilé ;
//   2. le plafond d'utilisation de 1 500 € pour une certification du répertoire spécifique (hors CléA) n'était pas appliqué, et
//      le plafond d'alimentation du compte (5 000 €, 8 000 € pour un salarié sans qualification ou handicapé) bornait à tort le
//      solde saisi. Les sources officielles le disent : seuls les droits acquis au titre de l'activité sont plafonnés, pas le
//      compte (« Le compte formation des titulaires n'est donc pas plafonné. Seuls les droits acquis au titre d'une activité
//      professionnelle le sont comme prévu par la loi. », financeurs.moncompteformation.gouv.fr, « Les dotations sont-elles
//      plafonnées ? ») ; le Code du travail prévoit des abondements quand le coût dépasse « le montant des droits inscrits sur le
//      compte ou [...] les plafonds » de l'article L. 6323-11 (article L. 6323-4, II) ;
//   3. la dotation volontaire de l'employeur (150 €) était comptée comme un financement extérieur et abaissait le reste à charge,
//      alors que c'est l'argent de l'employeur et que 150 € est le seuil de la participation forfaitaire, pas un montant d'aide.
// Les valeurs attendues sont calculées à la main (calcul en commentaire) ; les tirages au hasard ont une graine fixe.
// ============================================================

import { describe, it, expect } from 'vitest';
import { construirePlan, type PlanFinancement } from '../src/aides/plan';
import { evaluerAides } from '../src/aides/evaluer';
import { profilDepuisWizard } from '../src/aides/profil';
import type { Aide } from '../src/aides/types';
import { calculateFunding } from '../src/calculator';
import { EMBEDDED_AIDES, getEmbeddedOpcoBySlug } from '../src/data';
import { createInitialWizardState, type CertificationType, type ProjetType, type WizardState } from '../src/types';

/** Date d'évaluation fixe : le résultat ne dépend pas du jour où les tests s'exécutent. */
const DATE = '2026-10-07';

const aideParId = new Map<string, Aide>(EMBEDDED_AIDES.map((a) => [a.id, a]));
function aide(id: string): Aide {
  const trouvee = aideParId.get(id);
  if (!trouvee) throw new Error(`Aide absente du catalogue embarqué : ${id}`);
  return trouvee;
}

const centimes = (n: number): number => Math.round(n * 100);
const NOM_CPF = aide('nat-cpf').nom;
const NOM_CLEA = aide('nat-clea').nom;

/** Parcours, puis calcul comme l'écran de résultats (estimation de l'OPCO pour les seuls projets de salarié). */
function simuler(over: Partial<WizardState>) {
  const state: WizardState = { ...createInitialWizardState(), trainingMode: 'presentiel', ...over };
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const projet = state.projetType ?? 'formation_salarie';
  const etat = { ...state, trainingDays: state.trainingDays ?? Math.ceil((state.durationHours ?? 0) / 7) };
  const funding =
    opco && (projet === 'formation_salarie' || projet === 'reconversion_salarie') ? calculateFunding(opco, etat) : null;
  const profil = profilDepuisWizard(etat, slug);
  const aides = evaluerAides(EMBEDDED_AIDES, profil, DATE);
  return { aides, profil, plan: construirePlan(funding, aides, profil) };
}

type Resultat = ReturnType<typeof simuler>;
const evaluee = (r: Resultat, id: string) => r.aides.find((a) => a.id === id)!;

/** Identifiants de tout ce que le plan présente, toutes listes confondues. */
function idsDuPlan(plan: PlanFinancement): string[] {
  return [
    ...plan.financements.map((l) => l.id),
    ...plan.options.map((o) => o.id),
    ...plan.aidesEmployeur.map((l) => l.id),
    ...plan.remunerations.map((l) => l.id),
    ...plan.avantagesFiscauxSociaux.map((l) => l.id),
    ...plan.nonChiffrees.map((a) => a.id),
    ...plan.servicesGratuits.map((a) => a.id),
  ];
}

/** Salarié en CDI d'une TPE d'Île-de-France, sans OPCO renseigné : seul le catalogue d'aides finance la formation. */
const SALARIE: Partial<WizardState> = {
  projetType: 'formation_salarie', regionCode: '11', departementCode: '95', companySize: 'less_11', contractType: 'cdi',
  ageBeneficiaire: 35, niveauDiplome: 'bac', formationType: 'certification', eligibleCpf: true,
};

/** Formation de `cout` € sur `heures` h, certification `certification`, solde CPF `solde` €. */
const formation = (certification: CertificationType | null, cout: number, heures: number, solde: number | null): Partial<WizardState> => ({
  certificationLevel: certification,
  durationHours: heures,
  pedagogyCostTotal: cout,
  pedagogyCostPerHour: cout / heures,
  soldeCpf: solde,
});

// --- 1. CléA ----------------------------------------------------------------------------------------------------------

describe("CléA : proposé seulement pour une certification du répertoire spécifique, jamais chiffré ni empilé", () => {
  it('données : critère « répertoire spécifique », montant non chiffré, libellé « pour la certification CléA uniquement »', () => {
    const clea = aide('nat-clea');
    expect(clea.criteres).toEqual({ certifications: ['rs'] });
    expect(clea.montant).toMatchObject({ mode: 'non_chiffre', valeur: null, pourcentage: null, plafond: null });
    expect(clea.montant.libelle).toMatch(/^Pour la certification CléA uniquement/);
    // Le plafond de 1 500 € du répertoire spécifique ne s'applique pas à CléA : la condition reste écrite.
    expect(clea.conditions).toContain("Le plafond CPF de 1 500 € des certifications du répertoire spécifique ne s'applique pas à CléA.");
  });

  it('évaluation : non éligible pour une certification RNCP, éligible sans montant pour le répertoire spécifique, à vérifier si la certification est inconnue', () => {
    const rncp = simuler({ ...SALARIE, ...formation('rncp', 7000, 140, 7000) });
    expect(evaluee(rncp, 'nat-clea')).toMatchObject({
      statut: 'non_eligible',
      raisons: ['Réservé aux formations menant à : Répertoire spécifique (RS)'],
      montantEstime: null,
    });
    const rs = simuler({ ...SALARIE, ...formation('rs', 3000, 70, 4000) });
    expect(evaluee(rs, 'nat-clea')).toMatchObject({ statut: 'eligible', raisons: [], montantEstime: null });
    const inconnue = simuler({ ...SALARIE, ...formation(null, 3000, 70, 4000) });
    expect(evaluee(inconnue, 'nat-clea')).toMatchObject({
      statut: 'a_verifier',
      raisons: ['Précisez la certification visée par la formation'],
      montantEstime: null,
    });
  });

  it("RNCP, solde CPF de 7 000 €, coût de 7 000 € : le CPF finance 7 000 €, CléA n'apparaît nulle part dans le plan", () => {
    // Avant la correction : financements [nat-clea 7 000 €] et le CPF (borné à 5 000 €) « Au choix avec Certificat CléA ».
    // Calcul : CPF = solde de 7 000 €, sous le coût de 7 000 € ; financé 7 000 €, reste 0 €.
    const r = simuler({ ...SALARIE, ...formation('rncp', 7000, 140, 7000) });
    expect(evaluee(r, 'nat-cpf')).toMatchObject({ statut: 'eligible', montantEstime: 7000 });
    expect(r.plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 7000 })]);
    expect(idsDuPlan(r.plan)).not.toContain('nat-clea');
    expect(r.plan.options.filter((o) => o.raison.includes(NOM_CLEA))).toEqual([]);
    expect(r.plan.totalFinance).toBe(7000);
    expect(r.plan.resteACharge).toBe(0);
  });

  it("RNCP, solde CPF de 5 000 €, coût de 5 000 € : plus d'option « au choix » CléA à côté du CPF", () => {
    const r = simuler({ ...SALARIE, ...formation('rncp', 5000, 140, 5000) });
    expect(r.plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 5000 })]);
    expect(idsDuPlan(r.plan)).not.toContain('nat-clea');
  });

  it("répertoire spécifique, solde de 4 000 € : CléA est une option au choix avec le CPF, sans montant, jamais empilée", () => {
    const r = simuler({ ...SALARIE, ...formation('rs', 3000, 70, 4000) });
    expect(r.plan.financements.map((l) => l.id)).not.toContain('nat-clea');
    expect(r.plan.options).toContainEqual(
      expect.objectContaining({ id: 'nat-clea', montantEstime: null, raison: `Au choix avec « ${NOM_CPF} »` }),
    );
  });

  it("répertoire spécifique, éligibilité au CPF inconnue : CléA, seule aide du solde éligible, est listée au montant selon dossier", () => {
    const r = simuler({ ...SALARIE, eligibleCpf: null, ...formation('rs', 3000, 70, 4000) });
    expect(evaluee(r, 'nat-cpf').statut).toBe('a_verifier');
    expect(r.plan.nonChiffrees.map((a) => a.id)).toContain('nat-clea');
    expect(r.plan.financements).toEqual([]);
  });
});

// --- 2. Plafonds du CPF ---------------------------------------------------------------------------------------------------

describe("CPF : plafond d'utilisation de 1 500 € pour le répertoire spécifique, plafond d'alimentation jamais appliqué au solde saisi", () => {
  it("données : aucun plafond sur le solde, une seule majoration, en tête : le répertoire spécifique à 1 500 € (sauf CléA)", () => {
    const cpf = aide('nat-cpf');
    expect(cpf.montant.mode).toBe('solde_cpf');
    expect(cpf.montant.plafond).toBeNull();
    expect(cpf.montant.majorations).toHaveLength(1);
    expect(cpf.montant.majorations![0]).toMatchObject({ criteres: { certifications: ['rs'] }, plafond: 1500 });
    expect(cpf.montant.majorations![0].libelle).toContain('1 500 €');
    expect(cpf.montant.majorations![0].libelle).toContain('CléA');
    // Les plafonds d'alimentation restent écrits, comme information : 5 000 € (800 € par an et 8 000 € dans deux cas).
    expect(cpf.montant.libelle).toContain('5 000 €');
    expect(cpf.montant.libelle).toContain('8 000 €');
  });

  it('répertoire spécifique, solde de 4 000 €, coût de 3 000 € : le CPF finance 1 500 €, reste 1 500 €', () => {
    // Avant la correction : 3 000 € financés, reste 0 €. Calcul : min(solde 4 000 € ; plafond 1 500 €) = 1 500 €, sous le coût ;
    // reste 3 000 - 1 500 = 1 500 €.
    const r = simuler({ ...SALARIE, ...formation('rs', 3000, 70, 4000) });
    expect(evaluee(r, 'nat-cpf')).toMatchObject({ statut: 'eligible', montantEstime: 1500 });
    expect(evaluee(r, 'nat-cpf').libelleMontant).toContain('1 500 €');
    expect(r.plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 1500 })]);
    expect(r.plan.totalFinance).toBe(1500);
    expect(r.plan.resteACharge).toBe(1500);
  });

  it("le plafond de 1 500 € ne vaut que pour le répertoire spécifique : RNCP, CQP et certification inconnue gardent le solde entier", () => {
    for (const certification of ['rncp', 'cqp', 'diplome', null] as const) {
      const r = simuler({ ...SALARIE, ...formation(certification, 3000, 70, 4000) });
      expect(evaluee(r, 'nat-cpf').montantEstime, String(certification)).toBe(3000);
    }
  });

  it('RNCP, sans diplôme, solde de 9 000 €, coût de 9 000 € : le CPF finance 9 000 € (le plafond de 8 000 € est celui des droits acquis)', () => {
    // Avant la correction : CPF borné à 8 000 € (et CléA à 9 000 € empilé à sa place).
    const r = simuler({ ...SALARIE, niveauDiplome: 'sans_diplome', ...formation('rncp', 9000, 140, 9000) });
    expect(evaluee(r, 'nat-cpf')).toMatchObject({ statut: 'eligible', montantEstime: 9000 });
    expect(r.plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 9000 })]);
    expect(idsDuPlan(r.plan)).not.toContain('nat-clea');
    expect(r.plan.resteACharge).toBe(0);
  });

  it('travailleur handicapé, solde de 9 000 € : 9 000 €, sans plafond de 8 000 €', () => {
    const r = simuler({ ...SALARIE, isHandicap: true, ...formation('rncp', 9500, 140, 9000) });
    expect(evaluee(r, 'nat-cpf').montantEstime).toBe(9000);
    expect(r.plan.resteACharge).toBe(500);
  });
});

// --- 3. Dotation de l'employeur ---------------------------------------------------------------------------------------------

describe("dotation volontaire de l'employeur : une dépense de l'employeur, jamais comptée comme un financement", () => {
  it("données : non chiffrée, ni la Caisse des Dépôts ni un montant de 150 € présentés comme une aide", () => {
    const dotation = aide('nat-cpf-abondement-employeur');
    expect(dotation.montant).toMatchObject({ mode: 'non_chiffre', valeur: null, plafond: null });
    expect(dotation.financeur_nom).toMatch(/^L'employeur/);
    expect(dotation.montant.libelle).toContain("argent de l'employeur");
    expect(dotation.description).toContain("argent de l'employeur");
    // La participation forfaitaire de 150 € reste écrite dans les conditions du CPF.
    expect(aide('nat-cpf').conditions.some((c) => c.startsWith('Participation forfaitaire obligatoire de 150 €'))).toBe(true);
  });

  it("AKTO, moins de 11 salariés, RNCP de 140 h à 4 200 €, solde CPF de 1 000 € : AKTO 2 500 € et CPF 1 000 €, reste 700 €", () => {
    // Avant la correction : une troisième ligne de 150 € (nat-cpf-abondement-employeur), reste 550 €, alors que l'employeur paie
    // 700 €. Calcul : barème général d'AKTO, 2 500 € pris en charge ; CPF : solde de 1 000 € ; 4 200 - 2 500 - 1 000 = 700 €.
    const r = simuler({ ...SALARIE, selectedOpcoSlug: 'akto', ...formation('rncp', 4200, 140, 1000) });
    expect(r.plan.financements).toEqual([
      expect.objectContaining({ id: 'opco-pdc', montant: 2500 }),
      expect.objectContaining({ id: 'nat-cpf', montant: 1000 }),
    ]);
    expect(r.plan.totalFinance).toBe(3500);
    expect(r.plan.resteACharge).toBe(700);
    expect(evaluee(r, 'nat-cpf-abondement-employeur')).toMatchObject({ statut: 'eligible', montantEstime: null });
    expect(r.plan.nonChiffrees.map((a) => a.id)).toContain('nat-cpf-abondement-employeur');
  });
});

// --- 4. Balayage de profils ---------------------------------------------------------------------------------------------------

describe('balayage de 1 200 profils tirés au hasard (graine 53)', () => {
  // mulberry32 : tirages indépendants et reproductibles.
  let graine = 53;
  const hasard = (n: number): number => {
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
  const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
  const PROJETS: ProjetType[] = ['formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi', 'formation_dirigeant'];
  const resultats = Array.from({ length: 1200 }, () => {
    const projet = un(PROJETS);
    const heures = un([14, 24, 70, 140]);
    const cout = un([900, 1600, 3000, 4200, 7000, 9000, 12600]);
    const over: Partial<WizardState> = {
      ...SALARIE,
      projetType: projet,
      selectedOpcoSlug: un([null, 'akto', 'atlas', 'opcommerce', 'uniformation']),
      detectedIdcc: un([null, '1516']),
      companySize: un(['less_11', '11_49', '50_299'] as const),
      niveauDiplome: un(['sans_diplome', 'bac'] as const),
      isHandicap: un([false, true]),
      inscritFranceTravail: un([null, true]),
      statutDirigeant: un(['artisan', 'commercant', 'assimile_salarie'] as const),
      formationType: un(['certification', 'qualification', 'vae', null] as const),
      eligibleCpf: un([true, false, null]),
      ...formation(un(['rncp', 'rs', 'cqp', null] as const), cout, heures, un([null, 0, 800, 1500, 4000, 9000])),
    };
    return { over, ...simuler(over) };
  });

  it("la dotation de l'employeur n'entre jamais dans la pile et n'est jamais chiffrée", () => {
    const vues = resultats.filter((r) => r.aides.some((a) => a.id === 'nat-cpf-abondement-employeur' && a.statut === 'eligible'));
    expect(vues.length).toBeGreaterThan(100); // le contrôle n'est pas vide
    for (const r of resultats) {
      expect(r.plan.financements.map((l) => l.id), JSON.stringify(r.over)).not.toContain('nat-cpf-abondement-employeur');
      expect(evaluee(r, 'nat-cpf-abondement-employeur').montantEstime).toBeNull();
    }
  });

  it("CléA n'est jamais empilé ni gagnant d'une option, et n'est visible que pour le répertoire spécifique ou une certification inconnue", () => {
    expect(resultats.filter((r) => evaluee(r, 'nat-clea').statut === 'eligible').length).toBeGreaterThan(50);
    for (const r of resultats) {
      const contexte = JSON.stringify(r.over);
      expect(r.plan.financements.map((l) => l.id), contexte).not.toContain('nat-clea');
      expect(r.plan.options.filter((o) => o.raison.includes(NOM_CLEA)), contexte).toEqual([]);
      if (evaluee(r, 'nat-clea').statut !== 'non_eligible') expect(['rs', null], contexte).toContain(r.profil.certification);
    }
  });

  it('répertoire spécifique : la ligne du CPF ne dépasse jamais 1 500 € ; ailleurs, elle vaut le solde dans la limite du coût', () => {
    let rs = 0;
    for (const r of resultats) {
      const cpf = evaluee(r, 'nat-cpf');
      if (cpf.statut !== 'eligible' || cpf.montantEstime == null) continue;
      const solde = r.profil.soldeCpf ?? 0;
      const cout = (r.profil.coutPedagogique ?? 0) + r.profil.coutFraisAnnexes;
      if (r.profil.certification === 'rs') {
        rs++;
        expect(cpf.montantEstime, JSON.stringify(r.over)).toBe(Math.min(solde, 1500, cout));
      } else {
        expect(cpf.montantEstime, JSON.stringify(r.over)).toBe(Math.min(solde, cout));
      }
    }
    expect(rs).toBeGreaterThan(50);
  });

  it('invariants du plan : financé et reste redonnent le coût au centime, lignes prélevées sur le solde CPF sous le solde', () => {
    const surSolde = new Set(EMBEDDED_AIDES.filter((a) => a.montant.mode === 'solde_cpf').map((a) => a.id));
    for (const r of resultats) {
      const contexte = JSON.stringify(r.over);
      const { plan } = r;
      expect(centimes(plan.totalFinance + plan.resteACharge), contexte).toBe(centimes(plan.coutFormation));
      expect(centimes(plan.financements.reduce((s, l) => s + l.montant, 0)), contexte).toBe(centimes(plan.totalFinance));
      const preleve = plan.financements.filter((l) => surSolde.has(l.id)).reduce((s, l) => s + l.montant, 0);
      expect(centimes(preleve), contexte).toBeLessThanOrEqual(centimes(r.profil.soldeCpf ?? 0));
      const pasEligibles = new Set(r.aides.filter((a) => a.statut !== 'eligible').map((a) => a.id));
      expect(idsDuPlan(plan).filter((id) => pasEligibles.has(id)), contexte).toEqual([]);
    }
  });
});
