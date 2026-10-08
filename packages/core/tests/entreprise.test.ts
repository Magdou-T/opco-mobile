import { describe, it, expect } from 'vitest';
import { parseResultatRechercheEntreprises, tailleDepuisTranche } from '../src/entreprise';
import { resoudreOpco } from '../src/opco-resolver';
import { EMBEDDED_IDCC, EMBEDDED_NAF } from '../src/data';

// Forme réelle d'un résultat de https://recherche-entreprises.api.gouv.fr/search (valeurs fictives).
const RESULTAT = {
  siren: '123456789',
  nom_complet: 'ORGANISME EXEMPLE',
  activite_principale: '85.59A',
  categorie_entreprise: 'PME',
  nature_juridique: '5710',
  tranche_effectif_salarie: '01',
  annee_tranche_effectif_salarie: '2024',
  siege: {
    siret: '12345678900011',
    est_siege: true,
    code_postal: '95870',
    libelle_commune: 'BEZONS',
    departement: '95',
    region: '11',
    liste_idcc: ['1516'],
    tranche_effectif_salarie: '01',
  },
  matching_etablissements: [
    { siret: '12345678900029', est_siege: false, code_postal: '69003', libelle_commune: 'LYON', departement: '69', region: '84', liste_idcc: ['1486'] },
  ],
  complements: { liste_idcc: ['1516'], est_ess: true, est_siae: false, est_association: false, est_entrepreneur_individuel: false },
};

describe('parseResultatRechercheEntreprises', () => {
  it('extrait identité, NAF, effectif et statuts', () => {
    const e = parseResultatRechercheEntreprises(RESULTAT);
    expect(e).toMatchObject({
      siren: '123456789',
      nom: 'ORGANISME EXEMPLE',
      codeNaf: '85.59A',
      natureJuridique: '5710',
      trancheEffectif: '01',
      anneeTrancheEffectif: '2024',
      tailleSuggeree: 'less_11',
      structures: ['ess'],
      estEntrepreneurIndividuel: false,
    });
  });

  it('extrait le siège et les établissements avec leur région', () => {
    const e = parseResultatRechercheEntreprises(RESULTAT);
    expect(e.siege).toMatchObject({ siret: '12345678900011', estSiege: true, departement: '95', region: '11', idccs: ['1516'] });
    expect(e.etablissements[0]).toMatchObject({ departement: '69', region: '84', idccs: ['1486'] });
  });

  it('agrège les IDCC sans doublon et isole ceux du siège', () => {
    const e = parseResultatRechercheEntreprises(RESULTAT);
    expect(e.idccs).toEqual(['1516', '1486']);
    expect(e.idccSiege).toEqual(['1516']);
  });

  it('déduit département et région du code postal si absents', () => {
    const e = parseResultatRechercheEntreprises({
      ...RESULTAT,
      siege: { siret: '1', code_postal: '20090', libelle_commune: 'AJACCIO', liste_idcc: [] },
      matching_etablissements: [],
    });
    expect(e.siege).toMatchObject({ departement: '2A', region: '94' });
  });

  it('ignore 0000 et les tranches inconnues', () => {
    const e = parseResultatRechercheEntreprises({
      ...RESULTAT,
      tranche_effectif_salarie: 'NN',
      complements: { liste_idcc: ['0000'] },
      siege: { ...RESULTAT.siege, liste_idcc: ['0000'] },
      matching_etablissements: [],
    });
    expect(e.idccs).toEqual([]);
    expect(e.trancheEffectif).toBeNull();
    expect(e.tailleSuggeree).toBeNull();
  });
});

// Chemin du site : réponse de l'API lue par parseResultatRechercheEntreprises, puis résolveur appelé avec la catégorie
// juridique. Un établissement public sans convention ne reçoit aucun OPCO d'après son code NAF.
describe('réponse de l\'API → résolveur (catégorie juridique transmise)', () => {
  const EHPAD_PUBLIC = {
    ...RESULTAT,
    nom_complet: 'EHPAD PUBLIC EXEMPLE',
    activite_principale: '87.10A',
    nature_juridique: '7366',
    siege: { ...RESULTAT.siege, liste_idcc: [] },
    matching_etablissements: [],
    complements: { liste_idcc: [] },
  };
  const resoudre = (raw: Record<string, unknown>) => {
    const e = parseResultatRechercheEntreprises(raw);
    return resoudreOpco(
      { idccs: e.idccs, idccSiege: e.idccSiege, codeNaf: e.codeNaf, natureJuridique: e.natureJuridique },
      EMBEDDED_IDCC,
      EMBEDDED_NAF,
    );
  };

  it('établissement public (7366) sans convention : inconnu, motif propre aux employeurs publics', () => {
    const r = resoudre(EHPAD_PUBLIC);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'inconnu', candidats: [], idccRetenu: null });
    expect(r.motif).toContain('la plupart des employeurs publics ne cotisent pas à un OPCO');
  });

  it('même activité, société privée (5710) : suggestion « à confirmer » d\'après le code NAF', () => {
    const r = resoudre({ ...EHPAD_PUBLIC, nature_juridique: '5710' });
    expect(r).toMatchObject({ opcoSlug: 'opco-sante', certitude: 'a_confirmer', idccRetenu: null });
    expect(r.motif).toContain('% des établissements');
  });

  it('établissement public avec une convention : la convention fait foi', () => {
    const r = resoudre({ ...EHPAD_PUBLIC, complements: { liste_idcc: ['2264'] } });
    expect(r).toMatchObject({ opcoSlug: 'opco-sante', certitude: 'fiable', idccRetenu: '2264' });
  });
});

describe('tailleDepuisTranche', () => {
  it('suggère une taille seulement si la tranche est sans ambiguïté', () => {
    expect(tailleDepuisTranche('03')).toBe('less_11');
    expect(tailleDepuisTranche('11')).toBeNull(); // 10 à 19 salariés
    expect(tailleDepuisTranche('12')).toBe('11_49');
    expect(tailleDepuisTranche('31')).toBe('50_299');
    expect(tailleDepuisTranche('32')).toBeNull(); // 250 à 499 salariés
    expect(tailleDepuisTranche('41')).toBe('300_plus');
    expect(tailleDepuisTranche(null)).toBeNull();
  });
});
