import { describe, it, expect } from 'vitest';
import { EMBEDDED_IDCC, EMBEDDED_NAF, EMBEDDED_OPCOS } from '../src/data';
import { resoudreOpco, suggestionParNaf, type EntreeResolution, type ResolutionOpco } from '../src/opco-resolver';
import { SuggestionNafSchema } from '../src/schema';

// Suggestions d'OPCO par code NAF (repli quand aucune convention collective n'est exploitable). Chaque part est
// observée sur un échantillon d'établissements employeurs joints à la Table SIRET-OPCO de France Compétences (données
// ouvertes, Licence Ouverte 2.0) : méthode, date des données et seuils dans la spécification, section 5.5.

const SLUGS = new Set(EMBEDDED_OPCOS.map((o) => o.slug));
const SOURCE_TABLE_SIRET_OPCO = 'https://www.data.gouv.fr/datasets/table-siret-opco';
const PART_MINIMALE = 0.6;
const ECHANTILLON_MINIMAL = 30;

/**
 * Préfixes plus longs dont l'OPCO diffère de celui du préfixe parent le plus proche : chacun est une exception
 * observée (sa propre part et son propre échantillon le justifient). Une contradiction absente de cette liste fait
 * échouer le test : elle doit être vérifiée puis déclarée ici avec sa raison.
 */
const EXCEPTIONS_DECLAREES: Record<string, string> = {
  '10.13B': 'charcuterie artisanale : OPCO EP 88 %, alors que les industries alimentaires relèvent d\'OCAPIAT',
  '10.71C': 'boulangerie artisanale : OPCO EP 100 %, alors que les industries alimentaires relèvent d\'OCAPIAT',
  '10.71D': 'pâtisserie artisanale : OPCO EP 100 %, alors que les industries alimentaires relèvent d\'OCAPIAT',
  '41.1': 'promotion immobilière : OPCO EP 86 %, alors que la construction de bâtiments relève de Constructys',
  '55.30Z': "campings : AFDAS 97 %, alors que l'hôtellerie relève d'AKTO",
};

/** Préfixe parent le plus proche présent dans la table (sous-classe > classe > groupe > division). */
function parentLePlusProche(prefixe: string): string | null {
  const candidats = [prefixe.slice(0, 5), prefixe.slice(0, 4), prefixe.slice(0, 2)].filter(
    (p, i, t) => p.length < prefixe.length && t.indexOf(p) === i,
  );
  for (const p of candidats) if (EMBEDDED_NAF.some((s) => s.prefixe === p)) return p;
  return null;
}

describe('suggestions NAF : données', () => {
  it('chaque entrée respecte le schéma, avec un préfixe NAF bien formé et unique', () => {
    expect(EMBEDDED_NAF.length).toBeGreaterThan(0);
    const vus = new Set<string>();
    for (const s of EMBEDDED_NAF) {
      expect(SuggestionNafSchema.safeParse(s).success, s.prefixe).toBe(true);
      // Division (47), groupe (47.1), classe (47.11) ou sous-classe (47.11F).
      expect(s.prefixe, s.prefixe).toMatch(/^\d{2}(\.\d|\.\d{2}|\.\d{2}[A-Z])?$/);
      expect(vus.has(s.prefixe), `${s.prefixe} en double`).toBe(false);
      vus.add(s.prefixe);
    }
  });

  it(`part observée entre ${PART_MINIMALE} et 1, à deux décimales, sur un échantillon d'au moins ${ECHANTILLON_MINIMAL} établissements`, () => {
    for (const s of EMBEDDED_NAF) {
      expect(s.part, s.prefixe).not.toBeNull();
      const part = s.part as number;
      const n = s.effectif_etablissements;
      expect(part, s.prefixe).toBeGreaterThanOrEqual(PART_MINIMALE);
      expect(part, s.prefixe).toBeLessThanOrEqual(1);
      expect(Math.abs(part * 100 - Math.round(part * 100)), s.prefixe).toBeLessThan(1e-9);
      expect(Number.isInteger(n), s.prefixe).toBe(true);
      expect(n as number, s.prefixe).toBeGreaterThanOrEqual(ECHANTILLON_MINIMAL);
      // La part est un rapport k / n arrondi : aucune valeur qui ne puisse venir de l'échantillon déclaré.
      const possibles = Array.from({ length: (n as number) + 1 }, (_, k) => Math.round((k / (n as number)) * 100) / 100);
      expect(possibles, s.prefixe).toContain(part);
    }
  });

  it("OPCO connu, intitulé officiel non vide et source : la Table SIRET-OPCO", () => {
    for (const s of EMBEDDED_NAF) {
      expect(SLUGS.has(s.opco), s.prefixe).toBe(true);
      expect(s.libelle.trim().length, s.prefixe).toBeGreaterThan(0);
      expect(s.libelle, s.prefixe).toBe(s.libelle.trim());
      expect(s.source, s.prefixe).toBe(SOURCE_TABLE_SIRET_OPCO);
    }
  });

  it('un préfixe plus long ne contredit son parent que dans les exceptions déclarées', () => {
    const contradictions: Record<string, string> = {};
    for (const s of EMBEDDED_NAF) {
      const parent = parentLePlusProche(s.prefixe);
      if (parent && EMBEDDED_NAF.find((p) => p.prefixe === parent)?.opco !== s.opco) contradictions[s.prefixe] = parent;
    }
    expect(Object.keys(contradictions).sort()).toEqual(Object.keys(EXCEPTIONS_DECLAREES).sort());
    for (const raison of Object.values(EXCEPTIONS_DECLAREES)) expect(raison.length).toBeGreaterThan(0);
  });
});

// Secteurs couverts : entreprise sans convention exploitable, code NAF de l'unité légale seul.
describe('suggestions NAF : secteurs couverts', () => {
  const SECTEURS: [string, string, string][] = [
    ['10.71C', 'opco-ep', 'boulangerie et boulangerie-pâtisserie'],
    ['10.71D', 'opco-ep', 'pâtisserie'],
    ['10.13B', 'opco-ep', 'charcuterie'],
    ['10.51C', 'ocapiat', 'fabrication de fromage (industries alimentaires)'],
    ['47.11F', 'opcommerce', 'hypermarchés'],
    ['47.22Z', 'opco-ep', 'boucherie'],
    ['47.73Z', 'opco-ep', 'pharmacie'],
    ['47.71Z', 'opco-ep', 'habillement'],
    ['96.02A', 'opco-ep', 'coiffure'],
    ['96.02B', 'opco-ep', 'soins de beauté'],
    ['81.21Z', 'akto', 'nettoyage courant des bâtiments'],
    ['81.22Z', 'akto', 'autres activités de nettoyage'],
    ['69.10Z', 'opco-ep', 'cabinets d\'avocats'],
    ['69.20Z', 'atlas', 'expertise comptable'],
    ['64.19Z', 'atlas', 'banque'],
    ['68.31Z', 'opco-ep', 'agences immobilières'],
    ['55.10Z', 'akto', 'hôtels'],
    ['55.30Z', 'afdas', 'campings'],
    ['70.22Z', 'atlas', 'conseil de gestion'],
    ['71.11Z', 'opco-ep', 'architectes'],
    ['71.12B', 'atlas', 'ingénierie'],
    ['73.11Z', 'afdas', 'agences de publicité'],
    ['85.59A', 'akto', 'formation continue d\'adultes'],
    ['85.53Z', 'opco-mobilites', 'auto-écoles'],
    ['86.21Z', 'opco-ep', 'médecins généralistes'],
    ['86.22C', 'opco-ep', 'médecins spécialistes'],
    ['86.23Z', 'opco-ep', 'dentistes'],
    ['86.90A', 'opco-mobilites', 'ambulances'],
    ['87.10A', 'opco-sante', 'hébergement médicalisé pour personnes âgées'],
    ['88.91A', 'opco-ep', 'accueil de jeunes enfants'],
    ['41.10A', 'opco-ep', 'promotion immobilière de logements'],
    ['41.20A', 'constructys', 'construction de maisons individuelles'],
    ['45.20A', 'opco-mobilites', 'garages'],
    ['49.41A', 'opco-mobilites', 'transports routiers de fret'],
    ['93.12Z', 'afdas', 'clubs de sport'],
    ['80.10Z', 'akto', 'sécurité privée'],
    ['79.11Z', 'opco-mobilites', 'agences de voyage'],
    ['78.20Z', 'akto', 'travail temporaire'],
  ];

  it.each(SECTEURS)('%s → %s (%s) : suggestion à confirmer avec la part observée', (codeNaf, opco) => {
    const r = resoudreOpco({ idccs: [], idccSiege: null, codeNaf }, EMBEDDED_IDCC, EMBEDDED_NAF);
    const suggestion = suggestionParNaf(codeNaf, EMBEDDED_NAF);
    expect(suggestion, codeNaf).not.toBeNull();
    expect(r).toMatchObject({ opcoSlug: opco, certitude: 'a_confirmer', idccRetenu: null, candidats: [{ opcoSlug: opco, idccs: [] }] });
    expect(r.motif).toContain('% des établissements');
    expect(r.motif).toContain(
      `Suggestion d'après le code NAF ${suggestion?.prefixe} (${suggestion?.libelle}) : ${Math.round((suggestion?.part ?? 0) * 100)} % des établissements employeurs observés dans ce secteur (échantillon de ${suggestion?.effectif_etablissements}) relèvent de cet OPCO.`,
    );
  });

  // Secteurs partagés entre plusieurs OPCO (part du premier sous 0,60) ou trop peu d'employeurs pour un échantillon
  // de 30 : aucune suggestion, le résolveur dit « non identifié » plutôt que de deviner.
  const SANS_SUGGESTION: [string, string][] = [
    ['94.99Z', 'associations : Uniformation 58 %, sept autres OPCO'],
    ['46.39B', 'commerce de gros : aucun groupe au-dessus de 53 %'],
    ['45.31Z', "commerce de gros d'équipements automobiles : OPCO Mobilités 53 %, AKTO 44 %"],
    ['49.32Z', 'taxis : OPCO EP 59 %, OPCO Mobilités 41 %'],
    ['29.20Z', 'industrie automobile : OPCO 2i 50 %, OPCO Mobilités 44 %'],
    ['35.11Z', "production d'électricité : OPCO 2i 58 %"],
    ['65.12Z', 'assurance hors vie : Uniformation et ATLAS à parts égales'],
    ['64.20Z', 'sociétés holding : activités de tous secteurs'],
    ['70.10Z', 'sièges sociaux : activités de tous secteurs'],
    ['86.10Z', 'activités hospitalières : OPCO Santé 63 %, OPCO EP chez les plus petits'],
    ['87.90B', 'hébergement social : OPCO Santé 50 %, Uniformation 31 %'],
    ['88.10A', 'aide à domicile : OPCO EP 58 %, Uniformation 42 %'],
    ['85.59B', 'autres enseignements : AKTO 59 %'],
    ['96.09Z', 'autres services personnels : OPCO EP et AKTO'],
    ['47.52A', 'quincaillerie : L\'Opcommerce 59 %, AKTO'],
    ['92.00Z', 'jeux de hasard : AFDAS 61 % mais 42 % chez les moins de 10 salariés'],
    ['19.20Z', 'raffinage : 24 employeurs seulement dans la table'],
    ['97.00Z', 'ménages employeurs : absents du répertoire des entreprises'],
  ];

  it.each(SANS_SUGGESTION)('%s (%s) : aucune suggestion, OPCO non identifié', (codeNaf) => {
    expect(suggestionParNaf(codeNaf, EMBEDDED_NAF), codeNaf).toBeNull();
    const r = resoudreOpco({ idccs: [], idccSiege: null, codeNaf }, EMBEDDED_IDCC, EMBEDDED_NAF);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'inconnu', candidats: [], idccRetenu: null });
    expect(r.motif).toContain('OPCO non identifié automatiquement');
  });
});

// Les réponses fondées sur une convention collective ne dépendent ni des suggestions NAF ni de la catégorie
// juridique : seules les entreprises sans convention exploitable (et le choix entre plusieurs candidats) en dépendent.
describe('suggestions NAF : les réponses fondées sur une convention ne changent pas', () => {
  const NAFS = ['10.71C', '47.73Z', '87.10A', '85.59A', '46.39B', null];
  const NATURES = ['5710', '9220', '7364', null];

  it('toute convention seule de la table : un seul candidat → même résolution, quels que soient NAF et catégorie juridique', () => {
    let verifiees = 0;
    for (const e of Object.values(EMBEDDED_IDCC)) {
      const reference = resoudreOpco({ idccs: [e.idcc] }, EMBEDDED_IDCC, []);
      if (reference.candidats.length !== 1) continue;
      for (const codeNaf of NAFS) {
        for (const natureJuridique of NATURES) {
          const r = resoudreOpco({ idccs: [e.idcc], codeNaf, natureJuridique }, EMBEDDED_IDCC, EMBEDDED_NAF);
          expect(r, `${e.idcc} ${codeNaf} ${natureJuridique}`).toEqual(reference);
          verifiees++;
        }
      }
    }
    expect(verifiees).toBeGreaterThan(15_000);
  });

  it('plusieurs candidats : mêmes candidats et même certitude, seule la présélection peut venir du code NAF', () => {
    for (const e of Object.values(EMBEDDED_IDCC)) {
      const reference = resoudreOpco({ idccs: [e.idcc] }, EMBEDDED_IDCC, []);
      if (reference.candidats.length < 2) continue;
      for (const codeNaf of NAFS) {
        const r = resoudreOpco({ idccs: [e.idcc], codeNaf, natureJuridique: '5710' }, EMBEDDED_IDCC, EMBEDDED_NAF);
        expect(r.candidats, e.idcc).toEqual(reference.candidats);
        expect(r.certitude, e.idcc).toBe('a_confirmer');
        if (r.opcoSlug != null) expect(reference.candidats.map((c) => c.opcoSlug), e.idcc).toContain(r.opcoSlug);
      }
    }
  });

  // Entrées de dix entreprises réelles (réponses de l'API Recherche d'entreprises du jeu d'essai du site, lues par
  // parseResultatRechercheEntreprises) et leur résolution avant l'ajout des parts observées.
  const ENTREPRISES: { nom: string; entree: EntreeResolution; avant: Pick<ResolutionOpco, 'opcoSlug' | 'certitude' | 'idccRetenu'> }[] = [
    { nom: 'SFG DEVELOPPEMENT', entree: { idccs: ['1516'], idccSiege: ['1516'], codeNaf: '85.59A', natureJuridique: '5710' }, avant: { opcoSlug: 'akto', certitude: 'fiable', idccRetenu: '1516' } },
    { nom: 'AIRBUS', entree: { idccs: ['1612', '3248', '9999', '1944'], idccSiege: ['3248', '9999'], codeNaf: '30.30Z', natureJuridique: '5710' }, avant: { opcoSlug: 'opco2i', certitude: 'a_confirmer', idccRetenu: '3248' } },
    { nom: 'CROIX ROUGE FRANCAISE', entree: { idccs: ['5502', '3127', '9999', '2941'], idccSiege: [], codeNaf: '88.99B', natureJuridique: '9230' }, avant: { opcoSlug: null, certitude: 'a_confirmer', idccRetenu: null } },
    { nom: 'VEOLIA PROPRETE', entree: { idccs: ['2149', '9999', '0637'], idccSiege: [], codeNaf: '38.32Z', natureJuridique: '5710' }, avant: { opcoSlug: null, certitude: 'a_confirmer', idccRetenu: null } },
    { nom: 'TOURISTIC HOTEL', entree: { idccs: ['1979', '1483'], idccSiege: ['1979'], codeNaf: '55.10Z', natureJuridique: '5710' }, avant: { opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: '1979' } },
    { nom: 'CARREFOUR VOYAGES', entree: { idccs: ['3245'], idccSiege: ['3245'], codeNaf: '79.11Z', natureJuridique: '5710' }, avant: { opcoSlug: 'opco-mobilites', certitude: 'a_confirmer', idccRetenu: '3245' } },
    { nom: 'CARREFOUR', entree: { idccs: ['2216'], idccSiege: ['2216'], codeNaf: '64.20Z', natureJuridique: '5599' }, avant: { opcoSlug: 'opcommerce', certitude: 'fiable', idccRetenu: '2216' } },
    { nom: 'CARREFOUR (fondation)', entree: { idccs: [], idccSiege: [], codeNaf: '68.32A', natureJuridique: '9110' }, avant: { opcoSlug: null, certitude: 'inconnu', idccRetenu: null } },
    { nom: 'ASSOCIATION ABGAV', entree: { idccs: [], idccSiege: [], codeNaf: '88.99B', natureJuridique: '9220' }, avant: { opcoSlug: null, certitude: 'inconnu', idccRetenu: null } },
    { nom: 'AUCHAN RUSSIE', entree: { idccs: [], idccSiege: [], codeNaf: '46.39B', natureJuridique: '3220' }, avant: { opcoSlug: null, certitude: 'inconnu', idccRetenu: null } },
  ];

  it('entreprises réelles : les réponses « fiable » et celles fondées sur une convention sont inchangées', () => {
    for (const { nom, entree, avant } of ENTREPRISES) {
      const apres = resoudreOpco(entree, EMBEDDED_IDCC, EMBEDDED_NAF);
      if (avant.certitude === 'fiable' || avant.opcoSlug != null) {
        expect({ opcoSlug: apres.opcoSlug, certitude: apres.certitude, idccRetenu: apres.idccRetenu }, nom).toEqual(avant);
      } else if (avant.certitude === 'a_confirmer') {
        // Plusieurs candidats sans présélection : les candidats restent ; le code NAF peut seulement en présélectionner un.
        expect(apres.certitude, nom).toBe('a_confirmer');
        expect(apres.candidats, nom).toEqual(resoudreOpco(entree, EMBEDDED_IDCC, []).candidats);
      } else {
        // Sans convention exploitable : jamais « fiable » ; au mieux une suggestion « à confirmer ».
        expect(apres.certitude, nom).not.toBe('fiable');
      }
    }
  });
});
