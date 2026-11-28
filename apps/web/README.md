# Site financementOPCO

Site de SFG Développement qui aide une entreprise à trouver ce qui peut financer une formation : un simulateur en six étapes (OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe), les fiches des 11 OPCO, trois guides (comprendre les OPCO, obligations des entreprises, se former sans consommer son budget), une page de contact et la page « Mentions légales et données ».

C'est un export statique Next.js 16 (App Router, React 19, Tailwind 4) : `next build` écrit dans `out/` des fichiers qu'un hébergement Apache sert tels quels, sans Node ni base de données.

## Commandes

Depuis la racine du dépôt (npm workspaces) :

```bash
npm run dev --workspace web      # serveur de développement, http://localhost:3000 (non testée ici)
npm run build --workspace web    # export statique dans apps/web/out (non testée ici)
npm run lint --workspace web
npm run test:web                 # tests du site (node:test)
npm run check:charte             # garde de charte SFG du site
npm run check:tirets             # tirets cadratins dans tout le dépôt
```

Depuis `apps/web`, `npm run dev`, `npm run build` et `npm run lint` font la même chose. Le build télécharge les polices Montserrat et Inter : il demande une connexion Internet. Next refuse `npm run start` sur un export statique ; pour voir `out/`, le servir avec un serveur de fichiers (`npx serve@latest out`, la commande que propose le message de Next ; non testée ici).

Les mesures (nombre de tests, pages, tailles) sont dans le tableau « Vérifications » du `README.md` à la racine du dépôt.

La documentation de la version de Next installée (16.2.1) est dans `node_modules/next/dist/docs/`, à la racine du dépôt. `AGENTS.md` (repris par `CLAUDE.md`) est une consigne pour les agents de code, conservée volontairement : lire cette documentation avant de coder, car cette version de Next a des changements incompatibles avec les précédentes.

## Organisation

- `src/app` : les pages (accueil, `simulateur/`, `opco/` et `opco/[slug]/`, `comprendre-les-opco/`, `obligations/`, `former-sans-budget/`, `contact/`, `mentions-legales/`), la page 404, `sitemap.ts` et `robots.ts`, ainsi que `layout.tsx` et `globals.css`, où vivent les jetons de design.
- `src/components` : `ui/` (primitives), `site/` (en-tête, pied de page, éléments des guides), `wizard/` (les six étapes du simulateur), `results/` (l'écran « Votre plan de financement »), `opco/` (fiches des OPCO).
- `src/hooks` : l'état du parcours (`useWizard`), la recherche d'entreprise (`useSirenLookup`) et la place réservée à la barre de navigation collante du simulateur.
- `src/lib` : les fonctions pures du site (étapes, saisie, calcul de l'écran de résultats, formats, métadonnées des pages, mentions légales), testées dans `tests/`.
- `public/` : `logo-sfg.png` et le `.htaccess` d'Apache, copiés tels quels dans `out/`.

## Mentions légales et nom de domaine

La page `/mentions-legales/` (liée depuis le pied de page) lit ses informations dans `src/lib/mentions.ts`. Tant qu'un champ vaut `null`, elle l'écrit « [à compléter : libellé] » et affiche en tête l'encadré « Page à compléter avant publication ». Les informations que seul l'éditeur peut fournir (capital, greffe, TVA, téléphone, directeur de la publication, hébergeur, base légale et durée de conservation des messages de contact, exercice des droits, délégué à la protection des données) sont encore vides : ne pas publier avant de les avoir remplies. Liste et marche à suivre : `docs/deploiement-site.md`, section 3.

L'adresse du site (`ADRESSE_DU_SITE`, `src/lib/metadonnees.ts`) fixe les adresses canoniques, les aperçus de partage, le plan du site et l'adresse du plan que `robots.txt` annonce : c'est la seule constante à changer avec le domaine. Elle vaut `https://www.financementopco.fr`, un domaine qui n'était pas enregistré le 08/10/2026 : le choix du domaine est à faire avant la publication (même section du guide).

## Lien avec @opco/core

Le moteur de calcul et les données (barèmes des OPCO, table IDCC, suggestions par code NAF, catalogue d'aides, portails régionaux) viennent de `@opco/core` (`packages/core`). Ils sont compilés dans le site au moment du build : une modification des données n'apparaît en ligne qu'après un nouveau build et un nouveau dépôt.

Au moment de l'usage, le navigateur n'appelle qu'une API, la recherche d'entreprise de l'État (`recherche-entreprises.api.gouv.fr`). Le site n'appelle jamais `api.francecompetences.fr`, dont la réutilisation demande une licence : il renvoie seulement, par un lien, vers l'outil officiel « Quel est mon OPCO ».

## Design

`DESIGN.md` décrit le système de design SFG : jetons de couleur, typographie, primitives, contrastes mesurés et interdits. `npm run check:charte` applique ces interdits (tiret cadratin, bleu, violet, police mono, émojis) au code de `src/`, et cherche tirets et émojis dans `tests/` et `DESIGN.md`. `npm run check:tirets` étend la recherche du tiret cadratin aux fichiers texte suivis du dépôt, hors données JSON de `datasets/` (instantanés publiés, immuables, qui en contiennent 19) et de `packages/core/data/` (contrôlées par un test du cœur) ; c'est aussi une étape de la CI (`.github/workflows/ci.yml`).

## Publier

Le dépôt sur Hostinger (page légale et nom de domaine à régler avant le build, archive, `.htaccess`, liste de contrôle, limites connues) est décrit dans `docs/deploiement-site.md`. Le workflow `.github/workflows/ci.yml` construit le site à chaque pull request et à chaque push sur `main`, et conserve `out/` comme artefact `site-hostinger`.
