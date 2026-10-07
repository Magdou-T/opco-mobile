# Site financementOPCO

Site de SFG Développement qui aide une entreprise à trouver ce qui peut financer une formation : un simulateur en six étapes (OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe), les fiches des 11 OPCO, trois guides (comprendre les OPCO, obligations des entreprises, former sans consommer son budget) et une page de contact.

C'est un export statique Next.js 16 (App Router, React 19, Tailwind 4) : `next build` écrit dans `out/` des fichiers qu'un hébergement Apache sert tels quels, sans Node ni base de données.

## Commandes

Depuis la racine du dépôt (npm workspaces) :

```bash
npm run dev --workspace web      # serveur de développement, http://localhost:3000
npm run build --workspace web    # export statique dans apps/web/out
npm run lint --workspace web
npm run test:web                 # tests du site (node:test)
npm run check:charte             # garde de charte SFG sur apps/web/src
```

Depuis `apps/web`, `npm run dev`, `npm run build` et `npm run lint` font la même chose. Le build télécharge les polices Montserrat et Inter : il demande une connexion Internet. `npm run start` est refusé par Next sur un export statique ; pour voir `out/`, le servir avec un serveur de fichiers (`npx serve@latest out`, la commande que Next indique).

La documentation de la version de Next installée est dans `node_modules/next/dist/docs/`, à la racine du dépôt. `AGENTS.md` demande de la lire avant de coder : cette version a des changements incompatibles avec les précédentes.

## Organisation

- `src/app` : les pages (accueil, `simulateur/`, `opco/` et `opco/[slug]/`, `comprendre-les-opco/`, `obligations/`, `former-sans-budget/`, `contact/`), la page 404, `sitemap.ts` et `robots.ts`, ainsi que `layout.tsx` et `globals.css`, où vivent les jetons de design.
- `src/components` : `ui/` (primitives), `site/` (en-tête, pied de page, éléments des guides), `wizard/` (les six étapes du simulateur), `results/` (l'écran « Votre plan de financement »), `opco/` (fiches des OPCO).
- `src/hooks` : l'état du parcours (`useWizard`), la recherche d'entreprise (`useSirenLookup`) et la place réservée à la barre de navigation collante du simulateur.
- `src/lib` : les fonctions pures du site (étapes, saisie, calcul de l'écran de résultats, formats), testées dans `tests/`.
- `public/` : `logo-sfg.png` et le `.htaccess` d'Apache, copiés tels quels dans `out/`.

## Lien avec @opco/core

Le moteur de calcul et les données (barèmes des OPCO, table IDCC, catalogue d'aides, portails régionaux) viennent de `@opco/core` (`packages/core`). Ils sont compilés dans le site au moment du build : une modification des données n'apparaît en ligne qu'après un nouveau build et un nouveau dépôt.

Au moment de l'usage, le navigateur n'appelle qu'une API, la recherche d'entreprise de l'État (`recherche-entreprises.api.gouv.fr`). Le site n'appelle jamais `api.francecompetences.fr`, dont la réutilisation demande une licence : il renvoie seulement, par un lien, vers l'outil officiel « Quel est mon OPCO ».

## Design

`DESIGN.md` décrit le système de design SFG : jetons de couleur, typographie, primitives, contrastes mesurés et interdits. `npm run check:charte` applique ces interdits (tiret cadratin, bleu, violet, police mono, émojis) au code de `src/`.

## Publier

Le dépôt sur Hostinger (archive, `.htaccess`, liste de contrôle, limites connues) est décrit dans `docs/deploiement-site.md`. Le workflow `.github/workflows/ci.yml` construit le site à chaque pull request et à chaque push sur `main`, et conserve `out/` comme artefact `site-hostinger`.
