import { describe, it, expect } from 'vitest';
import { EMBEDDED_OPCOS } from '../src/data';
import { applyVarianteBranche } from '../src/calculator';
import { OpcoDataSchema, sanityCheckOpco } from '../src/schema';
import type { OpcoData, SourcedValue } from '../src/types';

const CHAMPS_CHIFFRES = [
  'cout_horaire_inter',
  'cout_horaire_intra',
  'cout_horaire_metier',
  'prise_en_charge_salaires',
  'frais_transport',
  'frais_hebergement',
  'frais_restauration',
  'frais_annexes_pourcentage',
  'budget_annuel_max',
] as const;
type ChampChiffre = (typeof CHAMPS_CHIFFRES)[number];
type ChampsSources = Partial<Record<ChampChiffre, SourcedValue<number | null>>>;

/** Nombre de mois entiers écoulés depuis une date AAAA-MM-JJ (horloge du test). */
function moisDepuis(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const maintenant = new Date();
  return (maintenant.getUTCFullYear() - d.getUTCFullYear()) * 12 + (maintenant.getUTCMonth() - d.getUTCMonth());
}

// ---------------------------------------------------------------------------
// Outils de contrôle : chaque contrôle renvoie la liste des problèmes (chemin de la valeur + raison), vide = conforme.
// Ils sont appliqués au dataset embarqué, puis à des copies mutées pour prouver qu'ils détectent bien les erreurs.
// ---------------------------------------------------------------------------

/** Extraits entre guillemets français (« … ») d'une note. */
function extraits(note: string | undefined): string[] {
  return [...(note ?? '').matchAll(/«([^»]+)»/g)].map((m) => m[1]);
}

/**
 * Remet un texte à plat pour y chercher un nombre : séparateurs de milliers (espace, point) retirés et virgule décimale
 * ramenée au point (« 1 500 » → 1500, « 1.500 » → 1500, « 12,31 » → 12.31).
 */
function enChiffres(texte: string): string {
  return texte
    .replace(/\s/g, ' ')
    .replace(/(\d)[ .](?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d),(\d)/g, '$1.$2');
}

/** true si `valeur` figure dans `texte` comme un nombre à part entière (et non comme un fragment de 130, 1 300 ou 30,5). */
function contientValeur(texte: string, valeur: number): boolean {
  const [entier, decimales] = String(valeur).split('.');
  const motif = decimales ? `${entier}\\.${decimales}0*` : `${entier}(?:\\.0+)?`;
  return new RegExp(`(?<![\\d.])${motif}(?!\\d|\\.\\d)`).test(enChiffres(texte));
}

/** Extrait qui énonce une absence de prise en charge (valeur 0) : « pas de prise en charge », « ne pourront pas », « hors … ». */
const ABSENCE = /\b(?:pas|non|aucune?|sans|hors|exclu\w*|uniquement|ne pourront)\b/i;

/** Le barème par défaut d'un OPCO, puis chacune de ses variantes de branche. */
function niveaux(o: OpcoData): { chemin: string; champs: ChampsSources }[] {
  return [
    { chemin: o.slug, champs: o },
    ...(o.variantes_branche ?? []).map((v) => ({ chemin: `${o.slug}[${v.id}]`, champs: v })),
  ];
}

/** Toute valeur « exact » (défaut et variantes) : source https, extrait « » non vide, et la valeur elle-même dans un extrait. */
function controlerValeursExactes(opcos: OpcoData[]): string[] {
  const problemes: string[] = [];
  for (const o of opcos) {
    for (const { chemin, champs } of niveaux(o)) {
      for (const champ of CHAMPS_CHIFFRES) {
        const v = champs[champ];
        if (!v || v.value == null || v.confidence !== 'exact') continue;
        const ou = `${chemin}.${champ}`;
        if (!/^https:\/\//.test(v.source_url)) problemes.push(`${ou} : source_url non https (« ${v.source_url} »)`);
        const ex = extraits(v.note);
        if (ex.length === 0) {
          problemes.push(`${ou} : valeur « exact » sans extrait entre guillemets`);
        } else if (v.value === 0) {
          if (!ex.some((e) => ABSENCE.test(e))) problemes.push(`${ou} : 0 « exact » dont l'extrait n'énonce aucune absence de prise en charge`);
        } else if (!ex.some((e) => contientValeur(e, v.value as number))) {
          problemes.push(`${ou} : valeur ${v.value} « exact » absente de ses extraits`);
        }
      }
    }
    for (const v of o.variantes_branche ?? []) {
      if (v.confidence !== 'exact') continue;
      const ou = `${o.slug}[${v.id}]`;
      if (!/^https:\/\//.test(v.source_url)) problemes.push(`${ou} : source_url de la variante non https (« ${v.source_url} »)`);
      if (extraits(v.note).length === 0) problemes.push(`${ou} : variante « exact » dont la note ne cite aucun extrait entre guillemets`);
    }
  }
  return problemes;
}

/** IDCC : 4 chiffres, et jamais dans deux variantes d'un même OPCO (la résolution par IDCC renverrait la première). */
function controlerIdcc(opcos: OpcoData[]): string[] {
  const problemes: string[] = [];
  for (const o of opcos) {
    const vus = new Map<string, string>();
    for (const v of o.variantes_branche ?? []) {
      for (const code of v.idcc) {
        const ou = `${o.slug}[${v.id}].idcc`;
        if (!/^\d{4}$/.test(code)) problemes.push(`${ou} : « ${code} » n'a pas 4 chiffres`);
        const autre = vus.get(code);
        if (autre !== undefined) problemes.push(`${ou} : IDCC ${code} déjà porté par la variante ${autre}`);
        else vus.set(code, v.id);
      }
    }
  }
  return problemes;
}

/**
 * Plafond horaire par taille : une valeur qui répète un plafond du même niveau (inter, intra, métier) doit rester à null,
 * sinon elle masque la confiance et la source du champ ; une valeur propre à la taille porte sa confiance et sa source.
 * Le contrôle est inconditionnel : toute valeur non nulle sans confidence ou sans source_url https est signalée, qu'elle
 * répète ou non un champ du même niveau (le moteur l'afficherait « exact », avec la page de critères de l'OPCO).
 * Le niveau est celui que voit le moteur (variante appliquée au barème par défaut).
 */
function controlerPlafondsHoraires(opcos: OpcoData[]): string[] {
  const problemes: string[] = [];
  for (const o of opcos) {
    const niveauxEffectifs = [
      { chemin: o.slug, bareme: o },
      ...(o.variantes_branche ?? []).map((v) => ({ chemin: `${o.slug}[${v.id}]`, bareme: applyVarianteBranche(o, v) })),
    ];
    for (const { chemin, bareme } of niveauxEffectifs) {
      for (const p of bareme.plafonds_par_taille ?? []) {
        if (p.cout_horaire_max == null) continue;
        const ou = `${chemin}.plafonds_par_taille[${p.taille}].cout_horaire_max`;
        const propre = p.confidence !== undefined && /^https:\/\//.test(p.source_url ?? '');
        const repetes = (['cout_horaire_inter', 'cout_horaire_intra', 'cout_horaire_metier'] as const).filter(
          (champ) => bareme[champ].value === p.cout_horaire_max,
        );
        if (!propre) {
          problemes.push(
            repetes.length > 0
              ? `${ou} : ${p.cout_horaire_max} répète ${repetes.join(' et ')} du même niveau sans confidence ni source_url propres (mettre null)`
              : `${ou} : ${p.cout_horaire_max} sans confidence ni source_url https propres (le moteur afficherait « exact »)`,
          );
        }
        if (p.confidence === 'exact' && !contientValeur(p.description, p.cout_horaire_max)) {
          problemes.push(`${ou} : « exact » mais la description ne cite pas ${p.cout_horaire_max}`);
        }
      }
    }
  }
  return problemes;
}

/** Forfait de restauration : un montant « par repas » dans la note déclare l'unité « repas », un montant « €/jour » ne la déclare pas. */
const PAR_REPAS = /par repas|€\s*(?:HT\s*|TTC\s*)?\/\s*repas|plafond pour 1 repas|\bRepas\s*:/i;
const PAR_JOUR = /€\s*\/\s*jour|par jour/i;
function controlerUniteRestauration(opcos: OpcoData[]): string[] {
  const problemes: string[] = [];
  for (const o of opcos) {
    const niveauxRestauration = [
      { chemin: o.slug, forfait: o.frais_restauration, unite: o.frais_restauration_unite },
      ...(o.variantes_branche ?? []).map((v) => ({
        chemin: `${o.slug}[${v.id}]`,
        forfait: v.frais_restauration,
        unite: v.frais_restauration_unite ?? o.frais_restauration_unite,
      })),
    ];
    for (const { chemin, forfait, unite } of niveauxRestauration) {
      if (!forfait || forfait.value == null || forfait.value === 0) continue;
      const note = forfait.note ?? '';
      const ou = `${chemin}.frais_restauration`;
      if (PAR_REPAS.test(note) && unite !== 'repas') {
        problemes.push(`${ou} : la note parle d'un montant par repas mais frais_restauration_unite vaut « ${unite ?? 'absent'} »`);
      }
      if (!PAR_REPAS.test(note) && PAR_JOUR.test(note) && unite === 'repas') {
        problemes.push(`${ou} : la note parle d'un montant par jour mais frais_restauration_unite vaut « repas »`);
      }
    }
  }
  return problemes;
}

/** Un plafond « par demande », « par dossier » ou « par stagiaire » n'est pas un budget annuel : jamais « exact » comme tel. */
function controlerBudgetsParDemande(opcos: OpcoData[]): string[] {
  const problemes: string[] = [];
  const PAR_DEMANDE = /plafond[^.;]{0,60}\bpar (?:demande|dossier|stagiaire)\b/i;
  for (const o of opcos) {
    for (const { chemin, champs } of niveaux(o)) {
      const b = champs.budget_annuel_max;
      if (!b || b.value == null || b.confidence !== 'exact') continue;
      if (PAR_DEMANDE.test(b.note ?? '')) {
        problemes.push(`${chemin}.budget_annuel_max : montant « par demande/dossier/stagiaire » présenté comme budget annuel « exact »`);
      }
    }
  }
  return problemes;
}

const APOSTROPHE_COURBE = String.fromCharCode(0x2019);

/**
 * Jargon interne que le visiteur ne doit pas lire : les notes des barèmes s'affichent telles quelles sur les fiches OPCO et à
 * l'écran de résultats. Sont proscrits les noms de champs des données (plafonds_par_taille, cout_horaire_inter…), le mot
 * « null », le vocabulaire de traçabilité (proxy translate.goog, site injoignable, documents qui « n'ont pas pu être
 * téléchargés »), les remarques de calcul interne (« valeur prudente retenue », « hypothèse de calcul ») et le vocabulaire
 * du moteur de calcul (« le moteur applique », « non modélisé », « modélisables ») : le site parle du « simulateur » et de
 * l'« estimation ». « moteur » et « modélis… » sont lus comme des mots entiers (« automoteur » n'est pas signalé).
 */
const JARGON_INTERNE: RegExp[] = [
  /\b(?:plafonds_par_taille|variantes_branche|dispositifs_complementaires|selon_accord|confidence)\b/gi,
  /\b(?:cout_horaire|budget_annuel|quota_horaire|prise_en_charge|frais)_\w+/gi,
  /\bnull\b/gi,
  /translate\.goog|\bproxy\b|filtre IDCC|injoignable/gi,
  new RegExp(`n['${APOSTROPHE_COURBE}]ont pas pu|pas pu être`, 'gi'),
  /valeur prudente retenue|hypothèse de calcul/gi,
  /(?<![\p{L}])(?:moteur|mod[ée]lis\p{L}*)(?![\p{L}])/giu,
];

/** Repère d'un élément de tableau dans un chemin : son identifiant (dispositif), sa taille, sinon son rang. */
function repere(element: unknown, rang: number): string {
  const { id, taille } = (element ?? {}) as { id?: unknown; taille?: unknown };
  if (typeof id === 'string') return id;
  if (typeof taille === 'string') return taille;
  return String(rang);
}

/**
 * Chaînes de prose d'un OPCO (barème par défaut, puis chaque variante de branche) avec leur chemin : toute chaîne qui contient
 * au moins un espace, hors champs `extrait` (citations mot pour mot des alertes). Les valeurs d'énumération (« selon_accord »,
 * « exact »), les identifiants et les URL n'ont pas d'espace : elles ne sont jamais lues.
 */
function chainesDeProse(o: OpcoData): { chemin: string; texte: string }[] {
  const chaines: { chemin: string; texte: string }[] = [];
  const parcourir = (valeur: unknown, chemin: string, cle: string): void => {
    if (typeof valeur === 'string') {
      if (cle !== 'extrait' && /\s/.test(valeur)) chaines.push({ chemin, texte: valeur });
    } else if (Array.isArray(valeur)) {
      valeur.forEach((element, rang) => parcourir(element, `${chemin}[${repere(element, rang)}]`, cle));
    } else if (valeur && typeof valeur === 'object') {
      for (const [k, v] of Object.entries(valeur)) parcourir(v, `${chemin}.${k}`, k);
    }
  };
  const { variantes_branche: variantes, ...bareme } = o;
  parcourir(bareme, o.slug, '');
  for (const v of variantes ?? []) parcourir(v, `${o.slug}[${v.id}]`, '');
  return chaines;
}

/**
 * Toute chaîne de prose qui contient du jargon interne, avec son chemin et le jargon trouvé. Les citations « … » d'une note
 * sont la source mot pour mot : elles ne sont pas lues (un extrait peut contenir « n'ont pas pu être engagés » ou « proxy »).
 */
function controlerJargon(opcos: OpcoData[]): string[] {
  const problemes: string[] = [];
  for (const o of opcos) {
    for (const { chemin, texte } of chainesDeProse(o)) {
      const lu = texte.replace(/«[^»]*»/g, ' ');
      const trouves = new Set(JARGON_INTERNE.flatMap((motif) => [...lu.matchAll(motif)].map((m) => m[0])));
      for (const jargon of trouves) problemes.push(`${chemin} : contient « ${jargon} »`);
    }
  }
  return problemes;
}

const par = (slug: string): OpcoData => {
  const o = EMBEDDED_OPCOS.find((x) => x.slug === slug);
  if (!o) throw new Error(`OPCO introuvable : ${slug}`);
  return o;
};
const parVariante = (slug: string, id: string) => {
  const v = par(slug).variantes_branche?.find((x) => x.id === id);
  if (!v) throw new Error(`variante introuvable : ${slug}[${id}]`);
  return v;
};

describe('barèmes OPCO embarqués', () => {
  it('respectent le schéma (une seule entrée par taille) et les bornes', () => {
    for (const o of EMBEDDED_OPCOS) {
      const parsed = OpcoDataSchema.safeParse(o);
      expect(parsed.success, `${o.slug} : ${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true);
      if (parsed.success) expect(sanityCheckOpco(parsed.data)).toEqual([]);
    }
  });

  it('les 11 OPCO embarqués ont un nom complet non vide, repris de la dénomination officielle (affiché par le site)', () => {
    expect(EMBEDDED_OPCOS).toHaveLength(11);
    const sansNomComplet = EMBEDDED_OPCOS.filter((o) => typeof o.nom_complet !== 'string' || o.nom_complet.trim() === '');
    expect(sansNomComplet.map((o) => o.slug)).toEqual([]);
    for (const o of EMBEDDED_OPCOS) expect(o.nom_complet, o.slug).toMatch(/^Opérateur de compétences /i);
  });

  it('ont été vérifiés il y a moins de 12 mois', () => {
    for (const o of EMBEDDED_OPCOS) {
      expect(o.derniere_verification, o.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(moisDepuis(o.derniere_verification!), o.slug).toBeLessThan(12);
    }
  });

  it('chaque montant « exact », au niveau par défaut comme dans chaque variante, cite une source https et un extrait entre guillemets qui contient la valeur', () => {
    expect(controlerValeursExactes(EMBEDDED_OPCOS)).toEqual([]);
  });

  it('aucun IDCC n\'est porté par deux variantes d\'un même OPCO, et tous ont 4 chiffres', () => {
    expect(controlerIdcc(EMBEDDED_OPCOS)).toEqual([]);
  });

  it('un plafond horaire par taille ne répète pas le champ du même niveau : il garde son propre plafond avec sa confiance et sa source', () => {
    expect(controlerPlafondsHoraires(EMBEDDED_OPCOS)).toEqual([]);
  });

  it('les OPCO dont la note parle d\'un forfait « par repas » déclarent frais_restauration_unite « repas »', () => {
    expect(controlerUniteRestauration(EMBEDDED_OPCOS)).toEqual([]);
  });

  it('un plafond « par demande » n\'est pas un budget annuel « exact »', () => {
    expect(controlerBudgetsParDemande(EMBEDDED_OPCOS)).toEqual([]);
  });

  it('aucune chaîne de prose des 11 OPCO ne contient de jargon interne (noms de champs, « null », proxy, « n\'ont pas pu », « moteur », « modélisé »…) : le site les affiche telles quelles', () => {
    expect(EMBEDDED_OPCOS).toHaveLength(11);
    expect(controlerJargon(EMBEDDED_OPCOS)).toEqual([]);
  });

  it('une enveloppe 50+ est toujours décrite', () => {
    for (const o of EMBEDDED_OPCOS) {
      for (const p of o.plafonds_par_taille ?? []) {
        if ((p.taille === '50_299' || p.taille === '300_plus') && p.budget_annuel_max != null) {
          expect(p.description.length, `${o.slug}.${p.taille}`).toBeGreaterThan(20);
        }
      }
    }
  });

  it("les alertes citent une source https, un extrait et une date", () => {
    for (const o of EMBEDDED_OPCOS) {
      for (const a of o.alertes ?? []) {
        expect(a.source_url, `${o.slug} ${a.branche}`).toMatch(/^https:\/\//);
        expect(a.extrait.length, `${o.slug} ${a.branche}`).toBeGreaterThan(10);
        expect(a.verifie_le, `${o.slug} ${a.branche}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});

describe('unité du forfait de restauration (liste des OPCO)', () => {
  it.each(['akto', 'opco-ep', 'opco-sante', 'uniformation', 'ocapiat'])('%s : montants par repas', (slug) => {
    expect(par(slug).frais_restauration_unite).toBe('repas');
  });

  it("l'Opcommerce : montant par jour", () => {
    expect(par('opcommerce').frais_restauration_unite).toBe('jour');
  });

  it('les autres OPCO ne publient aucun forfait de restauration chiffré, donc aucune unité', () => {
    const avecUnite = ['akto', 'opco-ep', 'opco-sante', 'uniformation', 'ocapiat', 'opcommerce'];
    for (const o of EMBEDDED_OPCOS.filter((x) => !avecUnite.includes(x.slug))) {
      const forfaits = [o.frais_restauration, ...(o.variantes_branche ?? []).map((v) => v.frais_restauration)];
      expect(forfaits.filter((f) => f && f.value != null && f.value > 0), o.slug).toEqual([]);
    }
  });
});

describe('les contrôles détectent une copie mutée', () => {
  const muter = (modifier: (opcos: OpcoData[]) => void): OpcoData[] => {
    const copie = structuredClone(EMBEDDED_OPCOS);
    modifier(copie);
    return copie;
  };
  const dans = (opcos: OpcoData[], slug: string) => opcos.find((o) => o.slug === slug)!;
  const varianteDans = (opcos: OpcoData[], slug: string, id: string) => dans(opcos, slug).variantes_branche!.find((v) => v.id === id)!;

  it('le dataset embarqué lui-même passe tous les contrôles (point de départ des mutations)', () => {
    expect(controlerValeursExactes(EMBEDDED_OPCOS)).toEqual([]);
    expect(controlerIdcc(EMBEDDED_OPCOS)).toEqual([]);
    expect(controlerPlafondsHoraires(EMBEDDED_OPCOS)).toEqual([]);
    expect(controlerUniteRestauration(EMBEDDED_OPCOS)).toEqual([]);
    expect(controlerBudgetsParDemande(EMBEDDED_OPCOS)).toEqual([]);
    expect(controlerJargon(EMBEDDED_OPCOS)).toEqual([]);
  });

  describe('valeurs « exact »', () => {
    it('une valeur de variante « exact » sans extrait « » est signalée, avec son chemin', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'opco-ep', 'coiffure').cout_horaire_metier!.note = 'Taux de la branche, sans citation.';
      });
      expect(controlerValeursExactes(copie)).toEqual(['opco-ep[coiffure].cout_horaire_metier : valeur « exact » sans extrait entre guillemets']);
    });

    it('une valeur « exact » absente de ses extraits est signalée (et non un simple fragment de nombre)', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'opco-ep', 'coiffure').cout_horaire_metier!.value = 99;
        varianteDans(opcos, 'akto', 'hcr').cout_horaire_inter!.value = 5; // « 25 €/heure » contient 5 comme fragment
      });
      expect(controlerValeursExactes(copie)).toEqual([
        'akto[hcr].cout_horaire_inter : valeur 5 « exact » absente de ses extraits',
        'opco-ep[coiffure].cout_horaire_metier : valeur 99 « exact » absente de ses extraits',
      ]);
    });

    it('une source non https est signalée', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'opco-ep', 'immobilier').cout_horaire_metier!.source_url = 'http://www.opcoep.fr/criteres';
      });
      expect(controlerValeursExactes(copie)).toEqual([
        "opco-ep[immobilier].cout_horaire_metier : source_url non https (« http://www.opcoep.fr/criteres »)",
      ]);
    });

    it('une valeur 0 « exact » sans énoncé d\'absence est signalée', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'opco-ep', 'boulangerie').prise_en_charge_salaires!.note = 'Taux de la branche. Extrait : « Coût pédagogique : 25 € HT/h »';
      });
      expect(controlerValeursExactes(copie)).toEqual([
        "opco-ep[boulangerie].prise_en_charge_salaires : 0 « exact » dont l'extrait n'énonce aucune absence de prise en charge",
      ]);
    });

    it('une variante « exact » dont la note ne cite aucun extrait est signalée', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'opco-ep', 'coiffure').note = 'Critères 2026 de la branche coiffure.';
      });
      expect(controlerValeursExactes(copie)).toEqual([
        'opco-ep[coiffure] : variante « exact » dont la note ne cite aucun extrait entre guillemets',
      ]);
    });

    it('reconnaît les écritures françaises des nombres', () => {
      expect(contientValeur('Budget annuel : 1500 €', 1500)).toBe(true);
      expect(contientValeur('Budget annuel : 1 500 €', 1500)).toBe(true);
      expect(contientValeur(`Budget annuel : 1${String.fromCharCode(0xa0)}500 €`, 1500)).toBe(true); // espace insécable
      expect(contientValeur(`Budget annuel : 1${String.fromCharCode(0x202f)}500 €`, 1500)).toBe(true); // espace fine insécable
      expect(contientValeur('Budget annuel : 1.500 €', 1500)).toBe(true);
      expect(contientValeur('Budget annuel : 2.000 €', 2000)).toBe(true);
      expect(contientValeur('plafonnées à 14,50 €/h', 14.5)).toBe(true);
      expect(contientValeur('Smic horaire 12,31 €', 12.31)).toBe(true);
      expect(contientValeur('Coûts pédagogiques : 9,15 € HT/h', 9.15)).toBe(true);
      expect(contientValeur('un budget de 1,5 million', 1.5)).toBe(true);
      expect(contientValeur('plafonnés à 30€/heure', 30)).toBe(true);
    });

    it('ne prend pas un fragment d\'un autre nombre pour la valeur', () => {
      expect(contientValeur('plafonné à 130 €', 30)).toBe(false);
      expect(contientValeur('limité à 1 300 €', 300)).toBe(false);
      expect(contientValeur('limité à 30,5 €', 30)).toBe(false);
      expect(contientValeur('limité à 2 000 €', 20)).toBe(false);
      expect(contientValeur('limité à 15 000 €', 5000)).toBe(false);
    });
  });

  describe('IDCC', () => {
    it('un IDCC porté par deux variantes du même OPCO est signalé', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'constructys', 'travaux-publics').idcc.push('0007'); // déjà dans la variante Bâtiment
      });
      expect(controlerIdcc(copie)).toEqual(['constructys[travaux-publics].idcc : IDCC 0007 déjà porté par la variante batiment']);
    });

    it('un IDCC à moins de 4 chiffres est signalé', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'akto', 'hcr').idcc = ['979'];
      });
      expect(controlerIdcc(copie)).toEqual(["akto[hcr].idcc : « 979 » n'a pas 4 chiffres"]);
    });

    it('le même IDCC dans deux OPCO différents n\'est pas signalé (conventions partagées)', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'akto', 'hcr').idcc.push(...varianteDans(opcos, 'atlas', 'societes-financieres').idcc);
      });
      expect(controlerIdcc(copie)).toEqual([]);
    });
  });

  describe('plafond horaire par taille', () => {
    it('une valeur qui répète le champ du même niveau, sans confiance ni source, est signalée', () => {
      const copie = muter((opcos) => {
        const p = varianteDans(opcos, 'atlas', 'agents-generaux-assurance').plafonds_par_taille![0];
        p.cout_horaire_max = 50; // répète cout_horaire_inter (50) de la variante
      });
      expect(controlerPlafondsHoraires(copie)).toEqual([
        'atlas[agents-generaux-assurance].plafonds_par_taille[less_11].cout_horaire_max : 50 répète cout_horaire_inter et cout_horaire_metier du même niveau sans confidence ni source_url propres (mettre null)',
      ]);
    });

    it('la même valeur avec sa propre confiance et sa propre source est acceptée', () => {
      const copie = muter((opcos) => {
        const p = varianteDans(opcos, 'atlas', 'agents-generaux-assurance').plafonds_par_taille![0];
        p.cout_horaire_max = 50;
        p.confidence = 'estimated';
        p.source_url = 'https://www.opco-atlas.fr/criteres-financement/agents-generaux-dassurance';
      });
      expect(controlerPlafondsHoraires(copie)).toEqual([]);
    });

    it('une confiance sans source https reste signalée', () => {
      const copie = muter((opcos) => {
        const p = varianteDans(opcos, 'atlas', 'agents-generaux-assurance').plafonds_par_taille![0];
        p.cout_horaire_max = 50;
        p.confidence = 'estimated';
      });
      expect(controlerPlafondsHoraires(copie)).toHaveLength(1);
    });

    it('un plafond propre à la taille privé de sa confiance est signalé, même s\'il ne répète aucun champ du même niveau', () => {
      const copie = muter((opcos) => {
        const p = varianteDans(opcos, 'akto', 'hcr').plafonds_par_taille!.find((x) => x.taille === '50_299')!;
        delete p.confidence; // 35 €/h « estimated » : sans confidence, le moteur afficherait « exact »
      });
      expect(controlerPlafondsHoraires(copie)).toEqual([
        'akto[hcr].plafonds_par_taille[50_299].cout_horaire_max : 35 sans confidence ni source_url https propres (le moteur afficherait « exact »)',
      ]);
    });

    it('un plafond propre à la taille privé de sa source est signalé, même s\'il ne répète aucun champ du même niveau', () => {
      const copie = muter((opcos) => {
        const p = varianteDans(opcos, 'constructys', 'batiment').plafonds_par_taille!.find((x) => x.taille === 'less_11')!;
        delete p.source_url; // 24 €/h « exact » : sans source_url, le moteur renverrait la page de critères de l'OPCO
      });
      expect(controlerPlafondsHoraires(copie)).toEqual([
        'constructys[batiment].plafonds_par_taille[less_11].cout_horaire_max : 24 sans confidence ni source_url https propres (le moteur afficherait « exact »)',
      ]);
    });

    it('un plafond propre à la taille « exact » doit citer sa valeur dans sa description', () => {
      const copie = muter((opcos) => {
        const p = dans(opcos, 'constructys').plafonds_par_taille!.find((x) => x.taille === 'less_11')!;
        p.cout_horaire_max = 42;
      });
      expect(controlerPlafondsHoraires(copie)).toEqual([
        'constructys.plafonds_par_taille[less_11].cout_horaire_max : « exact » mais la description ne cite pas 42',
      ]);
    });

    it('un plafond du barème par défaut hérité par une variante est jugé aussi au niveau de la variante', () => {
      const copie = muter((opcos) => {
        dans(opcos, 'afdas').plafonds_par_taille![0].cout_horaire_max = 40; // répète inter, intra et métier (40 €/h)
        delete varianteDans(opcos, 'afdas', 'spectacle-vivant').plafonds_par_taille; // la variante hérite des plafonds de l'OPCO
      });
      const repetition = 'répète cout_horaire_inter et cout_horaire_intra et cout_horaire_metier du même niveau sans confidence ni source_url propres (mettre null)';
      expect(controlerPlafondsHoraires(copie)).toEqual([
        `afdas.plafonds_par_taille[less_11].cout_horaire_max : 40 ${repetition}`,
        `afdas[spectacle-vivant].plafonds_par_taille[less_11].cout_horaire_max : 40 ${repetition}`,
      ]);
    });
  });

  describe('unité du forfait de restauration', () => {
    it('un OPCO dont la note parle d\'un forfait par repas sans en déclarer l\'unité est signalé', () => {
      const copie = muter((opcos) => {
        delete dans(opcos, 'opco-sante').frais_restauration_unite;
      });
      expect(controlerUniteRestauration(copie)).toEqual([
        "opco-sante.frais_restauration : la note parle d'un montant par repas mais frais_restauration_unite vaut « absent »",
      ]);
    });

    it('une variante qui surcharge l\'unité par « jour » alors que sa note dit « par repas » est signalée', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'akto', 'restauration-rapide').frais_restauration_unite = 'jour';
      });
      expect(controlerUniteRestauration(copie)).toEqual([
        "akto[restauration-rapide].frais_restauration : la note parle d'un montant par repas mais frais_restauration_unite vaut « jour »",
      ]);
    });

    it('un forfait « par jour » déclaré « repas » est signalé', () => {
      const copie = muter((opcos) => {
        dans(opcos, 'opcommerce').frais_restauration_unite = 'repas';
      });
      expect(controlerUniteRestauration(copie)).toEqual([
        "opcommerce.frais_restauration : la note parle d'un montant par jour mais frais_restauration_unite vaut « repas »",
      ]);
    });
  });

  describe('budget par demande', () => {
    it('un plafond « par demande » repassé en « exact » est signalé', () => {
      const copie = muter((opcos) => {
        varianteDans(opcos, 'uniformation', 'alisfa').budget_annuel_max!.confidence = 'exact';
      });
      expect(controlerBudgetsParDemande(copie)).toEqual([
        'uniformation[alisfa].budget_annuel_max : montant « par demande/dossier/stagiaire » présenté comme budget annuel « exact »',
      ]);
    });
  });

  describe('jargon interne dans les notes', () => {
    it('un nom de champ réinjecté dans une note de barème est signalé, avec son chemin', () => {
      const copie = muter((opcos) => {
        const budget = dans(opcos, 'akto').budget_annuel_max;
        budget.note = `${budget.note} Selon l'effectif : voir plafonds_par_taille.`;
      });
      expect(controlerJargon(copie)).toEqual(['akto.budget_annuel_max.note : contient « plafonds_par_taille »']);
    });

    it('« null » réinjecté dans une note de dispositif est signalé, avec son chemin', () => {
      const copie = muter((opcos) => {
        const dispositif = dans(opcos, 'atlas').dispositifs_complementaires!.find((d) => d.id === 'bonus-transition-ecologique-betic')!;
        dispositif.note = `${dispositif.note} Montant laissé à null.`;
      });
      expect(controlerJargon(copie)).toEqual(['atlas.dispositifs_complementaires[bonus-transition-ecologique-betic].note : contient « null »']);
    });

    it('translate.goog réinjecté dans une note de variante est signalé, avec son chemin', () => {
      const copie = muter((opcos) => {
        const variante = varianteDans(opcos, 'afdas', 'sport');
        variante.note = `${variante.note} Page lue via translate.goog.`;
      });
      expect(controlerJargon(copie)).toEqual(['afdas[sport].note : contient « translate.goog »']);
    });

    it('plusieurs jargons dans une même note sont tous signalés', () => {
      const copie = muter((opcos) => {
        dans(opcos, 'opco-mobilites').cout_horaire_inter.note = 'Site injoignable, page lue via le proxy translate.goog.';
      });
      expect(controlerJargon(copie)).toEqual([
        'opco-mobilites.cout_horaire_inter.note : contient « injoignable »',
        'opco-mobilites.cout_horaire_inter.note : contient « proxy »',
        'opco-mobilites.cout_horaire_inter.note : contient « translate.goog »',
      ]);
    });

    it('chaque jargon de la liste est reconnu, majuscules comprises', () => {
      const jargons: [string, string][] = [
        ['voir plafonds_par_taille', 'plafonds_par_taille'],
        ['voir cout_horaire_inter', 'cout_horaire_inter'],
        ['voir budget_annuel_max', 'budget_annuel_max'],
        ['voir quota_horaire_max', 'quota_horaire_max'],
        ['voir prise_en_charge_salaires', 'prise_en_charge_salaires'],
        ['voir frais_hebergement', 'frais_hebergement'],
        ['voir variantes_branche', 'variantes_branche'],
        ['voir dispositifs_complementaires', 'dispositifs_complementaires'],
        ['mode selon_accord', 'selon_accord'],
        ['la confidence est exacte', 'confidence'],
        ['montant laissé à null', 'null'],
        ['Montant Null', 'Null'],
        ['page lue via translate.goog', 'translate.goog'],
        ['page lue via le proxy', 'proxy'],
        ['filtre IDCC à appliquer', 'filtre IDCC'],
        ['site officiel injoignable', 'injoignable'],
        ["les guides n'ont pas pu être téléchargés", "n'ont pas pu"],
        [`les guides n${APOSTROPHE_COURBE}ont pas pu être téléchargés`, `n${APOSTROPHE_COURBE}ont pas pu`],
        ["les guides n'avaient pas pu être lus", 'pas pu être'],
        ['valeur prudente retenue', 'valeur prudente retenue'],
        ['hypothèse de calcul', 'hypothèse de calcul'],
        ['le moteur applique ce taux', 'moteur'],
        ['Le Moteur applique ce taux', 'Moteur'],
        ['plafond non modélisé', 'modélisé'],
        ['plafond non modelisé', 'modelisé'],
        ['cas non modélisables par le barème', 'modélisables'],
      ];
      for (const [texte, attendu] of jargons) {
        const copie = muter((opcos) => {
          dans(opcos, 'akto').specificites = texte;
        });
        expect(controlerJargon(copie), texte).toEqual([`akto.specificites : contient « ${attendu} »`]);
      }
    });

    it('les mots français proches du jargon ne sont pas signalés (frais, confiance, proximité, nullité, budget annuel, automoteur, modalités…)', () => {
      const copie = muter((opcos) => {
        dans(opcos, 'akto').specificites =
          'Frais de repas et d\'hébergement, confiance du financeur, accès de proximité, nullité de la demande, budget annuel, prise en charge des salaires, plafonds par taille, variantes de branche, bateaux automoteurs, modalités de prise en charge, modèle de convention.';
      });
      expect(controlerJargon(copie)).toEqual([]);
    });

    it('« le moteur applique » réinjecté dans une note est signalé, avec son chemin', () => {
      const copie = muter((opcos) => {
        const metier = dans(opcos, 'opco2i').cout_horaire_metier;
        metier.note = `${metier.note} Estimation : le moteur applique 30 €/h.`;
      });
      expect(controlerJargon(copie)).toEqual(['opco2i.cout_horaire_metier.note : contient « moteur »']);
    });

    it('« non modélisé » réinjecté dans la description d\'une taille d\'entreprise est signalé, avec son chemin', () => {
      const copie = muter((opcos) => {
        const taille = dans(opcos, 'opco2i').plafonds_par_taille!.find((p) => p.taille === 'less_11')!;
        taille.description = `${taille.description} Plafond non modélisé.`;
      });
      expect(controlerJargon(copie)).toEqual(['opco2i.plafonds_par_taille[less_11].description : contient « modélisé »']);
    });

    it('un extrait cité qui contient par hasard « moteur » ou « modélisé » n\'est pas signalé (citation « … » d\'une note, champ extrait d\'une alerte)', () => {
      const copie = muter((opcos) => {
        const metier = dans(opcos, 'opco2i').cout_horaire_metier;
        metier.note = `${metier.note} « Le moteur de recherche du site ne couvre pas les accords non modélisés. »`;
        const akto = dans(opcos, 'akto');
        akto.alertes![0].extrait = `${akto.alertes![0].extrait} Le moteur de recherche est en panne.`;
      });
      expect(controlerJargon(copie)).toEqual([]);
    });

    it('chaque zone de prose est lue (conditions, démarches, descriptions, alertes, textes libres, listes), avec son chemin', () => {
      const zones: [string, (opcos: OpcoData[]) => void, string][] = [
        [
          'une condition de dispositif',
          (o) => { dans(o, 'akto').dispositifs_complementaires![0].conditions[0] = 'Respecter le quota_horaire_max.'; },
          'akto.dispositifs_complementaires[espace-formation].conditions[0] : contient « quota_horaire_max »',
        ],
        [
          'une démarche de dispositif',
          (o) => { dans(o, 'akto').dispositifs_complementaires![0].demarches = 'Montant laissé à null.'; },
          'akto.dispositifs_complementaires[espace-formation].demarches : contient « null »',
        ],
        [
          'la description du budget annuel',
          (o) => { dans(o, 'akto').budget_annuel_description = 'Voir budget_annuel_max.'; },
          'akto.budget_annuel_description : contient « budget_annuel_max »',
        ],
        [
          'les spécificités',
          (o) => { dans(o, 'akto').specificites = 'Mode selon_accord retenu.'; },
          'akto.specificites : contient « selon_accord »',
        ],
        [
          'les points clés de maximisation',
          (o) => { dans(o, 'akto').points_cles_maximisation = 'Voir frais_transport.'; },
          'akto.points_cles_maximisation : contient « frais_transport »',
        ],
        [
          'la description d\'un plafond par taille',
          (o) => { dans(o, 'akto').plafonds_par_taille!.find((p) => p.taille === 'less_11')!.description = 'Moins de 11 salariés : valeur prudente retenue.'; },
          'akto.plafonds_par_taille[less_11].description : contient « valeur prudente retenue »',
        ],
        [
          'la description d\'un plafond par taille de variante',
          (o) => { varianteDans(o, 'akto', 'hcr').plafonds_par_taille!.find((p) => p.taille === '50_299')!.description = 'Hypothèse de calcul : 80 %.'; },
          'akto[hcr].plafonds_par_taille[50_299].description : contient « Hypothèse de calcul »',
        ],
        [
          'le périmètre d\'une alerte',
          (o) => { dans(o, 'akto').alertes![0].branche = 'Organismes de formation (site officiel injoignable)'; },
          'akto.alertes[0].branche : contient « injoignable »',
        ],
        [
          'un texte libre en objet',
          (o) => { (dans(o, 'opco-ep').alternance_apprentissage as Record<string, unknown>).description = 'Page lue via un proxy.'; },
          'opco-ep.alternance_apprentissage.description : contient « proxy »',
        ],
        [
          'un élément d\'une liste de textes',
          (o) => { dans(o, 'akto').profils_candidats[0] = 'Salariés (voir variantes_branche)'; },
          'akto.profils_candidats[0] : contient « variantes_branche »',
        ],
      ];
      for (const [zone, muterZone, attendu] of zones) {
        const copie = muter(muterZone);
        expect(controlerJargon(copie), zone).toEqual([attendu]);
      }
    });

    it('une valeur d\'énumération (« selon_accord ») et une URL ne sont pas signalées, même quand elles portent un mot du jargon', () => {
      expect(JSON.stringify(EMBEDDED_OPCOS)).toContain('"prise_en_charge_salaires_mode":"selon_accord"'); // les énumérations existent dans les données
      const copie = muter((opcos) => {
        const variante = varianteDans(opcos, 'akto', 'hcr');
        variante.prise_en_charge_salaires_mode = 'selon_accord';
        variante.cout_horaire_inter!.source_url = 'https://www-opco--mobilites-fr.translate.goog/plan-de-developpement-des-competences?proxy=null';
      });
      expect(controlerJargon(copie)).toEqual([]);
    });

    it('un extrait cité qui contient par hasard un mot du jargon n\'est pas signalé (champ extrait d\'une alerte, citation « … » d\'une note)', () => {
      const copie = muter((opcos) => {
        const akto = dans(opcos, 'akto');
        akto.alertes![0].extrait = `${akto.alertes![0].extrait} Le proxy de la plateforme est injoignable (valeur null).`;
        akto.budget_annuel_max.note = `${akto.budget_annuel_max.note} « Le proxy ne relaie pas ce fichier : plafonds_par_taille null. »`;
      });
      expect(controlerJargon(copie)).toEqual([]);
    });

    it('le jargon placé hors des citations d\'une note qui en contient est signalé : seules les citations « … » sont exemptes', () => {
      const copie = muter((opcos) => {
        dans(opcos, 'akto').budget_annuel_max.note = "« Un extrait cité. » Selon l'effectif : voir plafonds_par_taille. « Un autre extrait. »";
      });
      expect(controlerJargon(copie)).toEqual(['akto.budget_annuel_max.note : contient « plafonds_par_taille »']);
    });
  });
});

describe('corrections des barèmes (tâche 8c)', () => {
  it('OPCO EP : cout_horaire_metier est le plafond des CQP et certifications (« hors plafond »), jamais le taux cœur de métier', () => {
    for (const v of par('opco-ep').variantes_branche ?? []) {
      const metier = v.cout_horaire_metier;
      if (!metier || metier.value == null) continue;
      expect(extraits(metier.note).some((e) => /hors plafond/i.test(e)), `${v.id} : l'extrait doit citer une formation « hors plafond »`).toBe(true);
    }
  });

  it('OPCO EP : le taux cœur de métier est noté dans cout_horaire_inter quand il diffère du taux transverse', () => {
    const cles = ['boulangerie', 'pharmacie-officine', 'cabinets-medicaux', 'cabinets-dentaires', 'immobilier'];
    for (const id of cles) {
      expect(parVariante('opco-ep', id).cout_horaire_inter!.note, id).toMatch(/cœur de métier|actions métier/);
    }
  });

  it('OPCO EP : valeurs retenues pour les CQP et certifications', () => {
    const valeurs = Object.fromEntries(
      (par('opco-ep').variantes_branche ?? []).map((v) => [v.id, [v.cout_horaire_metier?.value, v.cout_horaire_metier?.confidence]]),
    );
    expect(valeurs).toEqual({
      coiffure: [15, 'exact'],
      boulangerie: [15, 'exact'],
      'pharmacie-officine': [20, 'exact'],
      'cabinets-medicaux': [15, 'estimated'],
      'cabinets-dentaires': [20, 'estimated'],
      immobilier: [9.15, 'exact'],
    });
  });

  it('OPCO 2i : le plafond « métier » de 30 €/h est une estimation (habilitations à 20 €/h)', () => {
    expect(par('opco2i').cout_horaire_metier.confidence).toBe('estimated');
    expect(par('opco2i').cout_horaire_metier.note).toContain('habilitations : 20 €/h');
  });

  it('OCAPIAT : le plafond horaire de 40 €/h du barème général est une estimation (taux de 50 %, 70 % ou 100 %)', () => {
    const o = par('ocapiat');
    for (const champ of ['cout_horaire_inter', 'cout_horaire_intra', 'cout_horaire_metier'] as const) {
      expect(o[champ].confidence, champ).toBe('estimated');
      expect(o[champ].note, champ).toContain('à confirmer auprès d\'OCAPIAT');
    }
  });

  it('Uniformation ALISFA : 5 000 € par demande, estimation de budget annuel', () => {
    const b = parVariante('uniformation', 'alisfa').budget_annuel_max!;
    expect(b.confidence).toBe('estimated');
    expect(b.note).toContain('plafond par demande');
    expect(parVariante('uniformation', 'alisfa').budget_annuel_description).toContain('budget annuel non publié');
  });

  it('Constructys : chaque note qui cite une fiche renvoie aussi à l\'URL de son fichier zip', () => {
    const notes: string[] = [];
    const parcourir = (valeur: unknown) => {
      if (typeof valeur === 'string') {
        if (/fiche Modalites_\w+_PDC_2026\.pdf/.test(valeur)) notes.push(valeur);
      } else if (valeur && typeof valeur === 'object') {
        for (const v of Object.values(valeur)) parcourir(v);
      }
    };
    parcourir(par('constructys'));
    expect(notes.length).toBeGreaterThan(30);
    for (const n of notes) {
      expect(n).toMatch(/https:\/\/www\.constructys\.fr\/wp-content\/uploads\/(BATIMENT|TP|NEGOCE)-Modalites-2026\.zip/);
    }
  });

  it('OPCO Mobilités : les cinq budgets par taille sont cités dans des extraits de la page officielle', () => {
    const o = par('opco-mobilites');
    const texteExtraits = extraits(o.budget_annuel_max.note).join(' ');
    for (const montant of [1500, 1800, 2100, 2400, 2700]) {
      expect(contientValeur(texteExtraits, montant), `${montant} €`).toBe(true);
    }
    expect(o.budget_annuel_max.confidence).toBe('exact');
    expect(o.plafonds_par_taille!.find((p) => p.taille === 'less_11')!.description).toContain('« Moins de 11 salariés 1 500 € »');
    expect(o.plafonds_par_taille!.find((p) => p.taille === '11_49')!.description).toContain('« De 11 à moins de 20 salariés 1 800 € »');
  });

  it('AFDAS : les budgets des variantes, sommes du plafond légal et du plan conventionnel, se disent estimés', () => {
    for (const v of par('afdas').variantes_branche ?? []) {
      expect(v.budget_annuel_max!.confidence, v.id).toBe('estimated');
      expect(v.budget_annuel_description, v.id).toMatch(
        /^Estimation : somme du plafond légal et du minimum du plan conventionnel de la branche/,
      );
    }
  });

  it('Atlas : chaque mention d\'une copie archivée cite l\'URL de l\'instantané', () => {
    const notes: string[] = [];
    const parcourir = (valeur: unknown) => {
      if (typeof valeur === 'string') {
        if (/copie archivée/.test(valeur)) notes.push(valeur);
      } else if (valeur && typeof valeur === 'object') {
        for (const v of Object.values(valeur)) parcourir(v);
      }
    };
    parcourir(par('atlas'));
    expect(notes.length).toBeGreaterThanOrEqual(17);
    for (const n of notes) expect(n).toMatch(/https:\/\/web\.archive\.org\/web\/20260618\d{6}\/https:\/\/www\.opco-atlas\.fr\/criteres-financement\//);
    const atlas = JSON.stringify(par('atlas'));
    for (const snapshot of [
      'https://web.archive.org/web/20260618072028/https://www.opco-atlas.fr/criteres-financement/agents-generaux-dassurance',
      'https://web.archive.org/web/20260618073449/https://www.opco-atlas.fr/criteres-financement/bureaux-detudes-techniques-ingenieurs-et-conseils',
      'https://web.archive.org/web/20260618072451/https://www.opco-atlas.fr/criteres-financement/societes-financieres',
    ]) {
      expect(atlas).toContain(snapshot);
    }
  });

  it('OPCO Santé : le taux de salaires suit le SMIC horaire, dont la source est la page du SMIC', () => {
    const s = par('opco-sante').prise_en_charge_salaires;
    expect(s.source_url).toBe('https://www.service-public.gouv.fr/particuliers/vosdroits/F2300');
    expect(s.note).toContain('suit le SMIC horaire');
    expect(extraits(s.note).some((e) => contientValeur(e, 12.31))).toBe(true);
  });

  it('OPCO EP cabinets dentaires : le forfait repas est estimé comme l\'hébergement (frais annexes réservés aux moins de 11 salariés)', () => {
    const v = parVariante('opco-ep', 'cabinets-dentaires');
    expect(v.frais_restauration!.confidence).toBe('estimated');
    expect(v.frais_hebergement!.confidence).toBe('estimated');
  });

  it('L\'Opcommerce, commerce de détail alimentaire non spécialisé : dates du PDF du 05 octobre 2026', () => {
    const note = parVariante('opcommerce', 'commerce-detail-alimentaire-non-specialise').note!;
    expect(note).toContain('« Dernière mise à jour le 05 octobre 2026 »');
    expect(note).toContain('1er/10/2026');
    expect(note).not.toContain('21 septembre 2026');
  });

  it('AKTO, enveloppe épuisée : la note reprend le libellé exact de la page des commerces de gros et cite le déchet', () => {
    const note = parVariante('akto', 'akto-pdc-2026-epuise').note!;
    expect(note).toContain("« A ce jour, une partie de l'enveloppe budgétaire a été intégralement engagée. »");
    expect(note).toMatch(/aussi épuisé pour la quincaillerie, le travail du bois, les exploitations forestières et le déchet/);
  });

  it('Uniformation : le barème dégressif de 65 et 15 €/h est en TTC (TVA comprise)', () => {
    const note = par('uniformation').cout_horaire_inter.note!;
    expect(note).toContain('TTC');
    expect(note).toContain('y compris TVA');
  });

  it('les fichiers modifiés ont été revérifiés le 2026-10-06', () => {
    for (const slug of ['akto', 'ocapiat', 'opco-ep', 'opco-sante', 'opcommerce', 'uniformation']) {
      expect(par(slug).derniere_verification, slug).toBe('2026-10-06');
    }
  });
});
