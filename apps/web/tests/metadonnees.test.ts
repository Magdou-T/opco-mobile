// Métadonnées des pages (lib/metadonnees.ts) : adresse canonique à barre finale, Open Graph, carte Twitter sans image,
// longueur des titres et des descriptions.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMBEDDED_OPCOS } from '@opco/core';
import { LIEN_MENTIONS } from '../src/lib/mentions';
import {
  ADRESSE_DU_SITE,
  GABARIT_DU_TITRE,
  NOM_DU_SITE,
  PAGES,
  descriptionDeFiche,
  metadonnees,
  titreAffiche,
} from '../src/lib/metadonnees';
import type { DescriptionDePage } from '../src/lib/metadonnees';

const TOUTES: [string, DescriptionDePage][] = [
  ...Object.entries(PAGES),
  ...EMBEDDED_OPCOS.map((o): [string, DescriptionDePage] => [o.slug, descriptionDeFiche(o)]),
];

describe('métadonnées des pages', () => {
  test('accueil : titre complet (le nom du site n’est pas répété), adresse canonique « / », Open Graph et carte Twitter', () => {
    assert.deepEqual(metadonnees(PAGES.accueil), {
      title: { absolute: 'financementOPCO : trouvez tous les financements de votre formation' },
      description: PAGES.accueil.description,
      alternates: { canonical: '/' },
      openGraph: {
        title: 'financementOPCO : trouvez tous les financements de votre formation',
        description: PAGES.accueil.description,
        url: '/',
        siteName: 'financementOPCO',
        locale: 'fr_FR',
        type: 'website',
      },
      twitter: { card: 'summary', title: 'financementOPCO : trouvez tous les financements de votre formation', description: PAGES.accueil.description },
    });
  });

  test('autre page : le gabarit du site ajoute son nom au titre, dans l’onglet comme dans les aperçus de partage', () => {
    const m = metadonnees(PAGES.contact);
    assert.equal(m.title, 'Nous contacter');
    assert.equal(GABARIT_DU_TITRE, '%s | financementOPCO');
    assert.equal(titreAffiche(PAGES.contact), 'Nous contacter | financementOPCO');
    assert.deepEqual(m.openGraph, {
      title: 'Nous contacter | financementOPCO',
      description: PAGES.contact.description,
      url: '/contact/',
      siteName: NOM_DU_SITE,
      locale: 'fr_FR',
      type: 'website',
    });
    assert.equal(m.alternates?.canonical, '/contact/');
  });

  test('chaque page : chemin à barre finale, unique ; aucune image de partage', () => {
    const chemins = TOUTES.map(([, p]) => p.chemin);
    for (const [nom, p] of TOUTES) {
      assert.match(p.chemin, /^\/(?:[a-z0-9-]+\/)*$/, nom);
      const m = metadonnees(p);
      assert.equal(m.alternates?.canonical, p.chemin, nom);
      assert.equal((m.openGraph as { url?: string }).url, p.chemin, nom);
      assert.equal((m.openGraph as { images?: unknown }).images, undefined, nom);
      assert.equal((m.twitter as { card?: string }).card, 'summary', nom);
    }
    assert.equal(new Set(chemins).size, chemins.length);
    assert.equal(PAGES.mentions.chemin, LIEN_MENTIONS.href);
    assert.equal(ADRESSE_DU_SITE, 'https://www.financementopco.fr');
  });

  test('longueurs : description de l’accueil de 160 caractères au plus, titre de « Se former sans budget » de 72 au plus', () => {
    assert.ok(PAGES.accueil.description.length <= 160, String(PAGES.accueil.description.length));
    assert.ok(titreAffiche(PAGES.formerSansBudget).length <= 72, titreAffiche(PAGES.formerSansBudget));
    // Aucune description vide, aucun titre affiché de plus de 90 caractères.
    for (const [nom, p] of TOUTES) {
      assert.ok(p.description.length > 0, nom);
      assert.ok(titreAffiche(p).length <= 90, `${nom} : ${titreAffiche(p)}`);
    }
  });

  test('fiche d’un OPCO : son nom, l’élision, la date de vérification et son adresse', () => {
    const akto = EMBEDDED_OPCOS.find((o) => o.slug === 'akto');
    assert.ok(akto);
    const d = descriptionDeFiche({ ...akto, derniere_verification: '2026-10-05' });
    assert.equal(d.titre, 'AKTO : barèmes de financement 2026, conditions, dispositifs');
    assert.match(d.description, /^Barèmes de prise en charge 2026 d'AKTO vérifiés le 05\/10\/2026 : /);
    assert.equal(d.chemin, '/opco/akto/');
    assert.doesNotMatch(descriptionDeFiche({ ...akto, derniere_verification: undefined }).description, /vérifiés le/);
  });
});
