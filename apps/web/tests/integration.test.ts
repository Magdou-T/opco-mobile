// Mode intégré (le site affiché dans un cadre d'un autre site, par exemple une page WordPress) : ni en-tête, ni
// navigation, ni pied de page quand la page est dans un cadre ; le site autonome n'est pas touché.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ATTRIBUT_INTEGRE, SCRIPT_DETECTION_INTEGRATION } from '../src/lib/integration';

const source = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

interface FausseRacine {
  attributs: Map<string, string>;
  setAttribute(nom: string, valeur: string): void;
}

/** Exécute le script de détection avec une fenêtre simulée ; renvoie l'élément racine pour lire les attributs posés. */
function executer(fenetre: { self: unknown; top: unknown } | (() => never)): FausseRacine {
  const racine: FausseRacine = {
    attributs: new Map(),
    setAttribute(nom, valeur) {
      this.attributs.set(nom, valeur);
    },
  };
  const document = { documentElement: racine };
  const window = typeof fenetre === 'function' ? Object.defineProperty({ self: {} }, 'top', { get: fenetre }) : fenetre;
  new Function('window', 'document', SCRIPT_DETECTION_INTEGRATION)(window, document);
  return racine;
}

describe('mode intégré : détection du cadre', () => {
  test('page affichée dans un cadre : l’attribut est posé sur la racine, vide', () => {
    const racine = executer({ self: { id: 'cadre' }, top: { id: 'page-parente' } });
    assert.equal(ATTRIBUT_INTEGRE, 'data-integre');
    assert.equal(racine.attributs.get(ATTRIBUT_INTEGRE), '');
  });

  test('page ouverte seule : aucun attribut, le site reste complet', () => {
    const fenetre = { id: 'seule' };
    const racine = executer({ self: fenetre, top: fenetre });
    assert.equal(racine.attributs.size, 0);
  });

  test('lecture du sommet refusée par le navigateur : la page est dans un cadre, l’attribut est posé', () => {
    const racine = executer(() => {
      throw new Error('accès refusé');
    });
    assert.equal(racine.attributs.get(ATTRIBUT_INTEGRE), '');
  });

  test('le script ne lit ni ne pose rien d’autre : pas de stockage, pas de cookie, pas de requête', () => {
    assert.doesNotMatch(SCRIPT_DETECTION_INTEGRATION, /localStorage|sessionStorage|cookie|fetch|XMLHttpRequest|postMessage/);
  });
});

describe('mode intégré : câblage dans le site', () => {
  test('le gabarit pose le script dans l’en-tête du document, avant l’affichage, et tolère l’attribut ajouté', () => {
    const gabarit = source('../src/app/layout.tsx');
    assert.match(gabarit, /import \{ SCRIPT_DETECTION_INTEGRATION \} from "@\/lib\/integration"/);
    assert.match(gabarit, /<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: SCRIPT_DETECTION_INTEGRATION \}\} \/>\s*<\/head>/);
    assert.match(gabarit, /<html lang="fr"[^>]*suppressHydrationWarning/);
  });

  test('la feuille de style masque l’en-tête, la seconde ligne de navigation et le pied de page, et annule la hauteur de l’en-tête', () => {
    const css = source('../src/app/globals.css');
    assert.match(
      css,
      /html\[data-integre\] \.entete-site,\s*html\[data-integre\] \.entete-seconde-ligne,\s*html\[data-integre\] \.pied-site \{\s*display: none;\s*\}/,
    );
    assert.match(css, /html\[data-integre\] \{\s*--hauteur-entete: 0rem;\s*\}/);
  });

  test('les composants portent les classes que la feuille de style cible', () => {
    assert.match(source('../src/components/site/SiteHeader.tsx'), /className="entete-site sticky /);
    assert.match(source('../src/components/site/SiteHeader.tsx'), /className="entete-seconde-ligne hidden /);
    assert.match(source('../src/components/site/SiteFooter.tsx'), /<footer className="pied-site surface-encre /);
  });
});
