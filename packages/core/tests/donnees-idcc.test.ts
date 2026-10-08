import { describe, it, expect } from 'vitest';
import { EMBEDDED_IDCC, EMBEDDED_NAF, EMBEDDED_OPCOS } from '../src/data';
import { IdccTableSchema, SuggestionNafSchema } from '../src/schema';
import { resoudreOpco } from '../src/opco-resolver';

const SLUGS = new Set(EMBEDDED_OPCOS.map((o) => o.slug));

// Rattachements notoires servant de garde-fous (vérifiés sur les sites des OPCO ou dans leur arrêté d'agrément).
const ANCRES: Record<string, string> = {
  '1516': 'akto', // organismes de formation
  '1979': 'akto', // hôtels, cafés, restaurants
  '3248': 'opco2i', // métallurgie
  '0044': 'opco2i', // industries chimiques
  '1486': 'atlas', // bureaux d'études techniques (Syntec)
  '2216': 'opcommerce', // commerce à prédominance alimentaire
  '0016': 'opco-mobilites', // transports routiers
  '1597': 'constructys', // bâtiment ouvriers (plus de 10 salariés)
  '2264': 'opco-sante', // hospitalisation privée
  '1996': 'opco-ep', // pharmacie d'officine
  '1261': 'uniformation', // acteurs du lien social et familial
};

describe('table IDCC v2', () => {
  it('respecte le schéma et couvre au moins 900 conventions', () => {
    expect(IdccTableSchema.safeParse(EMBEDDED_IDCC).success).toBe(true);
    expect(Object.keys(EMBEDDED_IDCC).length).toBeGreaterThanOrEqual(900);
  });

  it('chaque clé est le code IDCC de son entrée', () => {
    for (const [cle, e] of Object.entries(EMBEDDED_IDCC)) expect(e.idcc, cle).toBe(cle);
  });

  it("n'utilise que les 11 OPCO connus", () => {
    for (const e of Object.values(EMBEDDED_IDCC)) {
      if (e.opco) expect(SLUGS.has(e.opco), e.idcc).toBe(true);
      for (const o of e.opcos_possibles ?? []) expect(SLUGS.has(o), e.idcc).toBe(true);
    }
  });

  it('décrit correctement fusions, partages, échappatoires et conventions sans OPCO confirmé', () => {
    for (const e of Object.values(EMBEDDED_IDCC)) {
      if (e.statut === 'fusionne' && e.idcc_cible) {
        expect(EMBEDDED_IDCC[e.idcc_cible], e.idcc).toBeDefined();
        expect(EMBEDDED_IDCC[e.idcc_cible]?.statut, e.idcc).not.toBe('fusionne');
      }
      if (e.statut === 'partage') expect((e.opcos_possibles ?? []).length, e.idcc).toBeGreaterThanOrEqual(2);
      if (e.statut === 'echappatoire') expect(e.opco, e.idcc).toBeNull();
      if (e.statut === 'actif' && e.opco === null) expect((e.note ?? '').length, e.idcc).toBeGreaterThan(0);
      expect(e.source, e.idcc).toMatch(/^https:\/\//);
    }
    for (const code of ['5501', '5100', '9998', '9999']) expect(EMBEDDED_IDCC[code]?.statut).toBe('echappatoire');
  });

  it('respecte les rattachements notoires', () => {
    for (const [idcc, opco] of Object.entries(ANCRES)) {
      expect(resoudreOpco({ idccs: [idcc] }, EMBEDDED_IDCC).opcoSlug, idcc).toBe(opco);
    }
  });

  it('les suggestions NAF sont valides', () => {
    for (const s of EMBEDDED_NAF) {
      expect(SuggestionNafSchema.safeParse(s).success, s.prefixe).toBe(true);
      expect(SLUGS.has(s.opco), s.prefixe).toBe(true);
    }
  });
});

// Conventions connues sans OPCO confirmé et conventions fusionnées ou closes sans convention de rattachement :
// le résolveur ne doit inventer aucun OPCO pour elles (vérifié sur les données embarquées, sans NAF).
describe('table IDCC v2 : le résolveur sur les conventions sans OPCO confirmé', () => {
  const entrees = Object.values(EMBEDDED_IDCC);
  const actifsSansOpco = entrees.filter((e) => e.statut === 'actif' && e.opco === null);
  const fusionneesSansCibleSansOpco = entrees.filter((e) => e.statut === 'fusionne' && !e.idcc_cible && e.opco === null);
  const fusionneesSansCibleAvecOpco = entrees.filter((e) => e.statut === 'fusionne' && !e.idcc_cible && e.opco !== null);

  it('la table contient bien de telles conventions (garde contre un contrôle vide)', () => {
    expect(actifsSansOpco.length).toBeGreaterThan(0);
    expect(fusionneesSansCibleSansOpco.length).toBeGreaterThan(0);
    expect(fusionneesSansCibleAvecOpco.length).toBeGreaterThan(0);
  });

  it("une convention connue sans OPCO confirmé n'est ni rattachée à un OPCO ni « non référencée »", () => {
    for (const e of [...actifsSansOpco, ...fusionneesSansCibleSansOpco]) {
      const r = resoudreOpco({ idccs: [e.idcc] }, EMBEDDED_IDCC);
      expect(r, e.idcc).toMatchObject({ opcoSlug: null, certitude: 'inconnu', candidats: [], idccRetenu: null });
      expect(r.avertissements, e.idcc).toContain(
        `IDCC ${e.idcc} (${e.titre}) : aucun OPCO confirmé par une source officielle pour cette convention.`,
      );
      expect(r.avertissements.some((a) => a.includes('non référencé')), e.idcc).toBe(false);
    }
  });

  it("une convention fusionnée ou close sans convention cible n'est jamais « fiable »", () => {
    for (const e of fusionneesSansCibleAvecOpco) {
      const r = resoudreOpco({ idccs: [e.idcc] }, EMBEDDED_IDCC);
      expect(r, e.idcc).toMatchObject({ opcoSlug: e.opco, certitude: 'a_confirmer', idccRetenu: e.idcc });
      expect(r.motif, e.idcc).toContain('fusionnée ou close');
    }
  });
});

// Conventions dont l'OPCO n'est établi par aucune source officielle propre à cet IDCC (repris d'une ancienne table,
// ou déduit des conventions remplacées) : le drapeau a_confirmer plafonne la certitude du résolveur.
describe('table IDCC v2 : rattachements sans source officielle propre à la convention', () => {
  const entrees = Object.values(EMBEDDED_IDCC);
  const marquees = entrees.filter((e) => e.a_confirmer);
  const MOTIFS = ["repris de l'ancienne table", 'déduit des conventions remplacées'];
  const ditAConfirmer = (e: (typeof entrees)[number]) =>
    e.statut === 'actif' && MOTIFS.some((m) => (e.note ?? '').includes(m));

  it('la table contient bien de telles conventions (garde contre un contrôle vide)', () => {
    expect(marquees.length).toBeGreaterThan(0);
    expect(entrees.filter(ditAConfirmer).length).toBeGreaterThan(0);
  });

  it('une convention marquée a_confirmer a un OPCO et une note qui en donne la raison', () => {
    for (const e of marquees) {
      expect(e.opco, e.idcc).not.toBeNull();
      expect((e.note ?? '').length, e.idcc).toBeGreaterThan(0);
    }
  });

  it("toute convention dont la note dit que l'OPCO est repris d'une ancienne table ou déduit des conventions remplacées porte le drapeau", () => {
    for (const e of entrees.filter(ditAConfirmer)) expect(e.a_confirmer, e.idcc).toBe(true);
  });

  it("une convention marquée a_confirmer est résolue « à confirmer », jamais « fiable » (l'OPCO reste le candidat)", () => {
    for (const e of marquees) {
      const r = resoudreOpco({ idccs: [e.idcc] }, EMBEDDED_IDCC);
      expect(r.certitude, e.idcc).toBe('a_confirmer');
      expect(r.opcoSlug, e.idcc).toBe(e.opco);
    }
  });

  it("une convention fusionnée vers une convention marquée a_confirmer n'est pas « fiable » non plus", () => {
    const versMarquee = entrees.filter((e) => e.statut === 'fusionne' && e.idcc_cible && EMBEDDED_IDCC[e.idcc_cible]?.a_confirmer);
    expect(versMarquee.length).toBeGreaterThan(0);
    for (const e of versMarquee) {
      expect(resoudreOpco({ idccs: [e.idcc] }, EMBEDDED_IDCC).certitude, e.idcc).toBe('a_confirmer');
    }
  });
});

// Conventions partagées, provenance des codes d'échappement et hygiène des textes de la table.
describe('table IDCC v2 : conventions partagées, provenance et hygiène des textes', () => {
  const entrees = Object.values(EMBEDDED_IDCC);

  it('une convention partagée ne désigne aucun OPCO seul : opco est null, les OPCO possibles sont dans opcos_possibles', () => {
    const partagees = entrees.filter((e) => e.statut === 'partage');
    expect(partagees.length).toBeGreaterThan(0);
    for (const e of partagees) expect(e.opco, e.idcc).toBeNull();
  });

  it("les notes des codes d'échappement 9998, 5501 et 5100 citent la page AKTO qui les établit, pas la fiche net-entreprises", () => {
    // La fiche net-entreprises « IDCC : comment faire la déclaration ? » ne mentionne que le code 9999.
    for (const code of ['9998', '5501', '5100']) {
      const note = EMBEDDED_IDCC[code]?.note ?? '';
      expect(note, code).toContain('page AKTO « Comment connaître mon opérateur de compétences »');
      expect(note, code).not.toContain('fiche net-entreprises');
    }
  });

  it("les notes affichées par le résolveur (conventions partagées ou marquées à confirmer) nomment chaque OPCO, jamais par son identifiant technique", () => {
    const affichees = entrees.filter((e) => e.statut === 'partage' || e.a_confirmer);
    expect(affichees.length).toBeGreaterThan(0);
    for (const e of affichees) {
      const texte = (e.note ?? '').replace(/https?:\/\/\S+/g, '');
      for (const slug of SLUGS) {
        expect(texte, `${e.idcc} : ${slug}`).not.toMatch(new RegExp(`(^|[^\\w-])${slug}([^\\w-]|$)`));
      }
    }
  });

  it("aucun titre ne se termine par des points de suspension et aucun titre ni aucune note ne contient d'apostrophe courbe", () => {
    // U+2019, construite par son code pour rester visible dans le source (les textes affichés n'ont que des apostrophes droites).
    const apostropheCourbe = String.fromCharCode(0x2019);
    for (const e of entrees) {
      expect(e.titre, e.idcc).not.toMatch(/\.\.\.\s*$/);
      expect(e.titre, e.idcc).not.toContain(apostropheCourbe);
      expect(e.note ?? '', e.idcc).not.toContain(apostropheCourbe);
    }
  });
});
