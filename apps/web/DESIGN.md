# Guide de design du site financementOPCO

Le site est un service de SFG Développement : il porte sa charte graphique et éditoriale. Ce guide dit quelles
valeurs employer, avec quels composants, et ce qu'il ne faut jamais faire. Les jetons vivent dans
`src/app/globals.css`, les primitives dans `src/components/ui/` et `src/components/site/Logo.tsx`.

## 1. Charte et sources

- Charte SFG (skill `sfg-brand-guidelines`) : orange `#E84E1B`, turquoise `#5E9F92`, or `#F9B233`, rouge `#BC1723`,
  vert clair `#A3D1C8` ; Montserrat pour les titres, Inter pour le texte ; règles de rédaction (section 9).
- Langage visuel : animation de marque d'octobre 2026 (`CRM-SFG2/motion-sfg/sfg-en-mouvement.html`) : titres très
  serrés, surtitres majuscules espacés, étiquettes en pilule avec point de couleur, rails et jalons, aplats en dégradé
  radial, reflet qui balaie le logo.
- Logo : `public/logo-sfg.png` (426 x 224, copie conforme du fichier du CRM). Jamais redessiné, jamais recoloré.
- **Le bleu et le violet ne font plus partie de la charte.** La palette Tailwind par défaut est retirée
  (`--color-*: initial`) : un `bg-blue-500` ne produit aucune règle. Seules les couleurs ci-dessous existent.

## 2. Jetons de couleur

Chaque rapport est calculé par script (formule WCAG 2.x). Tableau complet en annexe.

| Classe Tailwind | Valeur | Rôle |
|---|---|---|
| `orange` | `#E84E1B` | Orange identité : aplats, graphismes, points. Jamais de texte blanc dessus (3,79:1). |
| `orange-deep` | `#C43F13` | **Action** : boutons pleins, liens, anneau de focus. Blanc dessus 5,16:1. |
| `orange-deeper` | `#A93510` | Survol des boutons pleins (blanc 6,55:1). |
| `orange-soft` | `#FDF0EA` | Fond doux orangé (orange-deep dessus 4,63:1). |
| `orange-clair` | `#F56A31` | Orange **sur fond sombre uniquement** (5,72:1 sur encre). |
| `turquoise` | `#5E9F92` | Identité : aplats, barres, points, graphismes. Pas de texte (3,07:1 sur blanc). |
| `turquoise-deep` | `#3E6860` | Texte, icônes et confirmations turquoise : 6,26:1 sur blanc, 5,34:1 sur lin. |
| `turquoise-soft` | `#EDF5F2` | Fond doux turquoise. |
| `or` | `#F9B233` | Mise en valeur ponctuelle, anneau de focus sur fond sombre. Jamais de texte sur blanc. |
| `or-soft` | `#FEF4DE` | Fond doux or. |
| `rouge` | `#BC1723` | Alertes (6,39:1 sur blanc). |
| `rouge-soft` | `#FBEDEE` | Fond des alertes. |
| `vert-clair` | `#A3D1C8` | Surlignage `.mark`, aplats doux, liens sur fond sombre. |
| `vert-clair-soft` | `#E6F2EF` | Fond très doux vert. |
| `encre` | `#0F1E1B` | Surfaces sombres (pied de page). |
| `nuit` | `#08110F` | Le plus sombre (réserve). |
| `papier` | `#FFFFFF` | Fond de page. |
| `lin` | `#E6EFEC` | Surface teintée, pilule de navigation active. |
| `lin-soft` | `#F3F7F6` | Bandes de section et cartes teintées. |
| `texte` | `#1A1A1A` | Texte principal (17,40:1). |
| `texte-doux` | `#44514E` | Texte secondaire : 8,29:1 sur blanc, 7,08:1 sur lin. |
| `texte-discret` | `#5F6E6A` | Libellés, légendes : 5,35:1 sur blanc, 4,95:1 sur lin-soft, 4,57:1 sur lin. |
| `filet` | `#D7E2DE` | Filets décoratifs (séparations, bord des cartes). |
| `filet-fort` | `#7A8C88` | Contour d'un élément d'interface (champ, bouton à contour) : 3,54:1 sur blanc. |

Règles qui en découlent :
- texte orange-deep sur blanc ou lin-soft, **jamais sur lin** (4,41:1) ;
- sur un dégradé, texte **blanc plein** : à 90 % d'opacité il tombe sous 4,5:1 sur le point le plus clair ;
- le turquoise, l'orange identité et l'or ne portent jamais de texte : on prend la variante `-deep` ou du texte foncé.

### Alias historiques

Les composants écrits avant cette charte (fiches, guides, simulateur, résultats, environ 5 000 lignes) gardent leurs
noms de classes ; ces noms pointent désormais vers les valeurs SFG. **Ne pas les employer dans un nouveau code** : ils
disparaîtront au fil des restylages (tâches W4, W5, D3).

| Alias | Devient | Remarque |
|---|---|---|
| `paper` | `papier` (blanc) | |
| `paper-deep` | `lin-soft` | aussi utilisé en `var(--paper-deep)` dans d'anciennes ombres |
| `ink` | `texte` (`#1A1A1A`) | `border-ink` est rendu en `filet-fort` (règle dédiée dans globals.css) |
| `ink-soft` | `texte-doux` | |
| `ink-faint` | `texte-discret` | |
| `cobalt` | `orange-deep` | texte, liens, boutons pleins |
| `cobalt-soft` | `orange-soft` | |
| `navy` | `encre` | une carte `bg-navy border-ink` garde un bord invisible |
| `marker` | `vert-clair` | aussi `var(--marker)` dans d'anciennes ombres |
| `marker-soft` | `vert-clair-soft` | |
| `valid` | `turquoise-deep` | |
| `valid-soft` | `turquoise-soft` | |
| `alert` | `rouge` | |
| `alert-soft` | `rouge-soft` | |
| `rule` | `filet` | |

## 3. Typographie

- **Montserrat** 700 (titres, chiffres clés) et 600 (sous-titres, nom de formation). Pas de 800 : les classes
  `font-extrabold` des pages anciennes s'affichent en 700, seul poids chargé au-dessus.
- **Inter** 400 (texte), 500 et 600 (libellés d'interface, boutons, étiquettes).
- Aucune autre famille : `font-mono` et `font-serif` sont retirés du thème, IBM Plex Mono n'est plus chargée.
- Les titres `h1` à `h4` prennent Montserrat par défaut, avec `text-wrap: balance` ; les paragraphes, `text-wrap: pretty`.

Échelle (tailles fluides, `clamp`) :

| Classe | Valeur | 375 px | 768 px | 1280 px | Emploi |
|---|---|---|---|---|---|
| `text-affiche` | `clamp(2.5rem, 1.55rem + 2.75vw, 3.75rem)`, interligne 1,04, interlettrage -0,035em | 40 | 46 | 60 | titre d'accueil |
| `text-titre` | `clamp(1.75rem, 1.25rem + 1.6vw, 2.5rem)`, interligne 1,1, interlettrage -0,025em | 28 | 32 | 40 | titre de section |
| `text-xl` / `text-2xl` | 20 / 24 px, interlettrage -0,02em | 20 | 24 | 24 | sous-section, titre de carte |
| `text-chapeau` | `clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)`, interligne 1,6 | 17 | 18 | 19 | chapeau sous un titre |
| `text-base` | 16 px, interligne 1,6 | | | | texte courant |
| `text-sm` | 14 px | | | | texte de carte, légendes |
| `text-xs` | 12 px | | | | étiquettes, surtitres, mentions |

Chiffres clés : classe `.amount` (Montserrat 700, chiffres tabulaires, interlettrage -0,01em). Un utilitaire
`font-semibold` posé à côté l'emporte (la classe est dans la couche `components`).

## 4. Formes, ombres, espacements

- Rayons : `rounded-carte` 20 px (cartes), `rounded-panneau` 28 px (aplats du hero), `rounded-champ` 12 px (champs),
  `rounded-full` (boutons, étiquettes, pilules de navigation). `rounded` seul vaut 12 px : les anciens composants
  s'arrondissent sans réécriture.
- Ombres teintées d'encre, jamais d'ombre dure décalée : `shadow-douce` (cartes), `shadow-flottante` (survol, carte
  posée sur un aplat), `shadow-etiquette` (ombre orangée des étiquettes flottantes, reprise de l'animation de marque).
- Filets : 1 px `filet` pour séparer ; `filet-fort` pour le contour d'un élément d'interface.
- Largeur : contenu dans `max-w-6xl` (1 152 px) avec `px-4 sm:px-6` (gouttière de 16 px sur mobile) ; texte courant
  limité à `max-w-2xl` ou `max-w-3xl` (65 à 75 caractères).
- Rythme vertical des sections : `py-16 md:py-20`. Alterner fond blanc et bande `bg-lin-soft` bordée de `border-filet/70`.
- Grilles : 1 colonne sous 640 px, 2 à partir de `sm`, 3 ou 4 à partir de `lg` / `xl`. Écart `gap-4` pour des cartes,
  `gap-8` à `gap-14` entre colonnes de texte.
- En-tête collant : 65 px sous 1 024 px, 122 px au-delà (variable `--hauteur-entete`, qui règle aussi le décalage des
  ancres). Un élément collant d'une page se place à `top: calc(var(--hauteur-entete) + 1.5rem)`.

## 5. Primitives

Toutes sont typées, sans dépendance, utilisables dans un composant serveur ; seul l'en-tête est un composant client.

### `Button` (`components/ui/Button.tsx`)

Pilule. Rend un `<button>` sans `href`, un lien Next pour une adresse interne, un `<a>` pour une adresse externe
(nouvel onglet annoncé « (nouvel onglet) » aux lecteurs d'écran) ou `mailto:`.

| Prop | Valeurs | Défaut |
|---|---|---|
| `variant` | `primary` (orange-deep plein, balayage au survol), `secondary` (contour turquoise-deep), `ghost` (lien d'action), `inverse` (pilule blanche sur surface colorée) | `primary` |
| `size` | `sm` 36 px (zones denses sur grand écran), `md` 44 px, `lg` 48 px | `md` |
| `fleche` | flèche après le libellé, qui glisse au survol | |
| `icone` | nom d'icône avant le libellé | |
| `pleineLargeur` | `true` ou `'mobile'` (pleine largeur sous 640 px) | |

```tsx
<Button href="/simulateur" size="lg" fleche pleineLargeur="mobile">Estimer mon financement</Button>
<Button href="/comprendre-les-opco" variant="secondary">D'abord comprendre</Button>
<Button onClick={calculer} disabled={!pret}>Calculer mon financement</Button>
<Button href="/simulateur" variant="inverse" fleche>Estimer mon financement</Button> {/* sur surface-orange */}
```

Une seule action `primary` par zone. Le libellé dit ce qui se passe (« Estimer mon financement », pas « Valider »).

### `Card` (`components/ui/Card.tsx`)

`tone` : `plain` (blanc, filet, ombre douce), `teintee` (lin-soft), `turquoise`, `orange`, `nuit` (dégradés à texte
blanc). `padding` : `none`, `sm`, `md`, `lg`. `as` : `div`, `article`, `section`, `aside`, `li`. Carte cliquable :
`interactive` et, dedans, un lien `lien-etendu` qui porte le titre :

```tsx
<Card as="li" interactive padding="none" className="group">
  <div className="p-5 pr-12">
    <h3><Link href="/opco/akto/" className="lien-etendu">AKTO</Link></h3>
    <p className="text-sm text-texte-discret">Services à forte intensité de main-d'œuvre</p>
  </div>
  <Icon name="fleche" className="absolute top-5 right-5 size-5 text-orange-deep" />
</Card>
```

### `Etiquette` (`components/ui/Etiquette.tsx`)

Pilule avec point de couleur : `tone` `neutre`, `orange`, `turquoise`, `or`, `rouge`, `vert-clair` ; `variante`
`douce` (fond teinté) ou `flottante` (pilule blanche à ombre orangée, posée sur un aplat) ; `surFondSombre` pour les
surfaces sombres. Le texte porte le sens, le point reste décoratif.

```tsx
<Etiquette tone="or">Exemple</Etiquette>
<Etiquette variante="flottante" tone="turquoise">Frais annexes</Etiquette>
```

Les étiquettes de fiabilité des montants restent `ConfidenceBadge` (classe `.stamp`, même dessin) : `exact` en
turquoise, `estimated` en rouge, `depends_on_branche` en neutre.

### `SectionTitle` (`components/ui/SectionTitle.tsx`)

Surtitre, titre, chapeau. `as` fixe le niveau (`h1`, `h2`, `h3`), `taille` le rôle visuel (`affiche`, `section`,
`sous-section`) : les deux sont indépendants. `id` pour un `aria-labelledby` de section.

```tsx
<section aria-labelledby="titre-etapes">
  <SectionTitle id="titre-etapes" surtitre="Comment ça marche" titre="De votre SIREN à votre plan de financement"
    chapeau="Comptez environ cinq minutes." />
</section>
```

### `Callout` (`components/ui/Callout.tsx`)

`tone` : `info`, `confirmation`, `avertissement`, `alerte`, avec `titre` facultatif. Un préfixe réservé aux lecteurs
d'écran annonce le ton (« Alerte : »). Contenu statique : pas de `role="alert"`.

```tsx
<Callout tone="avertissement" titre="Fonds épuisés pour votre branche">Vérifiez la source avant de déposer.</Callout>
```

### `Icon` (`components/ui/Icon.tsx`)

Grille 24 px, trait 1,75 px à bouts ronds, `currentColor`. Noms : `batiment`, `calculatrice`, `euro`, `repere`,
`bouclier`, `document`, `fleche`, `coche`, `info`, `alerte`, `lien-externe`, `menu`, `fermer`, `globe`, `personne`,
`mallette`, `courriel`, `chevron`. Décorative par défaut (`aria-hidden`) ; `titre` lui donne un nom quand elle porte
seule un sens. Taille par classe (`size-5` par défaut). Pas de bibliothèque d'icônes, pas d'émoji.

### `Logo` (`components/site/Logo.tsx`)

Logo SFG + filet + « financementOPCO » (OPCO en orange-deep, ou orange-clair avec `fond="sombre"`). `taille`
`compacte` (32 px, en-tête mobile) ou `normale` (40 px). Au survol du lien qui l'entoure, un reflet balaie le logo
(masque = le logo lui-même). Le fichier n'est jamais recoloré : ses couleurs restent lisibles sur l'encre (5,55:1 et 4,98:1).

### Classes signatures (`globals.css`)

| Classe | Rendu |
|---|---|
| `.surtitre` | Inter 600, 12 px, majuscules espacées 0,2em, turquoise-deep, point orange |
| `.marginalia` | même famille en texte-discret, 11 px : en-têtes de tableau, libellés de champ |
| `.amount` | chiffres clés Montserrat 700 tabulaires |
| `.stamp` | étiquette en pilule, point et bord dans la couleur du texte (`text-*`) |
| `.mark` | surlignage vert clair droit, derrière un mot ou un chiffre ; s'anime à l'affichage |
| `.rule-double` | filet de section teinté, ponctué d'un trait orange de 40 px |
| `.lien` | lien dans un texte : orange-deep souligné ; vert clair sur fond sombre, blanc sur dégradé |
| `.lien-etendu` | lien qui couvre sa carte (focus dessiné autour de la carte) |
| `.surface-turquoise`, `.surface-orange`, `.surface-nuit`, `.surface-encre` | surfaces sombres, texte clair, focus adapté |
| `.aplat-turquoise` | turquoise lumineux de la marque, **décor seul** (aucun texte posé dessus) |
| `.apparition` | apparition douce (délai par la variable `--delai`) |
| `.reflet` | balayage lumineux au survol (bouton primaire) |

Rail et jalons : voir la section « Comment ça marche » de `app/page.tsx` (rail de 4 à 6 px, jalons ronds turquoise-deep
cerclés de la couleur du fond). À reprendre pour la progression du simulateur.

## 6. Dégradés et icônes

- Les dégradés radiaux reprennent ceux de l'animation de marque. Ceux qui portent du texte sont décalés d'un cran vers
  le foncé pour que le blanc atteigne 4,5:1 partout : turquoise `#477A70 → #3E6860 → #335850`, orange
  `#D04415 → #C43F13 → #B03911`, nuit `#183530 → #0F1E1B → #0A1513`. Le turquoise lumineux
  `#70B2A5 → #5E9F92 → #4D8B7F` reste un décor.
- Un dégradé marque une zone d'accent courte : hero, bande d'appel à l'action, récapitulatif d'un résultat. Jamais
  derrière un long texte, jamais deux zones en dégradé côte à côte.
- Icônes dans une pastille `size-11 rounded-2xl` : `bg-turquoise-soft text-turquoise-deep` (identité),
  `bg-orange-soft text-orange-deep` pour l'élément qui ouvre une suite d'actions.

## 7. Mouvement, accessibilité, impression

- Mouvement sobre : apparition douce au chargement (0,6 s), surlignage qui se déploie, balayage au survol du bouton
  primaire et du logo, flèche qui glisse. Sous `prefers-reduced-motion: reduce`, tout s'arrête (état final immédiat).
- Focus visible partout : anneau de 3 px décalé de 2 px, orange-deep sur fond clair, or sur encre et nuit, blanc sur
  les dégradés turquoise et orange (`--focus` par surface). Ne jamais retirer `outline` sans le remplacer.
- Cibles tactiles d'au moins 44 px sous 1 024 px (boutons `md`, liens du menu 48 px, liens du pied de page 44 px).
- Hiérarchie : un seul `h1` par page ; `SectionTitle` avec `id` et `aria-labelledby` sur la section.
- Lien d'évitement « Aller au contenu » en tête de page (cible `#contenu`).
- Impression : en-tête et pied masqués, surfaces en dégradé rendues sur fond blanc en texte foncé, décors (`.decor`)
  retirés.

## 8. En-tête et pied de page

- En-tête (`components/site/SiteHeader.tsx`) : blanc, collant, filet fin. Grand écran : logo et bouton principal, puis
  la navigation sur une seconde ligne (pilule lin et point orange sur la page active, `aria-current="page"`). Petit
  écran : bouton « Menu » (`aria-expanded`, `aria-controls`), fermeture par Échap, par un clic hors du menu ou sur un
  lien, focus rendu au bouton. Le bouton principal s'efface sur la page du simulateur.
- Pied de page (`components/site/SiteFooter.tsx`) : surface encre, filet tricolore turquoise / or / orange (les trois
  soulignés du slogan de marque), logo en version claire, liens, date des critères dérivée des données des OPCO.

## 9. Rédaction SFG (tout texte visible)

- Jamais de tiret cadratin : virgule, parenthèses, deux points, point-virgule ou deux phrases.
- Pas d'émoji. Les signes typographiques déjà présents (coche, flèche) sont tolérés ; pour du nouveau travail, `Icon`.
- Ton de collègue expert de la formation : phrases de longueur variée, vocabulaire concret, position claire.
- À proscrire : « il est important de noter que », « de plus », « n'hésitez pas à », « dans le monde d'aujourd'hui »,
  les questions rhétoriques d'ouverture, les triades répétées, le plan « d'un côté… de l'autre », les résumés
  automatiques, les adverbes d'intensité, le gras et les titres à profusion.
- Apostrophes droites dans le code (`'`, `&apos;` en JSX), accents complets, espaces insécables avant « : ; ? ! » quand
  le rendu le demande.
- Aucune affirmation nouvelle : un chiffre affiché vient des données (`@opco/core`) ou d'une source citée. Un exemple
  est étiqueté « Exemple » et ses montants dits fictifs.

## 10. À ne pas faire

- Du bleu ou du violet, sous quelque forme que ce soit (classe, hexadécimal, `rgb()`, `hsl()`).
- Une police mono ou une autre famille que Montserrat et Inter.
- Du texte blanc sur l'orange identité, le turquoise de marque ou l'or ; du texte en opacité sur un dégradé.
- Une ombre dure décalée (`shadow-[4px_4px_0_0_...]`), un filet noir, un tampon incliné.
- Une classe d'affichage (`hidden`, `lg:inline-flex`) passée à un composant qui fixe déjà son `display` : régler la
  visibilité sur un élément enveloppe.
- Recolorer, déformer ou redessiner le logo.
- Les alias historiques (`cobalt`, `ink`, `paper`…) dans un nouveau code.

## 11. Liste de contrôle d'un nouvel écran

1. Les couleurs viennent des jetons SFG, pas des alias ni de valeurs écrites en dur.
2. Chaque couple texte / fond nouveau est ajouté au tableau des contrastes et atteint 4,5:1 (3:1 pour un grand texte
   ou un contour d'élément d'interface).
3. Titres : un `h1`, des `SectionTitle` ; Montserrat 700 ; chapeau en `text-chapeau text-texte-doux`.
4. Actions : une `Button primary` par zone, libellé qui dit le résultat ; liens internes avec `/` final.
5. Rendu vérifié à 375, 768 et 1 280 px : une colonne et boutons pleine largeur sur mobile, aucun débordement
   horizontal (`document.documentElement.scrollWidth` égal à la largeur de la fenêtre).
6. Navigation au clavier : ordre logique, focus visible sur chaque élément, menus fermables par Échap.
7. Mouvement coupé sous `prefers-reduced-motion`, impression lisible.
8. Textes relus selon la section 9 ; `npm run check:charte` au vert.

## 12. Garde de charte

`npm run check:charte` (script `scripts/check-charte-sfg.mjs`, Node seul) parcourt `apps/web/src/**/*.{ts,tsx,css}` et
signale, avec fichier, ligne et colonne : le tiret cadratin, les classes et couleurs bleues ou violettes (teinte de 190
à 320 degrés), `font-mono` et IBM Plex, les émojis (U+1F000 à U+1FAFF). Code de sortie 1 en cas de problème.
`node scripts/check-charte-sfg.mjs --self-test` vérifie le garde lui-même sur des cas fautifs et propres.

## Annexe : tableau des contrastes

Généré par script à partir des valeurs des jetons (formule WCAG 2.x, opacités mélangées au fond comme le fait le
navigateur ; pour un dégradé, chaque point est vérifié). Seuils : 4,5:1 pour le texte, 3:1 pour un grand texte, un
contour d'élément d'interface, une icône porteuse de sens ou un anneau de focus. Les lignes « repère » ne sont pas des
emplois : elles expliquent une règle.

| Texte | Fond | Emploi | Rapport | Seuil | Verdict |
|---|---|---|---|---|---|
| `#1A1A1A` | `#FFFFFF` | texte sur blanc | 17,40:1 | 4,50:1 | conforme |
| `#44514E` | `#FFFFFF` | texte-doux (ink-soft) sur blanc | 8,29:1 | 7,00:1 | conforme |
| `#5F6E6A` | `#FFFFFF` | texte-discret (ink-faint, .marginalia) sur blanc | 5,35:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#F3F7F6` | texte sur lin-soft | 16,12:1 | 4,50:1 | conforme |
| `#44514E` | `#F3F7F6` | texte-doux (ink-soft) sur lin-soft | 7,68:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#F3F7F6` | texte-discret (ink-faint, .marginalia) sur lin-soft | 4,95:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#E6EFEC` | texte sur lin | 14,85:1 | 4,50:1 | conforme |
| `#44514E` | `#E6EFEC` | texte-doux (ink-soft) sur lin | 7,08:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#E6EFEC` | texte-discret (ink-faint, .marginalia) sur lin | 4,57:1 | 4,50:1 | conforme |
| `#C43F13` | `#FFFFFF` | liens, bouton ghost, OPCO du logo (orange-deep, cobalt) sur blanc | 5,16:1 | 4,50:1 | conforme |
| `#C43F13` | `#F3F7F6` | lien orange-deep sur lin-soft | 4,78:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#C43F13` | Button primary : blanc sur orange-deep | 5,16:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#A93510` | Button primary au survol : blanc sur orange-deeper | 6,55:1 | 4,50:1 | conforme |
| `#C43F13` | `#FDF0EA` | Étiquette orange, Button inverse au survol, CumulBadge additif | 4,63:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#E84E1B` | repère : blanc sur orange identité (interdit pour du texte) | 3,79:1 | - | repère |
| `#1A1A1A` | `#E84E1B` | repère : #1A1A1A sur orange identité | 4,59:1 | - | repère |
| `#3E6860` | `#FFFFFF` | Button secondary, .surtitre, icônes (turquoise-deep, valid) sur blanc | 6,26:1 | 4,50:1 | conforme |
| `#3E6860` | `#F3F7F6` | .surtitre sur bande lin-soft | 5,80:1 | 4,50:1 | conforme |
| `#3E6860` | `#E6EFEC` | turquoise-deep sur lin | 5,34:1 | 4,50:1 | conforme |
| `#3E6860` | `#EDF5F2` | Étiquette turquoise, ConfidenceBadge exact, survol secondary | 5,65:1 | 4,50:1 | conforme |
| `#3E6860` | `#E6F2EF` | marginalia !text-valid sur marker-soft (contact) | 5,46:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#3E6860` | CertitudeBadge confirmé, pastille Callout info / confirmation | 6,26:1 | 4,50:1 | conforme |
| `#5E9F92` | `#FFFFFF` | repère : turquoise de marque sur blanc (graphismes seulement) | 3,07:1 | - | repère |
| `#BC1723` | `#FFFFFF` | rouge (alert) sur blanc | 6,39:1 | 4,50:1 | conforme |
| `#BC1723` | `#FBEDEE` | Étiquette rouge, ConfidenceBadge estimé, titre AlertesOpco | 5,62:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#BC1723` | pastille Callout alerte (glyphe blanc) | 6,39:1 | 3,00:1 | conforme |
| `#1A1A1A` | `#FEF4DE` | Étiquette or (texte sur or-soft), titre Callout avertissement | 15,92:1 | 4,50:1 | conforme |
| `#0F1E1B` | `#F9B233` | pastille Callout avertissement (glyphe encre sur or) | 9,37:1 | 3,00:1 | conforme |
| `#1A1A1A` | `#A3D1C8` | .mark : texte sur surlignage vert clair | 10,37:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#E6F2EF` | Étiquette vert-clair | 15,18:1 | 4,50:1 | conforme |
| `#44514E` | `#F3F7F6` | corps de Callout : texte-doux sur lin-soft (info) | 7,68:1 | 4,50:1 | conforme |
| `#44514E` | `#EDF5F2` | corps de Callout : texte-doux sur turquoise-soft (confirmation) | 7,48:1 | 4,50:1 | conforme |
| `#44514E` | `#FEF4DE` | corps de Callout : texte-doux sur or-soft (avertissement) | 7,58:1 | 4,50:1 | conforme |
| `#44514E` | `#FBEDEE` | corps de Callout : texte-doux sur rouge-soft (alerte) | 7,28:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#477A70` | Card turquoise, tuile « Vous ne connaissez pas votre OPCO » : blanc sur #477A70 | 4,90:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#3E6860` | Card turquoise, tuile « Vous ne connaissez pas votre OPCO » : blanc sur #3E6860 | 6,26:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#335850` | Card turquoise, tuile « Vous ne connaissez pas votre OPCO » : blanc sur #335850 | 7,92:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#D04415` | bande d'appel orange : blanc sur #D04415 | 4,65:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#C43F13` | bande d'appel orange : blanc sur #C43F13 | 5,16:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#B03911` | bande d'appel orange : blanc sur #B03911 | 6,11:1 | 4,50:1 | conforme |
| `#EDF2F1` | `#477A70` | repère : blanc à 90 % sur le turquoise le plus clair (proscrit) | 4,33:1 | - | repère |
| `#FAECE8` | `#D04415` | repère : blanc à 90 % sur l'orange le plus clair (proscrit) | 4,03:1 | - | repère |
| `#C43F13` | `#FFFFFF` | Button inverse sur la bande (texte orange-deep sur blanc) | 5,16:1 | 4,50:1 | conforme |
| `#F2F6F5` | `#183530` | Card nuit : #F2F6F5 sur #183530 | 12,12:1 | 4,50:1 | conforme |
| `#A3D1C8` | `#183530` | Card nuit : surtitre et liens vert clair sur #183530 | 7,87:1 | 4,50:1 | conforme |
| `#F2F6F5` | `#0F1E1B` | Card nuit : #F2F6F5 sur #0F1E1B | 15,78:1 | 4,50:1 | conforme |
| `#A3D1C8` | `#0F1E1B` | Card nuit : surtitre et liens vert clair sur #0F1E1B | 10,24:1 | 4,50:1 | conforme |
| `#F2F6F5` | `#0A1513` | Card nuit : #F2F6F5 sur #0A1513 | 17,07:1 | 4,50:1 | conforme |
| `#A3D1C8` | `#0A1513` | Card nuit : surtitre et liens vert clair sur #0A1513 | 11,08:1 | 4,50:1 | conforme |
| `#C3C7C6` | `#0F1E1B` | pied de page : phrase de présentation blanc 75 % | 10,07:1 | 4,50:1 | conforme |
| `#CFD2D1` | `#0F1E1B` | pied de page : liens blanc 80 %, date des critères | 11,29:1 | 4,50:1 | conforme |
| `#ABB0AF` | `#0F1E1B` | pied de page : mention légale blanc 65 % | 7,82:1 | 4,50:1 | conforme |
| `#A3D1C8` | `#0F1E1B` | pied de page : surtitres et lien e-mail vert clair | 10,24:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#0F1E1B` | pied de page : nom du service (financement) en blanc | 17,19:1 | 4,50:1 | conforme |
| `#F56A31` | `#0F1E1B` | pied de page : OPCO du nom du service en orange-clair | 5,72:1 | 4,50:1 | conforme |
| `#5E9E91` | `#0F1E1B` | logo (fichier non recoloré) : turquoise sur encre | 5,55:1 | 3,00:1 | conforme |
| `#DB6848` | `#0F1E1B` | logo (fichier non recoloré) : orange sur encre | 4,98:1 | 3,00:1 | conforme |
| `#1A1A1A` | `#E6EFEC` | navigation : élément actif (pilule lin) | 14,85:1 | 4,50:1 | conforme |
| `#44514E` | `#FFFFFF` | navigation : éléments inactifs | 8,29:1 | 4,50:1 | conforme |
| `#7A8C88` | `#FFFFFF` | filet-fort : contour d'élément d'interface, border-ink historique | 3,54:1 | 3,00:1 | conforme |
| `#C43F13` | `#FFFFFF` | anneau de focus orange-deep sur blanc | 5,16:1 | 3,00:1 | conforme |
| `#C43F13` | `#E6EFEC` | anneau de focus orange-deep sur lin | 4,41:1 | 3,00:1 | conforme |
| `#F9B233` | `#0F1E1B` | anneau de focus or sur encre (pied, Card nuit) | 9,37:1 | 3,00:1 | conforme |
| `#FFFFFF` | `#C43F13` | anneau de focus blanc sur bande orange | 5,16:1 | 3,00:1 | conforme |
| `#FFFFFF` | `#477A70` | anneau de focus blanc sur Card turquoise | 4,90:1 | 3,00:1 | conforme |
| `#3E6860` | `#FFFFFF` | contour du Button secondary | 6,26:1 | 3,00:1 | conforme |
| `#44514E` | `#FBEDEE` | AlertesOpco : texte ink-soft sur alert-soft | 7,28:1 | 4,50:1 | conforme |
| `#C43F13` | `#FBEDEE` | AlertesOpco : lien « Voir la source » cobalt sur alert-soft | 4,54:1 | 4,50:1 | conforme |
| `#44514E` | `#E6F2EF` | StepIdentification, contact : ink-soft sur marker-soft | 7,23:1 | 4,50:1 | conforme |
| `#0F1E1B` | `#FDF0EA` | choix sélectionné, Callout info des guides : navy sur cobalt-soft | 15,41:1 | 4,50:1 | conforme |
| `#273330` | `#FDF0EA` | Callout info des guides : navy à 90 % sur cobalt-soft | 11,75:1 | 4,50:1 | conforme |
| `#50766F` | `#EDF5F2` | Callout ok des guides : valid à 90 % sur valid-soft | 4,55:1 | 4,50:1 | conforme |
| `#C22C37` | `#FBEDEE` | Callout warn des guides : alert à 90 % sur alert-soft | 4,97:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#1A1A1A` | ProgressBar étape passée : paper sur ink | 17,40:1 | 4,50:1 | conforme |
| `#9FA5A4` | `#0F1E1B` | FundingBreakdown : paper 60 % sur navy | 6,87:1 | 4,50:1 | conforme |
| `#B7BCBB` | `#0F1E1B` | FundingBreakdown : paper 70 % sur navy | 8,94:1 | 4,50:1 | conforme |
| `#C3C7C6` | `#0F1E1B` | FundingBreakdown : paper 75 % sur navy | 10,07:1 | 4,50:1 | conforme |
| `#CFD2D1` | `#0F1E1B` | FundingBreakdown : paper 80 % sur navy | 11,29:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#A3D1C8` | CertitudeBadge à confirmer, ProgressBar étape en cours : ink sur marker | 10,37:1 | 4,50:1 | conforme |

79 couples, aucun sous son seuil.
