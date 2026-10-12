// Détail par profil d'un groupe (components/results/ParProfil.tsx), rendu sans navigateur par `renderToStaticMarkup` : ce que le
// tableau et la liste empilée écrivent selon l'état du bandeau du groupe, jamais un montant que le bandeau refuse. Les blocs
// viennent du vrai `calculer` ; les attentes, montants compris, sont écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'tsx/cjs/api';
import { createInitialWizardState } from '@opco/core';
import type { WizardState } from '@opco/core';
import { ajouterProfil, changerProjetDuProfil, majProfil } from '../src/lib/groupe';
import { coutsDeFormation } from '../src/lib/parcours';
import { calculer, etatEnTete } from '../src/lib/resultats';

/**
 * `ParProfil.tsx` importe par l'alias `@/` de apps/web/tsconfig.json, que tsx ne lit pas depuis la racine du dépôt (ni Node) :
 * le temps de charger le composant, tsx lit ce fichier (`TSX_TSCONFIG_PATH`) dans son propre espace de noms.
 */
function chargerParProfil() {
  const avant = process.env.TSX_TSCONFIG_PATH;
  process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
  const tsx = register({ namespace: 'par-profil' });
  try {
    return (tsx.require('../src/components/results/ParProfil.tsx', import.meta.url) as typeof import('../src/components/results/ParProfil')).ParProfil;
  } finally {
    tsx.unregister();
    if (avant === undefined) delete process.env.TSX_TSCONFIG_PATH;
    else process.env.TSX_TSCONFIG_PATH = avant;
  }
}

const ParProfil = chargerParProfil();

const NBSP = String.fromCharCode(0xa0);
const FINE = String.fromCharCode(0x202f);
const DATE = '2026-10-07';
const etat = (over: Partial<WizardState>): WizardState => ({ ...createInitialWizardState(), trainingMode: 'presentiel', ...over });

/** Un salarié d'AKTO en Île-de-France : 4 200 € de formation par personne, 10 000 € du plan de développement des compétences au plus. */
const AKTO: Partial<WizardState> = {
  projetType: 'formation_salarie', selectedOpcoSlug: 'akto', detectedIdcc: '1516', regionCode: '11', departementCode: '95',
  companySize: 'less_11', contractType: 'cdi', ageBeneficiaire: 35, certificationLevel: 'rncp', formationType: 'certification',
  eligibleCpf: true, durationHours: 140, pedagogyCostTotal: 4200, pedagogyCostPerHour: 30,
};

/** Un dirigeant artisan de Bretagne, dont la formation (3 000 € par personne) n'ouvre aucun financement chiffré (Qualiopi inconnu). */
const ARTISAN: Partial<WizardState> = {
  projetType: 'formation_dirigeant', regionCode: '53', companySize: 'less_11', statutDirigeant: 'artisan', microEntrepreneur: false,
  ageBeneficiaire: 45, formationType: 'non_certifiante', organismeQualiopi: null, ...coutsDeFormation(3000, 21),
};

/** Trois salariés d'AKTO et un apprenti (profil 2) : le plan du groupe est chiffré, celui de l'apprenti ne l'est pas. */
const troisSalariesEtUnApprenti = () => {
  let e = etat({ ...AKTO, nombrePersonnes: 3 });
  e = changerProjetDuProfil(ajouterProfil(e), 'profil-2', 'alternance');
  e = majProfil(e, 'profil-2', { typeAlternance: 'apprentissage', ageBeneficiaire: 19 });
  return calculer(e, DATE);
};
/** Deux dirigeants artisans : aucun financement n'est chiffré pour le groupe. */
const deuxDirigeantsSansFinancement = () =>
  calculer(majProfil(ajouterProfil(etat({ ...ARTISAN, nombrePersonnes: 1 })), 'profil-2', { statutDirigeant: 'artisan', ageBeneficiaire: 45, microEntrepreneur: false }), DATE);
/** Deux salariés d'AKTO sans coût de formation. */
const deuxSalariesSansCout = () =>
  calculer(ajouterProfil(etat({ ...AKTO, pedagogyCostTotal: null, pedagogyCostPerHour: null, nombrePersonnes: 2 })), DATE);

type Calcul = ReturnType<typeof calculer>;
/** Le composant tel que l'écran le monte : les blocs du groupe et l'état de son bandeau. */
const rendre = (r: Calcul): string => renderToStaticMarkup(createElement(ParProfil, { blocs: r.groupe.blocs, etat: etatEnTete(r.plan) }));

/** Le texte d'un morceau de HTML : balises remplacées par une espace, espaces ordinaires réduites à une (les insécables restent). */
const texte = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/[ \t\r\n]+/g, ' ').trim();
/** Le premier élément `balise` du HTML, ouverture et fermeture comprises ; vide s'il n'y en a pas. */
const element = (html: string, balise: string): string => {
  const debut = html.indexOf(`<${balise}`);
  return debut < 0 ? '' : html.slice(debut, html.indexOf(`</${balise}>`, debut) + balise.length + 3);
};
/** Le texte des cellules de chaque ligne (`tr`) du HTML. */
const lignes = (html: string): string[][] =>
  [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((tr) => [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => texte(c[1])));
/** Le texte des éléments `balise` du HTML. */
const textes = (html: string, balise: string): string[] =>
  [...html.matchAll(new RegExp(`<${balise}[ >][\\s\\S]*?</${balise}>`, 'g'))].map((m) => texte(m[0]));
const occurrences = (html: string, motif: string): number => html.split(motif).length - 1;
/** Un montant à zéro (« 0 € ») : un 0 qui ne termine pas un nombre plus grand (« 6 000 € »). */
const MONTANT_NUL = new RegExp(`(^|[^\\d${FINE},.])0${NBSP}€`);

describe("ParProfil : le détail par profil suit l'état du bandeau du groupe", () => {
  test('coût inconnu : rien, le bandeau explique', () => {
    const r = deuxSalariesSansCout();
    assert.equal(r.groupe.blocs.length, 2);
    assert.equal(etatEnTete(r.plan), 'cout_inconnu');
    assert.equal(rendre(r), '');
  });

  test('aucun financement chiffré : le coût de chaque profil seul, jamais « Financé », « Reste à charge » ni un montant à zéro', () => {
    const r = deuxDirigeantsSansFinancement();
    assert.deepEqual([r.plan.coutFormation, r.plan.totalFinance, r.plan.resteACharge], [6000, 0, 6000]);
    assert.equal(etatEnTete(r.plan), 'aucun_financement_chiffre');
    const html = rendre(r);
    assert.deepEqual(textes(element(html, 'thead'), 'th'), ['Profil', 'Personnes', 'Coût']);
    assert.equal(texte(element(html, 'caption')), 'Coût de chaque profil du groupe');
    assert.equal(textes(html, 'p').includes('Coût de chaque profil, pour toutes ses personnes.'), true);
    for (const absent of ['Financé', 'Reste à charge', 'Non chiffré']) assert.equal(html.includes(absent), false, absent);
    assert.doesNotMatch(html, MONTANT_NUL);
    const cout = `3${FINE}000${NBSP}€`;
    const artisan = `Dirigeant artisan, 45${NBSP}ans`;
    assert.deepEqual(lignes(element(html, 'tbody')), [
      ['Profil 1 ' + artisan, '1', cout],
      ['Profil 2 ' + artisan, '1', cout],
    ]);
    assert.deepEqual(lignes(element(html, 'tfoot')), [['Total', '2', `6${FINE}000${NBSP}€`]]);
    assert.deepEqual(textes(element(html, 'ul'), 'li'), [
      `Profil 1, 1${NBSP}personne ${artisan} Coût ${cout}`,
      `Profil 2, 1${NBSP}personne ${artisan} Coût ${cout}`,
      `Total, 2${NBSP}personnes Coût 6${FINE}000${NBSP}€`,
    ]);
  });

  test('plan chiffré avec un profil au plan non chiffré : « Non chiffré » à la place de son financé et de son reste à charge, le total est celui du bandeau', () => {
    const r = troisSalariesEtUnApprenti();
    assert.deepEqual([r.plan.coutFormation, r.plan.totalFinance, r.plan.resteACharge], [16800, 10000, 6800]);
    assert.equal(etatEnTete(r.plan), 'plan_chiffre');
    const html = rendre(r);
    const tableau = element(html, 'table');
    const liste = element(html, 'ul');
    assert.deepEqual(textes(element(tableau, 'thead'), 'th'), ['Profil', 'Personnes', 'Coût', 'Financé', 'Reste à charge']);
    assert.equal(texte(element(tableau, 'caption')), 'Coût, financement et reste à charge de chaque profil du groupe');
    assert.equal(textes(html, 'p').includes('Coût, financement et reste à charge de chaque profil, pour toutes ses personnes.'), true);
    // « Non chiffré » : le financé et le reste à charge de l'apprenti, une fois dans le tableau et une fois dans la liste empilée.
    assert.equal(occurrences(tableau, 'Non chiffré'), 2);
    assert.equal(occurrences(liste, 'Non chiffré'), 2);
    assert.doesNotMatch(html, MONTANT_NUL);
    const euros = (entier: string) => `${entier}${NBSP}€`;
    assert.deepEqual(lignes(element(tableau, 'tbody')), [
      [`Profil 1 Salarié en CDI, 35${NBSP}ans`, '3', euros(`12${FINE}600`), euros(`10${FINE}000`), euros(`2${FINE}600`)],
      [`Profil 2 Alternant en apprentissage, 19${NBSP}ans`, '1', euros(`4${FINE}200`), 'Non chiffré', 'Non chiffré'],
    ]);
    assert.deepEqual(lignes(element(tableau, 'tfoot')), [['Total', '4', euros(`16${FINE}800`), euros(`10${FINE}000`), euros(`6${FINE}800`)]]);
    assert.deepEqual(textes(liste, 'li'), [
      `Profil 1, 3${NBSP}personnes Salarié en CDI, 35${NBSP}ans Coût ${euros(`12${FINE}600`)} Financé ${euros(`10${FINE}000`)} Reste à charge ${euros(`2${FINE}600`)}`,
      `Profil 2, 1${NBSP}personne Alternant en apprentissage, 19${NBSP}ans Coût ${euros(`4${FINE}200`)} Financé Non chiffré Reste à charge Non chiffré`,
      `Total, 4${NBSP}personnes Coût ${euros(`16${FINE}800`)} Financé ${euros(`10${FINE}000`)} Reste à charge ${euros(`6${FINE}800`)}`,
    ]);
  });

  test('un seul profil : rien, même quand le plan est chiffré (le bandeau dit déjà tout)', () => {
    const r = calculer(etat({ ...AKTO, nombrePersonnes: 3 }), DATE);
    assert.equal(r.groupe.blocs.length, 1);
    assert.equal(etatEnTete(r.plan), 'plan_chiffre');
    assert.equal(rendre(r), '');
  });
});
