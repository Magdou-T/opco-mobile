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
| `turquoise` | `#5E9F92` | Identité, partout où un contraste non textuel suffit : aplats, rails, jalons (numéro #1A1A1A, 5,68:1), points, contour du bouton secondaire (3,07:1 sur blanc). Pas de texte. |
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
- le turquoise, l'orange identité et l'or ne portent jamais de texte : on prend la variante `-deep` ou du texte foncé ;
- le turquoise de marque se montre : dès qu'un élément non textuel n'exige que 3:1 (contour, jalon, rail, point), il
  prend `turquoise`, pas `turquoise-deep` ; le turquoise foncé reste au texte et aux icônes porteuses de sens.

### Alias historiques

Les composants écrits avant cette charte gardaient leurs noms de classes, qui pointent vers les valeurs SFG. **Ne pas
les employer dans un nouveau code.** Depuis D3, plus aucun fichier de `apps/web/src` n'emploie ces alias de couleur (ni
`border-ink`, dont la règle est retirée) ; leurs définitions restent dans `globals.css` jusqu'à leur suppression (dette,
section 13).

| Alias | Devient | Remarque |
|---|---|---|
| `paper` | `papier` (blanc) | |
| `paper-deep` | `lin-soft` | |
| `ink` | `texte` (`#1A1A1A`) | la règle `border-ink` (rendue en `filet-fort`) est retirée depuis D3 |
| `ink-soft` | `texte-doux` | |
| `ink-faint` | `texte-discret` | |
| `cobalt` | `orange-deep` | texte, liens, boutons pleins |
| `cobalt-soft` | `orange-soft` | |
| `navy` | `encre` | |
| `marker` | `vert-clair` | |
| `marker-soft` | `vert-clair-soft` | |
| `valid` | `turquoise-deep` | |
| `valid-soft` | `turquoise-soft` | |
| `alert` | `rouge` | |
| `alert-soft` | `rouge-soft` | |
| `rule` | `filet` | |

## 3. Typographie

- **Montserrat** 700 (titres, chiffres clés) et 600 (sous-titres, nom de formation). Pas de 800 : les classes
  `font-extrabold` des pages anciennes s'affichent en 700, seul poids chargé au-dessus.
- **Inter** 400 (texte), 500 et 600 (libellés d'interface, boutons, étiquettes). Le gras d'Inter (`<strong>`,
  `font-bold` sur du texte courant) s'affiche avec la graisse 600, la plus forte chargée : il n'y a pas d'Inter 700.
- Aucune autre famille : `font-mono` et `font-serif` sont retirés du thème, IBM Plex Mono n'est plus chargée. Les balises
  `<code>`, `<pre>`, `<kbd>` et `<samp>` prendraient la police mono du navigateur : ne pas les employer.
- Les titres `h1` à `h4` prennent Montserrat par défaut, avec `text-wrap: balance` ; les paragraphes, `text-wrap: pretty`.

Échelle (tailles fluides, `clamp`) :

| Classe | Valeur | 375 px | 768 px | 1280 px | Emploi |
|---|---|---|---|---|---|
| `text-affiche` | `clamp(2.25rem, max(min(0.796rem + 7.27vw, 2.5rem), 1.55rem + 2.75vw), 3.75rem)`, interligne 1,04, interlettrage -0,035em ; 36 px à 320 px, pour que le mot surligné (insécable) tienne | 40 | 46 | 60 | titre d'accueil |
| `text-titre` | `clamp(1.75rem, 1.25rem + 1.6vw, 2.5rem)`, interligne 1,1, interlettrage -0,025em | 28 | 32 | 40 | titre de section |
| `text-xl` / `text-2xl` | 20 / 24 px (l'interlettrage -0,02em vient de `SectionTitle taille="sous-section"`, pas de l'utilitaire) | 20 | 24 | 24 | sous-section, titre de carte |
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
- En-tête collant : une seule ligne collante, 65 px sous 1 024 px et 73 px au-delà, filet compris (variable
  `--hauteur-entete`, qui règle aussi le décalage des ancres) ; de 1 024 à 1 279 px, la seconde ligne de navigation
  défile avec la page et ne compte pas. Un élément collant d'une page se place à
  `top: calc(var(--hauteur-entete) + 1.5rem)` (classe `.sommaire-collant`).

## 5. Primitives

Toutes sont typées, sans dépendance, utilisables dans un composant serveur. Pour assembler des classes, `cx` de
`@/lib/cx` (une seule copie, à importer plutôt qu'à recopier).

### `Button` (`components/ui/Button.tsx`)

Pilule. Rend un `<button>` sans `href`, un lien Next pour une adresse interne, un `<a>` pour une adresse externe
(nouvel onglet annoncé « (nouvel onglet) » aux lecteurs d'écran) ou `mailto:`.

| Prop | Valeurs | Défaut |
|---|---|---|
| `variant` | `primary` (orange-deep plein, balayage au survol), `secondary` (contour 2 px turquoise de marque, libellé turquoise-deep, contour foncé au survol ; à poser sur blanc : sur lin-soft le contour tombe à 2,84:1, le libellé suffit alors à identifier le bouton), `ghost` (lien d'action), `inverse` (pilule blanche sur surface colorée) | `primary` |
| `size` | `sm` 36 px (zones denses sur grand écran), `md` 44 px, `lg` 48 px | `md` |
| `fleche` | flèche après le libellé, qui glisse au survol | |
| `icone` | nom d'icône avant le libellé | |
| `pleineLargeur` | `true` ou `'mobile'` (pleine largeur sous 640 px) | |

```tsx
<Button href="/simulateur" size="lg" fleche pleineLargeur="mobile">Estimer mon financement</Button>
<Button href="/comprendre-les-opco" variant="secondary">D'abord comprendre</Button>
<Button size="lg" fleche onClick={calculate}>Trouver mes financements</Button>
<Button href="/simulateur" variant="inverse" fleche>Estimer mon financement</Button> {/* sur surface-orange */}
```

Une seule action `primary` par zone. Le libellé dit ce qui se passe (« Estimer mon financement », pas « Valider »).

### `Card` (`components/ui/Card.tsx`)

`tone` : `plain` (blanc, filet, ombre douce), `teintee` (lin-soft), `turquoise`, `orange`, `nuit` (dégradés à texte
blanc). `padding` : `none`, `sm`, `md`, `lg`. `as` : `div`, `article`, `section`, `aside`, `li`. Carte cliquable :
`interactive` et, dedans, un lien `lien-etendu` qui porte le titre. L'anneau de focus entoure une carte claire
(orange foncé, décalé de 2 px) ; dans une carte en dégradé, il se dessine à 3 px à l'intérieur du bord, sur le dégradé,
là où la couleur de focus de la surface est lisible (dehors, un anneau blanc tombait sur le fond de la section). Une
carte claire remet `--focus` à l'orange foncé, même posée sur une surface sombre :

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
surfaces sombres (fond encre à 25 %, texte blanc : 6,70:1 au moins sur le point le plus clair de chaque dégradé) ;
`as` : `span` (défaut) ou `li` ; `style` pour un délai d'apparition (`--delai`). Le texte porte le sens, le point reste
décoratif.

```tsx
<Etiquette tone="or">Exemple</Etiquette>
<Etiquette variante="flottante" tone="turquoise">Frais annexes</Etiquette>
```

Les étiquettes de fiabilité des montants restent `ConfidenceBadge` (classe `.stamp`, même dessin) : `exact` en
turquoise, `estimated` en rouge, `depends_on_branche` en neutre.

### `SectionTitle` (`components/ui/SectionTitle.tsx`)

Surtitre, titre, chapeau. `as` fixe le niveau (`h1`, `h2`, `h3`), `taille` le rôle visuel (`affiche`, `section`,
`sous-section`) : les deux sont indépendants. `id` pour un `aria-labelledby` de section. `align` : `start` (défaut) ou
`center`. `surFondSombre` : chapeau en blanc plein sur une surface sombre. `titreFocusable` : le titre reçoit le focus
par programme (`tabIndex={-1}`), par exemple à chaque étape du simulateur.

```tsx
<section aria-labelledby="titre-etapes">
  <SectionTitle id="titre-etapes" surtitre="Comment ça marche" titre="De votre SIREN à votre plan de financement"
    chapeau="Comptez environ cinq minutes." />
</section>
```

### `Callout` (`components/ui/Callout.tsx`)

`tone` : `info`, `confirmation`, `avertissement`, `alerte`, avec `titre` facultatif. `icone` remplace l'icône du ton ;
`as` : `div` (défaut) ou `aside`. Un préfixe réservé aux lecteurs d'écran annonce le ton (« Alerte : »). Contenu
statique : pas de `role="alert"`.

```tsx
<Callout tone="avertissement" titre="Fonds épuisés pour votre branche">Vérifiez la source avant de déposer.</Callout>
```

### `Icon` (`components/ui/Icon.tsx`)

Grille 24 px, trait 1,75 px à bouts ronds, `currentColor`. Noms : `batiment`, `calculatrice`, `euro`, `repere`,
`bouclier`, `document`, `fleche`, `coche`, `info`, `alerte`, `lien-externe`, `menu`, `fermer`, `globe`, `personne`,
`mallette`, `courriel`, `chevron`, `loupe`, `retour`, `crayon`, `livre`, `diplome`, `recrutement`, `virage`, `train`,
`lit`, `couverts`. Décorative par défaut (`aria-hidden`) ; `titre` lui donne un nom quand elle porte
seule un sens. Taille par classe (`size-5` par défaut). Pas de bibliothèque d'icônes, pas d'émoji.

### `Logo` (`components/site/Logo.tsx`)

Logo SFG + filet + « financementOPCO » (OPCO en orange-deep, ou orange-clair avec `fond="sombre"`). `taille`
`compacte` (36 px, en-tête sous 1 024 px ; le nom se resserre avec la largeur sous 366 px pour tenir à côté du bouton
Menu) ou `normale` (40 px). Un simple `<img>` aux dimensions explicites (l'export ne transforme pas les images :
`next/image` n'ajouterait que son code client). Au survol du lien qui l'entoure, un reflet balaie le logo (masque = le
logo lui-même). Le fichier n'est jamais recoloré : ses couleurs restent lisibles sur l'encre (5,55:1 et 4,98:1).

### `Sommaire` (`components/site/Sommaire.tsx`)

Sommaire d'une page longue (fiches OPCO, guides), composant client : `entrees` (`id` de la section visée, `libelle`,
`compte` facultatif en pastille rouge), `etiquette` (nom de la navigation), `numerote` (« 01 », « 02 » des guides).
Sous 1 024 px, bloc replié `<details>` en tête du contenu (cibles de 44 px) ; à partir de 1 024 px, colonne
`.sommaire-collant` où la section à l'écran est signalée (pilule lin, point orange, `aria-current="location"`). Les
liens suivent l'ancre de façon native (sans JavaScript aussi) ; avec lui, le bloc se referme avant le défilement et le
focus passe au titre de la section. Section 16.

### `TitreDeSection` (`components/site/TitreDeSection.tsx`)

Titre `h2` des pages de contenu (fiches, guides) : Montserrat 700 de 28 à 32 px, focalisable par programme (le sommaire
y pose le focus), chapeau facultatif ; la section porte au-dessus son filet `.rule-double`. Plus mesuré que
`SectionTitle` en taille `section` (40 px à 1 280 px), qui reste celui de l'accueil.

### `BandeAppel` (`components/site/BandeAppel.tsx`)

Bande d'appel à l'action de fin de page, sur toute la largeur : `surface-orange`, rail et jalons décoratifs à partir de
768 px, `h2` (`id` relié par `aria-labelledby`), phrase facultative en blanc plein, `Button` inverse. Une par page :
l'accueil (« Cinq minutes pour chiffrer votre projet ») et chaque guide.

```tsx
<BandeAppel id="titre-appel" titre="Cinq minutes pour chiffrer votre projet" libelle="Trouver mes financements" />
```

### Classes signatures (`globals.css`)

| Classe | Rendu |
|---|---|
| `.surtitre` | Inter 600, 12 px, majuscules espacées 0,2em, turquoise-deep, point orange |
| `.marginalia` | même famille en texte-discret, 11 px : classe héritée, encore employée par le parcours du simulateur ; les pages de D3 et l'accueil écrivent les utilitaires (`text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase`) |
| `.amount` | chiffres clés Montserrat 700 tabulaires |
| `.stamp` | étiquette en pilule, point et bord dans la couleur du texte (`text-*`) |
| `.mark` | trait vert clair arrondi posé sur la ligne de base, sous un mot ou un chiffre (le souligné du film de marque) ; se déploie à l'affichage ; aplat plein et texte foncé sur une surface sombre ; souligné de texte à l'impression |
| `.rule-double` | filet de section teinté, ponctué d'un trait orange de 40 px |
| `.lien` | lien dans un texte : orange-deep souligné ; vert clair sur fond sombre, blanc sur dégradé |
| `.lien-etendu` | lien qui couvre sa carte (focus autour d'une carte claire, à l'intérieur d'une carte en dégradé) |
| `.sommaire-collant` | sommaire collant sous l'en-tête (`top` : hauteur de l'en-tête + 1,5 rem) |
| `.surface-turquoise`, `.surface-orange`, `.surface-nuit`, `.surface-encre` | surfaces sombres, texte clair, focus adapté |
| `.aplat-turquoise` | turquoise lumineux de la marque, **décor seul** (aucun texte posé dessus) |
| `.apparition` | apparition douce (délai par la variable `--delai`) |
| `.devoilement` | la barre empilée de l'écran de résultats se dévoile de gauche à droite (`clip-path`, bouts arrondis intacts) |
| `.reflet` | balayage lumineux au survol (bouton primaire) |

Rail et jalons : voir la section « Comment ça marche » de `app/page.tsx` (rail de 4 à 6 px au turquoise de marque,
jalons ronds turquoise à numéro #1A1A1A, cerclés de la couleur du fond). La progression du simulateur le reprend
(section 14).

## 6. Dégradés et icônes

- Les dégradés radiaux reprennent ceux de l'animation de marque. Ceux qui portent du texte sont décalés d'un cran vers
  le foncé pour que le blanc atteigne 4,5:1 partout : turquoise `#477A70 → #3E6860 → #335850`, orange
  `#D04415 → #C43F13 → #B03911`, nuit `#183530 → #0F1E1B → #0A1513`. Le turquoise lumineux
  `#70B2A5 → #5E9F92 → #4D8B7F` reste un décor.
- Un dégradé marque une zone d'accent courte : hero, bande d'appel à l'action, récapitulatif d'un résultat. Jamais
  derrière un long texte, jamais deux zones en dégradé côte à côte (ni à moins d'un écran l'une de l'autre : la tuile
  « Vous ne connaissez pas votre OPCO » qui précède la bande orange de l'accueil est teintée, flèche orange).
- Icônes dans une pastille `size-11 rounded-2xl` : `bg-turquoise-soft text-turquoise-deep` (identité),
  `bg-orange-soft text-orange-deep` pour l'élément qui ouvre une suite d'actions.

## 7. Mouvement, accessibilité, impression

- Mouvement sobre : apparition douce au chargement (0,6 s), surlignage qui se déploie, balayage au survol du bouton
  primaire et du logo, flèche qui glisse. Sous `prefers-reduced-motion: reduce`, tout s'arrête (état final immédiat).
- Focus visible partout : anneau de 3 px décalé de 2 px, orange-deep sur fond clair, or sur encre et nuit, blanc sur
  les dégradés turquoise et orange (`--focus` par surface). L'anneau est mesuré contre le fond **sur lequel il se
  dessine** : autour d'un bouton posé sur la bande orange, c'est la bande ; autour d'une carte en dégradé, ce serait le
  fond de la section (blanc sur lin-soft : 1,08:1), d'où l'anneau dessiné à l'intérieur de ces cartes. Ne jamais
  retirer `outline` sans le remplacer, et ne pas mettre `transition-colors` sur un élément focalisable (l'utilitaire
  anime aussi `outline-color` : l'anneau glisse depuis la couleur du texte) ; écrire la liste,
  `transition-[color,background-color,border-color]`.
- Contrôles natifs : `accent-color` orange-deep sur `:root` (cases, boutons radio, curseurs : jamais le bleu du
  navigateur) ; texte d'exemple des champs en texte-discret (5,35:1) ; champ prérempli par le navigateur recouvert de
  vert-clair-soft (le bleu clair de Chrome disparaît), texte #1A1A1A ; la règle est dans la couche `utilities` et plus
  spécifique qu'un anneau `focus:ring-*` (une ombre) posé sur le champ, qui ne fait donc pas revenir le bleu ; le focus
  reste montré par l'anneau `outline`.
- Cibles tactiles d'au moins 44 px sous 1 024 px (boutons `md`, liens du menu 48 px, liens du pied de page 44 px).
- Hiérarchie : un seul `h1` par page ; `SectionTitle` avec `id` et `aria-labelledby` sur la section.
- Lien d'évitement « Aller au contenu » en tête de page (cible `#contenu`).
- Impression : en-tête et pied masqués, surfaces en dégradé rendues sur fond blanc en texte foncé, décors (`.decor`)
  retirés, cartes sans ombre (`shadow-douce`, `shadow-flottante`, `shadow-etiquette`), animations d'apparition coupées,
  anneau de focus non imprimé. Un graphique qui porte une couleur utile (barre empilée et pastilles de l'écran de
  résultats) garde ses fonds par `[print-color-adjust:exact]` ; le reste suit le réglage du navigateur.

## 8. En-tête et pied de page

- En-tête (`components/site/SiteHeader.tsx`, composant serveur) : blanc, collant, filet fin. Seules la page active et
  le menu mobile s'exécutent dans le navigateur (`NavigationClient.tsx` : `LiensNavigation`, `HorsDuSimulateur`,
  `MenuMobile`) ; le logo, les icônes et le bouton sont rendus par le serveur et passés tout faits.
  - À partir de 1 280 px : **une seule ligne** de 72 px : logo, navigation (libellés courts de 14 px : Simulateur,
    Comprendre les OPCO, Obligations, Former sans budget, Les 11 OPCO, Contact), bouton principal. Le conteneur passe à
    `max-w-7xl` : la ligne demande environ 1 200 px, et 1 217 px restent à 1 280 px avec une barre de défilement.
  - De 1 024 à 1 279 px : la ligne collante garde le logo et le bouton ; la navigation suit sur une seconde ligne, hors
    de l'en-tête collant, qui défile avec la page.
  - Sous 1 024 px : logo compact (36 px) et bouton « Menu » (`aria-expanded`, `aria-controls` ; icône seule sous 400 px,
    « Menu » restant son nom accessible). Le panneau se ferme par Échap (focus rendu au bouton), par un clic sur le
    voile, par un lien (focus rendu au bouton), dès que le focus le quitte (Tab après le dernier lien, Maj+Tab avant le
    bouton : rien ne reste caché sous le panneau) et à chaque changement de page, retour et avance de l'historique
    compris (l'état « ouvert » est remis à zéro dès que le chemin change).
  - Page active : pilule lin et point orange, `aria-current="page"`. Le bouton principal s'efface sur le simulateur.
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
  est étiqueté « Exemple » et ses montants dits fictifs, une fois ; il ne porte ni étiquette de fiabilité ni lien de
  source (une étiquette « Exact » sur un montant inventé affaiblirait les vraies).
- Une idée, une fois par page. Sur l'accueil : le récapitulatif imprimable et « poste par poste » à l'étape 3,
  « cinq minutes » dans la bande d'appel (une phrase), l'identification par SIREN à l'étape 1 et sur la tuile de qui ne
  connaît pas son OPCO. Une étiquette flottante ne répète pas le texte voisin : l'accueil n'en garde que là où elle
  apporte une information (les domaines de formation).

## 10. À ne pas faire

- Du bleu ou du violet, sous quelque forme que ce soit (classe, hexadécimal, `rgb()`, `hsl()`).
- Une police mono ou une autre famille que Montserrat et Inter.
- Du texte blanc sur l'orange identité, le turquoise de marque ou l'or ; du texte en opacité sur un dégradé.
- Une ombre dure décalée (`shadow-[4px_4px_0_0_...]`), un filet noir, un tampon incliné.
- Une classe d'affichage (`hidden`, `lg:inline-flex`) passée à un composant qui fixe déjà son `display` : régler la
  visibilité sur un élément enveloppe.
- Recolorer, déformer ou redessiner le logo.
- Les alias historiques (`cobalt`, `ink`, `paper`…) dans un nouveau code.
- Une marge `scroll-mt-*` sur une cible d'ancre pour « passer sous l'en-tête » : `scroll-padding-top` de `html` compte
  déjà l'en-tête, la marge s'y ajoute (l'ancre atterrit trop bas).
- Un sélecteur CSS accroché à un texte (`nav[aria-label="…"]`) : une classe.
- Une étiquette de fiabilité ou « Source officielle » sur un montant d'exemple.
- Un élément qui n'est pas de la liste dans une liste (`ul` des 11 OPCO suivie de la tuile d'appel : la tuile est
  hors de la liste, la grille les range ensemble grâce à `contents`).
- Un composant client pour du rendu statique : seuls l'état et les événements justifient `'use client'`, et un
  composant serveur peut passer au client des éléments déjà rendus (icônes, bouton).

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
9. Aucune affirmation qui devance le produit. Les sections de l'accueil qui décrivent l'écran de résultats (« Ce que le
   simulateur recherche », « Lisez votre plan de financement », l'étiquette de fiabilité) ont été vérifiées phrase par
   phrase contre cet écran (W5) : le plan de l'OPCO n'est calculé que pour former ou reconvertir un salarié, le
   catalogue d'aides est évalué pour tout projet, chaque aide porte sa source et son étiquette de fiabilité. Toute
   promesse nouvelle se vérifie de la même façon, contre l'écran réel.

## 12. Garde de charte

`npm run check:charte` (script `scripts/check-charte-sfg.mjs`, Node seul) parcourt `apps/web/src/**/*.{ts,tsx,css}` et
signale, avec fichier, ligne et colonne (code de sortie 1 en cas de problème) :

- le tiret cadratin et ses variantes (U+2014, la barre horizontale U+2015, U+2E3A, U+2E3B, la forme verticale U+FE31,
  U+FE58), écrits tels quels, en entité HTML (`&mdash;`, `&horbar;`, `&#8212;`, `&#x2014;`), en échappement JavaScript
  (`\u{2014}` et sa forme courte à quatre chiffres, qui n'en prend jamais un cinquième : suivie de `0`, elle donne un
  tiret puis 0) ou CSS (`\2014`, `\2E3A`, `\FE58`…, de quatre à six chiffres) ;
- le bleu et le violet (teinte TSL de 190 à 320 degrés) : classes de la palette retirée sur les 49 utilitaires de
  couleur de Tailwind 4 (`bg-`, `drop-shadow-`, `inset-ring-`, `text-shadow-`, `mask-*-from-`…), variables
  `--color-blue…`, fonctions `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `color()` (séparateurs
  virgule, espace, barre ou souligné, souligné compris devant la fonction dans une valeur arbitraire :
  `shadow-[0_0_0_2px_rgb(59_130_246)]` ; les trois composantes de couleur sont lues et l'alpha est ignoré, même
  calculé : `rgb(59 130 246 / var(--opacite))`), hexadécimaux et couleurs nommées CSS (`blue`, `navy`,
  `rebeccapurple`…) **dans un contexte de couleur** : déclaration ou objet de style, attribut `fill`, `stroke`,
  `color`, valeur arbitraire `[…]`, argument d'un dégradé ou de `color-mix()`, chaîne qui n'est qu'un hexadécimal (sauf
  ancre affectée ou comparée : `href="#bad"`, `location.hash === '#bad'` ne sont pas des couleurs). Un gris (chroma
  OKLCH inférieure à 0,01) n'est pas signalé ;
- la police mono : `font-mono`, `monospace`, IBM Plex et, partout, les familles mono dont le nom ne désigne rien
  d'autre (SF Mono, Fira Code, JetBrains Mono, Source Code Pro, Cascadia, Lucida Console, Inconsolata, Iosevka,
  Monaspace, toute famille « … Mono ») ; Monaco, Menlo, Consolas, Courier et Hack seulement dans un contexte de police
  (déclaration `font-family`, `font` ou `--font-*`, propriété `fontFamily`, classe `font-[…]`), pour que « Menlo Park »
  ou la principauté de Monaco passent dans un texte ; les balises `<code>`, `<pre>`, `<kbd>`, `<samp>`, `<tt>` hors des
  commentaires (une balise citée en commentaire n'est pas rendue) ;
- les émojis, écrits tels quels, en entité HTML numérique (`&#127881;`, `&#x1F389;`), en échappement JavaScript
  (`\u{1F389}`, paire de substitution) ou CSS (`\1F389`) : tout pictogramme Unicode (propriétés
  `Extended_Pictographic` et `Emoji_Presentation`, sélecteur U+FE0F), sauf les signes typographiques tolérés sans
  sélecteur, sous toutes ces écritures : ✓ ⚠ ↗ ▸ ▾ © ® ™ (ils s'affichent en glyphes de texte).

La règle vaut pour le texte du dépôt, pas seulement pour l'affichage : un code qui retire le tiret d'une donnée en
l'écrivant en clair dans une expression régulière est signalé, et une forme échappée l'est aussi. Construire le
caractère : `t.replaceAll(String.fromCharCode(0x2014), ', ')` ou `new RegExp(String.fromCharCode(0x2014), 'g')` ; de
même `String.fromCodePoint()` pour un émoji qu'un code doit reconnaître.

`node scripts/check-charte-sfg.mjs --self-test` vérifie la garde sur 178 cas : chaque règle a une violation et un
jumeau propre, et quatre contrôles portent sur les positions et l'extrait signalés. Les 67 mutants de la garde (copies
du script dont une règle est retirée ou faussée) font tous échouer cet autotest. Limites : la garde lit le texte
source, pas le rendu ; une couleur calculée à l'exécution (variable, concaténation, donnée, composante en `var()` ou
`calc()`), un hexadécimal sans contexte de couleur (commentaire, texte courant), une couleur encodée dans une image SVG
en data URI (`fill='%233b82f6'`), une police mono sous un nom inconnu ou un nom ambigu rangé dans une constante, un
émoji en entité nommée (`&hearts;`), une image ou une icône bleue lui échappent. Les données de `packages/core`
(barèmes, table IDCC, aides) sont contrôlées à part par `packages/core/tests/charte-sfg.test.ts` (tiret cadratin et
barre horizontale).

## 13. Dette connue

| Élément | Où | Pourquoi il reste | À retirer par |
|---|---|---|---|
| Définitions des alias de couleur historiques (`--paper`, `--ink`, `--cobalt`, `--navy`, `--marker`, `--valid`, `--alert`, `--rule`… et leurs `--color-*`) | `globals.css` (`:root`, `@theme inline`) | Plus aucun emploi dans `apps/web/src` depuis D3 (fiches, liste, guides, contact) ; la règle `.border-ink` et `section[id].scroll-mt-24` sont retirées, comme les `transition-colors` et `transition-all` du formulaire de contact et des cartes de la liste des OPCO. | Fin du chantier : supprimer les définitions et le tableau « Alias historiques » (section 2) |
| Classe `.marginalia` | `globals.css` ; `components/ui/forms.tsx` (`RegionPicker`), `components/wizard/StepIdentification.tsx` | Libellés du parcours du simulateur (W4), hors du périmètre de D3. | Prochain passage sur le parcours : utilitaires, puis suppression de la classe |
| Espaces ordinaires à l'intérieur des guillemets d'un extrait cité (« Organismes de formation ») | textes des données et du moteur | `typo()` ne touche jamais une citation (mot pour mot) : un « » » peut commencer une ligne sur téléphone. | à trancher : insécables autour des guillemets dans les données (`@opco/core`) |

## 14. Parcours du simulateur

Les six étapes (`components/wizard/`) se composent avec les primitives et les champs de `components/ui/forms.tsx`.

- **Cadre** : à partir de 640 px, un panneau lin-soft arrondi (`rounded-panneau`) porte la progression et une `Card`
  blanche par étape ; en dessous, ni panneau ni marge de plus.
- **Progression** (`ProgressBar`) : liste ordonnée de jalons reliés par un rail de 4 px (part parcourue en turquoise).
  Étape faite : disque turquoise de marque cerclé de turquoise-deep, coche encre, cliquable pour y revenir. En cours :
  disque orange-deep, numéro blanc, `aria-current="step"`. À venir : disque blanc cerclé de filet-fort. Sans objet (les
  frais d'une formation à distance) : contour en tirets. Sous 640 px, numéros seuls et libellé de l'étape en cours sous
  le rail ; chaque étape garde son nom complet pour les lecteurs d'écran (« Étape 2 sur 6 : Entreprise (en cours) »).
- **En-tête d'étape** (`EnTeteEtape`) : `SectionTitle` (surtitre « Étape n sur 6 », `h2` focalisable par programme,
  chapeau). À chaque changement d'écran, le haut de l'écran revient à la vue s'il en était sorti et le focus passe à
  son titre : titre de l'étape ; à l'affichage des résultats, titre de l'écran de résultats (`h2` « Votre plan de
  financement », `ID_TITRE_RESULTATS`) ; au retour par « Modifier mes informations » ou « Revenir au récapitulatif »,
  titre « Récapitulatif » (seul `showResults` change : l'effet en dépend aussi) ; après « Nouvelle simulation », titre de
  l'étape Projet. L'écran de résultats est chargé à la demande : son titre n'existe pas quand `showResults` passe à vrai.
  Le squelette d'attente porte le même titre focalisable (le parcours y pose le focus), puis l'écran, comme l'écran
  d'échec du chargement, pose le focus sur son propre titre à son montage (section 15).
- **Navigation** : `Button` secondary « Retour » (flèche seule sous 640 px, nom gardé) et primary « Suivant ». Tant que
  l'étape est incomplète, « Suivant » reste atteignable au clavier mais porte `aria-disabled`, grisé (texte-discret sur
  lin), et un texte dit ce qui manque (« Pour continuer, indiquez la région et la taille de l'entreprise. »), relié par
  `aria-describedby`. Sous 1 024 px la barre colle au bas de l'écran (cibles de 44 px) ; au récapitulatif, qui se lit
  avant de calculer, elle reste en pied de carte et ses boutons s'empilent.
- **Barre collante et focus** (WCAG 2.2, critère 2.4.11 ; crochet `hooks/useReserveBarreCollante.ts`, fonctions pures
  `lib/barreCollante.ts`) : tant que la barre colle, sa hauteur réelle, mesurée par un `ResizeObserver` (phrase d'aide
  qui s'allonge, zone de sécurité iOS, texte agrandi) et augmentée de 8 px pour l'anneau de focus, est posée dans la
  variable `--reserve-barre-simulateur` de `html`. `globals.css` en tire `scroll-padding-bottom` (un contrôle qui reçoit
  le focus s'arrête au-dessus de la barre, jamais dessous) et, en négatif, le `scroll-margin-bottom` des contrôles de la
  barre (classe `barre-collante`) : le focus qui entre dans la barre collée ou en sort ne fait plus défiler la page
  jusqu'à la position statique de la barre (avant : 248 à 370 px de saut). Quand la barre grandit ou que le contenu de
  l'étape change de taille (erreur affichée au-dessus d'un champ pendant la frappe), le contrôle qui a le focus, si son
  bas dépasse le haut de la barre moins 8 px, remonte au-dessus d'elle (`scrollIntoView({ block: 'nearest' })`, qui
  respecte la réserve). La variable est retirée dès que la barre ne colle plus (1 024 px et plus, récapitulatif,
  résultats) et au démontage. Aucune hauteur écrite en dur. Un autre élément collant en bas de l'écran poserait sa
  propre variable, réunie à celle-ci dans un `max()` : retirer l'une n'efface jamais l'autre. Vérifié dans Chrome
  (DevTools, vraies touches, 375 × 812 et 320 × 568) ; Safari et iOS ne sont pas testables ici, en particulier la marge
  de défilement négative.
- **Choix** : `ChoiceButton` en carte (indicateur rond, coche, contour et fond orange quand il est choisi,
  `aria-pressed`) ; `OuiNonChoix` en groupe segmenté de pilules ; `CheckboxRow` en carte. « Je ne sais pas » (et
  « Ne sait pas » d'une liste) est une réponse que le parcours retient à part (`useWizard`, `repondre`) : la valeur
  reste null pour le moteur, qui la lit comme inconnue, mais le choix reste affiché quand l'étape revient ; une
  question sans réponse n'apparaît pas répondue. Une réponse remise à vide (changement de projet) perd ce choix.
  Le diplôme, seul choix facultatif en cartes, se retire d'un second clic ; les autres choix se remplacent par un autre
  (le barème de branche a son option « Barème général / je ne sais pas »).
- **Largeurs étroites** : sous 360 px, les grilles de choix courts à deux colonnes (régions, modes de transport) passent
  à une colonne et les cartes Entreprise et OPCO posent leur pastille au-dessus du titre : aucun mot n'est coupé
  (« Guadeloupe », « Bourgogne- » ou « SFG DEVELOPPEMENT » ne tenaient plus sur leur ligne). `break-words` ne reste
  qu'en dernier recours, pour un mot plus long que la carte.
- **Champs** : 48 px, rayon 12 px, contour filet-fort, orange-deep au focus, rouge en erreur. Libellé Inter 600, aide
  en texte-discret et erreur en rouge avec icône, entre le libellé et le champ ; l'erreur paraît quand on quitte le
  champ et s'annonce poliment. Les nombres se lisent à la française (`lib/saisie.ts`) : milliers collés ou groupés par
  trois chiffres avec des espaces (insécables et fines comprises) ; décimales, dans un champ décimal, après une virgule
  ou un point suivi d'un ou de deux chiffres ; virgule et point ensemble, le dernier est décimal et l'autre groupe les
  milliers par trois (« 1.500,50 ») ; « € » ou « euros » final accepté dans un montant (`euros`), refusé ailleurs. Toute
  ambiguïté est refusée avec son explication, jamais devinée : « 1.500 » ou « 1,500 » (« Pour 1 500 €, écrivez 1500 ou
  1 500 ; la virgule sert aux centimes. »), « 1 5 00 », un nombre trop grand, une virgule dans un champ entier.
- **Champs masqués** : un champ que l'écran ne montre plus revient à vide, car le moteur et le profil des aides lisent
  tout l'état : questions d'un autre statut et budget déjà consommé d'un projet qui n'ouvre pas le budget de l'OPCO
  (`etatDepuisProjet`), besoins de frais et nombre de jours quand l'étape Frais est sautée (`etatDepuisModeFormation`).
  Audit et test : `tests/parcours.test.ts` (« aucun champ invisible ne pèse sur le résultat »).
- **Région** (`ChampRegion`) : la région connue s'affiche avec « Modifier », qui ouvre la liste sur la région choisie ;
  un choix referme la liste et rend le focus au nom de la région.
- **Alertes** : `Callout` avertissement pour le plafond horaire indicatif (rien n'est bloqué) ; le rouge reste réservé
  aux saisies refusées et à l'échec de la recherche d'entreprise.
- **Récapitulatif** : une `Card` par étape (pastille d'icône, `h3`, « Modifier ») ; une valeur absente s'écrit
  « Non renseigné » en texte-discret, jamais un tiret ; une réponse « Je ne sais pas » ou « Ne sait pas » s'écrit telle
  quelle. Libellés propres à la section : « Objectif » (section Projet), « Intitulé » (nom de la formation).
- **Limite connue** : un dirigeant « assimilé salarié » dont l'entreprise relève d'un OPCO peut relever du plan de
  développement des compétences de sa branche (Afdas : « dirigeants salariés » ; Uniformation : « dirigeants bénévoles
  dans certaines branches ») ; le projet « Former le dirigeant » n'affiche pourtant ni plafond horaire ni budget OPCO,
  et l'écran de résultats ne calcule ce plan que pour les projets salariés (former, reconvertir : `ouvreBudgetOpco`,
  le `avecPdc` de l'écran). Une note le dit au dirigeant (« Aucun OPCO renseigné » ou « OPCO non compté pour un
  dirigeant », avec le cas de l'assimilé salarié). Hors périmètre.

## 15. Écran de résultats (« Votre plan de financement »)

Composants : `components/results/` ; logique de présentation en fonctions pures : `lib/resultats.ts` (tests :
`tests/resultats.test.ts`). Chaque montant vient du moteur (`@opco/core`) et n'est arrondi qu'à l'affichage
(`formatEuro` : un montant entier sans décimales, tout autre avec deux, « 1 500,50 € », jugé au centime près), y
compris dans les textes du moteur (voir « Textes des données » plus bas) ; un montant d'aide non éligible n'est jamais
affiché.

- **Chargement** : `EcranResultats` est chargé à la demande par `WizardContainer` (`next/dynamic`, `ssr: false`) : le
  catalogue d'aides (environ 135 Ko gzip) et le calcul restent hors du lot initial du simulateur. Le parcours ne lui
  passe que l'état et deux actions ; le calcul est une dérivation pure de l'état (`useMemo`), la date du jour est lue
  dans le composant, jamais dans `@opco/core`. Squelette d'attente (`ChargementResultats` : `aria-busy`, « Calcul en
  cours… », même titre focalisable, hauteur du bandeau) ; échec du chargement (`EchecChargementResultats` : `Callout`
  alerte, « Réessayer » recharge le code sans perdre les réponses).
- **Ordre** : titre `h2` et actions (Modifier, Imprimer : libellés courts sous 640 px, nom accessible complet),
  étiquettes de la situation (projet, OPCO, région, durée), bandeau de synthèse, note sur l'OPCO s'il y a lieu, cartes
  du plan, aides par financeur (`h2`), détail de l'estimation OPCO (`h2`), portails de la région (`h2`), mention,
  date de la simulation et actions. Aucun élément collant.
- **Bandeau de synthèse** : carte blanche à grands chiffres (`rounded-panneau`, filet turquoise / or / orange en tête),
  pas un dégradé : le reste à charge est en orange foncé (5,16:1 sur blanc ; moins de 2:1 sur le dégradé turquoise), la
  barre empilée a besoin d'un fond clair pour ses couleurs de famille (le turquoise de l'OPCO se perdrait dans un
  dégradé turquoise), et le bandeau porte plus qu'une accroche (chiffres, barre, légende, alerte) : section 6, un
  dégradé ne passe pas derrière un long contenu. Trois chiffres en Montserrat 700 tabulaires : Coût de la formation,
  **Financé** (le plus grand), Reste à charge (orange foncé) ; sous Financé, la part du coût (`partFinancee` : jamais
  « 100 % » avec un reste, jamais « 0 % » avec un financement). Sous 640 px, une ligne par chiffre.
- **`.mark`** : le trait de base vert clair (le souligné du film de marque) sous le seul chiffre Financé, sur fond
  blanc. L'aplat plein ne sert plus sur cet écran (plus de carte sombre) : la règle héritée `.mark.text-ink` est
  retirée de `globals.css`.
- **États du bandeau** (`etatEnTete`) : coût inconnu (`Callout` « Coût de la formation non renseigné », bouton
  « Indiquer le coût », jamais « 0 € ») ; aucun financement chiffré (coût seul, `Callout` qui le dit, liens vers les
  cartes Montant selon dossier, Aides versées à l'employeur et Revenus et aides à la personne, placées en tête ;
  variante quand des options au choix ont un montant) ; plan chiffré (chiffres, barre, légende). Fonds épuisés
  signalés par l'OPCO alors que le plan compte son plan de développement des compétences (`fondsEpuisesSurLePlan`) :
  `Callout` avertissement sous la barre, lien vers les alertes de l'OPCO (`#alertes-opco`).
- **Familles de couleur** (`familleCouleur`) : pastille ronde des lignes et des groupes, part de la barre, pastille de
  légende. L'icône posée sur la pastille est décorative (le nom du financeur est écrit) mais dépasse 3:1.

| Famille | Financeurs du catalogue | Couleur | Icône |
|---|---|---|---|
| OPCO | `opco`, `branche` | `turquoise` | #1A1A1A, 5,68:1 |
| Fonds d'assurance formation | `faf` (FAFCEA, AGEFICE, FIF PL, VIVÉA…) | `turquoise-deep` | blanc, 6,26:1 |
| CPF | `cpf` | `or` | #1A1A1A, 9,48:1 |
| Région | `region`, `departement` | `vert-clair` | #1A1A1A, 10,37:1 |
| État et France Travail | `etat`, `france_travail` | `orange` | #1A1A1A, 4,59:1 |
| Europe | `europe` | `nuit` | blanc, 19,14:1 |
| Autres | `transitions_pro`, `agefiph`, `fiscal`, `autre` | `filet-fort` | blanc, 3,54:1 |
| Reste à charge | | hachures orange doux sur blanc, bord orange foncé | |

- **Barre empilée** (`partsBarre`) : une part par famille (lignes additionnées, dans l'ordre d'empilement), puis le
  reste à charge ; pourcentages entiers dont la somme vaut exactement 100 (plus fort reste), largeurs proportionnelles
  aux montants (6 px au moins), 2 px de blanc entre les parts. Bord intérieur encre à 35 % sur chaque part (or 3,71:1
  et vert clair 3,41:1 contre le blanc, au lieu de 1,84:1 et 1,68:1). Jamais seule porteuse d'information :
  `role="img"` et nom accessible complet (`descriptionBarre`), légende écrite (« AKTO 67 % », « moins de 1 % »). Libellé
  d'une part : le nom de financeur commun à ses lignes s'il est court (« AKTO », « FAFCEA »), sinon celui de la famille.
- **Plan en pile** : la carte « Financement de la formation » liste les lignes dans l'ordre d'empilement (pastille,
  nom, financeur, étiquette de fiabilité, « estimation à confirmer auprès du financeur » si elle n'est pas exacte,
  montant à droite) ; avec plusieurs lignes, un fil (`filet`) les relie jusqu'au total, « plafonné au coût de la
  formation » ; c'est la seule carte à total. Les autres cartes (options au choix, aides versées à l'employeur, revenus
  et aides à la personne, avantages fiscaux et sociaux, montant selon dossier, services gratuits) : en-tête à pastille
  d'icône turquoise et phrase d'aide, aucune somme, aucune carte vide (`cartesDuPlan`). La raison d'une option (« Au
  choix avec « X » ») reste du texte, sans lien.
- **Aides par financeur** (`groupesAidesVisibles`) : groupées par financeur du catalogue, dans l'ordre de la liste
  évaluée. Titre : libellé de la famille pour CPF, État, Europe, OPCO, France Travail, Transitions Pro, Agefiph,
  Fiscalité (même titre d'une simulation à l'autre) ; nom propre commun pour Région, Département, fonds d'assurance
  formation, branche et autres (« Région Occitanie », « FAFCEA », « Action Logement »). Carte d'aide : étiquette
  Éligible (turquoise) ou À vérifier (or, texte foncé), montant en gros (« jusqu'à », « Montant selon dossier »,
  « Aucun montant estimé pour ce profil »), règle de calcul, description, points à confirmer, cumul ; détail dépliable
  (chevron, `aria-expanded`) : conditions, démarches numérotées, « Faire la demande », pages officielles citées (titre
  complet) ; pied : fiabilité, date de vérification, un lien par site source (`sourcesDeLAide` : le catalogue cite
  souvent dix pages d'un même site). Un identifiant technique d'aide cité par le catalogue (« nat-cpf ») devient le
  nom de l'aide (`nommerAides`). Aides non éligibles : repliées, nom et raisons, jamais de montant ; celles d'un autre
  projet, public, région ou type de formation ne sont jamais affichées.
- **Détail de l'estimation OPCO** (`FundingBreakdown`) : total de tous les postes (le plan ne retient que ceux de la
  formation, le chapeau le dit quand salaires ou transport sont financés) ; tableau Poste / Financé / Reste, « Demandé »
  et la source passant dans la colonne du poste sous 640 px ; ligne non chiffrée : « à confirmer », reste « - », règle
  sous le poste ; listes de plus de 6 conventions collectives repliées (`replierIdcc`) ; 50 salariés et plus : `Callout`
  avertissement (barème général ou de la branche ; choisir sa branche à l'étape Entreprise).
- **Textes des données** : `texteDonnees` (dates JJ/MM/AAAA, montants et `typo` : insécables avant « : ; ? ! », entre
  un nombre et son unité, entre les milliers), jamais à l'intérieur d'un extrait cité. Le moteur écrit les montants de
  ses textes de calcul à l'anglaise (« 840.00 € », « 42.86 €/h », « 12600.00 € » : détail du calcul, notes de poste,
  points d'attention) ; `montantsFr` les réécrit par `formatEuro` (« 840 € », « 42,86 €/h », « 12 600 € »). Un montant
  déjà écrit à la française reste tel quel ; un nombre ambigu (« 2.000 € », point de milliers d'une citation, ou nombre
  collé à un autre) n'est pas réinterprété. Une adresse web longue passe à la ligne
  (`break-words` ; `[overflow-wrap:anywhere]` dans le tableau, pour que la largeur des colonnes n'en dépende pas).
- **Mouvement** : apparition douce du bandeau et des cartes (`.apparition`, délais échelonnés), barre qui se dévoile
  (`.devoilement`), trait `.mark` qui se déploie ; tout s'arrête sous `prefers-reduced-motion`.
- **Impression** : section 7 ; détail des aides, liste des non éligibles et listes de conventions repliées imprimés en
  entier (`hidden print:block`), boutons masqués, cartes d'aide non coupées (`break-inside-avoid`).

## 16. Fiches OPCO, liste des OPCO, guides, contact et page 404

Pages de référence et de lecture. Logique de présentation en fonctions pures : `lib/fiche.ts` (tests :
`tests/fiche.test.ts`), `lib/contact.ts` (`tests/contact.test.ts`), `lib/typographie.ts` (`tests/typographie.test.ts`).
Composants des fiches : `components/opco/`.

- **Gabarit** : en-tête de page blanc bordé d'un filet (surtitre, `h1` en `text-affiche` avec au plus un `.mark`,
  chapeau) ; corps en grille `grid-cols-1`, colonne de contenu `min-w-0` (un tableau large ne fait plus déborder la
  page) ; à partir de 1 024 px, `Sommaire` collant à gauche (13,5 rem) ; sections séparées de 64 px, chacune sous son
  filet `.rule-double`, titrée par `TitreDeSection`.
- **Fiche OPCO, ordre** : fil d'Ariane, nom, nom complet, « Barèmes vérifiés le JJ/MM/AAAA » (étiquette turquoise),
  « Estimer pour cet OPCO » (primaire) et « Site d'AKTO » (secondaire, nouvel onglet annoncé), une phrase qui dit comment
  retrouver l'OPCO dans le simulateur (il n'est pas présélectionné), carte teintée « Secteurs couverts » ; encadré des
  alertes (type et nombre, lien vers la liste) ; barème général du plan de développement des compétences (PDC) ; selon
  la taille de l'entreprise ; barèmes par branche professionnelle ; alertes publiées (`AlertesOpco`, partagé avec l'écran
  de résultats, inchangé) ; financements complémentaires ; alternance, CPF et VAE ; en pratique. Une section sans
  contenu n'existe pas, ni son lien de sommaire (`sectionsDeLaFiche`). Les secteurs restent une phrase : ce texte libre
  ne se découpe pas sans erreur en étiquettes (chez OPCO Santé, « sanitaire, social et médico-social privé à but non
  lucratif » est un seul secteur).
- **Barème poste par poste** (`Bareme.tsx`, `lignesDuBareme`) : deux présentations rendues par le serveur. À partir de
  768 px, un tableau à disposition fixe (poste en titre de ligne, montant en Montserrat 20 px et son étiquette de
  fiabilité, précision, source) dans une carte `overflow-clip` et non `overflow-hidden`, pour que l'en-tête de colonnes
  colle sous l'en-tête du site (`top: var(--hauteur-entete)`) ; les liens et blocs du corps portent
  `scroll-margin-top: 3rem` pour s'arrêter sous cet en-tête quand le focus les ramène par le haut (seule exception à la
  section 10 : c'est l'en-tête du tableau, non celui du site, qui les masquerait). Sous 768 px, une carte par poste :
  poste et étiquette, montant en 24 px, règle en une phrase (`premierePhrase`), « Voir la précision » (`<details>`, nom
  complété par le poste pour les lecteurs d'écran), source. Aucun défilement horizontal. Montants par `formatEuro`
  (« 14,50 €/h »).
- **Montant absent et légende** : « non publié », « incluse dans le plafond horaire », « sans montant fixe », ou un renvoi
  à la précision qui cite ce qui est visible : « montant précisé dans la colonne Précision » dans le tableau,
  « montant précisé ci-dessous » dans les cartes. La légende, une par présentation, n'explique que les libellés affichés
  dans le barème général et ceux des branches (`legendeDuBareme`).
- **Branches** (`Branche.tsx`) : une carte `<details>` par branche, repliée ; son ancre est l'identifiant de la branche,
  et `OuvertureDesDetails` l'ouvre quand l'adresse la vise. Résumé en grille (un `<summary>` n'admet que du texte courant
  et un titre) : chevron en pastille turquoise doux, nom en `h3`, conventions collectives (citées jusqu'à trois, comptées
  au-delà), fiabilité, une étiquette rouge par type d'alerte qui vise la branche (`alertesDeLaBranche` : un code IDCC en
  commun ; une alerte sans code reste dans la liste générale). Contenu : ces alertes (extrait mot pour mot), note,
  source, postes de la branche, barème dégressif, budget, tailles ; plus de 6 codes IDCC repliés (`ListeIdcc`).
- **Dispositifs** : légende des seules règles de cumul présentes ; carte : nom et `CumulBadge`, montant en turquoise
  foncé (`montantDuDispositif`), description, public, tailles et conventions concernées, conditions à coches, démarche
  en étapes numérotées (`etapesDeDemarche` : coupe à « ; » et à « puis », jamais dans une citation ni une parenthèse ; une
  démarche d'une seule étape reste une phrase), précision, fiabilité et source.
- **Textes des données** : `TexteDonnees` (`texteDonnees` : dates, montants et typographie, hors citations). Les textes
  « A | B | C » (`specificites`, `points_cles_maximisation`) s'affichent en liste (`elementsDeTexte`, objets `FreeText`
  compris, jamais « [object Object] ») ; une adresse web longue passe à la ligne (`[overflow-wrap:anywhere]`). Un sigle
  est défini à sa première occurrence dans chaque texte (`<abbr title>`, `definirAbreviations`) seulement s'il a été
  vérifié sur la page officielle de l'OPCO (`ABREVIATIONS_PAR_OPCO` : DAF chez Uniformation ; SSSMS, HP, SPSTI et
  « hors CC » chez OPCO Santé). BETIC (ATLAS) n'est pas défini : les pages de critères d'ATLAS consultées le 07/10/2026 ne l'emploient pas.
- **Impression** : en-tête, sommaire, boutons et « Voir la précision » masqués ; tous les `<details>` ouverts (script
  `beforeprint` d'`OuvertureDesDetails` et, sans script, `details::details-content { content-visibility: visible }`) ;
  ni ombre ni dégradé. À la largeur d'une page A4 (moins de 768 px), le barème s'imprime en cartes.
- **Liste des OPCO** : 12 cases (11 cartes triées par `trierParNom`, article élidé ignoré : L'Opcommerce se range à O,
  puis la tuile teintée « Vous ne connaissez pas votre OPCO »), `ul` en `contents` ; carte : nom (lien étendu), nom
  complet, extrait des secteurs (110 caractères), « Vérifié le JJ/MM/AAAA », « Voir la fiche » (décoratif : le nom du
  lien est celui de l'OPCO).
- **Guides** (`Guide.tsx`) : texte courant mesuré à 34 rem (66 à 69 caractères par ligne pleine en Inter 16 px, mesurés
  dans Chrome), tableaux et cartes sur toute la colonne ; numéro de section en jalon turquoise ; encadrés en `Callout`
  (information, avertissement, confirmation) ; sources en `.lien`, nouvel onglet annoncé ; tableau « Ce que finance un
  OPCO » empilé en cartes sous 640 px (en-tête repris devant chaque cellule par `data-label`) ; `typoDesEnfants` pose les
  espaces insécables des textes écrits dans le JSX (nombre et unité, « : ») sans changer un mot ; `BandeAppel` en fin
  de page, la même que l'accueil.
- **Contact** : formulaire en carte, champs au dessin du simulateur (`FieldLabel`, contour filet-fort), erreurs entre le
  libellé et le champ (`aria-invalid`, `aria-describedby`, zone `aria-live`) quand on quitte le champ ou à l'envoi,
  focus sur le premier champ à corriger ; même lien `mailto` qu'avant (`lienMailto` : destinataire, objet, corps), le
  bouton dit ce qui se passe (« Ouvrir ma messagerie ») ; carte SFG Développement (logo, domaines de formation aux
  couleurs de la charte, adresse e-mail).
- **Page 404** (`app/not-found.tsx`) : dans le gabarit du site, un message court, trois liens (simulateur, liste des
  OPCO, accueil) et le rail de la marque au jalon manquant (décor) ; l'export produit `out/404.html`.

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
| `#3E6860` | `#FFFFFF` | libellé du Button secondary, .surtitre, icônes (turquoise-deep, valid) sur blanc | 6,26:1 | 4,50:1 | conforme |
| `#3E6860` | `#F3F7F6` | .surtitre sur bande lin-soft | 5,80:1 | 4,50:1 | conforme |
| `#3E6860` | `#E6EFEC` | turquoise-deep sur lin | 5,34:1 | 4,50:1 | conforme |
| `#3E6860` | `#EDF5F2` | Étiquette turquoise, ConfidenceBadge exact, CertitudeBadge confirmé ou fiable, survol secondary | 5,65:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#3E6860` | pastille Callout info / confirmation, jalon d'étape faite du simulateur au survol | 6,26:1 | 4,50:1 | conforme |
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
| `#F9B233` | `#0F1E1B` | anneau de focus or sur encre (pied de page) | 9,37:1 | 3,00:1 | conforme |
| `#FFFFFF` | `#D04415` | anneau de focus blanc autour du Button inverse, sur le point le plus clair de la bande orange | 4,65:1 | 3,00:1 | conforme |
| `#FFFFFF` | `#477A70` | anneau de focus blanc dessiné à l'intérieur d'une Card turquoise (point le plus clair) | 4,90:1 | 3,00:1 | conforme |
| `#FFFFFF` | `#D04415` | anneau de focus blanc dessiné à l'intérieur d'une Card orange (point le plus clair) | 4,65:1 | 3,00:1 | conforme |
| `#F9B233` | `#183530` | anneau de focus or dessiné à l'intérieur d'une Card nuit (point le plus clair) | 7,19:1 | 3,00:1 | conforme |
| `#C43F13` | `#F3F7F6` | anneau de focus orange-deep autour d'une carte claire, sur bande lin-soft | 4,78:1 | 3,00:1 | conforme |
| `#FFFFFF` | `#F3F7F6` | repère : ancien anneau blanc autour de la tuile turquoise, dessiné sur la bande lin-soft | 1,08:1 | - | repère |
| `#F9B233` | `#FFFFFF` | repère : anneau or autour d'une Card nuit posée sur blanc (d'où l'anneau intérieur) | 1,84:1 | - | repère |
| `#5F6E6A` | `#FFFFFF` | texte d'exemple (placeholder) des champs | 5,35:1 | 4,50:1 | conforme |
| `#8C8C8C` | `#FFFFFF` | repère : ancien texte d'exemple (#1A1A1A à 50 %, défaut de Tailwind) | 3,36:1 | - | repère |
| `#C43F13` | `#FFFFFF` | case cochée, bouton radio (`accent-color` orange-deep) sur blanc | 5,16:1 | 3,00:1 | conforme |
| `#C43F13` | `#FDF0EA` | case cochée sur le fond orange-soft d'un choix sélectionné | 4,63:1 | 3,00:1 | conforme |
| `#1A1A1A` | `#E6F2EF` | champ prérempli par le navigateur : texte sur vert-clair-soft | 15,18:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#39635B` | Etiquette surFondSombre : encre 25 % sur le point le plus clair de surface-turquoise (#477A70) | 6,75:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#A03B17` | Etiquette surFondSombre : encre 25 % sur le point le plus clair de surface-orange (#D04415) | 6,70:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#162F2B` | Etiquette surFondSombre : encre 25 % sur le point le plus clair de surface-nuit (#183530) | 14,23:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#D5572C` | repère : ancienne Etiquette surFondSombre (blanc 10 %) sur #D04415 | 4,02:1 | - | repère |
| `#5E9F92` | `#FFFFFF` | contour 2 px du Button secondary (turquoise de marque) sur blanc | 3,07:1 | 3,00:1 | conforme |
| `#3E6860` | `#FFFFFF` | contour du Button secondary au survol (turquoise-deep) | 6,26:1 | 3,00:1 | conforme |
| `#3E6860` | `#EDF5F2` | libellé du Button secondary au survol (turquoise-deep sur turquoise-soft) | 5,65:1 | 4,50:1 | conforme |
| `#5E9F92` | `#F3F7F6` | repère : contour du Button secondary posé sur lin-soft (le libellé identifie le bouton) | 2,84:1 | - | repère |
| `#1A1A1A` | `#5E9F92` | accueil, jalons des étapes : numéro #1A1A1A sur disque turquoise | 5,68:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#FFFFFF` | .mark : la part des lettres au-dessus du trait, sur blanc | 17,40:1 | 4,50:1 | conforme |
| `#7A8C88` | `#FFFFFF` | contour du bouton Menu (filet-fort plein) | 3,54:1 | 3,00:1 | conforme |
| `#C43F13` | `#F3F7F6` | tuile teintée « Vous ne connaissez pas votre OPCO » : flèche orange-deep sur lin-soft | 4,78:1 | 3,00:1 | conforme |
| `#44514E` | `#F3F7F6` | tuile teintée : texte-doux sur lin-soft | 7,68:1 | 4,50:1 | conforme |
| `#44514E` | `#FBEDEE` | AlertesOpco : texte ink-soft sur alert-soft | 7,28:1 | 4,50:1 | conforme |
| `#C43F13` | `#FBEDEE` | AlertesOpco : lien « Voir la source » cobalt sur alert-soft | 4,54:1 | 4,50:1 | conforme |
| `#9FA5A4` | `#0F1E1B` | FundingBreakdown : paper 60 % sur navy | 6,87:1 | 4,50:1 | conforme |
| `#B7BCBB` | `#0F1E1B` | FundingBreakdown : paper 70 % sur navy | 8,94:1 | 4,50:1 | conforme |
| `#C3C7C6` | `#0F1E1B` | FundingBreakdown : paper 75 % sur navy | 10,07:1 | 4,50:1 | conforme |
| `#CFD2D1` | `#0F1E1B` | FundingBreakdown : paper 80 % sur navy | 11,29:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#FDF0EA` | simulateur, choix sélectionné (carte, carte de projet, case cochée) : libellé sur orange-soft | 15,60:1 | 4,50:1 | conforme |
| `#44514E` | `#FDF0EA` | simulateur, choix sélectionné : description texte-doux sur orange-soft | 7,43:1 | 4,50:1 | conforme |
| `#3E6860` | `#FDF0EA` | simulateur, branche choisie : « Détectée via votre convention collective » sur orange-soft | 5,61:1 | 4,50:1 | conforme |
| `#C43F13` | `#FDF0EA` | simulateur : contour orange-deep du choix sélectionné contre son fond orange-soft | 4,63:1 | 3,00:1 | conforme |
| `#1A1A1A` | `#5E9F92` | simulateur, jalon d'étape faite : coche encre sur turquoise de marque | 5,68:1 | 3,00:1 | conforme |
| `#3E6860` | `#F3F7F6` | simulateur, jalon d'étape faite : contour turquoise-deep sur le panneau lin-soft | 5,80:1 | 3,00:1 | conforme |
| `#5E9F92` | `#F3F7F6` | repère : turquoise de marque seul sur lin-soft (d'où le contour du jalon fait) | 2,84:1 | - | repère |
| `#7A8C88` | `#F3F7F6` | simulateur, jalon à venir : contour filet-fort sur le panneau lin-soft | 3,28:1 | 3,00:1 | conforme |
| `#1A1A1A` | `#FBEDEE` | simulateur, recherche d'entreprise impossible : message sur rouge-soft | 15,29:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#5E9F92` | résultats : icône d'une pastille OPCO (turquoise) | 5,68:1 | 3,00:1 | conforme |
| `#1A1A1A` | `#F9B233` | résultats : icône d'une pastille CPF (or) | 9,48:1 | 3,00:1 | conforme |
| `#1A1A1A` | `#A3D1C8` | résultats : icône d'une pastille Région (vert clair) | 10,37:1 | 3,00:1 | conforme |
| `#1A1A1A` | `#E84E1B` | résultats : icône d'une pastille État et France Travail (orange) | 4,59:1 | 3,00:1 | conforme |
| `#FFFFFF` | `#3E6860` | résultats : icône d'une pastille fonds d'assurance formation (turquoise foncé) | 6,26:1 | 3,00:1 | conforme |
| `#FFFFFF` | `#08110F` | résultats : icône d'une pastille Europe (nuit) | 19,14:1 | 3,00:1 | conforme |
| `#FFFFFF` | `#7A8C88` | résultats : icône d'une pastille Autres (filet fort) | 3,54:1 | 3,00:1 | conforme |
| `#A77E2B` | `#FFFFFF` | résultats : bord d'une part or de la barre (encre 35 % sur or) contre le blanc | 3,71:1 | 3,00:1 | conforme |
| `#6F928B` | `#FFFFFF` | résultats : bord d'une part vert clair (encre 35 % sur vert clair) contre le blanc | 3,41:1 | 3,00:1 | conforme |
| `#427268` | `#FFFFFF` | résultats : bord d'une part turquoise (encre 35 % sur turquoise) contre le blanc | 5,47:1 | 3,00:1 | conforme |
| `#C43F13` | `#FFFFFF` | résultats : bord de la part « reste à charge » (orange foncé) contre le blanc | 5,16:1 | 3,00:1 | conforme |
| `#F9B233` | `#FFFFFF` | repère : part or sans bord (d'où le bord encre 35 %) | 1,84:1 | - | repère |
| `#A3D1C8` | `#FFFFFF` | repère : part vert clair sans bord | 1,68:1 | - | repère |
| `#C43F13` | `#FFFFFF` | résultats : chiffre « Reste à charge », reste sur les postes de l'OPCO (orange foncé) | 5,16:1 | 4,50:1 | conforme |
| `#3E6860` | `#FFFFFF` | résultats : total de la pile, total et montants financés de l'OPCO (turquoise foncé) | 6,26:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#F3F7F6` | résultats : pied de carte d'aide (« Vérifié le », « Sources ») | 4,95:1 | 4,50:1 | conforme |
| `#C43F13` | `#F3F7F6` | résultats : liens des sites sources en pied de carte d'aide | 4,78:1 | 4,50:1 | conforme |
| `#C43F13` | `#FDF0EA` | résultats : liens vers les cartes mises en avant (aucun financement chiffré) | 4,63:1 | 4,50:1 | conforme |
| `#44514E` | `#F8FAFA` | résultats : détail du calcul d'un poste (lin-soft à 60 % sur blanc) | 7,91:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#F8FAFA` | résultats : surtitre « Détail du calcul » (lin-soft à 60 % sur blanc) | 5,11:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#F9FBFB` | résultats : dispositif complémentaire (lin-soft à 50 %) : texte discret | 5,15:1 | 4,50:1 | conforme |
| `#3E6860` | `#F9FBFB` | résultats : montant d'un dispositif complémentaire (lin-soft à 50 %) | 6,03:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#F3F9F7` | résultats : ligne du tableau survolée (vert clair doux à 50 %) : texte discret | 5,02:1 | 4,50:1 | conforme |
| `#3E6860` | `#F3F9F7` | résultats : montant financé d'une ligne survolée | 5,88:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#5E9F92` | résultats : numéro d'une démarche (disque turquoise) | 5,68:1 | 4,50:1 | conforme |
| `#44514E` | `#FFFFFF` | sommaire (fiches, guides) : entrées inactives | 8,29:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#E6EFEC` | sommaire : section à l'écran (pilule lin) | 14,85:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#E6EFEC` | sommaire des guides : numéro de la section à l'écran (texte discret sur lin) | 4,57:1 | 4,50:1 | conforme |
| `#BC1723` | `#FBEDEE` | sommaire de fiche : nombre d'alertes (rouge sur rouge doux) | 5,62:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#F3F7F6` | barème : en-tête de colonne collant (texte discret sur lin-soft) | 4,95:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#FFFFFF` | barème : libellé d'un montant absent (« non publié »), précision complète | 5,35:1 | 4,50:1 | conforme |
| `#C43F13` | `#FFFFFF` | barème : « Voir la précision », liste repliée des conventions collectives | 5,16:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#F3F7F6` | barème : légende (libellé) sur lin-soft | 16,12:1 | 4,50:1 | conforme |
| `#44514E` | `#F3F7F6` | barème : légende (explication), règles de cumul | 7,68:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#E6F2EF` | barème dégressif : titre et taux sur vert-clair doux | 15,18:1 | 4,50:1 | conforme |
| `#44514E` | `#E6F2EF` | barème dégressif : phrase et libellés de tranche | 7,23:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#F3F7F6` | résumé de branche survolé : conventions collectives | 4,95:1 | 4,50:1 | conforme |
| `#C43F13` | `#F3F7F6` | résumé de branche survolé : anneau de focus intérieur | 4,78:1 | 3,00:1 | conforme |
| `#C43F13` | `#FFFFFF` | résumé de branche : anneau de focus intérieur sur blanc | 5,16:1 | 3,00:1 | conforme |
| `#3E6860` | `#EDF5F2` | résumé de branche : chevron (pastille turquoise doux), icônes Alternance, CPF et VAE | 5,65:1 | 3,00:1 | conforme |
| `#BC1723` | `#FFFFFF` | encadré des alertes : pastilles de type (rouge sur blanc) | 6,39:1 | 4,50:1 | conforme |
| `#3E6860` | `#FFFFFF` | dispositif : montant (turquoise foncé sur blanc) | 6,26:1 | 4,50:1 | conforme |
| `#1A1A1A` | `#5E9F92` | dispositif : numéro d'étape de la démarche ; guides : numéro de section (jalon turquoise) | 5,68:1 | 4,50:1 | conforme |
| `#3E6860` | `#FFFFFF` | coches des conditions et des points clés (icônes porteuses de sens) | 6,26:1 | 3,00:1 | conforme |
| `#3E6860` | `#EDF5F2` | coches de « Maximiser la prise en charge » sur turquoise doux | 5,65:1 | 3,00:1 | conforme |
| `#3E6860` | `#F3F7F6` | puces de « À savoir » (encadré information, lin-soft) | 5,80:1 | 3,00:1 | conforme |
| `#44514E` | `#F3F7F6` | carte « Secteurs couverts » (teintée) : texte des secteurs | 7,68:1 | 4,50:1 | conforme |
| `#3E6860` | `#F3F7F6` | carte « Secteurs couverts » : surtitre | 5,80:1 | 4,50:1 | conforme |
| `#C43F13` | `#F3F7F6` | contact : lien e-mail de la carte SFG Développement (teintée) | 4,78:1 | 4,50:1 | conforme |
| `#5F6E6A` | `#F3F7F6` | contact : libellé « Par e-mail » sur la carte teintée | 4,95:1 | 4,50:1 | conforme |
| `#7A8C88` | `#FFFFFF` | contact : contour des champs (filet-fort) | 3,54:1 | 3,00:1 | conforme |
| `#BC1723` | `#FFFFFF` | contact : message d'erreur d'un champ | 6,39:1 | 4,50:1 | conforme |
| `#5E9F92` | `#FFFFFF` | page 404 : rail et jalons (décor, aucune exigence) | 3,07:1 | - | repère |
| `#7A8C88` | `#FFFFFF` | page 404 : jalon manquant en tirets (décor) | 3,54:1 | - | repère |
| `#5F6E6A` | `#FFFFFF` | abréviation définie : trait pointillé (texte discret), décor du soulignement | 5,35:1 | - | repère |

157 couples (dont 16 repères), aucun sous son seuil.
