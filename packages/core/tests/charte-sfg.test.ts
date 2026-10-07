// ============================================================
// Charte rédactionnelle SFG : jamais le tiret cadratin (U+2014), ni la barre horizontale (U+2015) qui s'affiche comme lui,
// quelle que soit la production. Ce garde parcourt les données que le site affiche (les 11 barèmes OPCO, la table IDCC avec ses
// titres et ses notes, le catalogue d'aides national et régional, les portails régionaux, les suggestions d'OPCO par code NAF)
// et signale chaque chaîne lue qui en contient un, avec son chemin JSON et le signe trouvé. Le contrôle est générique : il lit
// toutes les chaînes, sans liste de champs à tenir à jour.
//   - chaînes lues : toutes, sauf une adresse web seule (`https://…` sans espace) et un identifiant nu (identifiant d'aide,
//     valeur d'énumération, date, code : lettres sans accent, chiffres, tiret, point, souligné), qui ne peut contenir aucun
//     tiret cadratin. Un nom d'un seul mot (un mot, un tiret cadratin, un mot) est donc lu : l'absence d'espace n'exempte rien ;
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
/** U+2015, barre horizontale : même rendu qu'un tiret cadratin (un titre de convention collective en portait une). */
const BARRE_HORIZONTALE = String.fromCharCode(0x2015);
/** Les signes interdits et le nom donné dans un signalement. */
const SIGNES_INTERDITS: ReadonlyArray<readonly [string, string]> = [
  [TIRET_CADRATIN, 'tiret cadratin'],
  [BARRE_HORIZONTALE, 'barre horizontale'],
];

/** Citation entre guillemets français : un extrait de source repris mot pour mot. */
const CITATION = /«[^»]*»/g;
/** Adresse web au milieu d'une phrase. */
const ADRESSE_WEB = /https?:\/\/\S+/g;
/** Chaîne qui est une adresse web, rien d'autre. */
const ADRESSE_WEB_SEULE = /^https?:\/\/\S+$/;
/** Identifiant nu : identifiant d'aide, valeur d'énumération, date, code (jamais de tiret cadratin : il n'est pas dans cette classe). */
const IDENTIFIANT_NU = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/** true si la garde lit la chaîne : toutes, sauf une adresse web seule et un identifiant nu. Un seul mot n'est pas exempté pour autant. */
const estLue = (texte: string): boolean => !ADRESSE_WEB_SEULE.test(texte) && !IDENTIFIANT_NU.test(texte);

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

/** Toutes les chaînes lues par la garde (voir `estLue`) d'une valeur JSON, avec leur chemin. */
function chainesLues(valeur: unknown, chemin: string, sortie: Chaine[] = []): Chaine[] {
  if (typeof valeur === 'string') {
    if (estLue(valeur)) sortie.push({ chemin, texte: valeur });
  } else if (Array.isArray(valeur)) {
    valeur.forEach((element, rang) => chainesLues(element, `${chemin}[${repere(element, rang)}]`, sortie));
  } else if (valeur !== null && typeof valeur === 'object') {
    for (const [cle, v] of Object.entries(valeur)) chainesLues(v, `${chemin}.${cle}`, sortie);
  }
  return sortie;
}

/** Signes interdits présents dans le texte hors des citations « … » et des adresses web (un nom par signe, dans l'ordre de la liste). */
const signesTrouves = (texte: string): string[] => {
  const lu = texte.replace(CITATION, ' ').replace(ADRESSE_WEB, ' ');
  return SIGNES_INTERDITS.filter(([signe]) => lu.includes(signe)).map(([, nom]) => nom);
};

/** true si le texte contient un tiret cadratin ou une barre horizontale hors des citations « … » et des adresses web. */
const contientTiret = (texte: string): boolean => signesTrouves(texte).length > 0;

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

/** Chaînes lues de chaque source de données, avec leur chemin (`opcos[akto].…`, `idcc[1516].…`, `aides[nat-cpf].…`, `portails[11].…`, `naf[85].…`). */
function lire(d: Donnees): Record<keyof Donnees, Chaine[]> {
  return {
    opcos: d.opcos.flatMap((o) => chainesLues(o, `opcos[${o.slug}]`)),
    idcc: Object.entries(d.idcc).flatMap(([code, e]) => chainesLues(e, `idcc[${code}]`)),
    aides: d.aides.flatMap((a) => chainesLues(a, `aides[${a.id}]`)),
    portails: d.portails.flatMap((p) => chainesLues(p, `portails[${p.region}]`)),
    naf: d.naf.flatMap((s) => chainesLues(s, `naf[${s.prefixe}]`)),
  };
}

/** Une ligne par chaîne lue et par signe interdit qu'elle contient : son chemin et le signe (vide = conforme). */
function controlerCharte(d: Donnees): string[] {
  return Object.values(lire(d))
    .flat()
    .flatMap(({ chemin, texte }) => signesTrouves(texte).map((nom) => `${chemin} : ${nom}`));
}

describe('charte SFG : ni tiret cadratin ni barre horizontale dans les textes que le site affiche', () => {
  it('les 11 OPCO, la table IDCC, le catalogue d\'aides, les portails régionaux et les suggestions NAF n\'en contiennent aucun', () => {
    expect(EMBEDDED_OPCOS).toHaveLength(11);
    expect(controlerCharte(embarquees())).toEqual([]);
  });

  it('le contrôle lit chaque source : des chaînes sont examinées pour chaque OPCO, convention, aide et portail', () => {
    const d = embarquees();
    for (const o of d.opcos) {
      expect(lire({ ...d, opcos: [o] }).opcos.length, o.slug).toBeGreaterThan(20);
    }
    for (const [code, e] of Object.entries(d.idcc)) {
      expect(chainesLues(e, code).length, code).toBeGreaterThanOrEqual(1);
    }
    for (const a of d.aides) {
      expect(chainesLues(a, a.id).length, a.id).toBeGreaterThan(4);
    }
    for (const p of d.portails) {
      expect(chainesLues(p, p.region).length, p.region).toBeGreaterThan(1);
    }
    expect(lire(d).naf.length).toBeGreaterThan(20);
    // Les notes et les titres de la table IDCC, les barèmes, les 173 aides : plusieurs milliers de chaînes lues au total.
    expect(Object.values(lire(d)).flat().length).toBeGreaterThan(5000);
  });
});

/**
 * Copie des données embarquées dont chaque tiret cadratin et chaque barre horizontale sont remplacés par une virgule : le point
 * de départ des mutations est propre quel que soit l'état des données, et chaque signalement d'une copie mutée vient de la seule
 * mutation.
 */
function propres(): Donnees {
  const nettoyer = (valeur: unknown): unknown => {
    if (typeof valeur === 'string') return valeur.replaceAll(TIRET_CADRATIN, ',').replaceAll(BARRE_HORIZONTALE, ',');
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

  it('une barre horizontale (U+2015) réinjectée est signalée avec son chemin JSON, dans chacune des cinq sources', () => {
    const naf = EMBEDDED_NAF.find((s) => /\s/.test(s.libelle))!;
    const avecBarre = (debut: string, fin: string): string => `${debut} ${BARRE_HORIZONTALE} ${fin}`;
    const copie = muter((d) => {
      opco(d, 'akto').specificites = avecBarre('Règles propres à chaque branche', 'voir la fiche');
      d.idcc['2636'].titre = avecBarre("Enseignement, écoles supérieures d'ingénieurs et de cadres", 'FESIC du 5 décembre 2006');
      aide(d, 'nat-cpf').description = avecBarre('Compte personnel', 'solde');
      portail(d, '53').liens[0].titre = avecBarre('Région', 'Bretagne');
      d.naf.find((s) => s.prefixe === naf.prefixe)!.libelle = avecBarre(naf.libelle, 'suite');
    });
    expect(controlerCharte(copie).sort()).toEqual(
      [
        'opcos[akto].specificites : barre horizontale',
        'idcc[2636].titre : barre horizontale',
        'aides[nat-cpf].description : barre horizontale',
        'portails[53].liens[0].titre : barre horizontale',
        `naf[${naf.prefixe}].libelle : barre horizontale`,
      ].sort(),
    );
  });

  it('une chaîne qui porte les deux signes est signalée une fois pour chacun ; entre « », la barre horizontale ne l\'est pas', () => {
    const copie = muter((d) => {
      opco(d, 'akto').specificites = `A ${TIRET_CADRATIN} B ${BARRE_HORIZONTALE} C ${BARRE_HORIZONTALE} D`;
      aide(d, 'nat-cpf').description = `Extrait : « Plan ${BARRE_HORIZONTALE} budget » repris tel quel.`;
    });
    expect(controlerCharte(copie)).toEqual([
      'opcos[akto].specificites : tiret cadratin',
      'opcos[akto].specificites : barre horizontale',
    ]);
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

  it("une adresse web seule n'est pas lue, même avec un tiret cadratin : elle n'est ni signalée ni parmi les chaînes lues", () => {
    const copie = muter((d) => {
      aide(d, 'nat-cpf').sources[0].url = `https://exemple.fr/a${TIRET_CADRATIN}b`;
      d.idcc['1516'].source = `https://exemple.fr/a${TIRET_CADRATIN}b`;
    });
    expect(controlerCharte(copie)).toEqual([]);
    // Sans l'exemption, la chaîne serait lue (puis écartée par le retrait des adresses web) : seule la liste des chaînes lues le prouve.
    const chemins = lire(copie).aides.map((c) => c.chemin);
    expect(chemins).not.toContain('aides[nat-cpf].sources[0].url');
    expect(lire(copie).idcc.map((c) => c.chemin)).not.toContain('idcc[1516].source');
  });

  it("un nom d'un seul mot, sans espace (un mot, un tiret cadratin, un mot), est lu et signalé avec son chemin", () => {
    const copie = muter((d) => {
      aide(d, 'nat-cpf').nom = `CPF${TIRET_CADRATIN}Compte`;
      aide(d, 'nat-cpf').conditions[0] = `Sans${TIRET_CADRATIN}condition`;
      d.idcc['1516'].titre = `Organismes${TIRET_CADRATIN}formation`;
      portail(d, '53').liens[0].titre = `Région${TIRET_CADRATIN}Bretagne`;
    });
    expect(controlerCharte(copie).sort()).toEqual(
      [
        'aides[nat-cpf].nom : tiret cadratin',
        'aides[nat-cpf].conditions[0] : tiret cadratin',
        'idcc[1516].titre : tiret cadratin',
        'portails[53].liens[0].titre : tiret cadratin',
      ].sort(),
    );
    expect(lire(copie).aides.map((c) => c.chemin)).toContain('aides[nat-cpf].nom');
  });
});

describe('la garde lit toute chaîne sauf une adresse web seule et un identifiant nu', () => {
  const avecTiret = (debut: string, fin: string): string => `${debut}${TIRET_CADRATIN}${fin}`;
  /** U+00A0, construit par son code : un espace insécable n'est pas un espace ordinaire dans une chaîne. */
  const ESPACE_INSECABLE = String.fromCharCode(0xa0);

  it("un seul mot avec un tiret cadratin est lu, quels que soient ses caractères : l'absence d'espace n'exempte rien", () => {
    for (const mot of [avecTiret('CPF', 'Compte'), avecTiret('a', 'b'), avecTiret('Région', 'Sud'), avecTiret('nat', 'cpf'), TIRET_CADRATIN]) {
      expect(estLue(mot), mot).toBe(true);
      expect(contientTiret(mot), mot).toBe(true);
    }
    // Un mot accentué est lu aussi (il n'est pas un identifiant nu) ; un mot en lettres sans accent est un identifiant nu : il ne peut
    // pas contenir de tiret cadratin, l'exempter ne cache rien.
    expect(estLue('Réunion')).toBe(true);
    expect(estLue('CPF')).toBe(false);
  });

  it("une phrase est lue, avec ou sans espace insécable ; une adresse web suivie d'un mot l'est aussi", () => {
    for (const phrase of ['Compte personnel de formation', `Plan${ESPACE_INSECABLE}de${ESPACE_INSECABLE}développement`, 'Voir https://exemple.fr/a', 'https://exemple.fr/a b']) {
      expect(estLue(phrase), phrase).toBe(true);
    }
  });

  it("une adresse web seule n'est pas lue, même avec un tiret cadratin dans le chemin", () => {
    for (const adresse of ['https://exemple.fr/a', 'http://exemple.fr', `https://exemple.fr/a${TIRET_CADRATIN}b`, 'https://www.fafcea.com/wp-content/uploads/2026/07/Criteres-SF-1-sept-2026.pdf']) {
      expect(estLue(adresse), adresse).toBe(false);
    }
  });

  it("un identifiant nu (identifiant d'aide, énumération, date, code) n'est pas lu", () => {
    for (const identifiant of ['nat-cpf', 'faf-fifpl', 'par_heure', 'depends_on_branche', 'less_11', '11_49', '2026-10-06', '86.21', '2A', '1516', '53']) {
      expect(estLue(identifiant), identifiant).toBe(false);
    }
  });

  it('la barre horizontale est interdite comme le tiret cadratin ; le tiret demi-cadratin (U+2013) ne l\'est pas', () => {
    expect(contientTiret(`a${BARRE_HORIZONTALE}b`)).toBe(true);
    expect(signesTrouves(`a ${BARRE_HORIZONTALE} b ${TIRET_CADRATIN} c`)).toEqual(['tiret cadratin', 'barre horizontale']);
    expect(contientTiret(`0,05 ${String.fromCharCode(0x2013)} 0,60 %`)).toBe(false);
  });

  it("une chaîne vide est lue (elle n'est ni une adresse ni un identifiant), sans rien signaler", () => {
    expect(estLue('')).toBe(true);
    expect(contientTiret('')).toBe(false);
  });

  it('chainesLues parcourt les objets et les tableaux et rend le chemin de chaque chaîne lue seulement', () => {
    const valeur = {
      id: 'nat-cpf',
      nom: avecTiret('CPF', 'Compte'),
      url: `https://exemple.fr/a${TIRET_CADRATIN}b`,
      conditions: ['Une phrase', 'code-2A'],
    };
    expect(chainesLues(valeur, 'x').map((c) => c.chemin)).toEqual(['x.nom', 'x.conditions[0]']);
  });
});
