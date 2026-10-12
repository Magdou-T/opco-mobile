// Textes et accessibilité des composants d'un groupe, rendus sans navigateur par `renderToStaticMarkup` : compteur de personnes
// (zone d'annonce qui nomme le profil, aide reliée au champ, signes visibles en contraste forcé), limites de l'étape
// Participants, statut d'un profil d'une personne, carte d'une aide sans montant pour un groupe, frais du récapitulatif d'un
// groupe. Une personne seule garde les textes d'avant. Attentes écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'tsx/cjs/api';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState, profilsDuGroupe } from '@opco/core';
import type { AideEvaluee, WizardState } from '@opco/core';
import type { ActionsDuGroupe } from '../src/hooks/useWizard';
import { ajouterProfil, definirNombre } from '../src/lib/groupe';
import type { QuestionAvecInconnu } from '../src/lib/parcours';

/**
 * Les composants importent par l'alias `@/` de apps/web/tsconfig.json, que tsx ne lit pas depuis la racine du dépôt (ni Node) :
 * le temps de les charger, tsx lit ce fichier (`TSX_TSCONFIG_PATH`) dans son propre espace de noms, comme tests/par-profil.test.ts.
 */
function chargerComposants() {
  const avant = process.env.TSX_TSCONFIG_PATH;
  process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
  const tsx = register({ namespace: 'rendu-groupe' });
  try {
    const charger = (chemin: string): unknown => tsx.require(chemin, import.meta.url);
    return {
      CompteurPersonnes: (charger('../src/components/wizard/CompteurPersonnes.tsx') as typeof import('../src/components/wizard/CompteurPersonnes')).CompteurPersonnes,
      StepSituation: (charger('../src/components/wizard/StepSituation.tsx') as typeof import('../src/components/wizard/StepSituation')).StepSituation,
      FormulaireProfil: (charger('../src/components/wizard/FormulaireProfil.tsx') as typeof import('../src/components/wizard/FormulaireProfil')).FormulaireProfil,
      AideCard: (charger('../src/components/results/AideCard.tsx') as typeof import('../src/components/results/AideCard')).AideCard,
      StepRecap: (charger('../src/components/wizard/StepRecap.tsx') as typeof import('../src/components/wizard/StepRecap')).StepRecap,
    };
  } finally {
    tsx.unregister();
    if (avant === undefined) delete process.env.TSX_TSCONFIG_PATH;
    else process.env.TSX_TSCONFIG_PATH = avant;
  }
}

const { CompteurPersonnes, StepSituation, FormulaireProfil, AideCard, StepRecap } = chargerComposants();

const NBSP = String.fromCharCode(0xa0);
const rien = () => {};
/** Aucune réponse « Je ne sais pas ». */
const AUCUNE: ReadonlySet<QuestionAvecInconnu> = new Set();
const etat = (over: Partial<WizardState> = {}): WizardState => ({ ...createInitialWizardState(), projetType: 'formation_salarie', ...over });
const actions: ActionsDuGroupe = {
  ajouterProfil: rien,
  retirerProfil: rien,
  majProfil: rien,
  changerProjetProfil: rien,
  definirNombre: rien,
  repondreProfil: rien,
  basculerModePrix: rien,
};

/** Le texte de chaque zone `role="status"` du HTML, dans l'ordre. */
const annonces = (html: string): string[] => [...html.matchAll(/<p role="status"[^>]*>([^<]*)<\/p>/g)].map((m) => m[1]);
/** La valeur d'un attribut de la première balise `balise` du HTML ; null si elle n'a pas cet attribut. */
const attribut = (html: string, balise: string, nom: string): string | null => {
  const ouverture = new RegExp(`<${balise}\\b[^>]*>`).exec(html)?.[0] ?? '';
  return new RegExp(`\\s${nom}="([^"]*)"`).exec(ouverture)?.[1] ?? null;
};
/** Le texte d'un morceau de HTML : balises remplacées par une espace, espaces ordinaires réduites à une (les insécables restent). */
const texte = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/[ \t\r\n]+/g, ' ').trim();

describe('compteur de personnes (CompteurPersonnes)', () => {
  const compteur = (over: { valeur?: number; aide?: string; nom?: string } = {}) =>
    renderToStaticMarkup(createElement(CompteurPersonnes, { label: 'Nombre de personnes', valeur: 4, onChange: rien, ...over }));

  test("sans nom (le compteur de l'étape à un seul profil) : la zone d'annonce dit le nombre seul, comme avant", () => {
    assert.deepEqual(annonces(compteur()), [`4${NBSP}personnes`]);
    assert.deepEqual(annonces(compteur({ valeur: 1 })), [`1${NBSP}personne`]);
  });

  test("avec un nom : la zone d'annonce nomme le profil, espace insécable avant le deux-points", () => {
    assert.deepEqual(annonces(compteur({ nom: 'Profil 2' })), [`Profil 2${NBSP}: 4${NBSP}personnes`]);
    assert.deepEqual(annonces(compteur({ nom: 'Profil 3', valeur: 1 })), [`Profil 3${NBSP}: 1${NBSP}personne`]);
  });

  test("l'aide est reliée au groupe et au champ de saisie ; sans aide, ni l'un ni l'autre ne porte de description", () => {
    const avecAide = compteur({ aide: 'Indiquez combien de personnes suivent cette formation.' });
    const idAide = /<p id="([^"]+)"[^>]*>Indiquez combien/.exec(avecAide)?.[1];
    assert.ok(idAide, avecAide);
    assert.equal(attribut(avecAide, 'div', 'aria-describedby'), idAide);
    assert.equal(attribut(avecAide, 'input', 'aria-describedby'), idAide);
    const sansAide = compteur();
    assert.equal(attribut(sansAide, 'div', 'aria-describedby'), null);
    assert.equal(attribut(sansAide, 'input', 'aria-describedby'), null);
  });

  test('les signes moins et plus : chaque trait garde la couleur du texte et prend CanvasText en contraste forcé', () => {
    const traits = [...compteur().matchAll(/<span class="([^"]*\bbg-current\b[^"]*)"/g)].map((m) => m[1].split(' '));
    assert.equal(traits.length, 3); // un trait pour moins, deux pour plus
    for (const classes of traits) assert.ok(classes.includes('forced-colors:bg-[CanvasText]'), classes.join(' '));
  });
});

describe('cartes des profils et étape Participants (StepSituation, CarteProfil)', () => {
  const etape = (e: WizardState) =>
    renderToStaticMarkup(createElement(StepSituation, { state: e, reponsesInconnues: AUCUNE, inconnuesProfils: {}, groupe: actions }));

  test('plusieurs profils : le compteur de chaque carte annonce son profil et son nombre de personnes', () => {
    const e = definirNombre(ajouterProfil(etat({ contractType: 'cdi' })), 'profil-2', 3);
    // Une zone par carte, dans l'ordre des profils, puis celle de l'étape (vide tant qu'aucun profil n'est ajouté ni retiré).
    assert.deepEqual(annonces(etape(e)), [`Profil 1${NBSP}: 1${NBSP}personne`, `Profil 2${NBSP}: 3${NBSP}personnes`, '']);
  });

  test("un seul profil de 4 personnes : le compteur de l'étape ne nomme aucun profil", () => {
    assert.deepEqual(annonces(etape(etat({ nombrePersonnes: 4 }))), [`4${NBSP}personnes`, '']);
  });

  test('six profils : chaque carte annonce son profil, et la limite se dit « Le groupe compte déjà 6 profils, le maximum. »', () => {
    assert.equal(MAX_PROFILS, 6);
    let e = etat({ contractType: 'cdi' });
    for (let i = 1; i < 6; i++) e = ajouterProfil(e);
    const html = etape(e);
    assert.deepEqual(annonces(html), [1, 2, 3, 4, 5, 6].map((rang) => `Profil ${rang}${NBSP}: 1${NBSP}personne`).concat(['']));
    assert.ok(texte(html).includes(`Le groupe compte déjà 6${NBSP}profils, le maximum.`), texte(html));
    assert.equal(html.includes('au plus'), false);
  });

  test('99 personnes : la limite se dit « Le groupe compte déjà 99 personnes, le maximum. »', () => {
    assert.equal(MAX_PERSONNES, 99);
    const html = etape(etat({ nombrePersonnes: 99 }));
    assert.ok(texte(html).includes(`Le groupe compte déjà 99${NBSP}personnes, le maximum.`), texte(html));
    assert.equal(html.includes('au plus'), false);
  });
});

describe("statut d'un profil supplémentaire (FormulaireProfil)", () => {
  const formulaire = (nombre: number, changerProjet?: () => void) =>
    texte(
      renderToStaticMarkup(
        createElement(FormulaireProfil, {
          champs: profilsDuGroupe(etat())[0].champs,
          nombre,
          regionEntreprise: null,
          maj: rien,
          inconnues: AUCUNE,
          repondre: rien,
          changerProjet,
        }),
      ),
    );

  test("« Statut de cette personne » pour une personne, « Statut de ces personnes » au-delà", () => {
    assert.ok(formulaire(1, rien).includes('Statut de cette personne'));
    assert.equal(formulaire(1, rien).includes('Statut de ces personnes'), false);
    for (const nombre of [2, 5]) {
      assert.ok(formulaire(nombre, rien).includes('Statut de ces personnes'), String(nombre));
      assert.equal(formulaire(nombre, rien).includes('Statut de cette personne'), false, String(nombre));
    }
  });

  test('le profil principal ne choisit pas son statut ici, quel que soit son effectif', () => {
    for (const nombre of [1, 3]) assert.equal(formulaire(nombre).includes('Statut de'), false, String(nombre));
  });
});

describe("carte d'une aide sans montant estimé (AideCard)", () => {
  const aide: AideEvaluee = {
    id: 'aide-test',
    nom: 'Aide de test',
    financeur: 'region',
    financeurNom: 'Région',
    categorie: 'cout_formation',
    description: '',
    statut: 'eligible',
    raisons: [],
    horsPerimetre: false,
    conditions: [],
    montantEstime: 0,
    libelleMontant: '',
    modeMontant: 'forfait',
    cumulable: true,
    alternatives: [],
    noteCumul: null,
    demarches: [],
    urlDemarche: null,
    sources: [],
    derniereVerification: '2026-10-01',
    confidence: 'exact',
    ordreEmpilement: 20,
  };
  const carte = (parPersonne?: boolean) => texte(renderToStaticMarkup(createElement(AideCard, { aide, nomParId: new Map(), parPersonne })));

  test('une personne : « Aucun montant estimé pour ce profil », comme avant', () => {
    assert.ok(carte().includes('Aucun montant estimé pour ce profil'));
    assert.ok(carte(false).includes('Aucun montant estimé pour ce profil'));
  });

  test('un groupe de plusieurs personnes : « Aucun montant estimé pour ce groupe »', () => {
    assert.ok(carte(true).includes('Aucun montant estimé pour ce groupe'));
    assert.equal(carte(true).includes('pour ce profil'), false);
  });
});

describe('frais annexes du récapitulatif (StepRecap)', () => {
  /** Les paires libellé et valeur de la section « Frais annexes ». */
  const fraisAnnexes = (e: WizardState): [string, string][] => {
    const html = renderToStaticMarkup(createElement(StepRecap, { state: e, onEdit: rien, reponsesInconnues: AUCUNE, inconnuesProfils: {} }));
    const debut = html.indexOf('>Frais annexes</h3>');
    assert.ok(debut > 0, 'section Frais annexes absente');
    const liste = html.slice(html.indexOf('<dl', debut), html.indexOf('</dl>', debut));
    return [...liste.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt><dd[^>]*>([\s\S]*?)<\/dd>/g)].map((m) => [texte(m[1]), texte(m[2])]);
  };
  const repas = { needsMeals: true, mealCostPerDay: 15 } as const;

  test('un groupe de 4 personnes : la section commence par « Montants saisis : pour une personne, comptés pour chacune des 4 personnes »', () => {
    assert.deepEqual(fraisAnnexes(etat({ ...repas, nombrePersonnes: 4 }))[0], [
      'Montants saisis',
      `Pour une personne, comptés pour chacune des 4${NBSP}personnes`,
    ]);
    // Deux profils de 2 personnes : le total du groupe.
    const deuxProfils = definirNombre(ajouterProfil(etat({ ...repas, nombrePersonnes: 2 })), 'profil-2', 2);
    assert.deepEqual(fraisAnnexes(deuxProfils)[0], ['Montants saisis', `Pour une personne, comptés pour chacune des 4${NBSP}personnes`]);
  });

  test('une personne seule : aucune ligne ajoutée, la section commence par ses frais', () => {
    const lignes = fraisAnnexes(etat({ ...repas }));
    assert.equal(lignes[0][0], 'Restauration');
    assert.equal(lignes.some(([libelle]) => libelle === 'Montants saisis'), false);
  });
});
