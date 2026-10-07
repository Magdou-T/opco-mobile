// ============================================================
// Cinq scénarios de bout en bout sur les données réelles embarquées : parcours (WizardState), calcul OPCO, profil, évaluation
// des aides, plan de financement, dans l'enchaînement de l'écran de résultats.
// Les valeurs attendues sont calculées à la main à partir des données vérifiées (octobre 2026) et des pages officielles citées
// en commentaire, avec le calcul : le test ne rejoue pas le moteur. Un écart signale une donnée ou un calcul à revoir, pas une
// attente à recopier. Les grilles de profils et les balayages du catalogue sont dans donnees-aides-coherence.test.ts.
// ============================================================

import { describe, it, expect } from 'vitest';
import { calculateFunding } from '../src/calculator';
import { construirePlan, type PlanFinancement } from '../src/aides/plan';
import { evaluerAides } from '../src/aides/evaluer';
import { profilDepuisWizard } from '../src/aides/profil';
import type { AideEvaluee, Financeur } from '../src/aides/types';
import { EMBEDDED_AIDES, getEmbeddedOpcoBySlug } from '../src/data';
import { createInitialWizardState, type PosteFinancement, type WizardState } from '../src/types';

/**
 * Date d'évaluation fixe : le résultat ne dépend pas du jour où les tests s'exécutent. Certaines aides ont une période de
 * validité (l'aide exceptionnelle aux employeurs d'apprentis court jusqu'au 31/12/2026) : avec la date du jour, les calculs
 * faits à la main sur les données d'octobre 2026 ne vaudraient plus après cette échéance.
 */
const DATE = '2026-10-07';

const aideParId = new Map(EMBEDDED_AIDES.map((a) => [a.id, a]));
const centimes = (n: number): number => Math.round(n * 100);

/**
 * Parcours, puis calcul comme l'écran de résultats : l'estimation du plan de développement des compétences (OPCO) ne concerne
 * que les salariés (former un salarié, reconversion) ; les aides du catalogue sont évaluées pour tous les projets.
 */
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
  return { funding, aides, profil, plan: construirePlan(funding, aides, profil) };
}

type Resultat = ReturnType<typeof simuler>;

/** Identifiants de tout ce que le plan présente, toutes listes confondues (aides du catalogue et lignes OPCO). */
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

/** Invariants communs à tous les scénarios. */
function invariants(r: Resultat) {
  const { plan, aides, profil } = r;

  // Le financé et le reste à charge redonnent le coût de la formation au centime ; le reste n'est jamais négatif.
  expect(centimes(plan.totalFinance + plan.resteACharge)).toBe(centimes(plan.coutFormation));
  expect(plan.totalFinance).toBeLessThanOrEqual(plan.coutFormation);
  expect(plan.resteACharge).toBeGreaterThanOrEqual(0);

  // Aucune ligne du plan ne provient d'une aide « à vérifier » ou non éligible (les lignes de l'OPCO, « opco-… », ne sont pas des aides du catalogue).
  const statuts = new Map(aides.map((a) => [a.id, a.statut]));
  for (const id of idsDuPlan(plan)) {
    if (statuts.has(id)) expect(statuts.get(id), `${id} dans le plan`).toBe('eligible');
  }

  // Les lignes prélevées sur le solde CPF ne dépassent pas ce solde (un solde inconnu vaut 0 : le plan ne compte alors aucune de ces lignes).
  const modes = new Map(aides.map((a) => [a.id, a.modeMontant]));
  const surSolde = plan.financements.filter((l) => modes.get(l.id) === 'solde_cpf').reduce((somme, l) => somme + l.montant, 0);
  expect(centimes(surSolde), 'lignes prélevées sur le solde CPF').toBeLessThanOrEqual(centimes(profil.soldeCpf ?? 0));

  // Une aide visible a au moins une source, et une aide régionale visible vise la région de référence du profil.
  for (const a of aides.filter((x) => x.statut !== 'non_eligible')) {
    const aide = aideParId.get(a.id)!;
    if (aide.criteres.regions?.length) {
      const region =
        aide.criteres.perimetre_region === 'beneficiaire'
          ? (profil.regionBeneficiaire ?? profil.regionEntreprise)
          : profil.regionEntreprise;
      if (region != null) expect(aide.criteres.regions, a.id).toContain(region);
    }
    expect(a.sources.length, a.id).toBeGreaterThan(0);
  }
}

const visibles = (aides: AideEvaluee[], financeur: Financeur) =>
  aides.filter((a) => a.statut !== 'non_eligible' && a.financeur === financeur);

const ligne = (r: Resultat, poste: PosteFinancement) => r.funding!.lines.find((l) => l.poste === poste)!;

describe('scénarios de bout en bout (données réelles)', () => {
  it("1. TPE d'Île-de-France (AKTO, organismes de formation), salarié en CDI, RNCP 140 h à 4 200 €", () => {
    const parcours: Partial<WizardState> = {
      projetType: 'formation_salarie', selectedOpcoSlug: 'akto', detectedIdcc: '1516', regionCode: '11', departementCode: '95',
      companySize: 'less_11', contractType: 'cdi', ageBeneficiaire: 35, certificationLevel: 'rncp', formationType: 'certification',
      eligibleCpf: true, durationHours: 140, pedagogyCostTotal: 4200, pedagogyCostPerHour: 30,
    };
    const r = simuler(parcours);
    invariants(r);

    // Calcul à la main : barème AKTO « Organismes de formation » (IDCC 1516), page
    // https://www.akto.fr/regles-de-prise-en-charge-organisme-de-formation/ : coûts pédagogiques plafonnés à 60 €/h, rémunération au
    // forfait de 15 €/h, plafond annuel de 10 000 € par entreprise pour les coûts pédagogiques.
    //   pédagogie : min(30 €/h ; 60 €/h) x 140 h = 30 x 140 = 4 200 €, sous le plafond annuel de 10 000 € : pris en charge en entier, reste 0 ;
    //   salaires : 15 €/h x 140 h = 2 100 €, versés hors plafond annuel (aide à l'employeur, présentée à part) ;
    //   total estimé par l'OPCO : 4 200 + 2 100 = 6 300 €.
    expect(r.funding!.brancheAppliquee).toBe('Organismes de formation');
    expect(ligne(r, 'pedagogie')).toMatchObject({ requestedAmount: 4200, fundedAmount: 4200, remainder: 0, confidence: 'exact' });
    expect(ligne(r, 'salaires')).toMatchObject({ fundedAmount: 2100 });
    expect(r.funding!.totalFunded).toBe(6300);
    expect(r.funding!.budgetCapApplied).toBe(false);
    // La page d'AKTO annonce l'enveloppe du plan de développement des compétences de cette branche épuisée : l'alerte est restituée.
    expect(r.funding!.alertes.map((a) => [a.type, a.branche])).toContainEqual(['fonds_epuises', 'Organismes de formation']);
    expect(r.funding!.warnings.join(' ')).toMatch(/« Organismes de formation » est épuisée/);

    // Plan : l'OPCO couvre tout le coût de la formation (4 200 €) ; les salaires (2 100 €) sont une aide à l'employeur, jamais déduits du coût.
    expect(r.plan.coutFormation).toBe(4200);
    expect(r.plan.financements).toEqual([
      { id: 'opco-pdc', nom: 'Plan de développement des compétences', financeurNom: 'AKTO', montant: 4200, confidence: 'exact' },
    ]);
    expect(r.plan.totalFinance).toBe(4200);
    expect(r.plan.resteACharge).toBe(0);
    expect(r.plan.aidesEmployeur).toContainEqual(expect.objectContaining({ id: 'opco-salaires', montant: 2100 }));
    expect(visibles(r.aides, 'cpf').length).toBeGreaterThan(0);

    // Une formation RNCP n'est pas une VAE : aucune aide dont l'identifiant contient « vae » n'est visible, aucune n'est dans le plan.
    const vae = r.aides.filter((a) => a.id.includes('vae'));
    expect(vae.length).toBeGreaterThan(0); // le catalogue en contient : le contrôle n'est pas vide
    expect(vae.filter((a) => a.statut !== 'non_eligible').map((a) => a.id)).toEqual([]);
    expect(idsDuPlan(r.plan).filter((id) => id.includes('vae'))).toEqual([]);

    // Variante : le même salarié chez un organisme à 90 €/h (12 600 €), avec 800 € sur son compte CPF.
    //   pédagogie : min(90 ; 60) x 140 h = 60 x 140 = 8 400 € pris en charge, reste (90 - 60) x 140 = 4 200 € ; 8 400 € < 10 000 € : le plafond annuel ne joue pas ;
    //   plan : l'OPCO d'abord (8 400 €), puis le CPF, limité à son solde (800 €, sous le reste de 4 200 €).
    const cher = simuler({ ...parcours, pedagogyCostPerHour: 90, pedagogyCostTotal: 12600, soldeCpf: 800 });
    invariants(cher);
    expect(ligne(cher, 'pedagogie')).toMatchObject({ requestedAmount: 12600, fundedAmount: 8400, remainder: 4200 });
    expect(cher.funding!.budgetCapApplied).toBe(false);
    expect(cher.plan.financements).toContainEqual(expect.objectContaining({ id: 'opco-pdc', montant: 8400 }));
    expect(cher.plan.financements).toContainEqual(expect.objectContaining({ id: 'nat-cpf', montant: 800 }));
  });

  it('2. Entreprise de 120 salariés : règle des 50 salariés', () => {
    const r = simuler({
      projetType: 'formation_salarie', selectedOpcoSlug: 'atlas', regionCode: '84', companySize: '50_299', effectif: 120,
      contractType: 'cdi', formationType: 'non_certifiante', durationHours: 35, pedagogyCostTotal: 1400, pedagogyCostPerHour: 40,
    });
    invariants(r);

    // Calcul à la main : 35 h x 40 €/h = 1 400 € demandés. Les fonds mutualisés du plan de développement des compétences sont
    // réservés aux entreprises de moins de 50 salariés (art. L. 6332-17 du code du travail) et Atlas ne publie aucune enveloppe
    // conventionnelle ou volontaire pour les 50 à 299 salariés (page https://www.opco-atlas.fr/entreprise/plan-dev-competences.html ;
    // atlas.json, plafonds_par_taille[50_299].budget_annuel_max absent) : prise en charge 0 €, reste 1 400 €.
    const enveloppe = getEmbeddedOpcoBySlug('atlas')!.plafonds_par_taille?.find((p) => p.taille === '50_299')?.budget_annuel_max;
    expect(enveloppe ?? null).toBeNull(); // donnée vérifiée le 05/10/2026 : si Atlas publie une enveloppe, ce scénario est à recalculer
    expect(r.funding!.pdcFerme).toBe(enveloppe == null);
    expect(r.funding!.pdcFerme).toBe(true);
    expect(r.funding!.totalRequested).toBe(1400);
    expect(r.funding!.totalFunded).toBe(0);
    expect(r.funding!.totalRemainder).toBe(1400);
    expect(r.funding!.dispositifPrincipal).toContain('non accessibles');
    // Messages du moteur pour une entreprise de 50 salariés ou plus (textes réels de warnings[0] et de demarches[0]).
    expect(r.funding!.warnings.join(' ')).toMatch(/réservés aux entreprises de moins de 50 salariés \(art\. L\. 6332-17 du code du travail\)/);
    expect(r.funding!.demarches[0]).toMatch(/^Votre entreprise compte 50 salariés ou plus : /);

    // Plan : aucune ligne empilée, le coût reste entièrement à charge ; le FSE+ d'Atlas, alternative au plan de développement des
    // compétences (non cumulable), est proposé en option : 50 % x 1 400 € = 700 € (« Le FSE+ prend en charge 50 % des coûts
    // pédagogiques », https://www.opco-atlas.fr/entreprise/beneficier-fse.html).
    expect(r.plan.coutFormation).toBe(1400);
    expect(r.plan.financements).toEqual([]);
    expect(r.plan.totalFinance).toBe(0);
    expect(r.plan.resteACharge).toBe(1400);
    expect(r.plan.options).toContainEqual(expect.objectContaining({ id: 'opco-fse-plus', montantEstime: 700 }));
  });

  it("3. Recrutement d'un demandeur d'emploi en Occitanie", () => {
    const r = simuler({
      projetType: 'recrutement_demandeur_emploi', selectedOpcoSlug: 'akto', regionCode: '76', companySize: '11_49',
      inscritFranceTravail: true, ageBeneficiaire: 28, formationType: 'qualification', durationHours: 280, pedagogyCostTotal: 3500,
      pedagogyCostPerHour: 12.5,
    });
    invariants(r);
    expect(visibles(r.aides, 'france_travail').length).toBeGreaterThan(0);

    // Calcul à la main : rémunération de formation de France Travail (RFFT) d'un demandeur d'emploi de 26 ans et plus : 775,65 € par
    // mois de formation à temps plein (https://www.service-public.gouv.fr/particuliers/vosdroits/F760). Un mois à temps plein compte
    // 151,67 h (35 h x 52 semaines / 12) : 280 h / 151,67 h = 1,846 mois, soit 775,65 x 280 / 151,67 = 1 431,94 € (arrondi au centime).
    const rfft = r.aides.find((a) => a.id === 'nat-rfft')!;
    expect(rfft).toMatchObject({ statut: 'eligible', categorie: 'remuneration_beneficiaire', montantEstime: 1431.94 });
    // La rémunération est un revenu de la personne : présentée à part, jamais déduite du coût de la formation (3 500 €).
    expect(r.plan.remunerations).toContainEqual(expect.objectContaining({ id: 'nat-rfft', montant: 1431.94 }));
    expect(r.plan.financements.map((l) => l.id)).not.toContain('nat-rfft');
    expect(r.plan.coutFormation).toBe(3500);
  });

  it('4. Apprenti de 19 ans en Hauts-de-France', () => {
    const r = simuler({
      projetType: 'alternance', selectedOpcoSlug: 'akto', regionCode: '32', companySize: '11_49', typeAlternance: 'apprentissage',
      ageBeneficiaire: 19, niveauFormationVise: 4, formationType: 'qualification', durationHours: 800, pedagogyCostTotal: 7000,
      pedagogyCostPerHour: 8.75,
    });
    invariants(r);
    expect(r.aides.some((a) => a.statut !== 'non_eligible' && a.categorie === 'aide_employeur')).toBe(true);

    // Calcul à la main : aide unique aux employeurs d'apprentis, 5 000 € pour la 1re année quand l'apprenti prépare un diplôme de
    // niveau 4 (baccalauréat) au plus dans une entreprise de moins de 250 salariés
    // (https://entreprendre.service-public.gouv.fr/vosdroits/F23556) : niveau 4, entreprise de 11 à 49 salariés, donc 5 000 €.
    const aideUnique = r.aides.find((a) => a.id === 'nat-aide-unique-apprentissage')!;
    expect(aideUnique).toMatchObject({ statut: 'eligible', categorie: 'aide_employeur', montantEstime: 5000 });
    // Aide à l'employeur : présentée à part. L'aide exceptionnelle 2026 ne vise pas ce cas (entreprises de moins de 250 salariés :
    // niveau 5 à 4 500 €, niveaux 6 et 7 à 2 000 € ; entreprises de 250 salariés et plus : autre barème) et n'est pas cumulable avec l'aide unique.
    expect(r.plan.aidesEmployeur).toContainEqual(expect.objectContaining({ id: 'nat-aide-unique-apprentissage', montant: 5000 }));
    expect(r.plan.financements.map((l) => l.id)).not.toContain('nat-aide-unique-apprentissage');
    for (const id of [
      'nat-aide-exceptionnelle-apprentissage-pme-niveau5',
      'nat-aide-exceptionnelle-apprentissage-pme-niveaux-6-7',
      'nat-aide-exceptionnelle-apprentissage-250-plus',
    ]) {
      expect(r.aides.find((a) => a.id === id)?.statut, id).toBe('non_eligible');
    }
  });

  it('5. Artisan non salarié en Bretagne', () => {
    const r = simuler({
      projetType: 'formation_dirigeant', regionCode: '53', companySize: 'less_11', statutDirigeant: 'artisan',
      microEntrepreneur: false, ageBeneficiaire: 45, formationType: 'non_certifiante', organismeQualiopi: true, durationHours: 21,
      pedagogyCostTotal: 900, pedagogyCostPerHour: 42.86,
    });
    invariants(r);
    expect(visibles(r.aides, 'faf').length).toBeGreaterThan(0);
    expect(r.plan.resteACharge).toBeGreaterThanOrEqual(0);

    // Aucun avantage fiscal ni social n'est à attendre : le crédit d'impôt pour dépenses de formation des dirigeants (CGI, art. 244
    // quater M) est supprimé par la loi de finances pour 2026 (loi n° 2026-103 du 19 février 2026, art. 17), BOFiP BOI-BIC-RICI-10-20260506
    // https://bofip.impots.gouv.fr/bofip/4766-PGP.html/identifiant%3DBOI-BIC-RICI-10-20260506 ; la recherche vérifiée
    // (docs/recherche-aides/2026-10/nat-3-handicap-ue-dirigeants.verifie.json, rubrique « exclues » et notes) n'a trouvé aucun autre
    // avantage fiscal ou social lié au coût de la formation. L'attente d'une aide « fiscal » visible n'a donc pas lieu d'être.

    // Calcul à la main : FAFCEA (fonds des artisans), critères du 1er septembre 2026, formation technique (secteur Services et
    // Fabrication) : 35 €/h dans la limite de 100 h, soit 35 x 21 h = 735 € (sous les 900 € du coût de la formation).
    // https://www.fafcea.com/wp-content/uploads/2026/07/Criteres-SF-1-sept-2026.pdf
    // Depuis le 1er juillet 2026 le FAFCEA ne finance que les organismes certifiés Qualiopi (https://www.fafcea.com/) : le parcours le précise.
    const fafcea = r.aides.find((a) => a.id === 'faf-fafcea')!;
    expect(fafcea).toMatchObject({ statut: 'eligible', financeur: 'faf', montantEstime: 735 });
    // Attente adaptée : « le plan finance quelque chose » devient « le FAFCEA figure dans le plan en option ». Le FAFCEA est déclaré
    // non cumulable (il n'intervient qu'en cas de refus du CPF pour la VAE, le bilan de compétences et les formations RNCP, mêmes
    // critères du 1er septembre 2026) : le plan le propose à comparer avec les autres financements, sans l'empiler contre le coût.
    expect(r.plan.options).toContainEqual(expect.objectContaining({ id: 'faf-fafcea', montantEstime: 735 }));
    expect(r.plan.financements.map((l) => l.id)).not.toContain('faf-fafcea');
    expect(r.plan.coutFormation).toBe(900);
  });
});
