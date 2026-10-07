// Mise en forme des textes des données : dates à la française hors citations, mois en toutes lettres, résumé d'une note
// de barème en une phrase (fiche OPCO sur écran étroit).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMBEDDED_AIDES, EMBEDDED_OPCOS } from '@opco/core';
import { formatEuro, moisAnneeFr, premierePhrase, texteFr } from '../src/lib/format';

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
    let graine = 11;
    const hasard = (n: number) => {
      graine = (graine * 1103515245 + 12345) & 0x7fffffff;
      return graine % n;
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

describe('formatEuro', () => {
  test('montant à la française', () => {
    // Espace fine insécable entre les milliers, espace insécable avant le symbole (Intl, fr-FR).
    assert.equal(formatEuro(6300).replace(/\s/g, ' '), '6 300 €');
    assert.equal(formatEuro(1500.5).replace(/\s/g, ' '), '1 500,5 €');
  });
});
