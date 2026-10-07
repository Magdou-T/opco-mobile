// ============================================================
// Cinq scénarios de bout en bout (le cinquième avec des variantes de Qualiopi et du CPF) sur les données réelles embarquées : parcours
// (WizardState), calcul OPCO, profil, évaluation des aides, plan de financement, dans l'enchaînement de l'écran de résultats.
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
import { ALERTE_OPCO_LABELS, createInitialWizardState, type PosteFinancement, type WizardState } from '../src/types';

/**
 * Date d'évaluation fixe : le résultat ne dépend pas du jour où les tests s'exécutent. Certaines aides ont une période de
 * validité (l'aide exceptionnelle aux employeurs d'apprentis court jusqu'au 31/12/2026) : avec la date du jour, les calculs
 * faits à la main sur les données d'octobre 2026 ne vaudraient plus après cette échéance.
 */
const DATE = '2026-10-07';

/** U+2014, construit par son code : le tiret cadratin ne figure pas dans ce fichier (charte SFG). */
const TIRET_CADRATIN = String.fromCharCode(0x2014);

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

/**
 * Tout texte que le résultat d'un scénario met sous les yeux de l'utilisateur, avec son origine : estimation de l'OPCO
 * (dispositif principal, libellés et détails des lignes, messages, conditions, démarches, alertes, dispositifs complémentaires,
 * étapes, paiement), aides évaluées (noms, descriptions, raisons, conditions, libellés de montant, notes de cumul, démarches,
 * titres des sources) et plan (noms des lignes et des options, raisons). L'extrait d'une alerte et celui d'une source sont des
 * citations mot pour mot, affichées entre « » : ils ne sont pas repris.
 */
function textesAffiches(r: Resultat): { origine: string; texte: string }[] {
  const textes: { origine: string; texte: string }[] = [];
  const ajouter = (origine: string, ...valeurs: (string | null | undefined)[]) => {
    for (const texte of valeurs) if (texte) textes.push({ origine, texte });
  };
  const { funding, aides, plan } = r;
  if (funding) {
    ajouter('funding.dispositifPrincipal', funding.dispositifPrincipal);
    for (const l of funding.lines) ajouter(`funding.lines[${l.poste}]`, l.label, l.note, ...(l.details ?? []));
    ajouter('funding.warnings', ...funding.warnings);
    ajouter('funding.conditions', ...funding.conditions);
    ajouter('funding.demarches', ...funding.demarches);
    for (const a of funding.alertes) ajouter(`funding.alertes[${a.branche}]`, a.branche, ALERTE_OPCO_LABELS[a.type]);
    for (const d of funding.dispositifsComplementaires) {
      ajouter(`funding.dispositifsComplementaires[${d.id}]`, d.nom, d.description, ...d.conditions, d.demarches, d.publics, d.note);
    }
    ajouter('funding.nextSteps', ...funding.nextSteps.map((s) => s.label));
    ajouter('funding.paiement', funding.modePaiement, funding.delaiValidation);
  }
  for (const a of aides) {
    ajouter(
      `aides[${a.id}]`,
      a.nom, a.financeurNom, a.description, ...a.raisons, ...a.conditions, a.libelleMontant, a.noteCumul, ...a.demarches,
      ...a.sources.map((s) => s.titre),
    );
  }
  for (const l of [...plan.financements, ...plan.aidesEmployeur, ...plan.remunerations, ...plan.avantagesFiscauxSociaux]) {
    ajouter(`plan[${l.id}]`, l.nom, l.financeurNom);
  }
  for (const o of plan.options) ajouter(`plan.options[${o.id}]`, o.nom, o.financeurNom, o.raison);
  return textes;
}

/** Invariants communs à tous les scénarios. */
function invariants(r: Resultat) {
  const { plan, aides, profil } = r;

  // Charte SFG : aucun texte affiché à l'utilisateur ne contient de tiret cadratin (U+2014).
  const textes = textesAffiches(r);
  expect(textes.length).toBeGreaterThan(100); // le contrôle n'est pas vide
  expect(textes.filter(({ texte }) => texte.includes(TIRET_CADRATIN)).map(({ origine }) => origine)).toEqual([]);

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
    // https://www.akto.fr/regles-de-prise-en-charge-organisme-de-formation/ : coûts pédagogiques plafonnés à 60 €/h (même plafond pour
    // toutes les formations hors Espace Formation, donc pour une certification), rémunération au forfait de 15 €/h, plafond annuel de
    // 10 000 € par entreprise pour les coûts pédagogiques.
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
    //   plan, trois lignes empilées par ordre d'empilement : l'OPCO d'abord (8 400 €), puis le CPF, limité à son solde (800 €, sous le
    //   reste de 4 200 €), puis l'abondement de l'employeur sur le CPF (nat-cpf-abondement-employeur), un forfait de 150 € : la
    //   participation forfaitaire de 150 € que le salarié n'a plus à payer quand son employeur abonde son CPF
    //   (https://www.service-public.gouv.fr/particuliers/vosdroits/F10705). Le catalogue la compte comme un financement du salarié
    //   éligible au CPF, sans savoir si l'employeur abonde réellement ;
    //   financé : 8 400 + 800 + 150 = 9 350 € ; reste à charge : 12 600 - 9 350 = 3 250 €.
    const cher = simuler({ ...parcours, pedagogyCostPerHour: 90, pedagogyCostTotal: 12600, soldeCpf: 800 });
    invariants(cher);
    expect(ligne(cher, 'pedagogie')).toMatchObject({ requestedAmount: 12600, fundedAmount: 8400, remainder: 4200 });
    expect(cher.funding!.budgetCapApplied).toBe(false);
    expect(cher.plan.financements).toEqual([
      expect.objectContaining({ id: 'opco-pdc', montant: 8400 }),
      expect.objectContaining({ id: 'nat-cpf', montant: 800 }),
      expect.objectContaining({ id: 'nat-cpf-abondement-employeur', montant: 150 }),
    ]);
    expect(cher.plan.totalFinance).toBe(9350);
    expect(cher.plan.resteACharge).toBe(3250);
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
    expect(r.funding!.dispositifPrincipal).toBe(
      'Plan de développement des compétences : fonds mutualisés non accessibles (50 salariés et plus)',
    );
    // Messages du moteur pour une entreprise de 50 salariés ou plus (textes réels de warnings[0] et de demarches[0]).
    expect(r.funding!.warnings.join(' ')).toMatch(/réservés aux entreprises de moins de 50 salariés \(art\. L\. 6332-17 du code du travail\)/);
    expect(r.funding!.demarches[0]).toMatch(/^Votre entreprise compte 50 salariés ou plus : /);

    // Plan : aucune ligne empilée, le coût reste entièrement à charge ; le FSE+ d'Atlas, alternative au plan de développement des
    // compétences (non cumulable), est proposé en option : 50 % x 1 400 € = 700 € (« Le FSE+ prend en charge 50 % des coûts
    // pédagogiques », https://www.opco-atlas.fr/entreprise/beneficier-fse.html). Ces 700 € ne valent que pour une formation des
    // thèmes que finance le FSE+ (transitions numérique, écologique et démographique, management de projet, diversité), en présence
    // continue d'un formateur et d'au moins 3,5 h (formations internes et à distance exclues), dans la limite des fonds disponibles
    // (page d'Atlas citée ci-dessus ; conditions de l'option fse-plus dans atlas.json) : le parcours ne précise pas le thème, l'option
    // reste donc à confirmer auprès d'Atlas.
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
    const parcours: Partial<WizardState> = {
      projetType: 'formation_dirigeant', regionCode: '53', companySize: 'less_11', statutDirigeant: 'artisan',
      microEntrepreneur: false, ageBeneficiaire: 45, formationType: 'non_certifiante', organismeQualiopi: true, durationHours: 21,
      pedagogyCostTotal: 900, pedagogyCostPerHour: 42.86,
    };
    const r = simuler(parcours);
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
    // Hypothèses de ce chiffre :
    //   - la contribution à la formation professionnelle (CFP) de l'entreprise dépasse 85 € : avec une CFP de 85 € ou moins, le FAFCEA
    //     plafonne la prise en charge à 600 € par an et par entreprise pour les formations à compter du 1er septembre 2026, soit 600 €
    //     et non 735 € ici (https://www.fafcea.com/actualites/evolution-criteres-prise-en-charge-formation-2026/). Le parcours n'a
    //     pas de champ pour la CFP : le catalogue chiffre le barème complet ;
    //   - `microEntrepreneur: false` : le parcours le précise, mais aucun critère du FAFCEA ni d'aucune aide du catalogue n'en dépend ;
    //     il ne change pas ce montant (une CFP de 85 € ou moins reste possible quel que soit le statut) ;
    //   - le secteur est celui des Services et de la Fabrication, ou du Bâtiment (35 €/h, 100 h) ; l'Alimentation a son barème
    //     (60 €/h, 54 h), d'où la confiance « depends_on_branche » de l'aide ;
    //   - le FAFCEA ne finance que les organismes certifiés Qualiopi depuis le 1er juillet 2026 (https://www.fafcea.com/) : le parcours
    //     le précise (`organismeQualiopi: true`), les variantes plus bas montrent ce qui change sans cette précision.
    const fafcea = r.aides.find((a) => a.id === 'faf-fafcea')!;
    expect(fafcea).toMatchObject({ statut: 'eligible', financeur: 'faf', montantEstime: 735, cumulable: true });

    // Plan : le FAFCEA est le seul financement de l'artisan. Sa seule restriction de cumul porte sur le CPF (pour la VAE, le bilan de
    // compétences et les formations RNCP, il n'intervient qu'en cas de refus du CPF) : elle ne vise pas cette formation technique non
    // certifiante, et le plan l'empile contre le coût de la formation.
    //   financé : 735 € (la ligne du FAFCEA) ; reste à charge : 900 - 735 = 165 €.
    // Le CPF n'est pas compté : l'éligibilité de la formation au CPF est inconnue, l'aide est seulement « à vérifier ».
    expect(r.plan.coutFormation).toBe(900);
    expect(r.plan.financements).toEqual([expect.objectContaining({ id: 'faf-fafcea', montant: 735, confidence: 'depends_on_branche' })]);
    expect(r.plan.totalFinance).toBe(735);
    expect(r.plan.resteACharge).toBe(165);
    expect(r.plan.options.map((o) => o.id)).not.toContain('faf-fafcea');
    expect(r.aides.find((a) => a.id === 'nat-cpf')).toMatchObject({ statut: 'a_verifier', raisons: ['Vérifiez que la formation est éligible au CPF'] });
    expect(idsDuPlan(r.plan)).not.toContain('nat-cpf');

    // Variante : l'organisme n'est pas précisé (`organismeQualiopi: null`). Le FAFCEA exige un organisme certifié Qualiopi : sans cette
    // information l'aide est seulement « à vérifier », et le plan, qui ne compte que les aides éligibles, n'empile rien :
    //   financé : 0 € ; reste à charge : 900 €. C'est pourquoi le parcours de référence renseigne `organismeQualiopi: true`.
    const inconnu = simuler({ ...parcours, organismeQualiopi: null });
    invariants(inconnu);
    expect(inconnu.aides.find((a) => a.id === 'faf-fafcea')).toMatchObject({
      statut: 'a_verifier', raisons: ["Vérifiez que l'organisme de formation est certifié Qualiopi"],
    });
    expect(inconnu.plan.financements).toEqual([]);
    expect(idsDuPlan(inconnu.plan)).not.toContain('faf-fafcea');
    expect(inconnu.plan.totalFinance).toBe(0);
    expect(inconnu.plan.resteACharge).toBe(900);

    // Variante : l'organisme n'est pas certifié Qualiopi (`organismeQualiopi: false`) : le FAFCEA ne finance pas ; mêmes montants.
    const sansQualiopi = simuler({ ...parcours, organismeQualiopi: false });
    invariants(sansQualiopi);
    expect(sansQualiopi.aides.find((a) => a.id === 'faf-fafcea')).toMatchObject({
      statut: 'non_eligible', raisons: ['Organisme de formation certifié Qualiopi exigé'],
    });
    expect(sansQualiopi.plan.financements).toEqual([]);
    expect(sansQualiopi.plan.totalFinance).toBe(0);
    expect(sansQualiopi.plan.resteACharge).toBe(900);
  });

  it("5 bis. Artisan en Bretagne, formation RNCP éligible au CPF : le FAFCEA n'intervient qu'en cas de refus du CPF, le plan ne compte que le CPF", () => {
    // Formation certifiante RNCP de 140 h à 4 200 € (30 €/h), éligible au CPF, organisme Qualiopi.
    // Critères du FAFCEA du 1er septembre 2026 (https://www.fafcea.com/wp-content/uploads/2026/07/Criteres-SF-1-sept-2026.pdf), ligne
    // « Formations diplômantes et certifiantes inscrites au RNCP » : « Prise en charge dans le cas d’un refus de prise en charge du CPF
    // à hauteur de 7 500€ par action dans la limite d’un coût horaire maximum de 30€, après avis des commissions techniques et validation
    // par le Conseil d’Administration ». Le FAFCEA n'est donc qu'un repli après un refus du CPF, et son montant dépend de l'avis des
    // commissions techniques : le plan le liste sans le compter. Il ne reprend pas le tarif de la formation technique (35 €/h, soit
    // 35 x 100 h = 3 500 € au plus), qui ne vaut pas pour une formation RNCP.
    // Le CPF, lui, est le droit du titulaire : son solde, plafond de 5 000 € non atteint.
    const parcours: Partial<WizardState> = {
      projetType: 'formation_dirigeant', regionCode: '53', companySize: 'less_11', statutDirigeant: 'artisan', microEntrepreneur: false,
      ageBeneficiaire: 45, formationType: 'certification', certificationLevel: 'rncp', niveauFormationVise: 5, eligibleCpf: true,
      organismeQualiopi: true, durationHours: 140, pedagogyCostTotal: 4200, pedagogyCostPerHour: 30,
    };
    const nomCpf = aideParId.get('nat-cpf')!.nom;
    const fafceaDe = (r: Resultat) => r.aides.find((a) => a.id === 'faf-fafcea');
    const cpfDe = (r: Resultat) => r.aides.find((a) => a.id === 'nat-cpf');

    // Solde CPF de 800 € : le CPF finance 800 € (sous les 4 200 € du coût) ; le FAFCEA, sans montant, est une option au choix.
    //   financé : 800 € ; reste à charge : 4 200 - 800 = 3 400 €.
    const faible = simuler({ ...parcours, soldeCpf: 800 });
    invariants(faible);
    expect(fafceaDe(faible)).toMatchObject({ statut: 'eligible', montantEstime: null });
    expect(fafceaDe(faible)!.libelleMontant).toContain('seulement en cas de refus de prise en charge par le CPF');
    expect(cpfDe(faible)).toMatchObject({ statut: 'eligible', montantEstime: 800 });
    expect(faible.plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 800 })]);
    expect(faible.plan.options).toContainEqual(
      expect.objectContaining({ id: 'faf-fafcea', montantEstime: null, raison: `Au choix avec « ${nomCpf} »` }),
    );
    expect(faible.plan.totalFinance).toBe(800);
    expect(faible.plan.resteACharge).toBe(3400);

    // Solde CPF de 3 900 € : le CPF finance 3 900 € (sous le plafond de 5 000 € et sous le coût) ; le FAFCEA reste une option sans montant.
    //   financé : 3 900 € ; reste à charge : 4 200 - 3 900 = 300 €.
    const fort = simuler({ ...parcours, soldeCpf: 3900 });
    invariants(fort);
    expect(fafceaDe(fort)).toMatchObject({ statut: 'eligible', montantEstime: null });
    expect(cpfDe(fort)).toMatchObject({ statut: 'eligible', montantEstime: 3900 });
    expect(fort.plan.financements).toEqual([expect.objectContaining({ id: 'nat-cpf', montant: 3900 })]);
    expect(fort.plan.options).toContainEqual(
      expect.objectContaining({ id: 'faf-fafcea', montantEstime: null, raison: `Au choix avec « ${nomCpf} »` }),
    );
    expect(fort.plan.totalFinance).toBe(3900);
    expect(fort.plan.resteACharge).toBe(300);

    // Dans les deux cas : le FAFCEA n'est jamais dans les lignes chiffrées, il est une option, et rien ne dépasse le coût.
    for (const r of [faible, fort]) {
      expect(r.plan.financements.map((l) => l.id)).not.toContain('faf-fafcea');
      expect(r.plan.options.filter((o) => o.id === 'faf-fafcea')).toHaveLength(1);
      expect(r.plan.nonChiffrees.map((a) => a.id)).not.toContain('faf-fafcea');
      expect(r.plan.coutFormation).toBe(4200);
    }

    // Solde CPF de 0 € : le CPF ne peut rien financer (son montant est nul : il n'apparaît dans aucune liste) ; le FAFCEA, repli après
    // refus, reste proposé au choix avec lui, sans montant. financé : 0 € ; reste à charge : 4 200 €.
    const vide = simuler({ ...parcours, soldeCpf: 0 });
    invariants(vide);
    expect(cpfDe(vide)).toMatchObject({ statut: 'eligible', montantEstime: 0 });
    expect(vide.plan.financements).toEqual([]);
    expect(vide.plan.options).toContainEqual(expect.objectContaining({ id: 'faf-fafcea', montantEstime: null }));
    expect(vide.plan.totalFinance).toBe(0);
    expect(vide.plan.resteACharge).toBe(4200);

    // Solde CPF inconnu : ni le CPF ni le FAFCEA ne sont chiffrés, rien n'est déduit (financé 0 €, reste 4 200 €) ; le CPF est
    // listé parmi les aides sans montant et le FAFCEA reste une option.
    const inconnu = simuler(parcours);
    invariants(inconnu);
    expect(inconnu.plan.financements).toEqual([]);
    expect(inconnu.plan.nonChiffrees.map((a) => a.id)).toContain('nat-cpf');
    expect(inconnu.plan.options).toContainEqual(expect.objectContaining({ id: 'faf-fafcea', montantEstime: null }));
    expect(inconnu.plan.totalFinance).toBe(0);
    expect(inconnu.plan.resteACharge).toBe(4200);

    // Formation non éligible au CPF (le CPF est refusé) : le FAFCEA devient le seul financeur possible, mais son montant dépend du
    // dossier : il est listé parmi les aides sans montant, jamais compté. financé : 0 € ; reste à charge : 4 200 €.
    const refuse = simuler({ ...parcours, eligibleCpf: false, soldeCpf: 800 });
    invariants(refuse);
    expect(cpfDe(refuse)).toMatchObject({ statut: 'non_eligible' });
    expect(fafceaDe(refuse)).toMatchObject({ statut: 'eligible', montantEstime: null });
    expect(refuse.plan.financements).toEqual([]);
    expect(refuse.plan.nonChiffrees.map((a) => a.id)).toContain('faf-fafcea');
    expect(refuse.plan.options.map((o) => o.id)).not.toContain('faf-fafcea');
    expect(refuse.plan.totalFinance).toBe(0);
    expect(refuse.plan.resteACharge).toBe(4200);
  });
});
