// Métadonnées des pages (lib/metadonnees.ts) : adresse canonique à barre finale, Open Graph, grande carte Twitter (image
// tirée du fichier opengraph-image de chaque route), longueur des titres et des descriptions.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EMBEDDED_OPCOS } from '@opco/core';
import robots from '../src/app/robots';
import { LIEN_MENTIONS } from '../src/lib/mentions';
import {
  ADRESSE_DU_SITE,
  descriptionDeFiche,
  GABARIT_DU_TITRE,
  metadonnees,
  NOM_DU_SITE,
  PAGES,
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
      title: { absolute: 'financementopco : trouvez tous les financements de votre formation' },
      description: PAGES.accueil.description,
      alternates: { canonical: '/' },
      openGraph: {
        title: 'financementopco : trouvez tous les financements de votre formation',
        description: PAGES.accueil.description,
        url: '/',
        siteName: 'financementopco',
        locale: 'fr_FR',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'financementopco : trouvez tous les financements de votre formation',
        description: PAGES.accueil.description,
      },
    });
  });

  test('autre page : le gabarit du site ajoute son nom au titre, dans l’onglet comme dans les aperçus de partage', () => {
    const m = metadonnees(PAGES.contact);
    assert.equal(m.title, 'Nous contacter');
    assert.equal(GABARIT_DU_TITRE, '%s | financementopco');
    assert.equal(titreAffiche(PAGES.contact), 'Nous contacter | financementopco');
    assert.deepEqual(m.openGraph, {
      title: 'Nous contacter | financementopco',
      description: PAGES.contact.description,
      url: '/contact/',
      siteName: NOM_DU_SITE,
      locale: 'fr_FR',
      type: 'website',
    });
    assert.equal(m.alternates?.canonical, '/contact/');
  });

  test('chaque page : chemin à barre finale, unique ; grande carte, image tirée du fichier de la route', () => {
    const chemins = TOUTES.map(([, p]) => p.chemin);
    for (const [nom, p] of TOUTES) {
      assert.match(p.chemin, /^\/(?:[a-z0-9-]+\/)*$/, nom);
      const m = metadonnees(p);
      assert.equal(m.alternates?.canonical, p.chemin, nom);
      assert.equal((m.openGraph as { url?: string }).url, p.chemin, nom);
      // Aucune image dans la configuration : elle remplacerait celle du fichier opengraph-image de la route.
      assert.equal((m.openGraph as { images?: unknown }).images, undefined, nom);
      assert.equal((m.twitter as { card?: string }).card, 'summary_large_image', nom);
      // Un guide daté devient un article daté dans l'aperçu de partage.
      if (p.modifieLe) {
        assert.equal((m.openGraph as { type?: string }).type, 'article', nom);
        assert.equal((m.openGraph as { modifiedTime?: string }).modifiedTime, p.modifieLe, nom);
      }
    }
    assert.equal(new Set(chemins).size, chemins.length);
    assert.equal(PAGES.mentions.chemin, LIEN_MENTIONS.href);
    assert.equal(ADRESSE_DU_SITE, 'https://www.financementopco.fr');
  });

  test('chaque page fixe a son image de partage (fichier opengraph-image.tsx de sa route), les fiches aussi', () => {
    for (const [nom, p] of Object.entries(PAGES)) {
      const dossier = p.chemin === '/' ? '' : p.chemin.slice(1);
      // Image générée (opengraph-image.tsx) ou dessinée (opengraph-image.png, l'accueil : image du kit d'identité).
      const genere = fileURLToPath(new URL(`../src/app/${dossier}opengraph-image.tsx`, import.meta.url));
      const dessine = fileURLToPath(new URL(`../src/app/${dossier}opengraph-image.png`, import.meta.url));
      assert.ok(existsSync(genere) || existsSync(dessine), `${nom} : ${genere}`);
    }
    assert.ok(existsSync(fileURLToPath(new URL('../src/app/opco/[slug]/opengraph-image.tsx', import.meta.url))));
  });

  test('robots.txt annonce le plan du site à l’adresse du site : une seule constante à changer avec le nom de domaine', () => {
    assert.equal(robots().sitemap, `${ADRESSE_DU_SITE}/sitemap.xml`);
    assert.doesNotMatch(ADRESSE_DU_SITE, /\/$/, 'sans barre finale : les adresses ajoutent la leur');
  });

  test('longueurs : descriptions de 155 caractères au plus, titres affichés de 72 au plus (fiches et pages fixes)', () => {
    // Au-delà, Google coupe la description ou le titre dans ses résultats (relevé du 27/11/2026 : des descriptions de
    // 200 à 211 caractères et des titres de fiche de 77 à 87 caractères).
    for (const [nom, p] of TOUTES) {
      assert.ok(p.description.length > 0, nom);
      assert.ok(p.description.length <= 155, `${nom} : ${p.description.length} caractères`);
      assert.ok(titreAffiche(p).length <= 72, `${nom} : ${titreAffiche(p)}`);
    }
  });

  test('fiche d’un OPCO : son nom, l’élision, la date de vérification et son adresse', () => {
    const akto = EMBEDDED_OPCOS.find((o) => o.slug === 'akto');
    assert.ok(akto);
    const d = descriptionDeFiche({ ...akto, derniere_verification: '2026-10-05' });
    assert.equal(d.titre, 'AKTO : barèmes et prise en charge 2026');
    assert.match(d.description, /^Plafonds de prise en charge d'AKTO en 2026, vérifiés le 05\/10\/2026 : /);
    assert.equal(d.chemin, '/opco/akto/');
    assert.doesNotMatch(descriptionDeFiche({ ...akto, derniere_verification: undefined }).description, /vérifiés le/);
  });
});
