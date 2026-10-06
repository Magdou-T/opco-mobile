import { describe, it, expect, vi } from 'vitest';
import { estimerMontant, evaluerAide, evaluerAides, formaterDate, HEURES_PAR_MOIS_TEMPS_PLEIN } from '../src/aides/evaluer';
import type { Aide, CriteresAide, ModeMontant, MontantAide, ProfilAides } from '../src/aides/types';
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

describe('evaluerAide — période de validité (bornes incluses)', () => {
  // Date de référence : 2026-10-05.
  const avecValidite = (debut: string | null, fin: string | null) =>
    evaluerAide(makeAide({ validite: { debut, fin } }), makeProfil(), AUJOURDHUI);

  it('dernier jour de validité (fin = date de référence) : encore valable', () => {
    expect(avecValidite(null, '2026-10-05')).toMatchObject({ statut: 'eligible', raisons: [] });
  });

  it('terminé la veille : non éligible, avec la date de fin', () => {
    expect(avecValidite(null, '2026-10-04')).toMatchObject({
      statut: 'non_eligible',
      raisons: ['Dispositif terminé le 04/10/2026'],
    });
  });

  it("jour d'ouverture (début = date de référence) : éligible", () => {
    expect(avecValidite('2026-10-05', null)).toMatchObject({ statut: 'eligible', raisons: [] });
  });

  it("ouverture le lendemain : à vérifier, avec la date d'ouverture", () => {
    expect(avecValidite('2026-10-06', null)).toMatchObject({
      statut: 'a_verifier',
      raisons: ['Dispositif ouvert à partir du 06/10/2026'],
    });
  });

  it('période en cours (début passé, fin à venir) : éligible', () => {
    expect(avecValidite('2026-01-01', '2026-12-31')).toMatchObject({ statut: 'eligible', raisons: [] });
  });
});

describe('evaluerAide — raisons', () => {
  it("une aide non éligible n'expose que les exclusions, pas les doutes", () => {
    // Critère région ko, et âge inconnu sur un autre critère : seule l'exclusion est affichée.
    const aide = makeAide({ criteres: { regions: ['84'], age_max: 29 } });
    const r = evaluerAide(aide, makeProfil({ age: null }), AUJOURDHUI);
    expect(r.statut).toBe('non_eligible');
    expect(r.raisons).toEqual(['Réservé à : Auvergne-Rhône-Alpes']);
  });

  it("les exclusions s'ajoutent dans l'ordre : projet, public, suspension, fin de validité, critères", () => {
    const aide = makeAide({
      projets: ['alternance'],
      beneficiaires: ['dirigeant'],
      statut: 'suspendu',
      validite: { debut: null, fin: '2026-06-30' },
      criteres: { regions: ['84'] },
    });
    expect(evaluerAide(aide, makeProfil(), AUJOURDHUI).raisons).toEqual([
      'Ne concerne pas ce type de projet',
      'Ne concerne pas ce public',
      'Dispositif suspendu : pas de nouvelle demande possible actuellement',
      'Dispositif terminé le 30/06/2026',
      'Réservé à : Auvergne-Rhône-Alpes',
    ]);
  });

  it('une aide à vérifier expose les doutes : critères, confirmation du financeur, ouverture à venir', () => {
    const aide = makeAide({ criteres: { age_max: 29 }, statut: 'a_confirmer', validite: { debut: '2026-12-01', fin: null } });
    const r = evaluerAide(aide, makeProfil({ age: null }), AUJOURDHUI);
    expect(r.statut).toBe('a_verifier');
    expect(r.raisons).toEqual([
      "Précisez l'âge du bénéficiaire",
      'Montant ou conditions en cours de confirmation auprès du financeur',
      'Dispositif ouvert à partir du 01/12/2026',
    ]);
  });

  it("une aide éligible n'a aucune raison", () => {
    expect(evaluerAide(makeAide(), makeProfil(), AUJOURDHUI).raisons).toEqual([]);
  });
});

describe("evaluerAide — ordre d'empilement et périmètre", () => {
  it("un ordre d'empilement de 0 explicite est conservé (pas la valeur par défaut du financeur)", () => {
    expect(evaluerAide(makeAide({ financeur: 'cpf', ordre_empilement: 0 }), makeProfil(), AUJOURDHUI).ordreEmpilement).toBe(0);
  });

  it('hors périmètre : le projet seul suffit (public et région compatibles)', () => {
    const aide = makeAide({ projets: ['alternance'], beneficiaires: ['salarie'], criteres: { regions: ['11'] } });
    expect(evaluerAide(aide, makeProfil(), AUJOURDHUI).horsPerimetre).toBe(true);
  });

  it('hors périmètre : le public seul suffit (projet et région compatibles)', () => {
    const aide = makeAide({ projets: ['formation_salarie'], beneficiaires: ['dirigeant'], criteres: { regions: ['11'] } });
    expect(evaluerAide(aide, makeProfil(), AUJOURDHUI).horsPerimetre).toBe(true);
  });

  it("une aide du bon projet, du bon public et de la bonne région n'est pas hors périmètre, même non éligible", () => {
    const suspendue = evaluerAide(makeAide({ statut: 'suspendu', criteres: { regions: ['11'] } }), makeProfil(), AUJOURDHUI);
    expect(suspendue).toMatchObject({ statut: 'non_eligible', horsPerimetre: false });
  });
});

describe("evaluerAide — recopie des champs de l'aide", () => {
  it("reprend les champs descriptifs de l'aide, avec le montant et le statut évalués", () => {
    const aide = makeAide({
      id: 'nat-exemple',
      nom: 'Aide exemple',
      financeur: 'opco',
      financeur_nom: 'OPCO exemple',
      categorie: 'aide_employeur',
      description: "Description de l'aide exemple.",
      conditions: ['Première condition.', 'Seconde condition.'],
      cumul: { cumulable: false, alternatives: ['nat-autre'], note: 'Au choix avec nat-autre.' },
      demarches: ['Première étape.', 'Seconde étape.'],
      url_demarche: 'https://www.example.gouv.fr/exemple',
      sources: [{ url: 'https://www.example.gouv.fr/source', titre: 'Source officielle', extrait: 'Extrait de la source.' }],
      derniere_verification: '2026-09-30',
      confidence: 'estimated',
    });
    expect(evaluerAide(aide, makeProfil(), AUJOURDHUI)).toEqual({
      id: 'nat-exemple',
      nom: 'Aide exemple',
      financeur: 'opco',
      financeurNom: 'OPCO exemple',
      categorie: 'aide_employeur',
      description: "Description de l'aide exemple.",
      statut: 'eligible',
      raisons: [],
      horsPerimetre: false,
      conditions: ['Première condition.', 'Seconde condition.'],
      montantEstime: 1000,
      libelleMontant: '1 000 € par dossier',
      modeMontant: 'forfait',
      cumulable: false,
      alternatives: ['nat-autre'],
      noteCumul: 'Au choix avec nat-autre.',
      demarches: ['Première étape.', 'Seconde étape.'],
      urlDemarche: 'https://www.example.gouv.fr/exemple',
      sources: [{ url: 'https://www.example.gouv.fr/source', titre: 'Source officielle', extrait: 'Extrait de la source.' }],
      derniereVerification: '2026-09-30',
      confidence: 'estimated',
      ordreEmpilement: 10,
    });
  });

  it('une règle de cumul sans alternative ni note donne une liste vide et une note nulle', () => {
    const r = evaluerAide(makeAide({ cumul: { cumulable: true } }), makeProfil(), AUJOURDHUI);
    expect(r).toMatchObject({ cumulable: true, alternatives: [], noteCumul: null });
  });

  // Typée par l'union des modes : un nouveau mode oblige à compléter cette table. Profil par défaut (solde CPF inconnu) :
  // le mode est recopié même quand le montant n'est pas chiffrable (solde_cpf, non_chiffre) ou chiffré autrement (forfait…).
  const MONTANT_PAR_MODE: Record<ModeMontant, MontantAide> = {
    forfait: montant({ mode: 'forfait', valeur: 1000 }),
    pourcentage: montant({ mode: 'pourcentage', pourcentage: 50, base: 'cout_pedagogique' }),
    par_heure: montant({ mode: 'par_heure', valeur: 10 }),
    par_mois: montant({ mode: 'par_mois', valeur: 500, duree_max_mois: 12 }),
    solde_cpf: montant({ mode: 'solde_cpf' }),
    non_chiffre: montant({ mode: 'non_chiffre' }),
  };

  it.each(Object.entries(MONTANT_PAR_MODE) as [ModeMontant, MontantAide][])(
    "expose le mode de calcul du montant de l'aide : %s",
    (mode, m) => {
      expect(evaluerAide(makeAide({ montant: m }), makeProfil(), AUJOURDHUI).modeMontant).toBe(mode);
    },
  );

  it("le mode de calcul est celui de l'aide, même quand une majoration remplace la valeur et le libellé, ou que l'aide n'est pas éligible", () => {
    const majoree = makeAide({
      montant: montant({ mode: 'par_heure', valeur: 10, majorations: [{ criteres: { rqth: true }, valeur: 20, libelle: 'RQTH' }] }),
    });
    expect(evaluerAide(majoree, makeProfil({ rqth: true }), AUJOURDHUI)).toMatchObject({ modeMontant: 'par_heure', montantEstime: 2800 });
    const suspendue = makeAide({ statut: 'suspendu', montant: montant({ mode: 'solde_cpf' }) });
    expect(evaluerAide(suspendue, makeProfil({ soldeCpf: 800 }), AUJOURDHUI)).toMatchObject({
      statut: 'non_eligible',
      modeMontant: 'solde_cpf',
      montantEstime: 800,
    });
  });
});

describe('evaluerAide — limite au coût de la formation (coût pédagogique + frais annexes)', () => {
  const MENTION = '(limité au coût de la formation)';
  // Coût connu de la formation : 2 000 € de coût pédagogique + 500 € de frais annexes = 2 500 €.
  const profil = makeProfil({ coutPedagogique: 2000, coutFraisAnnexes: 500 });
  const forfait = (valeur: number, libelle: string, categorie: 'cout_formation' | 'aide_employeur' = 'cout_formation') =>
    evaluerAide(makeAide({ categorie, montant: montant({ valeur, libelle }) }), profil, AUJOURDHUI);

  it('une aide de 3 000 € est limitée à 2 500 €, le libellé le mentionne', () => {
    const r = forfait(3000, '3 000 € par dossier');
    expect(r.montantEstime).toBe(2500);
    expect(r.libelleMontant).toBe(`3 000 € par dossier ${MENTION}`);
  });

  it("une aide de 2 500 € exactement (égalité) n'est pas limitée et n'a pas la mention", () => {
    const r = forfait(2500, '2 500 € par dossier');
    expect(r.montantEstime).toBe(2500);
    expect(r.libelleMontant).toBe('2 500 € par dossier');
  });

  it('un centime au-dessus du coût connu : limitée', () => {
    const r = forfait(2500.01, '2 500,01 € par dossier');
    expect(r.montantEstime).toBe(2500);
    expect(r.libelleMontant).toBe(`2 500,01 € par dossier ${MENTION}`);
  });

  it('un montant inférieur au coût connu reste tel quel', () => {
    expect(forfait(2499.99, '2 499,99 €').montantEstime).toBe(2499.99);
  });

  it('le coût connu est arrondi au centime (2 000,10 € + 500,20 € ne donne pas 2500.2999999999997)', () => {
    expect(2000.1 + 500.2).not.toBe(2500.3); // la somme brute est bruitée
    const aide = makeAide({ categorie: 'cout_formation', montant: montant({ valeur: 3000, libelle: '3 000 €' }) });
    const r = evaluerAide(aide, makeProfil({ coutPedagogique: 2000.1, coutFraisAnnexes: 500.2 }), AUJOURDHUI);
    expect(r.montantEstime).toBe(2500.3);
  });

  it("une aide qui ne réduit pas le coût de la formation n'est jamais limitée", () => {
    const r = forfait(3000, '3 000 € par dossier', 'aide_employeur');
    expect(r.montantEstime).toBe(3000);
    expect(r.libelleMontant).toBe('3 000 € par dossier');
  });

  it('un libellé qui se termine par un point reçoit la mention avant le point (jamais de double point)', () => {
    const r = forfait(3000, 'Forfait pour les dépenses financées.');
    expect(r.libelleMontant).toBe(`Forfait pour les dépenses financées ${MENTION}.`);
  });

  it.each([
    ['des points de suspension « … »', 'Selon le barème de la branche…'],
    ['des trois points « ... »', 'Selon le barème de la branche...'],
    ['une parenthèse fermante', 'Forfait de 3 000 € (barème 2026)'],
    ['aucune ponctuation', '3 000 € par dossier'],
    ["un point d'exclamation", 'Forfait de 3 000 € !'],
  ])('un libellé qui se termine par %s garde la mention à la suite', (_nom, libelle) => {
    expect(forfait(3000, libelle).libelleMontant).toBe(`${libelle} ${MENTION}`);
  });

  it('la mention suit le libellé de la majoration appliquée', () => {
    const aide = makeAide({
      categorie: 'cout_formation',
      montant: montant({
        valeur: 1000,
        libelle: '1 000 € par dossier',
        majorations: [{ criteres: { age_max: 40 }, valeur: 3000, libelle: 'Moins de 41 ans : 3 000 €.' }],
      }),
    });
    const r = evaluerAide(aide, profil, AUJOURDHUI);
    expect(r.montantEstime).toBe(2500);
    expect(r.libelleMontant).toBe(`Moins de 41 ans : 3 000 € ${MENTION}.`);
  });
});

describe('evaluerAide — lien régional et région de référence', () => {
  const lienIdf = 'https://www.transitionspro-idf.fr';
  const lienOccitanie = 'https://www.transitionspro-occitanie.fr';
  const lienNational = 'https://www.example.gouv.fr/demande';
  const liens_par_region = { '11': lienIdf, '76': lienOccitanie };

  const lien = (criteres: CriteresAide, profil: Partial<ProfilAides>) =>
    evaluerAide(makeAide({ liens_par_region, criteres }), makeProfil(profil), AUJOURDHUI).urlDemarche;

  it('périmètre « bénéficiaire » : le lien de la région du bénéficiaire', () => {
    expect(lien({ perimetre_region: 'beneficiaire' }, { regionEntreprise: '11', regionBeneficiaire: '76' })).toBe(lienOccitanie);
  });

  it("périmètre « bénéficiaire » sans région du bénéficiaire : le lien de la région de l'entreprise", () => {
    expect(lien({ perimetre_region: 'beneficiaire' }, { regionEntreprise: '11', regionBeneficiaire: null })).toBe(lienIdf);
  });

  it("périmètre « bénéficiaire » : pas de lien de l'entreprise quand la région du bénéficiaire n'en a pas", () => {
    expect(lien({ perimetre_region: 'beneficiaire' }, { regionEntreprise: '11', regionBeneficiaire: '84' })).toBe(lienNational);
  });

  it("sans périmètre : le lien de la région de l'entreprise, même si le bénéficiaire est ailleurs", () => {
    expect(lien({}, { regionEntreprise: '11', regionBeneficiaire: '76' })).toBe(lienIdf);
    expect(lien({ perimetre_region: 'entreprise' }, { regionEntreprise: '11', regionBeneficiaire: '76' })).toBe(lienIdf);
  });

  it("région de l'entreprise inconnue : le lien de la région du bénéficiaire", () => {
    expect(lien({}, { regionEntreprise: null, regionBeneficiaire: '76' })).toBe(lienOccitanie);
  });

  it("région de l'entreprise connue mais sans lien : le lien national, pas celui du bénéficiaire", () => {
    expect(lien({}, { regionEntreprise: '84', regionBeneficiaire: '76' })).toBe(lienNational);
  });

  it('aucune région connue : le lien national', () => {
    expect(lien({}, { regionEntreprise: null, regionBeneficiaire: null })).toBe(lienNational);
    expect(lien({ perimetre_region: 'beneficiaire' }, { regionEntreprise: null, regionBeneficiaire: null })).toBe(lienNational);
  });

  it('une aide sans lien régional garde son lien national', () => {
    const aide = makeAide({ liens_par_region: undefined });
    expect(evaluerAide(aide, makeProfil(), AUJOURDHUI).urlDemarche).toBe(lienNational);
    expect(evaluerAide({ ...aide, url_demarche: null }, makeProfil(), AUJOURDHUI).urlDemarche).toBeNull();
  });

  // Hors périmètre : une aide réservée à d'autres régions que la région de référence.
  it('périmètre « bénéficiaire » : la région du bénéficiaire décide du hors périmètre', () => {
    const aide = makeAide({ criteres: { regions: ['76'], perimetre_region: 'beneficiaire' } });
    const dansLaRegion = evaluerAide(aide, makeProfil({ regionEntreprise: '11', regionBeneficiaire: '76' }), AUJOURDHUI);
    expect(dansLaRegion).toMatchObject({ statut: 'eligible', horsPerimetre: false });
    const ailleurs = evaluerAide(aide, makeProfil({ regionEntreprise: '76', regionBeneficiaire: '11' }), AUJOURDHUI);
    expect(ailleurs).toMatchObject({ statut: 'non_eligible', horsPerimetre: true });
  });

  it("sans périmètre : la région de l'entreprise décide du hors périmètre", () => {
    const aide = makeAide({ criteres: { regions: ['76'] } });
    const r = evaluerAide(aide, makeProfil({ regionEntreprise: '11', regionBeneficiaire: '76' }), AUJOURDHUI);
    expect(r).toMatchObject({ statut: 'non_eligible', horsPerimetre: true });
  });

  it("région inconnue : l'aide reste visible (à vérifier), pas hors périmètre", () => {
    const aide = makeAide({ criteres: { regions: ['84'] } });
    const r = evaluerAide(aide, makeProfil({ regionEntreprise: null }), AUJOURDHUI);
    expect(r).toMatchObject({ statut: 'a_verifier', horsPerimetre: false, raisons: ['Précisez la région'] });
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
  describe('par mois : au prorata de la durée de la formation à temps plein, bornée à la durée maximale', () => {
    // 500 € par mois pendant 12 mois au plus ; un mois à temps plein = 151,67 h (35 h × 52 / 12).
    const parMois = montant({ mode: 'par_mois', valeur: 500, duree_max_mois: 12 });
    const pourHeures = (dureeHeures: number | null) => makeProfil({ dureeHeures });

    it("la base mensuelle est celle d'un temps plein : 35 h × 52 semaines / 12 mois", () => {
      expect(HEURES_PAR_MOIS_TEMPS_PLEIN).toBe(151.67);
    });

    it.each([
      ["140 h : moins d'un mois", 140, 461.53],
      ['1 350 h : environ 8,9 mois, pas encore borné', 1350, 4450.45],
      ['2 000 h : borné aux 12 mois maximum', 2000, 6000],
      ['151,67 h : exactement un mois', 151.67, 500],
      ['12 mois à temps plein exactement', 12 * HEURES_PAR_MOIS_TEMPS_PLEIN, 6000],
      ['0 h', 0, 0],
    ])('%s', (_nom, heures, attendu) => {
      expect(estimerMontant(parMois, pourHeures(heures)).montant).toBe(attendu);
    });

    it('775,65 € par mois sur 36 mois : 7 h valent 35,80 €', () => {
      const rfft = montant({ mode: 'par_mois', valeur: 775.65, duree_max_mois: 36 });
      expect(estimerMontant(rfft, pourHeures(7)).montant).toBe(35.8);
    });

    it("le plafond s'applique au total, après le prorata", () => {
      expect(estimerMontant({ ...parMois, plafond: 1000 }, pourHeures(1350)).montant).toBe(1000);
      expect(estimerMontant({ ...parMois, plafond: 5000 }, pourHeures(1350)).montant).toBe(4450.45);
    });

    it("sans estimation (null, le libellé seul s'affiche) quand la durée, la durée maximale ou la valeur manque", () => {
      expect(estimerMontant(parMois, pourHeures(null))).toEqual({ montant: null, libelle: 'règle' });
      expect(estimerMontant({ ...parMois, duree_max_mois: null }, pourHeures(140)).montant).toBeNull();
      expect(estimerMontant({ ...parMois, valeur: null }, pourHeures(140)).montant).toBeNull();
    });
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

  describe('majorations : première remplie, champs renseignés seulement', () => {
    const rqth = makeProfil({ rqth: true, age: 22 });
    const jeune = makeProfil({ rqth: false, age: 22 });
    const autre = makeProfil({ rqth: false, age: 40 });

    it("deux majorations remplies : la première l'emporte (valeur et libellé)", () => {
      const m = montant({
        valeur: 5000,
        libelle: 'base',
        majorations: [
          { criteres: { rqth: true }, valeur: 6000, libelle: 'RQTH' },
          { criteres: { age_max: 25 }, valeur: 7000, libelle: 'Moins de 26 ans' },
        ],
      });
      expect(estimerMontant(m, rqth)).toEqual({ montant: 6000, libelle: 'RQTH' });
      expect(estimerMontant(m, jeune)).toEqual({ montant: 7000, libelle: 'Moins de 26 ans' });
      expect(estimerMontant(m, autre)).toEqual({ montant: 5000, libelle: 'base' });
    });

    it('une majoration qui ne change que le plafond garde la valeur du montant de base', () => {
      const m = montant({
        valeur: 5000,
        plafond: 3000,
        libelle: 'base',
        majorations: [{ criteres: { rqth: true }, plafond: 4000, libelle: 'plafond relevé' }],
      });
      expect(estimerMontant(m, rqth)).toEqual({ montant: 4000, libelle: 'plafond relevé' });
      expect(estimerMontant(m, autre)).toEqual({ montant: 3000, libelle: 'base' });
    });

    it('une majoration qui ne change que la valeur garde le plafond du montant de base', () => {
      const m = montant({
        valeur: 2000,
        plafond: 3000,
        majorations: [{ criteres: { rqth: true }, valeur: 6000, libelle: 'valeur relevée' }],
      });
      expect(estimerMontant(m, rqth).montant).toBe(3000);
    });

    it('une majoration qui ne change que le pourcentage garde la base de calcul', () => {
      const m = montant({
        mode: 'pourcentage',
        pourcentage: 50,
        base: 'cout_pedagogique',
        libelle: '50 % du coût pédagogique',
        majorations: [{ criteres: { rqth: true }, pourcentage: 80, libelle: '80 % du coût pédagogique (RQTH)' }],
      });
      const profil = { coutPedagogique: 4200, coutFraisAnnexes: 300 };
      expect(estimerMontant(m, makeProfil({ ...profil, rqth: true }))).toEqual({ montant: 3360, libelle: '80 % du coût pédagogique (RQTH)' });
      expect(estimerMontant(m, makeProfil({ ...profil, rqth: false }))).toEqual({ montant: 2100, libelle: '50 % du coût pédagogique' });
    });

    it('une majoration à plafond null explicite lève le plafond du montant de base', () => {
      const m = montant({
        valeur: 5000,
        plafond: 3000,
        majorations: [{ criteres: { rqth: true }, plafond: null, libelle: 'sans plafond' }],
      });
      expect(estimerMontant(m, rqth).montant).toBe(5000);
      expect(estimerMontant(m, autre).montant).toBe(3000);
    });

    it('une majoration à 0 € remplace la valeur (0 est une valeur, pas une absence)', () => {
      const m = montant({ valeur: 5000, majorations: [{ criteres: { rqth: true }, valeur: 0, libelle: 'non versée' }] });
      expect(estimerMontant(m, rqth)).toEqual({ montant: 0, libelle: 'non versée' });
    });
  });

  describe('arrondi aux centimes', () => {
    const pourHeures = (dureeHeures: number) => makeProfil({ dureeHeures });

    it('par heure : 9,15 € × 140 h = 1 281 €', () => {
      expect(estimerMontant(montant({ mode: 'par_heure', valeur: 9.15 }), pourHeures(140)).montant).toBe(1281);
    });

    it('efface le bruit des flottants : 9,15 € × 3 h = 27,45 € (et non 27,450000000000003)', () => {
      expect(9.15 * 3).not.toBe(27.45); // le produit brut est bruité
      expect(estimerMontant(montant({ mode: 'par_heure', valeur: 9.15 }), pourHeures(3)).montant).toBe(27.45);
    });

    it('par mois : 775,65 € × 36 mois à temps plein = 27 923,40 € (et non 27923.399999999998)', () => {
      const rfft = montant({ mode: 'par_mois', valeur: 775.65, duree_max_mois: 36 });
      expect(775.65 * 36).not.toBe(27923.4); // le produit brut est bruité
      expect(estimerMontant(rfft, pourHeures(36 * HEURES_PAR_MOIS_TEMPS_PLEIN)).montant).toBe(27923.4);
    });

    it('arrondit au centime le plus proche (vers le haut comme vers le bas)', () => {
      expect(estimerMontant(montant({ valeur: 1234.5678 }), p).montant).toBe(1234.57);
      expect(estimerMontant(montant({ valeur: 1234.5649 }), p).montant).toBe(1234.56);
    });

    it('arrondit aussi un pourcentage : 33,33 % de 4 321 € = 1 440,1893 €, soit 1 440,19 €', () => {
      const m = montant({ mode: 'pourcentage', pourcentage: 33.33, base: 'cout_pedagogique' });
      expect(estimerMontant(m, makeProfil({ coutPedagogique: 4321 })).montant).toBe(1440.19);
    });

    it('jamais négatif : un forfait négatif donne 0', () => {
      expect(estimerMontant(montant({ valeur: -50 }), p).montant).toBe(0);
    });

    it("le plafond s'applique avant l'arrondi et reste inchangé quand il est plus bas", () => {
      expect(estimerMontant(montant({ valeur: 1000, plafond: 3000 }), p).montant).toBe(1000);
      expect(estimerMontant(montant({ valeur: 1000, plafond: 0 }), p).montant).toBe(0);
      expect(estimerMontant(montant({ valeur: 1000, plafond: 999.999 }), p).montant).toBe(1000);
    });
  });

  describe("information manquante : pas d'estimation (null), jamais 0", () => {
    it('par heure sans durée de formation', () => {
      const m = montant({ mode: 'par_heure', valeur: 10 });
      expect(estimerMontant(m, makeProfil({ dureeHeures: null }))).toEqual({ montant: null, libelle: 'règle' });
    });

    it('par heure sans valeur', () => {
      expect(estimerMontant(montant({ mode: 'par_heure', valeur: null }), p).montant).toBeNull();
    });

    it('pourcentage du coût pédagogique sans coût pédagogique', () => {
      const m = montant({ mode: 'pourcentage', pourcentage: 50, base: 'cout_pedagogique' });
      expect(estimerMontant(m, makeProfil({ coutPedagogique: null })).montant).toBeNull();
    });

    it('pourcentage du coût total sans coût pédagogique (les frais annexes seuls ne suffisent pas)', () => {
      const m = montant({ mode: 'pourcentage', pourcentage: 50, base: 'cout_total' });
      expect(estimerMontant(m, makeProfil({ coutPedagogique: null, coutFraisAnnexes: 300 })).montant).toBeNull();
    });

    it('pourcentage sans pourcentage', () => {
      expect(estimerMontant(montant({ mode: 'pourcentage', pourcentage: null, base: 'cout_pedagogique' }), p).montant).toBeNull();
      expect(estimerMontant(montant({ mode: 'pourcentage', pourcentage: null, base: 'cout_total' }), p).montant).toBeNull();
    });

    it('forfait sans valeur', () => {
      expect(estimerMontant(montant({ mode: 'forfait', valeur: null }), p).montant).toBeNull();
    });
  });

  describe('zéro est une valeur connue : 0 €, pas null', () => {
    it.each<[string, MontantAide, Partial<ProfilAides>]>([
      ['forfait de 0 €', montant({ valeur: 0 }), {}],
      ['par heure à 0 €', montant({ mode: 'par_heure', valeur: 0 }), {}],
      ['par heure sur 0 h', montant({ mode: 'par_heure', valeur: 10 }), { dureeHeures: 0 }],
      ['par mois à 0 €', montant({ mode: 'par_mois', valeur: 0, duree_max_mois: 12 }), {}],
      ['pourcentage de 0 %', montant({ mode: 'pourcentage', pourcentage: 0, base: 'cout_pedagogique' }), {}],
      ["pourcentage d'un coût pédagogique de 0 €", montant({ mode: 'pourcentage', pourcentage: 50, base: 'cout_pedagogique' }), { coutPedagogique: 0 }],
      ['solde CPF de 0 €', montant({ mode: 'solde_cpf' }), { soldeCpf: 0 }],
    ])('%s', (_nom, m, profil) => {
      expect(estimerMontant(m, makeProfil(profil)).montant).toBe(0);
    });
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

  const ordre = (aides: Aide[]) => evaluerAides(aides, makeProfil(), AUJOURDHUI).map((a) => a.id);
  const aideA = (id: string, nom: string, over: Partial<Aide> = {}) => makeAide({ id, nom, ...over });

  it("mélange des trois statuts : éligibles, à vérifier, non éligibles ; dans chaque groupe, le plus gros montant d'abord", () => {
    const aides = [
      aideA('nat-1', 'Aide 1', { criteres: { regions: ['84'] }, montant: montant({ valeur: 9000 }) }), // non éligible, 9 000 €
      aideA('nat-2', 'Aide 2', { statut: 'a_confirmer', montant: montant({ valeur: 300 }) }), // à vérifier, 300 €
      aideA('nat-3', 'Aide 3', { montant: montant({ valeur: 100 }) }), // éligible, 100 €
      aideA('nat-4', 'Aide 4', { criteres: { regions: ['84'] }, montant: montant({ valeur: 20 }) }), // non éligible, 20 €
      aideA('nat-5', 'Aide 5', { statut: 'a_confirmer', montant: montant({ valeur: 4000 }) }), // à vérifier, 4 000 €
      aideA('nat-6', 'Aide 6', { montant: montant({ valeur: 50 }) }), // éligible, 50 €
    ];
    const r = evaluerAides(aides, makeProfil(), AUJOURDHUI);
    expect(r.map((a) => [a.id, a.statut])).toEqual([
      ['nat-3', 'eligible'],
      ['nat-6', 'eligible'],
      ['nat-5', 'a_verifier'],
      ['nat-2', 'a_verifier'],
      ['nat-1', 'non_eligible'],
      ['nat-4', 'non_eligible'],
    ]);
  });

  it('à statut et montant égaux : par nom, sans tenir compte de la casse', () => {
    const aides = [aideA('nat-a', 'Zebre'), aideA('nat-b', 'abeille'), aideA('nat-c', 'Chouette')];
    expect(ordre(aides)).toEqual(['nat-b', 'nat-c', 'nat-a']);
  });

  it("un nom qui ne diffère que par la casse est départagé par l'identifiant", () => {
    expect(ordre([aideA('nat-b', 'aide'), aideA('nat-a', 'Aide')])).toEqual(['nat-a', 'nat-b']);
    expect(ordre([aideA('nat-a', 'aide'), aideA('nat-b', 'Aide')])).toEqual(['nat-a', 'nat-b']);
  });

  it('à nom égal : par identifiant', () => {
    expect(ordre([aideA('nat-c', 'Même nom'), aideA('nat-a', 'Même nom'), aideA('nat-b', 'Même nom')])).toEqual([
      'nat-a',
      'nat-b',
      'nat-c',
    ]);
  });

  it("le nom prime sur l'identifiant", () => {
    expect(ordre([aideA('nat-a', 'Zebre'), aideA('nat-b', 'Abeille')])).toEqual(['nat-b', 'nat-a']);
  });

  it('le montant prime sur le nom', () => {
    const aides = [aideA('nat-a', 'Abeille', { montant: montant({ valeur: 100 }) }), aideA('nat-b', 'Zebre', { montant: montant({ valeur: 200 }) })];
    expect(ordre(aides)).toEqual(['nat-b', 'nat-a']);
  });

  it('un montant nul (non chiffré) passe après un montant de 0 €', () => {
    const aides = [
      aideA('nat-a', 'Abeille', { montant: montant({ mode: 'non_chiffre' }) }),
      aideA('nat-b', 'Zebre', { montant: montant({ valeur: 0 }) }),
    ];
    const r = evaluerAides(aides, makeProfil(), AUJOURDHUI);
    expect(r.map((a) => [a.id, a.montantEstime])).toEqual([
      ['nat-b', 0],
      ['nat-a', null],
    ]);
  });

  it("ne dépend pas d'Intl : localeCompare n'est jamais appelé (même ordre sur tous les moteurs)", () => {
    const espion = vi.spyOn(String.prototype, 'localeCompare');
    try {
      const aides = [aideA('nat-b', 'aide'), aideA('nat-a', 'Aide'), aideA('nat-c', 'Autre')];
      expect(ordre(aides)).toEqual(['nat-a', 'nat-b', 'nat-c']);
      expect(espion).not.toHaveBeenCalled();
    } finally {
      espion.mockRestore();
    }
  });

  it('ne modifie pas la liste reçue', () => {
    const aides = [aideA('nat-b', 'B'), aideA('nat-a', 'A')];
    evaluerAides(aides, makeProfil(), AUJOURDHUI);
    expect(aides.map((a) => a.id)).toEqual(['nat-b', 'nat-a']);
  });
});

describe('formaterDate', () => {
  it('affiche JJ/MM/AAAA', () => {
    expect(formaterDate('2026-10-05')).toBe('05/10/2026');
  });

  it('renvoie la chaîne telle quelle quand elle ne ressemble pas à une date AAAA-MM-JJ', () => {
    expect(formaterDate('2026-10')).toBe('2026-10');
    expect(formaterDate('')).toBe('');
  });
});
