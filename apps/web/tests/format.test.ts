// Mise en forme des textes des données : dates à la française hors citations, mois en toutes lettres, résumé d'une note
// de barème en une phrase (fiche OPCO sur écran étroit).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMBEDDED_AIDES, EMBEDDED_OPCOS, calculateFunding, createInitialWizardState, type WizardState } from '@opco/core';
import {
  INSECABLE,
  de,
  formatEuro,
  moisAnneeFr,
  montantsFr,
  premierePhrase,
  texteDonnees,
  texteFr,
  typo,
} from '../src/lib/format';

/** Espace fine insécable (U+202F), écrite par son code : séparateur des milliers de `formatEuro` (Intl, fr-FR). */
const FINE = String.fromCharCode(0x202f);

/** Toutes les chaînes des données (OPCO et aides), parcourues récursivement. */
function chainesDesDonnees(): string[] {
  const chaines: string[] = [];
  const parcourir = (v: unknown) => {
    if (typeof v === 'string') chaines.push(v);
    else if (Array.isArray(v)) v.forEach(parcourir);
    else if (v && typeof v === 'object') Object.values(v).forEach(parcourir);
  };
  parcourir(EMBEDDED_OPCOS);
  parcourir(EMBEDDED_AIDES);
  return chaines;
}

/** Notes des postes de barème (OPCO et variantes de branche) : celles que la fiche résume avec premierePhrase. */
function notesDeBareme(): { id: string; note: string }[] {
  const postes = [
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
  const notes: { id: string; note: string }[] = [];
  for (const opco of EMBEDDED_OPCOS) {
    const baremes = [{ id: opco.slug, b: opco as unknown as Record<string, unknown> }];
    for (const v of opco.variantes_branche ?? []) baremes.push({ id: `${opco.slug}/${v.id}`, b: v as unknown as Record<string, unknown> });
    for (const { id, b } of baremes) {
      for (const poste of postes) {
        const note = (b[poste] as { note?: string } | undefined)?.note?.trim();
        if (note) notes.push({ id: `${id} ${poste}`, note });
      }
    }
  }
  return notes;
}

/** Extraits « … » d'un texte, au premier niveau (une citation imbriquée reste dans son extrait). */
function extraits(texte: string): string[] {
  const liste: string[] = [];
  let profondeur = 0;
  let debut = 0;
  for (let i = 0; i < texte.length; i++) {
    if (texte[i] === '«') {
      if (profondeur === 0) debut = i;
      profondeur++;
    } else if (texte[i] === '»' && profondeur > 0 && --profondeur === 0) {
      liste.push(texte.slice(debut, i + 1));
    }
  }
  if (profondeur > 0) liste.push(texte.slice(debut));
  return liste;
}

describe('texteFr', () => {
  test('convertit les dates ISO hors citation', () => {
    assert.equal(texteFr('vérifié le 2026-10-05'), 'vérifié le 05/10/2026');
    assert.equal(texteFr('du 2026-01-01 au 2026-12-31.'), 'du 01/01/2026 au 31/12/2026.');
    assert.equal(texteFr('sans date'), 'sans date');
  });

  test("un extrait « » n'est jamais modifié", () => {
    assert.equal(
      texteFr('« Dossier déposé avant le 2026-03-31 » (vérifié le 2026-10-05)'),
      '« Dossier déposé avant le 2026-03-31 » (vérifié le 05/10/2026)',
    );
    // Citation imbriquée : tout l'extrait de premier niveau reste mot pour mot.
    assert.equal(
      texteFr('Règle 2026-01-02 : « publié « le 2026-02-03 » puis 2026-04-05 » fin 2026-06-07'),
      'Règle 02/01/2026 : « publié « le 2026-02-03 » puis 2026-04-05 » fin 07/06/2026',
    );
    // Citation non refermée : elle court jusqu'à la fin du texte.
    assert.equal(texteFr('Note 2026-01-02 « extrait tronqué 2026-03-04'), 'Note 02/01/2026 « extrait tronqué 2026-03-04');
    // Guillemet fermant isolé : simple caractère, la date qui suit est convertie.
    assert.equal(texteFr('a » 2026-05-06'), 'a » 06/05/2026');
  });

  test('sur toutes les chaînes des données, chaque extrait cité se retrouve mot pour mot', () => {
    let verifies = 0;
    for (const chaine of chainesDesDonnees()) {
      const sortie = texteFr(chaine);
      for (const extrait of extraits(chaine)) {
        verifies++;
        assert.ok(sortie.includes(extrait), `extrait modifié : ${extrait.slice(0, 120)}`);
      }
      assert.ok(!/\b\d{4}-\d{2}-\d{2}\b/.test(sortie.replace(/«[^»]*»/g, '')), `date ISO restée hors citation : ${chaine.slice(0, 120)}`);
    }
    assert.ok(verifies > 100, `seulement ${verifies} extraits vérifiés`);
  });

  test('textes construits au hasard : les extraits sont gardés, les dates hors citation converties', () => {
    // mulberry32 : tirages indépendants et reproductibles.
    let graine = 11;
    const hasard = (n: number) => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    const morceaux = ['texte ', '2026-10-05', ' ', '« ', ' »', 'le 2025-01-31', ', ', '(vérifié le 2026-02-28)'];
    for (let i = 0; i < 2000; i++) {
      let texte = '';
      for (let k = 0; k < 10; k++) texte += morceaux[hasard(morceaux.length)];
      const sortie = texteFr(texte);
      for (const extrait of extraits(texte)) assert.ok(sortie.includes(extrait), `${texte} => ${sortie}`);
    }
  });
});

describe('moisAnneeFr', () => {
  test('mois en toutes lettres', () => {
    assert.equal(moisAnneeFr('2026-10-05'), 'octobre 2026');
    assert.equal(moisAnneeFr('2026-01-31'), 'janvier 2026');
    assert.equal(moisAnneeFr('2027-08-01'), 'août 2027');
    assert.equal(moisAnneeFr('2026-12-01'), 'décembre 2026');
  });

  test('toute autre forme est rendue telle quelle', () => {
    for (const autre of ['2026-13-01', '2026-00-10', '2026-10', '05/10/2026', '', 'octobre']) {
      assert.equal(moisAnneeFr(autre), autre);
    }
  });
});

describe('premierePhrase', () => {
  test('les extraits cités en tête sont sautés, la première phrase de la règle est gardée', () => {
    assert.equal(premierePhrase('« Extrait de la source » Plafond de 25 €/h. Suite de la note.'), 'Plafond de 25 €/h.');
    assert.equal(premierePhrase('« Un » ; « Deux » Règle propre. Autre phrase.'), 'Règle propre.');
  });

  test('la mention de vérification de fin est retirée et le point final rétabli', () => {
    assert.equal(premierePhrase('Forfait par jour de formation (vérifié le 2026-10-05)'), 'Forfait par jour de formation.');
    assert.equal(premierePhrase('Prise en charge à 100 % (relu en ligne le 2026-10-06).'), 'Prise en charge à 100 %.');
  });

  test("l'abréviation « ex. » ne termine pas la phrase", () => {
    assert.equal(
      premierePhrase('Plafond par branche, ex. Bâtiment à 19 €/h. Autre phrase.'),
      'Plafond par branche, ex. Bâtiment à 19 €/h.',
    );
  });

  test('sans règle propre, la première citation est rendue telle quelle', () => {
    assert.equal(premierePhrase('« Seule citation »'), '« Seule citation »');
    assert.equal(premierePhrase('« Citation » (fiche de la branche, 2026)'), '« Citation »');
  });

  test("une phrase qui porte une adresse web est une provenance : repli sur l'extrait de tête", () => {
    assert.equal(
      premierePhrase('« Plafond : 50 €/h » Page consultée via sa copie archivée (https://web.archive.org/x) : à reconfirmer.'),
      '« Plafond : 50 €/h »',
    );
    // Sans extrait de tête : la règle est gardée sans sa parenthèse de source (citation et lien).
    assert.equal(
      premierePhrase("Aucune prise en charge publiée, alors que la règle 2021 la prévoyait (« jusqu'au SMIC (10,25 €/h) », https://exemple.fr/page)."),
      'Aucune prise en charge publiée, alors que la règle 2021 la prévoyait.',
    );
    // Adresse hors parenthèses et sans extrait de tête : premier extrait cité de la note.
    assert.equal(premierePhrase('Source https://exemple.fr citée ainsi : « Plafond de 30 €/h ».'), '« Plafond de 30 €/h »');
  });

  test('les trois notes réelles qui citaient leur provenance', () => {
    const notes = notesDeBareme();
    const note = (id: string) => {
      const trouvee = notes.find((n) => n.id === id);
      assert.ok(trouvee, `note ${id} absente des données`);
      return trouvee.note;
    };
    assert.equal(
      premierePhrase(note('atlas/agents-generaux-assurance cout_horaire_metier')),
      '« Entreprises de plus de 11 salariés Plafond par entreprise : 8 000€ HT/an Prise en charge : au coût réel plafonné à 50€/h »',
    );
    assert.equal(
      premierePhrase(note('atlas/societes-financieres cout_horaire_metier')),
      '« Entreprises de moins de 11 salariés Plafond par entreprise : 1 000€ HT/an »',
    );
    assert.equal(
      premierePhrase(note('opco2i prise_en_charge_salaires')),
      "La règle PDC 2026 (CA du 18/12/2025) ne vise que les coûts pédagogiques : aucune prise en charge de la rémunération n'y est publiée, alors que la règle 2021 la prévoyait.",
    );
  });

  test('aucun résumé de note de barème ne porte une adresse web ni une date ISO', () => {
    const notes = notesDeBareme();
    assert.ok(notes.length > 200, `seulement ${notes.length} notes`);
    for (const { id, note } of notes) {
      const resume = premierePhrase(note);
      assert.ok(resume.length > 0, id);
      assert.ok(!/https?:\/\//.test(resume), `${id} : ${resume}`);
      assert.ok(!/\b\d{4}-\d{2}-\d{2}\b/.test(resume.replace(/«[^»]*»/g, '')), `${id} : ${resume}`);
    }
  });
});

describe('de (élision)', () => {
  test("« de » s'élide devant une voyelle, pour les noms des 11 OPCO", () => {
    const attendu: Record<string, string> = {
      AKTO: "d'AKTO",
      ATLAS: "d'ATLAS",
      AFDAS: "d'AFDAS",
      'OPCO 2i': "d'OPCO 2i",
      'OPCO EP': "d'OPCO EP",
      'OPCO Santé': "d'OPCO Santé",
      'OPCO Mobilités': "d'OPCO Mobilités",
      OCAPIAT: "d'OCAPIAT",
      Uniformation: "d'Uniformation",
      Constructys: 'de Constructys',
      "L'Opcommerce": "de L'Opcommerce",
    };
    for (const opco of EMBEDDED_OPCOS) {
      assert.ok(opco.name in attendu, `OPCO non prévu par le test : ${opco.name}`);
      assert.equal(de(opco.name), attendu[opco.name]);
    }
  });
});

describe('formatEuro', () => {
  const euro = (n: number) => formatEuro(n).replace(/\s/g, ' ');

  test('montant à la française : espace fine insécable entre les milliers, insécable avant le symbole (Intl, fr-FR)', () => {
    assert.equal(euro(6300), '6 300 €');
    assert.equal(formatEuro(6300), `6${FINE}300${INSECABLE}€`);
  });

  test('un montant entier sans décimales, tout autre montant avec deux décimales', () => {
    assert.equal(euro(1500.5), '1 500,50 €');
    assert.equal(euro(15.5), '15,50 €');
    assert.equal(euro(1431.94), '1 431,94 €');
    assert.equal(euro(0), '0 €');
    assert.equal(euro(0.1 + 0.2), '0,30 €');
    // Au centime près : un reste de calcul en virgule flottante ne fait pas apparaître de décimales.
    assert.equal(euro(1500.004), '1 500 €');
    assert.equal(euro(99.999), '100 €');
    assert.equal(euro(-12.5), '-12,50 €');
  });
});

describe('typo', () => {
  const nb = INSECABLE;

  test('espace insécable avant « : ; ? ! », entre un nombre et son unité, entre les groupes de milliers', () => {
    assert.equal(typo('Plafond : 2 000 € par an ; 35 h ? Oui !'), `Plafond${nb}: 2${nb}000${nb}€ par an${nb}; 35${nb}h${nb}? Oui${nb}!`);
    assert.equal(
      typo('100 % du coût, 19 ans, 1 an, 24 mois, 5 jours, 1 jour, 7 heures, 250 km, 4 nuits, 11 salariés, 1 500 euros'),
      `100${nb}% du coût, 19${nb}ans, 1${nb}an, 24${nb}mois, 5${nb}jours, 1${nb}jour, 7${nb}heures, 250${nb}km, 4${nb}nuits, ` +
        `11${nb}salariés, 1${nb}500${nb}euros`,
    );
    assert.equal(typo('1 000 000 €'), `1${nb}000${nb}000${nb}€`);
  });

  test("un mot qui commence comme une unité n'est pas une unité", () => {
    assert.equal(typo('3 hôtels, 2 kmz, 5 annexes, 4 heurts, 2 eurostar'), '3 hôtels, 2 kmz, 5 annexes, 4 heurts, 2 eurostar');
    // Deux chiffres sans groupe de trois : pas de milliers.
    assert.equal(typo('de 9 à 12 h'), `de 9 à 12${nb}h`);
    assert.equal(typo('niveaux 3 et 4'), 'niveaux 3 et 4');
    // Deux nombres voisins : le second, de quatre chiffres, n'est pas un groupe de milliers du premier.
    assert.equal(typo('en 2026 1500 dossiers'), 'en 2026 1500 dossiers');
  });

  test("un extrait cité « … » n'est jamais modifié", () => {
    assert.equal(
      typo('Transitions Pro : « à hauteur de 2 000 euros maximum ; voir : x » ; fin'),
      `Transitions Pro${nb}: « à hauteur de 2 000 euros maximum ; voir : x »${nb}; fin`,
    );
    // Citation imbriquée : tout l'extrait de premier niveau reste mot pour mot.
    assert.equal(typo('a : « b : « c : d » e : f » g : h'), `a${nb}: « b : « c : d » e : f » g${nb}: h`);
    // Citation non refermée : elle court jusqu'à la fin du texte.
    assert.equal(typo('Note : « extrait 2 000 € : tronqué'), `Note${nb}: « extrait 2 000 € : tronqué`);
    // Guillemet fermant isolé : simple caractère.
    assert.equal(typo('a » b : c'), `a » b${nb}: c`);
  });

  test("idempotente, et seules des espaces ordinaires deviennent insécables", () => {
    const texte = 'Montant : 1 500 € ; « cité : 2 000 € » puis 35 h ?';
    const une = typo(texte);
    assert.equal(typo(une), une);
    assert.equal(une.length, texte.length);
  });

  test('sur toutes les chaînes des données : extraits intacts, plus aucune espace ordinaire avant : ; ? ! hors citation', () => {
    let modifiees = 0;
    for (const chaine of chainesDesDonnees()) {
      const sortie = typo(chaine);
      if (sortie !== chaine) modifiees++;
      assert.equal(sortie.length, chaine.length, chaine.slice(0, 120));
      let horsCitation = sortie;
      for (const extrait of extraits(chaine)) {
        assert.ok(sortie.includes(extrait), `extrait modifié : ${extrait.slice(0, 120)}`);
        horsCitation = horsCitation.replace(extrait, '');
      }
      assert.ok(!/ [:;?!]/.test(horsCitation), `espace ordinaire restée avant une ponctuation : ${chaine.slice(0, 120)}`);
      assert.ok(!/\d (?:%|€|h(?![\p{L}\p{N}]))/u.test(horsCitation), `espace ordinaire restée avant une unité : ${chaine.slice(0, 120)}`);
    }
    assert.ok(modifiees > 300, `seulement ${modifiees} chaînes corrigées`);
  });

  test('textes construits au hasard (graine fixe) : seules des espaces changent, jamais dans un extrait', () => {
    // mulberry32 : tirages indépendants et reproductibles.
    let graine = 23;
    const hasard = (n: number) => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    const morceaux = ['texte', ' ', ':', ' ;', '« ', ' »', '2 000', ' €', ' h', '35', ' ans', '?', ' !', 'heures', '%', '1 500 000'];
    let changes = 0;
    for (let i = 0; i < 3000; i++) {
      let texte = '';
      for (let k = 0; k < 12; k++) texte += morceaux[hasard(morceaux.length)];
      const sortie = typo(texte);
      assert.equal(sortie.length, texte.length, texte);
      for (let j = 0; j < texte.length; j++) {
        if (sortie[j] !== texte[j]) {
          changes++;
          assert.ok(texte[j] === ' ' && sortie[j] === nb, `${texte} => ${sortie}`);
        }
      }
      for (const extrait of extraits(texte)) assert.ok(sortie.includes(extrait), `${texte} => ${sortie}`);
    }
    assert.ok(changes > 1000, `seulement ${changes} espaces changées`);
  });
});

describe('texteDonnees', () => {
  test('dates à la française et typographie, hors extraits cités', () => {
    const nb = INSECABLE;
    assert.equal(
      texteDonnees('Ouvert jusqu\'au 2026-12-31 : 5 000 € (« avant le 2026-06-30 : 3 000 € »)'),
      `Ouvert jusqu'au 31/12/2026${nb}: 5${nb}000${nb}€ (« avant le 2026-06-30 : 3 000 € »)`,
    );
  });

  test('montants du moteur écrits par formatEuro, hors extraits cités', () => {
    const nb = INSECABLE;
    assert.equal(
      texteDonnees('Reste à charge : 60.06 € (« plafond de 1500.00 € »)'),
      `Reste à charge${nb}: 60,06${nb}€ (« plafond de 1500.00 € »)`,
    );
    assert.equal(texteDonnees('Calcul : 40 €/h × 21 h = 840.00 €'), `Calcul${nb}: 40${nb}€/h × 21${nb}h = 840${nb}€`);
  });
});

describe('montantsFr', () => {
  /** Espaces insécables (fine ou non) lues comme des espaces ordinaires, pour écrire les attendus lisiblement. */
  const lisible = (s: string) => s.replace(/\s/g, ' ');

  test('montants écrits par le moteur : réécrits par formatEuro, entier sans décimales, tout autre à deux décimales', () => {
    assert.equal(lisible(montantsFr('Calcul : 40 €/h × 21 h = 840.00 €')), 'Calcul : 40 €/h × 21 h = 840 €');
    assert.equal(
      lisible(montantsFr('Votre coût horaire : 42.86 €/h × 21 h = 900.06 €')),
      'Votre coût horaire : 42,86 €/h × 21 h = 900,06 €',
    );
    assert.equal(
      lisible(montantsFr('Le montant calculé (12600.00 €) dépasse ce plafond → ramené à 0.00 €')),
      'Le montant calculé (12 600 €) dépasse ce plafond → ramené à 0 €',
    );
    assert.equal(
      lisible(montantsFr('Budget déjà consommé (1500 €) déduit du plafond annuel (6300 €) : enveloppe restante 4800 €.')),
      'Budget déjà consommé (1 500 €) déduit du plafond annuel (6 300 €) : enveloppe restante 4 800 €.',
    );
    assert.equal(lisible(montantsFr('Forfait : 15.5 € par repas, 0.66€')), 'Forfait : 15,50 € par repas, 0,66 €');
    // Espace insécable avant « € » (texte copié d'une page web) : même lecture.
    assert.equal(lisible(montantsFr(`plafond de 1500${INSECABLE}€`)), 'plafond de 1 500 €');
    // Écriture exacte de formatEuro : espace fine insécable entre les milliers, insécable avant « € ».
    assert.equal(montantsFr('reste 1431.94 €'), `reste ${formatEuro(1431.94)}`);
  });

  test('un montant déjà écrit à la française reste tel quel', () => {
    const textes = ['1 500 €', '1 500,50 €', '9,15 €/h', '50 000 € HT', `5${INSECABLE}000${INSECABLE}€`, '0,5 €', '1,5 M€', '50 k€'];
    for (const texte of [...textes, 'IDCC 1702', '35 h et 50 %']) assert.equal(montantsFr(texte), texte, texte);
  });

  test("un nombre ambigu n'est pas réinterprété", () => {
    // Point séparateur de milliers (forme des citations de source) : jamais lu comme une décimale.
    assert.equal(montantsFr('montant de 2.000€ maximum'), 'montant de 2.000€ maximum');
    assert.equal(montantsFr('plafonné à 12.500 € par an'), 'plafonné à 12.500 € par an');
    // Deux nombres voisins : le second n'est ni un groupe de milliers du premier, ni un montant à réécrire.
    assert.equal(montantsFr('en 2026 1500 €'), 'en 2026 1500 €');
    // Zéro en tête ou quatre décimales : nombre écrit par le moteur, arrondi au centime.
    assert.equal(lisible(montantsFr('0.125 €/h et 1.0625 €')), '0,13 €/h et 1,06 €');
  });

  test('montants tirés au hasard (graine fixe), écrits comme le moteur : même valeur au centime, idempotente', () => {
    // mulberry32 : tirages indépendants et reproductibles.
    let graine = 41;
    const hasard = (n: number) => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    /** Montants écrits à la française (« 12 600 € », « 0,66 € ») : leur valeur en centimes. */
    const centimes = (texte: string) =>
      [...texte.matchAll(/(\d{1,3}(?:\s\d{3})*)(?:,(\d{2}))?\s€/g)].map(
        (m) => Number(m[1].replace(/\s/g, '')) * 100 + Number(m[2] ?? 0),
      );
    const enCentimes = (ecrit: string) => Math.round(Number(ecrit) * 100);
    for (let i = 0; i < 2000; i++) {
      const taux = String(hasard(20_000) / 100);
      const heures = 1 + hasard(400);
      const calcul = (Number(taux) * heures).toFixed(2);
      const reste = (hasard(2_000_000) + (hasard(4) === 0 ? 0 : hasard(100) / 100)).toFixed(2);
      const plafond = String(hasard(100_000));
      const texte = `Calcul : ${taux} €/h × ${heures} h = ${calcul} € ; reste ${reste} € (plafond ${plafond}€)`;
      const sortie = montantsFr(texte);
      assert.deepEqual(centimes(sortie), [taux, calcul, reste, plafond].map(enCentimes), texte);
      assert.ok(!/\d\.\d/.test(sortie), sortie);
      assert.equal(montantsFr(sortie), sortie);
    }
  });

  test('textes du moteur, tous OPCO et branches : plus aucun montant à point décimal ni à quatre chiffres collés', () => {
    const etats: Partial<WizardState>[] = [
      {
        companySize: 'less_11', durationHours: 21, pedagogyCostTotal: 900, pedagogyCostPerHour: 42.86, trainingDays: 3,
        needsTransport: true, needsAccommodation: true, accommodationNights: 2, accommodationCostPerNight: 95.5,
        needsMeals: true, mealCostPerDay: 18.5, budgetDejaConsomme: 1500,
      },
      {
        companySize: '11_49', durationHours: 140, pedagogyCostTotal: 12600, pedagogyCostPerHour: 90,
        formationType: 'certification', certificationLevel: 'rncp',
      },
      { companySize: '50_299', durationHours: 35, pedagogyCostTotal: 1400, pedagogyCostPerHour: 40 },
      {
        companySize: 'less_11', durationHours: 7, pedagogyCostTotal: 350, pedagogyCostPerHour: 50, trainingDays: 1,
        needsMeals: true, mealCostPerDay: 9,
      },
    ];
    let textes = 0;
    let reecrits = 0;
    for (const opco of EMBEDDED_OPCOS) {
      for (const idcc of [null, ...(opco.variantes_branche ?? []).map((v) => v.idcc[0] ?? null)]) {
        for (const etat of etats) {
          const resultat = calculateFunding(opco, {
            ...createInitialWizardState(),
            trainingMode: 'presentiel',
            selectedOpcoSlug: opco.slug,
            detectedIdcc: idcc,
            ...etat,
          });
          const ecrits = [...resultat.lines.flatMap((l) => [l.note ?? '', ...(l.details ?? [])]), ...resultat.warnings];
          for (const texte of ecrits) {
            textes++;
            if (montantsFr(texte) !== texte) reecrits++;
            const sortie = texteDonnees(texte);
            assert.ok(!/\d\.\d+\s?€|\d{4,}\s?€/.test(sortie), sortie);
          }
        }
      }
    }
    assert.ok(textes > 2000 && reecrits > 1000, `${textes} textes, ${reecrits} réécrits`);
  });
});
