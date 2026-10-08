// Typographie des textes écrits dans le JSX des guides (lib/typographie.ts) : seules des espaces ordinaires deviennent
// insécables, les éléments et les extraits cités restent intacts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Fragment } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { typoDesEnfants } from '../src/lib/typographie';

const NBSP = String.fromCharCode(0xa0);
const rendu = (noeud: ReactNode) => renderToStaticMarkup(createElement(Fragment, null, noeud)).replaceAll('&nbsp;', NBSP);
const h = createElement;

describe('typoDesEnfants', () => {
  test('un texte seul : nombre et unité, ponctuation haute', () => {
    assert.equal(typoDesEnfants("jusqu'à 20 % du coût : 5 000 € par an"), `jusqu'à 20${NBSP}% du coût${NBSP}: 5${NBSP}000${NBSP}€ par an`);
  });

  test('en profondeur : chaque texte des éléments imbriqués, les éléments intacts', () => {
    const arbre = h('p', { className: 'x' }, 'Entreprises de 50 salariés : ', h('strong', null, 'plafond de 4 000 €'), h('br'), ' fin');
    assert.equal(
      rendu(typoDesEnfants(arbre)),
      `<p class="x">Entreprises de 50${NBSP}salariés${NBSP}: <strong>plafond de 4${NBSP}000${NBSP}€</strong><br/> fin</p>`,
    );
  });

  test('une espace seule avant un texte qui commence par « : » devient insécable', () => {
    const arbre = h('li', null, h('strong', null, "Financer l'alternance"), ' ', ': contrats');
    assert.equal(rendu(typoDesEnfants(arbre)), `<li><strong>Financer l&#x27;alternance</strong>${NBSP}: contrats</li>`);
    const fin = h('p', null, 'Sources ', ': liste');
    assert.equal(rendu(typoDesEnfants(fin)), `<p>Sources${NBSP}: liste</p>`);
  });

  test('un extrait cité « … » reste mot pour mot', () => {
    const arbre = h('p', null, 'Loi « pour 20 % : test » du 5 septembre : suite');
    assert.equal(rendu(typoDesEnfants(arbre)), `<p>Loi « pour 20 % : test » du 5 septembre${NBSP}: suite</p>`);
  });

  test('sans texte : élément sans enfant, nombre, null et booléen rendus tels quels', () => {
    const br = h('br');
    assert.equal(typoDesEnfants(br), br);
    assert.equal(typoDesEnfants(42), 42);
    assert.equal(typoDesEnfants(null), null);
    assert.equal(typoDesEnfants(false), false);
  });

  test("les propriétés et la clé des éléments sont conservées, aucun caractère autre que l'espace ne change", () => {
    const lien = h('a', { key: 'k', href: '/opco/', className: 'lien' }, 'les 11 fiches');
    const resultat = typoDesEnfants(lien) as ReturnType<typeof h>;
    assert.equal(resultat.key, 'k');
    assert.deepEqual({ ...(resultat.props as object), children: undefined }, { href: '/opco/', className: 'lien', children: undefined });
    const texte = 'Taux 0,55 % ; plafond 1 100 € HT ; art. L.6332-17 ! 3 ans ? oui';
    const sortie = typoDesEnfants(texte) as string;
    assert.equal(sortie.length, texte.length);
    assert.equal(sortie.replaceAll(NBSP, ' '), texte);
  });
});
