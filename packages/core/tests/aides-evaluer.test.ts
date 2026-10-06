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

  // Une aide de catégorie « cout_formation » ne peut pas financer plus que le coût connu de la formation.
  // 42 €/h × 140 h = 5 880 €, ramenés à 3 000 € par le plafond de l'aide.
  const parHeure = montant({ mode: 'par_heure', valeur: 42, plafond: 3000, libelle: '42 € par heure, dans la limite de 3 000 €' });

  it('limite une aide de coût de formation au coût connu de la formation', () => {
    const profil = makeProfil({ coutPedagogique: 2000, coutFraisAnnexes: 0, dureeHeures: 140 });
    const r = evaluerAide(makeAide({ categorie: 'cout_formation', montant: parHeure }), profil, AUJOURDHUI);
    expect(r.montantEstime).toBe(2000);
    expect(r.libelleMontant).toContain('limité au coût de la formation');
  });

  it('ne limite pas une aide de coût de formation inférieure au coût connu', () => {
    const profil = makeProfil({ coutPedagogique: 5000, coutFraisAnnexes: 0, dureeHeures: 140 });
    const r = evaluerAide(makeAide({ categorie: 'cout_formation', montant: parHeure }), profil, AUJOURDHUI);
    expect(r.montantEstime).toBe(3000);
    expect(r.libelleMontant).not.toContain('limité au coût de la formation');
  });

  it('ne limite pas une aide qui ne réduit pas le coût de la formation', () => {
    const profil = makeProfil({ coutPedagogique: 2000, coutFraisAnnexes: 0, dureeHeures: 140 });
    const r = evaluerAide(makeAide({ categorie: 'aide_employeur', montant: parHeure }), profil, AUJOURDHUI);
    expect(r.montantEstime).toBe(3000);
    expect(r.libelleMontant).not.toContain('limité au coût de la formation');
  });

  it('ne limite pas quand le coût de la formation est inconnu', () => {
    const profil = makeProfil({ coutPedagogique: null, coutFraisAnnexes: 0, dureeHeures: 140 });
    const r = evaluerAide(makeAide({ categorie: 'cout_formation', montant: parHeure }), profil, AUJOURDHUI);
    expect(r.montantEstime).toBe(3000);
    expect(r.libelleMontant).not.toContain('limité au coût de la formation');
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
