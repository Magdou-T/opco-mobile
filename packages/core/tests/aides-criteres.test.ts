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
