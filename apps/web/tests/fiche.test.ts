// Fiches OPCO et liste des OPCO (lib/fiche.ts) : textes « A | B | C » en listes, démarches numérotées, barème poste par
// poste (montants, libellés d'un montant absent selon la présentation, légende), tailles, dispositifs, alertes, plan de
// la fiche, tri des OPCO, sigles définis.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMBEDDED_OPCOS } from '@opco/core';
import type { AlerteOpco, OpcoData, SourcedValue } from '@opco/core';
import {
  ABREVIATIONS_PAR_OPCO,
  RENVOI_PRECISION,
  alertesDeLaBranche,
  cartesAlternance,
  chiffresDeLaTaille,
  decoderAncre,
  definirAbreviations,
  elementsDeTexte,
  etapesDeDemarche,
  legendeDuBareme,
  libelleValeurAbsente,
  lignesDuBareme,
  montantAvecUnite,
  montantDuDispositif,
  precisionDuPoste,
  restePrecision,
  resumeDesAlertes,
  resumeIdcc,
  sectionsDeLaFiche,
  sourceDuTexte,
  tranchesDegressives,
  trierParNom,
} from '../src/lib/fiche';
import type { Affichage, LigneBareme, PostesBareme } from '../src/lib/fiche';
import { premierePhrase, texteFr } from '../src/lib/format';

/** Espace insécable (U+00A0) et espace fine insécable (U+202F), écrites par leur code. */
const NBSP = String.fromCharCode(0xa0);
const FINE = String.fromCharCode(0x202f);

const opco = (slug: string): OpcoData => {
  const o = EMBEDDED_OPCOS.find((x) => x.slug === slug);
  if (!o) throw new Error(`OPCO introuvable : ${slug}`);
  return o;
};

/** Poste de barème de test. */
const poste = (value: number | null, confidence: SourcedValue['confidence'], note?: string): SourcedValue<number | null> => ({
  value,
  confidence,
  source_url: 'https://exemple.fr/bareme',
  ...(note !== undefined ? { note } : {}),
});

/** mulberry32, graine fixe : les tirages sont reproductibles. */
function hasardFixe(graine: number) {
  return (n: number) => {
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

describe('elementsDeTexte', () => {
  test('un texte « A | B | C » devient une liste, un élément par ligne', () => {
    assert.deepEqual(elementsDeTexte('Déposer avant le démarrage | Organisme certifié Qualiopi | Fonds limités'), [
      'Déposer avant le démarrage',
      'Organisme certifié Qualiopi',
      'Fonds limités',
    ]);
  });

  test('un texte sans séparateur reste un seul élément, sans ses espaces de bord', () => {
    assert.deepEqual(elementsDeTexte('  Délai non publié.  '), ['Délai non publié.']);
    assert.deepEqual(elementsDeTexte('   '), []);
    assert.deepEqual(elementsDeTexte(''), []);
  });

  test('séparateur « espace, barre, espace » : une barre collée à un caractère ne sépare rien', () => {
    assert.deepEqual(elementsDeTexte('A|B'), ['A|B']);
    assert.deepEqual(elementsDeTexte('A |B | C'), ['A |B', 'C']);
    assert.deepEqual(elementsDeTexte('A| B | C'), ['A| B', 'C']);
    assert.deepEqual(elementsDeTexte('Grille sur https://exemple.fr/bareme|2026 | Règle B'), [
      'Grille sur https://exemple.fr/bareme|2026',
      'Règle B',
    ]);
    // Toute espace compte (tabulation, insécable) ; plusieurs espaces aussi.
    assert.deepEqual(elementsDeTexte(`A${NBSP}|${NBSP}B  |\tC`), ['A', 'B', 'C']);
  });

  test('deux séparateurs de suite, ou un séparateur au bord du texte, ne laissent aucun élément vide', () => {
    assert.deepEqual(elementsDeTexte('A | | B'), ['A', 'B']);
    assert.deepEqual(elementsDeTexte('A |  | | B'), ['A', 'B']);
    assert.deepEqual(elementsDeTexte('| A | B |'), ['A', 'B']);
    assert.deepEqual(elementsDeTexte(' | A | B | '), ['A', 'B']);
    assert.deepEqual(elementsDeTexte('|'), []);
    assert.deepEqual(elementsDeTexte(' | | '), []);
    // Au bord, une barre collée au texte reste intacte.
    assert.deepEqual(elementsDeTexte('|A | B|'), ['|A', 'B|']);
  });

  test("jamais de coupe dans un extrait cité ni dans une parenthèse", () => {
    assert.deepEqual(elementsDeTexte('Règle A | « citation | mot pour mot » | Règle B'), [
      'Règle A',
      '« citation | mot pour mot »',
      'Règle B',
    ]);
    assert.deepEqual(elementsDeTexte('Règle A (option x | option y) | Règle B'), ['Règle A (option x | option y)', 'Règle B']);
  });

  test("un champ libre en objet : description puis note, les autres champs ignorés", () => {
    const valeur = {
      description: 'Abondement possible selon la branche.',
      plafond_cpf_standard: 5000,
      note: 'Rappel des droits CPF.',
      source_url: 'https://www.opcoep.fr/entreprise/former-mes-salaries',
      detail: { niveau: 'imbriqué' },
    };
    assert.deepEqual(elementsDeTexte(valeur), ['Abondement possible selon la branche.', 'Rappel des droits CPF.']);
  });

  test('VAE en deux postes : intitulé, plafond à la française, puis la note', () => {
    const valeur = {
      vae_simple: { value: 3000, note: '« Prise en charge au réel. » (vérifié le 2026-10-05)' },
      vae_mixte: { note: 'Dont accompagnement.' },
      source_url: 'https://www.uniformation.fr/',
    };
    assert.deepEqual(elementsDeTexte(valeur), [
      `VAE sans action de formation : jusqu'à 3${FINE}000${NBSP}€. « Prise en charge au réel. » (vérifié le 2026-10-05)`,
      'VAE avec action de formation. Dont accompagnement.',
    ]);
  });

  test('ni nombre, ni booléen, ni null, ni objet sans texte : aucun élément, jamais « [object Object] »', () => {
    for (const valeur of [null, undefined, 42, true, { a: { b: 'c' } }, { vae_simple: 'texte' }, [{ x: 1 }]]) {
      assert.deepEqual(elementsDeTexte(valeur), [], String(JSON.stringify(valeur)));
    }
  });

  test('une liste de textes est mise à plat', () => {
    assert.deepEqual(elementsDeTexte(['A | B', 'C']), ['A', 'B', 'C']);
  });

  test('les 11 OPCO : spécificités et points clés redonnent leur texte, aucun élément vide ni « [object Object] »', () => {
    for (const o of EMBEDDED_OPCOS) {
      for (const champ of ['specificites', 'points_cles_maximisation'] as const) {
        const elements = elementsDeTexte(o[champ]);
        assert.ok(elements.length >= 2, `${o.slug} ${champ} : ${elements.length} élément(s)`);
        assert.equal(elements.join(' | '), o[champ].trim(), `${o.slug} ${champ}`);
      }
      for (const champ of ['alternance_apprentissage', 'alternance_professionnalisation', 'cpf_details', 'vae_details', 'delai_validation'] as const) {
        for (const e of elementsDeTexte(o[champ])) {
          assert.ok(e.trim() !== '' && !e.includes('[object Object]') && !e.includes('undefined'), `${o.slug} ${champ} : ${e}`);
        }
      }
    }
    assert.equal(elementsDeTexte(opco('afdas').specificites).length, 5);
    assert.equal(elementsDeTexte(opco('ocapiat').specificites).length, 8);
  });
});

describe('sourceDuTexte', () => {
  test("l'adresse d'un champ libre en objet, rien pour un texte simple", () => {
    assert.equal(sourceDuTexte({ description: 'x', source_url: 'https://www.opcoep.fr/criteres' }), 'https://www.opcoep.fr/criteres');
    assert.equal(sourceDuTexte('https://www.opcoep.fr/criteres'), null);
    assert.equal(sourceDuTexte({ description: 'x', source_url: 'javascript:alert(1)' }), null);
    assert.equal(sourceDuTexte({ description: 'x' }), null);
    assert.equal(sourceDuTexte([{ source_url: 'https://a.fr' }]), null);
    assert.equal(sourceDuTexte(null), null);
  });
});

describe('etapesDeDemarche', () => {
  test('« puis » et « ; » séparent les étapes, chacune avec une majuscule et sans point final', () => {
    assert.deepEqual(
      etapesDeDemarche(
        "Consulter les critères de votre branche sur afdas.com, puis déposer la demande de prise en charge dans l'espace adhérent MyA avant le début de la formation.",
      ),
      [
        'Consulter les critères de votre branche sur afdas.com',
        "Déposer la demande de prise en charge dans l'espace adhérent MyA avant le début de la formation",
      ],
    );
    assert.deepEqual(etapesDeDemarche('Déposer la demande sur M-Gestion ; le conseiller vérifie les programmes.'), [
      'Déposer la demande sur M-Gestion',
      'Le conseiller vérifie les programmes',
    ]);
    assert.deepEqual(etapesDeDemarche('Choisir un module puis déposer la demande ; transmettre la facture.'), [
      'Choisir un module',
      'Déposer la demande',
      'Transmettre la facture',
    ]);
  });

  test('une démarche en une étape reste telle quelle, point final compris', () => {
    assert.deepEqual(etapesDeDemarche('Demande sur eGestion, dossier complet au moins 15 jours avant.'), [
      'Demande sur eGestion, dossier complet au moins 15 jours avant.',
    ]);
    assert.deepEqual(etapesDeDemarche('  '), []);
  });

  test("jamais de coupe dans un extrait cité, dans une parenthèse ni dans « depuis »", () => {
    assert.deepEqual(etapesDeDemarche('Consulter la rubrique « Actions ; puis collectives » de la page, puis s\'inscrire.'), [
      'Consulter la rubrique « Actions ; puis collectives » de la page',
      "S'inscrire",
    ]);
    assert.deepEqual(etapesDeDemarche('Choisir (puis valider ; signer) la session.'), ['Choisir (puis valider ; signer) la session.']);
    assert.deepEqual(etapesDeDemarche('Inscrire les salariés depuis le portail.'), ['Inscrire les salariés depuis le portail.']);
  });

  test('« etc. » garde son point', () => {
    assert.deepEqual(etapesDeDemarche('Préparer le devis ; joindre le programme, etc.'), ['Préparer le devis', 'Joindre le programme, etc.']);
  });

  test('les démarches des 11 OPCO : étapes non vides, majuscule en tête, découpe réelle des démarches en plusieurs temps', () => {
    let enPlusieursEtapes = 0;
    for (const o of EMBEDDED_OPCOS) {
      for (const d of o.dispositifs_complementaires ?? []) {
        const etapes = etapesDeDemarche(d.demarches);
        assert.ok(etapes.length >= 1, `${o.slug}/${d.id}`);
        if (etapes.length > 1) enPlusieursEtapes++;
        for (const e of etapes) {
          assert.ok(e.length > 3, `${o.slug}/${d.id} : « ${e} »`);
          assert.equal(e.charAt(0), e.charAt(0).toLocaleUpperCase('fr-FR'), `${o.slug}/${d.id} : « ${e} »`);
        }
      }
    }
    assert.ok(enPlusieursEtapes >= 25, `${enPlusieursEtapes} démarches en plusieurs étapes`);
    const boost = opco('ocapiat').dispositifs_complementaires?.find((d) => d.id === 'boost-competences');
    assert.deepEqual(etapesDeDemarche(boost?.demarches ?? ''), [
      "Déposer la demande préalable sur Mon Compte OCAPIAT au plus tôt 2 mois avant l'action et au plus tard le 1er jour de la formation, avec la convention de formation",
      'Transmettre facture et certificat de réalisation au plus tard 3 mois après la fin',
    ]);
  });
});

describe('montantAvecUnite', () => {
  test('euros : entier sans décimales, sinon deux ; espace insécable avant € et %', () => {
    assert.equal(montantAvecUnite(25, '€/h'), `25${NBSP}€/h`);
    assert.equal(montantAvecUnite(14.5, '€/h'), `14,50${NBSP}€/h`);
    assert.equal(montantAvecUnite(12.31, '€/h'), `12,31${NBSP}€/h`);
    assert.equal(montantAvecUnite(7500, '€/an'), `7${FINE}500${NBSP}€/an`);
    assert.equal(montantAvecUnite(150, '€/nuit'), `150${NBSP}€/nuit`);
    assert.equal(montantAvecUnite(22, '€/repas'), `22${NBSP}€/repas`);
    assert.equal(montantAvecUnite(18, '€/jour'), `18${NBSP}€/jour`);
    assert.equal(montantAvecUnite(8, '%'), `8${NBSP}%`);
    assert.equal(montantAvecUnite(9.15, '%'), `9,15${NBSP}%`);
    assert.equal(montantAvecUnite(0, '€/h'), `0${NBSP}€/h`);
  });
});

describe('barème poste par poste', () => {
  test('libellé du montant absent : le renvoi cite ce qui est visible dans chaque présentation', () => {
    assert.equal(libelleValeurAbsente('renvoi', 'tableau'), 'montant précisé dans la colonne Précision');
    assert.equal(libelleValeurAbsente('renvoi', 'cartes'), 'montant précisé ci-dessous');
    assert.equal(RENVOI_PRECISION.cartes, 'montant précisé ci-dessous');
    for (const affichage of ['tableau', 'cartes'] as const) {
      assert.equal(libelleValeurAbsente('non_publie', affichage), 'non publié');
      assert.equal(libelleValeurAbsente('sans_montant_fixe', affichage), 'sans montant fixe');
      assert.equal(libelleValeurAbsente('incluse', affichage), 'incluse dans le plafond horaire');
    }
  });

  test("précision : règle en une phrase, puis le reste de la note sans la répéter ; aucun reste quand elle ne dit rien d'autre", () => {
    assert.equal(precisionDuPoste(undefined), null);
    assert.equal(precisionDuPoste('   '), null);
    assert.deepEqual(precisionDuPoste('Frais réels plafonnés.'), { resume: 'Frais réels plafonnés.', reste: null });
    const note = '« Prise en charge au réel » Frais réels plafonnés. Autre règle. (vérifié le 2026-10-05)';
    assert.deepEqual(precisionDuPoste(note), {
      resume: 'Frais réels plafonnés.',
      reste: '« Prise en charge au réel » Autre règle. (vérifié le 05/10/2026)',
    });
  });

  test('lignes : montants mis en forme, raison de chaque montant absent, forfait annexe seulement publié', () => {
    const lignes = lignesDuBareme(
      {
        cout_horaire_inter: poste(25, 'exact', 'Plafond inter.'),
        cout_horaire_intra: poste(null, 'estimated', 'Selon la branche.'),
        cout_horaire_metier: poste(null, 'exact', 'Frais réels. Détail.'),
        prise_en_charge_salaires: poste(null, 'exact'),
        frais_transport: poste(null, 'depends_on_branche'),
        frais_annexes_pourcentage: poste(null, 'exact', 'Pas de forfait.'),
        frais_restauration: poste(22, 'exact'),
        budget_annuel_max: { value: 2500, confidence: 'exact', source_url: '' },
      },
      'euro_par_heure',
      'repas',
    );
    assert.deepEqual(
      lignes.map((l) => [l.cle, l.montant, l.absente, l.source]),
      [
        ['cout_horaire_inter', `25${NBSP}€/h`, null, 'https://exemple.fr/bareme'],
        ['cout_horaire_intra', null, 'non_publie', 'https://exemple.fr/bareme'],
        ['cout_horaire_metier', null, 'renvoi', 'https://exemple.fr/bareme'],
        ['prise_en_charge_salaires', null, 'sans_montant_fixe', 'https://exemple.fr/bareme'],
        ['frais_transport', null, 'non_publie', 'https://exemple.fr/bareme'],
        ['frais_restauration', `22${NBSP}€/repas`, null, 'https://exemple.fr/bareme'],
        ['budget_annuel_max', `2${FINE}500${NBSP}€/an`, null, null],
      ],
    );
    assert.equal(lignes[2].precision?.resume, 'Frais réels.');
    assert.equal(lignes[2].precision?.reste, 'Détail.');
    assert.equal(lignes[0].precision?.reste, null);
  });

  test('salaires : libellé et unité selon le mode ; « incluse dans le plafond horaire » ; restauration par jour', () => {
    const enPourcentage = lignesDuBareme({ prise_en_charge_salaires: poste(50, 'exact') }, 'pourcentage_pedagogique', undefined);
    assert.deepEqual(
      enPourcentage.map((l) => [l.libelle, l.montant]),
      [['Prise en charge des salaires (% des coûts pédagogiques)', `50${NBSP}%`]],
    );
    const incluse = lignesDuBareme({ prise_en_charge_salaires: poste(null, 'estimated', 'x') }, 'inclus_plafond_horaire', undefined);
    assert.equal(incluse[0].absente, 'incluse');
    const parJour = lignesDuBareme({ frais_restauration: poste(18, 'exact'), frais_annexes_pourcentage: poste(8, 'estimated') }, 'euro_par_heure', 'jour');
    assert.deepEqual(parJour.map((l) => l.montant), [`18${NBSP}€/jour`, `8${NBSP}%`]);
    assert.equal(lignesDuBareme({}, 'euro_par_heure', undefined).length, 0);
  });

  test('légende : seuls les libellés affichés, le renvoi propre à chaque présentation', () => {
    const lignes = lignesDuBareme(
      { cout_horaire_inter: poste(null, 'estimated'), cout_horaire_metier: poste(null, 'exact', 'Frais réels.') },
      'euro_par_heure',
      undefined,
    );
    assert.deepEqual(legendeDuBareme(lignes, 'cartes').map((e) => e.libelle), ['Non publié', 'Montant précisé ci-dessous']);
    assert.deepEqual(legendeDuBareme(lignes, 'tableau').map((e) => e.libelle), [
      'Non publié',
      'Montant précisé dans la colonne Précision',
    ]);
    assert.deepEqual(legendeDuBareme(lignesDuBareme({ cout_horaire_inter: poste(30, 'exact') }, 'euro_par_heure', undefined), 'cartes'), []);
  });

  test('les 11 OPCO et leurs branches : montant ou raison, jamais les deux, légende cohérente avec chaque présentation', () => {
    let lignesVues = 0;
    for (const o of EMBEDDED_OPCOS) {
      const baremes = [
        lignesDuBareme(o, o.prise_en_charge_salaires_mode, o.frais_restauration_unite),
        ...(o.variantes_branche ?? []).map((v) =>
          lignesDuBareme(v, v.prise_en_charge_salaires_mode ?? o.prise_en_charge_salaires_mode, v.frais_restauration_unite ?? o.frais_restauration_unite),
        ),
      ];
      const toutes: LigneBareme[] = baremes.flat();
      for (const l of toutes) {
        lignesVues++;
        assert.ok((l.montant === null) !== (l.absente === null), `${o.slug} ${l.cle}`);
        assert.ok(l.montant === null || !/undefined|NaN/.test(l.montant), `${o.slug} ${l.cle} : ${l.montant}`);
      }
      for (const affichage of ['tableau', 'cartes'] as Affichage[]) {
        const affiches = new Set(toutes.filter((l) => l.absente).map((l) => libelleValeurAbsente(l.absente!, affichage)));
        for (const e of legendeDuBareme(toutes, affichage)) {
          const libelle = e.libelle.charAt(0).toLowerCase() + e.libelle.slice(1);
          assert.ok(affiches.has(libelle), `${o.slug} ${affichage} : « ${e.libelle} » n'est pas affiché`);
          if (affichage === 'cartes') assert.ok(!e.libelle.includes('colonne'), `${o.slug} : la légende des cartes cite une colonne`);
          else assert.ok(!e.libelle.includes('ci-dessous'), `${o.slug} : la légende du tableau dit « ci-dessous »`);
        }
      }
    }
    assert.ok(lignesVues > 150, `${lignesVues} lignes`);
  });

  test('données réelles : OPCO Santé et OPCO 2i', () => {
    const sante = opco('opco-sante');
    const montants = Object.fromEntries(
      lignesDuBareme(sante, sante.prise_en_charge_salaires_mode, sante.frais_restauration_unite).map((l) => [l.cle, l.montant]),
    );
    assert.equal(montants.prise_en_charge_salaires, `12,31${NBSP}€/h`);
    assert.equal(montants.frais_hebergement, `150${NBSP}€/nuit`);
    assert.equal(montants.frais_restauration, `22${NBSP}€/repas`);
    assert.equal(montants.budget_annuel_max, `2${FINE}500${NBSP}€/an`);
    const deuxI = opco('opco2i');
    const budget = lignesDuBareme(deuxI, deuxI.prise_en_charge_salaires_mode, deuxI.frais_restauration_unite).at(-1);
    assert.equal(budget?.montant, `4${FINE}800${NBSP}€/an`);
  });
});

describe('restePrecision', () => {
  const POSTES: (keyof PostesBareme)[] = [
    'cout_horaire_inter',
    'cout_horaire_intra',
    'cout_horaire_metier',
    'prise_en_charge_salaires',
    'frais_transport',
    'frais_hebergement',
    'frais_restauration',
    'frais_annexes_pourcentage',
    'budget_annuel_max',
  ];

  /** Note d'un poste réel, au barème général (branche null) ou d'une branche. */
  const noteDe = (slug: string, branche: string | null, cle: keyof PostesBareme): string => {
    const o = opco(slug);
    const bareme: PostesBareme | undefined = branche === null ? o : o.variantes_branche?.find((v) => v.id === branche);
    const note = bareme?.[cle]?.note;
    if (!note) throw new Error(`note introuvable : ${slug} ${branche} ${cle}`);
    return note;
  };

  test("note d'une seule phrase : aucun reste", () => {
    assert.equal(restePrecision('Frais réels plafonnés.'), '');
    assert.equal(restePrecision('  Frais réels plafonnés.  '), '');
    assert.equal(restePrecision('« Prise en charge au réel. »'), '');
    assert.equal(restePrecision(''), '');
  });

  test('une phrase et sa date de vérification (AKTO, prévention-sécurité, salaires) : seule la date reste', () => {
    const note = noteDe('akto', 'prevention-securite', 'prise_en_charge_salaires');
    assert.equal(premierePhrase(note), '« La rémunération et les frais annexes des salariés formés ne sont pas pris en charge. »');
    assert.equal(restePrecision(note), '(vérifié le 05/10/2026)');
    // Phrase sans point final avant la mention : premierePhrase le rétablit, le reste ne garde que la mention.
    assert.equal(restePrecision('Frais réels plafonnés (vérifié le 2026-10-05)'), '(vérifié le 05/10/2026)');
  });

  test('plusieurs phrases (OPCO Mobilités, intra) : les phrases suivantes et la mention, dans leur ordre', () => {
    const note = noteDe('opco-mobilites', null, 'cout_horaire_intra');
    assert.equal(premierePhrase(note), 'Pas de plafond horaire publié sur la page PDC.');
    assert.equal(
      restePrecision(note),
      "À confirmer : les guides pratiques 2026 par branche (version du 01/10/2026) n'étaient pas consultables lors de la vérification, site officiel inaccessible le 06/10. (vérifié le 06/10/2026 ; informations relevées sur une copie de la page officielle de l'OPCO, le site officiel étant momentanément inaccessible lors de la vérification).",
    );
  });

  test("extrait cité en tête (AFDAS, inter) : la règle affichée est retirée, l'extrait garde sa place", () => {
    const note = noteDe('afdas', null, 'cout_horaire_inter');
    const extrait = note.slice(0, note.indexOf('»') + 1);
    assert.ok(extrait.startsWith('« À ces plafonds annuels'), extrait);
    assert.equal(
      premierePhrase(note),
      'Barème unique du PDC des structures de moins de 50 salariés, dans la limite du plafond annuel.',
    );
    assert.equal(restePrecision(note), `${extrait} (vérifié le 05/10/2026)`);
  });

  test('adresse web : la parenthèse de source (OPCO 2i, salaires) et la phrase de provenance (ATLAS) restent', () => {
    const deuxI = noteDe('opco2i', null, 'prise_en_charge_salaires');
    // premierePhrase retire la parenthèse de source et rétablit le point : elle reste dans la précision.
    assert.ok(premierePhrase(deuxI).endsWith('alors que la règle 2021 la prévoyait.'));
    const reste = restePrecision(deuxI);
    assert.ok(reste.startsWith('(« pour toutes les entreprises de moins de 50 salariés'), reste);
    assert.ok(reste.includes('https://www.opco2i.fr/plan-de-developpement-des-competences-la-prise-en-charge-evolue/).'), reste);
    assert.ok(reste.endsWith('(vérifié le 05/10/2026)'), reste);
    assert.ok(!reste.includes('La règle PDC 2026'), reste);

    // La règle d'ATLAS cite sa page : le résumé est l'extrait cité, la phrase de provenance reste.
    const atlas = noteDe('atlas', 'societes-financieres', 'cout_horaire_metier');
    assert.equal(premierePhrase(atlas), '« Entreprises de moins de 11 salariés Plafond par entreprise : 1 000€ HT/an »');
    const resteAtlas = restePrecision(atlas);
    assert.ok(resteAtlas.startsWith('Page officielle de critères 2026 (affichée seulement'), resteAtlas);
    assert.ok(resteAtlas.includes('(https://web.archive.org/web/20260618072451/'), resteAtlas);
    assert.ok(!resteAtlas.includes('Plafond par entreprise'), resteAtlas);
  });

  test('premier extrait cité de la note pris pour résumé : retiré de son milieu ; « ; » de jonction retiré', () => {
    // Règle qui cite une adresse sans parenthèse ni extrait de tête : premierePhrase se replie sur le premier extrait.
    const note = 'Barème publié sur https://exemple.fr/bareme. « Plafond de 30 € par heure » ; « 1 200 heures au plus » (vérifié le 2026-10-05)';
    assert.equal(premierePhrase(note), '« Plafond de 30 € par heure »');
    assert.equal(restePrecision(note), 'Barème publié sur https://exemple.fr/bareme. « 1 200 heures au plus » (vérifié le 05/10/2026)');
    assert.equal(restePrecision('« Plafond de 30 € » ; « 1 200 heures au plus »'), '« 1 200 heures au plus »');
    // « ; » entre l'extrait de tête et la règle affichée : il part avec elle.
    assert.equal(restePrecision('« Plafond de 30 € » ; Règle publiée. Autre phrase.'), '« Plafond de 30 € » Autre phrase.');
  });

  test('phrase affichée introuvable telle quelle dans la note : la note entière, rien ne se perd', () => {
    // Parenthèse de source au milieu de la phrase : premierePhrase la retire, la phrase affichée n'est plus dans la note.
    const note = 'Plafond (« 30 € », https://exemple.fr/a) appliqué. Autre règle.';
    assert.equal(premierePhrase(note), 'Plafond appliqué.');
    assert.equal(restePrecision(note), note);
  });

  test('les notes des 11 OPCO : première phrase + reste = note (aux espaces près), le reste ne répète jamais la phrase', () => {
    const compact = (s: string) => s.replace(/\s+/g, '');
    let notes = 0;
    let sansReste = 0;
    for (const o of EMBEDDED_OPCOS) {
      const baremes: [string, PostesBareme][] = [['général', o], ...(o.variantes_branche ?? []).map((v): [string, PostesBareme] => [v.id, v])];
      for (const [nom, bareme] of baremes) {
        for (const cle of POSTES) {
          const note = bareme[cle]?.note;
          if (!note?.trim()) continue;
          notes++;
          const id = `${o.slug} ${nom} ${cle}`;
          const texte = texteFr(note).trim();
          const phrase = premierePhrase(note);
          // Le point final que premierePhrase rétablit après une parenthèse de source retirée n'est pas dans la note.
          const affichee = texte.includes(phrase) ? phrase : phrase.replace(/\.$/, '');
          assert.ok(texte.includes(affichee), `${id} : phrase introuvable`);
          const reste = restePrecision(note);
          if (!reste) sansReste++;
          assert.ok(!reste.includes(affichee), `${id} : le reste répète la phrase`);
          const [n, p, r] = [compact(texte), compact(affichee), compact(reste)];
          const recomposee = Array.from({ length: r.length + 1 }, (_, k) => [r.slice(0, k), r.slice(k)]).some(
            ([a, z]) => n === a + p + z || n === a + p + ';' + z || n === a + ';' + p + z,
          );
          assert.ok(recomposee, `${id} : « ${reste} »`);
        }
      }
    }
    assert.ok(notes >= 240, `${notes} notes`);
    // Toutes les notes actuelles disent davantage que leur règle (au moins la date de vérification).
    assert.equal(sansReste, 0);
  });
});

describe('tranchesDegressives', () => {
  test('selon la durée totale (Uniformation) : un taux par durée de formation', () => {
    assert.deepEqual(
      tranchesDegressives(
        [
          { max_heures: null, valeur: 15 },
          { max_heures: 105, valeur: 65 },
        ],
        'selon_duree_totale',
      ),
      [
        { libelle: `formation de 105${NBSP}h ou moins`, valeur: `65${NBSP}€/h` },
        { libelle: `formation de plus de 105${NBSP}h`, valeur: `15${NBSP}€/h` },
      ],
    );
  });

  test("par tranche (défaut) : bornes de chaque tranche d'heures", () => {
    assert.deepEqual(
      tranchesDegressives(
        [
          { max_heures: 70, valeur: 30 },
          { max_heures: 35, valeur: 40 },
          { max_heures: null, valeur: 20 },
        ],
        undefined,
      ).map((t) => t.libelle),
      [`de 0 à 35${NBSP}h`, `de 35 à 70${NBSP}h`, `au-delà de 70${NBSP}h`],
    );
  });
});

describe('chiffresDeLaTaille', () => {
  test('chiffres publiés seulement ; fiabilité sur le seul plafond horaire (« exact » par défaut)', () => {
    assert.deepEqual(
      chiffresDeLaTaille({
        taille: 'less_11',
        description: '',
        budget_annuel_max: 2500,
        cout_horaire_max: 30,
        confidence: 'estimated',
        prise_en_charge_salaires_horaire: 12,
        quota_horaire_max: 1200,
      }),
      [
        { libelle: 'Budget annuel', valeur: `2${FINE}500${NBSP}€`, confiance: null },
        { libelle: 'Plafond horaire', valeur: `30${NBSP}€/h`, confiance: 'estimated' },
        { libelle: 'Salaires', valeur: `12${NBSP}€/h`, confiance: null },
        { libelle: "Plafond d'heures", valeur: `1${FINE}200${NBSP}h`, confiance: null },
      ],
    );
    assert.deepEqual(
      chiffresDeLaTaille({ taille: '11_49', description: '', budget_annuel_max: null, cout_horaire_max: 19, quota_horaire_max: null }),
      [{ libelle: 'Plafond horaire', valeur: `19${NBSP}€/h`, confiance: 'exact' }],
    );
    assert.deepEqual(
      chiffresDeLaTaille({
        taille: '300_plus',
        description: 'x',
        budget_annuel_max: null,
        cout_horaire_max: null,
        quota_horaire_max: null,
        prise_en_charge_salaires_horaire: null,
      }),
      [],
    );
  });
});

describe('montantDuDispositif', () => {
  test('pourcentage, plafond et unité', () => {
    assert.equal(
      montantDuDispositif({ pourcentage_couts: 50, montant_max: 750, unite: 'par_stagiaire' }),
      `50${NBSP}% des coûts pédagogiques, dans la limite de 750${NBSP}€ par stagiaire`,
    );
    assert.equal(montantDuDispositif({ pourcentage_couts: null, montant_max: 10, unite: 'par_heure' }), `jusqu'à 10${NBSP}€ par heure`);
    assert.equal(montantDuDispositif({ pourcentage_couts: null, montant_max: 1500, unite: null }), `jusqu'à 1${FINE}500${NBSP}€`);
    assert.equal(montantDuDispositif({ pourcentage_couts: 100, montant_max: null, unite: null }), `100${NBSP}% des coûts pédagogiques`);
    assert.equal(montantDuDispositif({ pourcentage_couts: null, montant_max: null, unite: 'par_an' }), null);
  });
});

describe('resumeIdcc', () => {
  test('codes cités jusqu’à trois, au-delà leur nombre', () => {
    assert.equal(resumeIdcc([]), '');
    assert.equal(resumeIdcc(['1486']), 'IDCC 1486');
    assert.equal(resumeIdcc(['1516', '1518', '2847']), 'IDCC 1516, 1518, 2847');
    assert.equal(resumeIdcc(['1', '2', '3', '4']), `4${NBSP}conventions collectives`);
  });
});

describe('alertes', () => {
  const alerte = (type: AlerteOpco['type'], idcc: string[], branche = 'b'): AlerteOpco => ({
    type,
    branche,
    idcc,
    source_url: 'https://exemple.fr',
    extrait: 'x',
    verifie_le: '2026-10-06',
  });

  test('résumé : un compte par type, du plus fréquent au moins fréquent, ordre des données à égalité', () => {
    assert.deepEqual(
      resumeDesAlertes([
        alerte('changement_paiement', []),
        alerte('fonds_epuises', ['1']),
        alerte('dispositif_termine', []),
        alerte('fonds_epuises', ['2']),
      ]),
      [
        { type: 'fonds_epuises', libelle: 'Fonds épuisés', nombre: 2 },
        { type: 'changement_paiement', libelle: 'Modalités de paiement modifiées', nombre: 1 },
        { type: 'dispositif_termine', libelle: 'Dispositif terminé', nombre: 1 },
      ],
    );
    assert.deepEqual(resumeDesAlertes([]), []);
    assert.deepEqual(
      resumeDesAlertes(opco('akto').alertes ?? []).map((t) => [t.libelle, t.nombre]),
      [
        ['Fonds épuisés', 10],
        ['Dispositif terminé', 1],
        ['Modalités de paiement modifiées', 1],
      ],
    );
  });

  test("d'une branche : celles qui citent l'un de ses codes ; une alerte sans code reste générale", () => {
    const alertes = [alerte('fonds_epuises', ['1516']), alerte('changement_paiement', []), alerte('echeance', ['9999', '1517'])];
    assert.deepEqual(alertesDeLaBranche(alertes, ['1516', '1517']).map((a) => a.type), ['fonds_epuises', 'echeance']);
    assert.deepEqual(alertesDeLaBranche(alertes, ['7777']), []);
    assert.deepEqual(alertesDeLaBranche(alertes, []), []);
  });

  test('données réelles : branches visées chez AKTO et Constructys', () => {
    const akto = opco('akto');
    const parBranche = Object.fromEntries((akto.variantes_branche ?? []).map((v) => [v.id, alertesDeLaBranche(akto.alertes ?? [], v.idcc).length]));
    assert.deepEqual(parBranche, {
      hcr: 0,
      proprete: 0,
      'restauration-rapide': 0,
      'prevention-securite': 0,
      'organismes-de-formation': 1,
      'akto-pdc-2026-epuise': 7,
    });
    const cons = opco('constructys');
    assert.deepEqual(
      (cons.variantes_branche ?? []).map((v) => alertesDeLaBranche(cons.alertes ?? [], v.idcc).map((a) => a.branche)),
      [['Bâtiment 11 à 299 salariés'], [], ['Négoce : périodes de reconversion (CQP)']],
    );
  });
});

describe('plan de la fiche', () => {
  test('sections présentes selon les données, dans l’ordre de la page', () => {
    assert.deepEqual(sectionsDeLaFiche(opco('akto')), [
      { id: 'bareme', libelle: 'Barème général' },
      { id: 'tailles', libelle: "Selon la taille de l'entreprise" },
      { id: 'branches', libelle: 'Barèmes par branche' },
      { id: 'alertes', libelle: 'Alertes', compte: 12 },
      { id: 'dispositifs', libelle: 'Financements complémentaires' },
      { id: 'alternance', libelle: 'Alternance, CPF et VAE' },
      { id: 'pratique', libelle: 'En pratique' },
    ]);
    // OPCO Santé : pas de variante mais une note sur les branches ; OPCO 2i : ni l'une ni l'autre.
    assert.deepEqual(sectionsDeLaFiche(opco('opco-sante')).map((s) => s.id), ['bareme', 'tailles', 'branches', 'dispositifs', 'alternance', 'pratique']);
    assert.deepEqual(sectionsDeLaFiche(opco('opco2i')).map((s) => s.id), ['bareme', 'tailles', 'dispositifs', 'alternance', 'pratique']);
  });

  test('fiche minimale : barème général et « En pratique » seulement', () => {
    const base = opco('opco2i');
    const minimale: OpcoData = {
      ...base,
      plafonds_par_taille: [],
      variantes_branche: undefined,
      note_variantes: '  ',
      alertes: [],
      dispositifs_complementaires: undefined,
      alternance_apprentissage: null,
      alternance_professionnalisation: { source_url: 'https://exemple.fr' },
      cpf_abondement: false,
      cpf_details: 'Texte non affiché sans abondement.',
      vae_possible: true,
      vae_details: '',
    };
    assert.deepEqual(sectionsDeLaFiche(minimale).map((s) => s.id), ['bareme', 'pratique']);
    assert.deepEqual(cartesAlternance(minimale), []);
  });

  test("les ancres de section ne croisent jamais l'identifiant d'une branche ni une ancre du site", () => {
    const fixes = new Set(['contenu', 'alertes-opco', 'sommaire']);
    for (const o of EMBEDDED_OPCOS) {
      const ids = sectionsDeLaFiche(o).map((s) => s.id as string);
      const branches = (o.variantes_branche ?? []).map((v) => v.id);
      const tous = [...ids, ...branches];
      assert.equal(new Set(tous).size, tous.length, `${o.slug} : identifiant en double`);
      for (const id of tous) assert.ok(!fixes.has(id), `${o.slug} : ${id}`);
    }
  });

  test('cartes Alternance, CPF et VAE : texte et source des champs en objet', () => {
    const cartes = cartesAlternance(opco('opco-ep'));
    assert.deepEqual(cartes.map((c) => c.cle), ['apprentissage', 'professionnalisation', 'cpf', 'vae']);
    assert.equal(cartes[2].source, 'https://www.opcoep.fr/entreprise/former-mes-salaries');
    assert.equal(cartes[2].elements.length, 2);
    assert.ok(cartesAlternance(opco('afdas')).every((c) => c.source === null));
  });
});

describe('trierParNom', () => {
  test("ordre alphabétique, article élidé ignoré (L'Opcommerce à O), nombres dans l'ordre", () => {
    assert.deepEqual(trierParNom(EMBEDDED_OPCOS).map((o) => o.name), [
      'AFDAS',
      'AKTO',
      'ATLAS',
      'Constructys',
      'OCAPIAT',
      'OPCO 2i',
      'OPCO EP',
      'OPCO Mobilités',
      'OPCO Santé',
      "L'Opcommerce",
      'Uniformation',
    ]);
    assert.deepEqual(trierParNom([{ name: 'Opco 10' }, { name: 'opco 9' }, { name: 'Élan' }, { name: 'Abc' }]).map((o) => o.name), [
      'Abc',
      'Élan',
      'opco 9',
      'Opco 10',
    ]);
  });

  test('la liste reçue reste intacte', () => {
    const liste = [{ name: 'B' }, { name: 'A' }];
    trierParNom(liste);
    assert.deepEqual(liste.map((o) => o.name), ['B', 'A']);
  });
});

describe('decoderAncre', () => {
  test('ancre bien encodée : décodée, sans le « # »', () => {
    assert.equal(decoderAncre('#organismes-de-formation'), 'organismes-de-formation');
    assert.equal(decoderAncre('#%C3%A9conomie'), 'économie');
    assert.equal(decoderAncre('#a%20b'), 'a b');
    assert.equal(decoderAncre('#hcr'), 'hcr');
  });

  test("ancre mal encodée : rendue telle quelle sans le « # », jamais d'exception", () => {
    assert.equal(decoderAncre('#taux-100%'), 'taux-100%');
    assert.equal(decoderAncre('#%E0%A4%A'), '%E0%A4%A');
    assert.equal(decoderAncre('#%'), '%');
    assert.equal(decoderAncre('#%C3%A9-100%'), '%C3%A9-100%');
    // Octets qui ne forment pas un caractère UTF-8 valide.
    assert.equal(decoderAncre('#%FF'), '%FF');
  });

  test('ancre vide ou absente : chaîne vide ; seul un « # » de tête est retiré', () => {
    assert.equal(decoderAncre('#'), '');
    assert.equal(decoderAncre(''), '');
    assert.equal(decoderAncre('hcr'), 'hcr');
    assert.equal(decoderAncre('##hcr'), '#hcr');
  });

  test('2 000 ancres tirées au hasard (graine fixe) : aucune exception, aller-retour exact une fois encodées', () => {
    const hasard = hasardFixe(7);
    const signes = ['%', '#', 'a', 'é', ' ', '-', '1', 'E', '0', 'Z', '€', '/', '?', '&', '%2', '%C3', '%A9', '%E0%A4'];
    let malEncodees = 0;
    for (let i = 0; i < 2000; i++) {
      let s = '';
      const n = hasard(10);
      for (let k = 0; k < n; k++) s += signes[hasard(signes.length)];
      const brut = decoderAncre(`#${s}`);
      let attendu: string;
      try {
        attendu = decodeURIComponent(s);
      } catch {
        attendu = s;
        malEncodees++;
      }
      assert.equal(brut, attendu, `ancre ${i} : « #${s} »`);
      assert.equal(decoderAncre(`#${encodeURIComponent(s)}`), s, `ancre ${i} encodée : « ${s} »`);
    }
    assert.ok(malEncodees > 300, `${malEncodees} ancres mal encodées`);
  });
});

describe('definirAbreviations', () => {
  const DEFINITIONS = { DAF: "demande d'aide financière", 'hors CC': 'hors convention collective', CC: 'convention collective' };

  test('la première occurrence de chaque sigle porte sa définition, le texte est recomposé à l’identique', () => {
    const texte = 'La DAF légale et la DAF conventionnelle (hors CC) ; une CC.';
    const morceaux = definirAbreviations(texte, DEFINITIONS);
    assert.deepEqual(morceaux, [
      { genre: 'texte', valeur: 'La ' },
      { genre: 'abreviation', valeur: 'DAF', definition: "demande d'aide financière" },
      { genre: 'texte', valeur: ' légale et la DAF conventionnelle (' },
      { genre: 'abreviation', valeur: 'hors CC', definition: 'hors convention collective' },
      { genre: 'texte', valeur: ') ; une ' },
      { genre: 'abreviation', valeur: 'CC', definition: 'convention collective' },
      { genre: 'texte', valeur: '.' },
    ]);
  });

  test('mot entier et casse exacte seulement', () => {
    assert.deepEqual(definirAbreviations('DAFX, XDAF, daf, DAF2', DEFINITIONS), [{ genre: 'texte', valeur: 'DAFX, XDAF, daf, DAF2' }]);
    assert.deepEqual(definirAbreviations('', DEFINITIONS), []);
    assert.deepEqual(definirAbreviations('DAF', {}), [{ genre: 'texte', valeur: 'DAF' }]);
  });

  test('recomposition à l’identique sur 2 000 textes tirés au hasard (graine fixe)', () => {
    const hasard = hasardFixe(11);
    const mots = ['DAF', 'hors', 'CC', 'hors CC', 'la', 'DAFDAF', '(', ')', '«', '»', 'é', 'CC2', ' ', ', '];
    let definitions = 0;
    for (let i = 0; i < 2000; i++) {
      let texte = '';
      const n = hasard(12);
      for (let m = 0; m < n; m++) texte += mots[hasard(mots.length)] + (hasard(3) === 0 ? '' : ' ');
      const morceaux = definirAbreviations(texte, DEFINITIONS);
      assert.equal(morceaux.map((x) => x.valeur).join(''), texte, `texte ${i} : « ${texte} »`);
      const vus = morceaux.filter((x) => x.genre === 'abreviation').map((x) => x.valeur);
      assert.equal(new Set(vus).size, vus.length, `texte ${i} : sigle défini deux fois`);
      definitions += vus.length;
    }
    assert.ok(definitions > 500, `${definitions} définitions`);
  });

  test('OPCO Santé : les quatre synthèses de prise en charge sont définies', () => {
    const sigles = definirAbreviations(opco('opco-sante').note_variantes ?? '', ABREVIATIONS_PAR_OPCO['opco-sante'])
      .filter((m) => m.genre === 'abreviation')
      .map((m) => m.valeur);
    assert.deepEqual(sigles, ['SSSMS', 'HP', 'SPSTI', 'hors CC']);
  });
});
