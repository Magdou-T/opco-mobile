import type { OpcoData, WizardState } from '../src/types';
import { createInitialWizardState } from '../src/types';

export const sourced = (value: number | null) => ({
  value,
  confidence: 'exact' as const,
  source_url: 'https://example.opco.fr/criteres',
});

/** Fabrique un OpcoData minimal valide, surchargé par `over`. */
export function makeOpco(over: Partial<OpcoData> = {}): OpcoData {
  return {
    slug: 'test-opco',
    name: 'Test OPCO',
    secteurs: 'Secteur de test',
    secteurs_source: 'https://example.opco.fr',
    email_contact: 'contact@example.opco.fr',
    url_finance_page: 'https://example.opco.fr/criteres',
    types_formations: ['Formation test'],
    types_formations_source: 'https://example.opco.fr',
    cout_horaire_inter: sourced(40),
    cout_horaire_intra: sourced(null),
    cout_horaire_metier: sourced(null),
    prise_en_charge_salaires: sourced(null),
    prise_en_charge_salaires_mode: 'selon_accord',
    frais_transport: sourced(null),
    frais_hebergement: sourced(null),
    frais_restauration: sourced(null),
    frais_annexes_pourcentage: sourced(null),
    budget_annuel_max: sourced(null),
    budget_annuel_description: '',
    quota_horaire_min: null,
    quota_horaire_max: null,
    profils_candidats: ['Salariés'],
    tailles_cibles: 'Toutes tailles',
    priorite_tpe_pme: false,
    duree_min_formation: null,
    processus_approbation: 'Demande dématérialisée',
    delai_validation: '2-3 semaines',
    mode_paiement: 'Tiers-payant',
    alternance_apprentissage: '',
    alternance_professionnalisation: '',
    cpf_abondement: false,
    cpf_details: '',
    vae_possible: false,
    vae_details: '',
    limite_dossiers_an: '',
    specificites: '',
    points_cles_maximisation: '',
    ...over,
  };
}

/** Fabrique un WizardState de formation simple, surchargé par `over`. */
export function makeFormationState(over: Partial<WizardState> = {}): WizardState {
  return {
    ...createInitialWizardState(),
    opcoKnown: true,
    selectedOpcoSlug: 'test-opco',
    contractType: 'cdi',
    companySize: 'less_11',
    formationType: 'qualification',
    durationHours: 100,
    pedagogyCostPerHour: 30,
    ...over,
  };
}

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
