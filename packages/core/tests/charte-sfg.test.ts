// ============================================================
// Charte rédactionnelle SFG : jamais le tiret cadratin (U+2014), quelle que soit la production. Ce garde parcourt les données
// que le site affiche (les 11 barèmes OPCO, la table IDCC avec ses titres et ses notes, le catalogue d'aides national et régional,
// les portails régionaux, les suggestions d'OPCO par code NAF) et signale chaque chaîne de prose qui en contient un, avec son
// chemin JSON. Le contrôle est générique : il lit toutes les chaînes, sans liste de champs à tenir à jour.
//   - chaîne de prose : au moins un espace (les identifiants, les valeurs d'énumération et les adresses web n'en ont pas) ;
//   - ne sont pas lus : les citations entre « » (un extrait mot pour mot d'une source n'est pas une production de SFG) et
//     les adresses web contenues dans une phrase.
// Le contrôle est appliqué aux données embarquées puis à des copies mutées, pour prouver qu'il détecte bien ce qu'il prétend détecter.
// Les textes que le moteur produit (libellés, messages, démarches) sont contrôlés dans scenarios.test.ts.
// ============================================================

import { describe, it, expect } from 'vitest';
import type { Aide, PortailRegional } from '../src/aides/types';
import { EMBEDDED_AIDES, EMBEDDED_IDCC, EMBEDDED_NAF, EMBEDDED_OPCOS, EMBEDDED_PORTAILS } from '../src/data';
import type { IdccTable, SuggestionNaf } from '../src/opco-resolver';
import type { OpcoData } from '../src/types';

/** U+2014, construit par son code : le tiret cadratin ne figure pas dans ce fichier (charte SFG). */
const TIRET_CADRATIN = String.fromCharCode(0x2014);

/** Citation entre guillemets français : un extrait de source repris mot pour mot. */
const CITATION = /«[^»]*»/g;
/** Adresse web au milieu d'une phrase. */
const ADRESSE_WEB = /https?:\/\/\S+/g;

interface Chaine {
  chemin: string;
  texte: string;
}

/** Repère d'un élément de tableau dans un chemin : son identifiant (aide, variante, dispositif), son slug, sa taille ou sa région, sinon son rang. */
function repere(element: unknown, rang: number): string {
  const { id, slug, taille, region } = (element ?? {}) as Record<string, unknown>;
  for (const cle of [id, slug, taille, region]) {
    if (typeof cle === 'string') return cle;
  }
  return String(rang);
}

/** Toutes les chaînes de prose (au moins un espace) d'une valeur JSON, avec leur chemin. */
function chainesDeProse(valeur: unknown, chemin: string, sortie: Chaine[] = []): Chaine[] {
  if (typeof valeur === 'string') {
    if (/\s/.test(valeur)) sortie.push({ chemin, texte: valeur });
  } else if (Array.isArray(valeur)) {
    valeur.forEach((element, rang) => chainesDeProse(element, `${chemin}[${repere(element, rang)}]`, sortie));
  } else if (valeur !== null && typeof valeur === 'object') {
    for (const [cle, v] of Object.entries(valeur)) chainesDeProse(v, `${chemin}.${cle}`, sortie);
  }
  return sortie;
}

/** true si le texte contient un tiret cadratin hors des citations « … » et des adresses web. */
const contientTiret = (texte: string): boolean => texte.replace(CITATION, ' ').replace(ADRESSE_WEB, ' ').includes(TIRET_CADRATIN);

interface Donnees {
  opcos: OpcoData[];
  idcc: IdccTable;
  aides: Aide[];
  portails: PortailRegional[];
  naf: SuggestionNaf[];
}

const embarquees = (): Donnees => ({
  opcos: EMBEDDED_OPCOS,
  idcc: EMBEDDED_IDCC,
  aides: EMBEDDED_AIDES,
  portails: EMBEDDED_PORTAILS,
  naf: EMBEDDED_NAF,
});

/** Chaînes de prose de chaque source de données, avec leur chemin (`opcos[akto].…`, `idcc[1516].…`, `aides[nat-cpf].…`, `portails[11].…`, `naf[85].…`). */
function lire(d: Donnees): Record<keyof Donnees, Chaine[]> {
  return {
    opcos: d.opcos.flatMap((o) => chainesDeProse(o, `opcos[${o.slug}]`)),
    idcc: Object.entries(d.idcc).flatMap(([code, e]) => chainesDeProse(e, `idcc[${code}]`)),
    aides: d.aides.flatMap((a) => chainesDeProse(a, `aides[${a.id}]`)),
    portails: d.portails.flatMap((p) => chainesDeProse(p, `portails[${p.region}]`)),
    naf: d.naf.flatMap((s) => chainesDeProse(s, `naf[${s.prefixe}]`)),
  };
}

/** Une ligne par chaîne de prose qui contient un tiret cadratin : son chemin (vide = conforme). */
function controlerCharte(d: Donnees): string[] {
  return Object.values(lire(d))
    .flat()
    .filter(({ texte }) => contientTiret(texte))
    .map(({ chemin }) => `${chemin} : tiret cadratin`);
}

describe('charte SFG : aucun tiret cadratin dans les textes que le site affiche', () => {
  it('les 11 OPCO, la table IDCC, le catalogue d\'aides, les portails régionaux et les suggestions NAF n\'en contiennent aucun', () => {
    expect(EMBEDDED_OPCOS).toHaveLength(11);
    expect(controlerCharte(embarquees())).toEqual([]);
  });

  it('le contrôle lit chaque source : des chaînes de prose sont examinées pour chaque OPCO, convention, aide et portail', () => {
    const d = embarquees();
    for (const o of d.opcos) {
      expect(lire({ ...d, opcos: [o] }).opcos.length, o.slug).toBeGreaterThan(20);
    }
    for (const [code, e] of Object.entries(d.idcc)) {
      expect(chainesDeProse(e, code).length, code).toBeGreaterThanOrEqual(1);
    }
    for (const a of d.aides) {
      expect(chainesDeProse(a, a.id).length, a.id).toBeGreaterThan(4);
    }
    for (const p of d.portails) {
      expect(chainesDeProse(p, p.region).length, p.region).toBeGreaterThan(1);
    }
    expect(lire(d).naf.length).toBeGreaterThan(20);
    // Les notes et les titres de la table IDCC, les barèmes, les 173 aides : plusieurs milliers de chaînes lues au total.
    expect(Object.values(lire(d)).flat().length).toBeGreaterThan(5000);
  });
});

/**
 * Copie des données embarquées dont chaque tiret cadratin est remplacé par une virgule : le point de départ des mutations est
 * propre quel que soit l'état des données, et chaque signalement d'une copie mutée vient de la seule mutation.
 */
function propres(): Donnees {
  const nettoyer = (valeur: unknown): unknown => {
    if (typeof valeur === 'string') return valeur.replaceAll(TIRET_CADRATIN, ',');
    if (Array.isArray(valeur)) return valeur.map(nettoyer);
    if (valeur !== null && typeof valeur === 'object') {
      return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => [cle, nettoyer(v)]));
    }
    return valeur;
  };
  return nettoyer(embarquees()) as Donnees;
}

describe('le contrôle détecte une copie mutée', () => {
  const muter = (modifier: (d: Donnees) => void): Donnees => {
    const copie = propres();
    modifier(copie);
    return copie;
  };
  const opco = (d: Donnees, slug: string): OpcoData => d.opcos.find((o) => o.slug === slug)!;
  const aide = (d: Donnees, id: string): Aide => d.aides.find((a) => a.id === id)!;
  const portail = (d: Donnees, region: string): PortailRegional => d.portails.find((p) => p.region === region)!;
  const avecTiret = (debut: string, fin: string): string => `${debut} ${TIRET_CADRATIN} ${fin}`;

  it('le point de départ des mutations est propre : les données embarquées, tirets cadratins remplacés par des virgules', () => {
    expect(controlerCharte(propres())).toEqual([]);
    expect(Object.values(lire(propres())).flat()).toHaveLength(Object.values(lire(embarquees())).flat().length);
  });

  it('un tiret cadratin réinjecté est signalé avec son chemin JSON, dans chacune des cinq sources', () => {
    const naf = EMBEDDED_NAF.find((s) => /\s/.test(s.libelle))!;
    const copie = muter((d) => {
      opco(d, 'akto').specificites = avecTiret('Règles propres à chaque branche', 'voir la fiche');
      d.idcc['3229'].note = avecTiret('Nouvel IDCC', 'à confirmer');
      d.idcc['1516'].titre = avecTiret('Organismes', 'formation');
      aide(d, 'nat-cpf').description = avecTiret('Compte personnel', 'solde');
      aide(d, 'r11-recrutup').nom = avecTiret('RecrutUp', 'Île-de-France');
      portail(d, '53').liens[0].titre = avecTiret('Région', 'Bretagne');
      d.naf.find((s) => s.prefixe === naf.prefixe)!.libelle = avecTiret(naf.libelle, 'suite');
    });
    expect(controlerCharte(copie).sort()).toEqual(
      [
        'opcos[akto].specificites : tiret cadratin',
        'idcc[3229].note : tiret cadratin',
        'idcc[1516].titre : tiret cadratin',
        'aides[nat-cpf].description : tiret cadratin',
        'aides[r11-recrutup].nom : tiret cadratin',
        'portails[53].liens[0].titre : tiret cadratin',
        `naf[${naf.prefixe}].libelle : tiret cadratin`,
      ].sort(),
    );
  });

  it('le chemin désigne les éléments de tableau par leur identifiant, leur taille ou leur rang', () => {
    const copie = muter((d) => {
      opco(d, 'akto').dispositifs_complementaires![0].conditions[0] = avecTiret('Sous condition', 'voir le dossier');
      opco(d, 'akto').variantes_branche!.find((v) => v.id === 'hcr')!.note = avecTiret('Barème', 'HCR');
      opco(d, 'akto').plafonds_par_taille!.find((p) => p.taille === 'less_11')!.description = avecTiret('Moins de 11 salariés', 'budget');
      opco(d, 'akto').profils_candidats[0] = avecTiret('Salariés', 'moins de 50');
      aide(d, 'nat-cpf').conditions[0] = avecTiret('Condition', 'suite');
      aide(d, 'nat-cpf').demarches[0] = avecTiret('Démarche', 'suite');
      aide(d, 'nat-cpf').montant.libelle = avecTiret('Montant', 'suite');
      aide(d, 'nat-cpf').sources[0].titre = avecTiret('Source', 'suite');
    });
    expect(controlerCharte(copie).sort()).toEqual(
      [
        'opcos[akto].dispositifs_complementaires[espace-formation].conditions[0] : tiret cadratin',
        'opcos[akto].variantes_branche[hcr].note : tiret cadratin',
        'opcos[akto].plafonds_par_taille[less_11].description : tiret cadratin',
        'opcos[akto].profils_candidats[0] : tiret cadratin',
        'aides[nat-cpf].conditions[0] : tiret cadratin',
        'aides[nat-cpf].demarches[0] : tiret cadratin',
        'aides[nat-cpf].montant.libelle : tiret cadratin',
        'aides[nat-cpf].sources[0].titre : tiret cadratin',
      ].sort(),
    );
  });

  it('une chaîne est signalée une seule fois, même avec plusieurs tirets cadratins', () => {
    const copie = muter((d) => {
      opco(d, 'akto').specificites = `A ${TIRET_CADRATIN} B ${TIRET_CADRATIN} C ${TIRET_CADRATIN} D`;
    });
    expect(controlerCharte(copie)).toEqual(['opcos[akto].specificites : tiret cadratin']);
  });

  it('un tiret cadratin entre « » (citation mot pour mot) n\'est pas signalé', () => {
    const copie = muter((d) => {
      opco(d, 'akto').specificites = `Extrait de la page : « Plan ${TIRET_CADRATIN} budget de 2 500 € » repris tel quel.`;
      aide(d, 'nat-cpf').description = `« Un ${TIRET_CADRATIN} deux » ; « trois ${TIRET_CADRATIN} quatre »`;
    });
    expect(controlerCharte(copie)).toEqual([]);
  });

  it('un tiret cadratin hors des « » est signalé même quand la même chaîne en cite un', () => {
    const copie = muter((d) => {
      opco(d, 'akto').specificites = `Extrait : « Plan ${TIRET_CADRATIN} budget » ${TIRET_CADRATIN} à confirmer.`;
      aide(d, 'nat-cpf').description = `Avant ${TIRET_CADRATIN} « cité » puis « cité ${TIRET_CADRATIN} encore »`;
    });
    expect(controlerCharte(copie).sort()).toEqual(['aides[nat-cpf].description : tiret cadratin', 'opcos[akto].specificites : tiret cadratin']);
  });

  it('un guillemet ouvrant sans fermeture n\'exempte rien', () => {
    const copie = muter((d) => {
      opco(d, 'akto').specificites = `« Citation jamais refermée ${TIRET_CADRATIN} suite du texte`;
    });
    expect(controlerCharte(copie)).toEqual(['opcos[akto].specificites : tiret cadratin']);
  });

  it('une adresse web au milieu d\'une phrase n\'est pas lue, mais le reste de la phrase l\'est', () => {
    const copie = muter((d) => {
      opco(d, 'akto').specificites = `Voir https://exemple.fr/a${TIRET_CADRATIN}b pour le détail.`;
      aide(d, 'nat-cpf').description = `Voir https://exemple.fr/a${TIRET_CADRATIN}b ${TIRET_CADRATIN} pour le détail.`;
    });
    expect(controlerCharte(copie)).toEqual(['aides[nat-cpf].description : tiret cadratin']);
  });

  it('une chaîne sans espace (identifiant, énumération, adresse web seule) n\'est pas une chaîne de prose', () => {
    const copie = muter((d) => {
      aide(d, 'nat-cpf').sources[0].url = `https://exemple.fr/a${TIRET_CADRATIN}b`;
      d.idcc['1516'].source = `https://exemple.fr/a${TIRET_CADRATIN}b`;
    });
    expect(controlerCharte(copie)).toEqual([]);
  });
});
