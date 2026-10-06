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
