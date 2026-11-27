# Guide de design du site financementopco

Depuis novembre 2026, le site porte sa propre identité : le kit financementopco (piste « l'attestation »), qui remplace
pour ce site la charte graphique de SFG Développement. SFG Développement reste l'éditeur du site et l'organisme qui
accompagne les projets de formation ; son nom apparaît à deux endroits (section 8) et dans les mentions légales. Ce guide
dit quelles valeurs employer, avec quels composants, et ce qu'il ne faut jamais faire. Les jetons vivent dans
`src/app/globals.css`, les primitives dans `src/components/ui/` et `src/components/site/`.

## 1. Charte et sources

- Kit d'identité financementopco (novembre 2026) : logo, palette, typographies et maquette de l'accueil. L'idée : une
  attestation de prise en charge, papier et encre, des filets et des tableaux, un seul montant surligné par écran.
- Palette (section 2) : papier `#F4F1E9`, feuille `#FBF9F4`, encre `#161C27`, ardoise `#4A5262`, bleu de Prusse
  `#1F3B63` pour l'action, surligneur `#F1D84B` pour le sceau du logo et le montant clé, bleu clair `#B9C8DE` sur les
  fonds sombres.
- Typographies (section 3) : Newsreader pour les titres, Instrument Sans pour le texte, DM Mono pour les montants, les
  sources, les dates et les repères.
- Logo : `public/logo-horizontal.svg` (fond clair) et `public/logo-horizontal-fond-sombre.svg` (fond encre),
  `public/logo-symbole.svg` (sceau seul). Icônes de l'application dans `src/app/` (`favicon.ico`, `icon.svg`,
  `apple-icon.png`, `manifest.webmanifest`) et `public/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`). Jamais
  redessinés ni recolorés.
- L'ancienne charte SFG (orange, turquoise, or, vert clair ; Montserrat et Inter) est abandonnée pour ce site. La palette
  Tailwind par défaut reste retirée (`--color-*: initial`) : seules les couleurs ci-dessous existent. Le logo SFG
  (`public/logo-sfg.png`) ne sert plus qu'à la donnée structurée de l'éditeur (`lib/donnees-structurees.ts`).

## 2. Jetons de couleur

Chaque rapport est calculé par script (formule WCAG 2.x). Tableau complet en annexe.

| Classe Tailwind | Valeur | Rôle |
|---|---|---|
| `papier` | `#F4F1E9` | Fond de page. |
| `papier-fonce` | `#EAE5D8` | Sections alternées, carte teintée. |
| `feuille` | `#FBF9F4` | Plans de financement, documents, cartes, champs. `white` vaut aussi `#FBF9F4` : un `bg-white` des composants anciens prend la couleur de la feuille. |
| `filet` | `#CFC8B8` | Traits de séparation (décor : 1,48:1, jamais le contour d'un élément d'interface). |
| `filet-fonce` | `#B9B2A2` | Traits sur papier foncé ; segment des fonds des non-salariés. |
| `pointilles` | `#A9A293` | Pointillés entre un libellé et son montant (décor). |
| `encre` | `#161C27` | Texte principal (15,13:1 sur papier), pied de page, bouton secondaire, contour des champs. |
| `ardoise` | `#4A5262` | Texte secondaire (`texte-doux`), surtitres : 6,96:1 sur papier, 6,24:1 sur papier foncé. |
| `texte-discret` | `#59616F` | Légendes, libellés, texte d'exemple : 5,53:1 sur papier, 4,96:1 sur papier foncé. |
| `filet-fort` | `#7A7364` | Contour d'un élément d'interface quand l'encre serait trop lourde : 4,17:1 sur papier, 3,74:1 sur papier foncé. |
| `prusse` | `#1F3B63` | **Action** : boutons pleins, liens, anneau de focus, bande d'appel. 9,98:1 sur papier ; blanc dessus 11,27:1. |
| `prusse-fonce` | `#172D4C` | Survol des boutons bleus. |
| `surligneur` | `#F1D84B` | Sceau du logo, montant clé, `.mark`, bouton sur fond bleu, focus sur fond sombre. **Jamais de texte de cette couleur** (1,27:1 sur papier) ; encre dessus 11,93:1. |
| `surligneur-doux` | `#F8EFBF` | Fond d'un avertissement (encre dessus). |
| `bleu-clair` | `#B9C8DE` | « opco » du logo sur fond sombre, titres et liens du pied de page (10,07:1 sur encre) ; segment des Régions. Pas sur papier (1,50:1). |
| `texte-sur-prusse` | `#D6DEEA` | Texte secondaire sur le bleu de Prusse (8,31:1). |
| `texte-sur-encre` | `#B9BFCA` | Texte du pied de page (9,25:1 sur encre). |
| `filet-sur-encre` | `#2E3647` | Filets du pied de page (décor). |
| `rouge` | `#BC1723` | Alertes et erreurs : 5,66:1 sur papier, 5,08:1 sur papier foncé. |
| `rouge-soft` | `#F6E3E1` | Fond des alertes. |
| `nuit` | `#0E121A` | Survol du bouton encre. |

Règles qui en découlent :
- le bleu de Prusse est la seule couleur d'action : un lien, un bouton plein, un focus ; il ne décore pas ;
- le surligneur ne colore jamais un texte (`text-surligneur` est interdit, garde : `tests/surlignage.test.ts`) ; il
  passe sous un texte encre ;
- un seul montant surligné par écran (`.montant-cle`) : sur l'accueil, la prise en charge du plan d'exemple ;
- le filet est un décor : un champ, une case ou un bouton à contour prend l'encre ou `filet-fort`.

### Noms historiques

Les composants écrits avant cette charte gardent leurs classes : les noms de l'ancienne palette restent définis dans
`globals.css` et pointent vers les nouvelles valeurs. **Ne pas les employer dans un nouveau code.**

| Nom historique | Devient |
|---|---|
| `orange`, `orange-deep`, `cobalt` | `prusse` |
| `orange-deeper` | `prusse-fonce` |
| `orange-soft`, `turquoise-soft`, `lin`, `lin-soft`, `paper-deep`, `cobalt-soft`, `valid-soft` | `papier-fonce` |
| `orange-clair` | `bleu-clair` |
| `turquoise` | `filet-fonce` |
| `turquoise-deep`, `valid` | `ardoise` |
| `or`, `vert-clair`, `marker` | `surligneur` |
| `or-soft`, `marker-soft` | `surligneur-doux` |
| `vert-clair-soft` | `feuille` |
| `paper` | `papier` |
| `ink`, `ink-soft`, `ink-faint` | `texte`, `texte-doux`, `texte-discret` |
| `navy` | `encre` |
| `alert`, `alert-soft` | `rouge`, `rouge-soft` |
| `rule` | `filet` |

## 3. Typographie

- **Newsreader** 500 (titres `h1` à `h4`, chiffres d'affiche), avec son italique pour l'accent `.mark` et l'axe de taille
  optique (`opsz`). La graisse `bold` du thème vaut 500 : un `font-bold` hérité rend la graisse des titres du kit.
- **Instrument Sans** 400 (texte), 500 et 600 (libellés d'interface, boutons).
- **DM Mono** 400 et 500 : montants, sources, dates de vérification, surtitres et repères de section (« 01 Par
  profil »), étiquettes. `font-mono` désigne DM Mono.
- Aucune autre famille. Replis permis : Georgia et Times New Roman (titres), Helvetica Neue et Arial (texte), Menlo et
  `ui-monospace` (DM Mono), puis les familles génériques.
- Les titres prennent Newsreader par défaut, avec `text-wrap: balance` ; les paragraphes, `text-wrap: pretty`.

Échelle :

| Classe | Valeur | Emploi |
|---|---|---|
| `text-affiche` | `clamp(2.6rem, 1.6rem + 3.6vw, 4.6rem)`, interligne 1,04, interlettrage -0,02em | titre d'accueil |
| `text-titre` | `clamp(2rem, 1.5rem + 2vw, 3.1rem)`, interligne 1,08, interlettrage -0,015em | titre de section, bande d'appel |
| `TitreDeSection` | 30 px, 36 px à partir de 640 px, interligne 1,1 | `h2` des fiches et des guides |
| `text-chapeau` | 18 px, interligne 1,6 | chapeau sous un titre |
| `text-base` | 16 px | texte courant |
| `text-sm` | 14 px | texte de carte, légendes |
| `text-xs` et `.surtitre` | 12 et 13 px | étiquettes, surtitres, mentions |

Chiffres : `.amount` (DM Mono 500, chiffres tabulaires) ; `.montant-cle` pour le seul montant surligné de l'écran.

## 4. Formes, ombres, espacements

- Angles presque droits : tous les rayons de Tailwind (`rounded-sm` à `rounded-4xl`) et les rayons nommés
  (`rounded-carte`, `rounded-panneau`, `rounded-champ`) valent 2 ou 3 px. Pas de pilule ni de disque : `rounded-full`
  ne reste que sur ce qui est rond par nature (puces de liste, bouton radio, indicateur de chargement qui tourne).
- Aucune ombre douce (`shadow-douce` et `shadow-etiquette` ne dessinent rien). La seule ombre est celle, décalée et
  pleine, de la feuille : `.feuille` ou `shadow-flottante` (`10px 10px 0` en `#E4DED0`), réservée au plan de financement
  et aux documents.
- Filets : 1 px `filet` pour séparer ; filet encre au-dessus d'un titre de section (`.rule-double`) ; 1,5 px encre pour
  le contour d'un champ.
- Largeur : contenu dans `max-w-6xl` (1 152 px) avec `px-4 sm:px-6` ; texte courant limité à `max-w-2xl` ou
  `max-w-3xl`.
- Sections de l'accueil : grille `lg:grid-cols-[11rem_minmax(0,1fr)]`, repère numéroté en DM Mono dans la colonne de
  gauche (« 01 Par profil » à « 06 Accompagnement »), fond papier ou papier foncé en alternance.
- En-tête collant : une seule ligne collante, 65 px sous 1 024 px et 73 px au-delà, filet compris (variable
  `--hauteur-entete`, qui règle aussi le décalage des ancres) ; un élément collant se place à
  `top: calc(var(--hauteur-entete) + 1.5rem)` (classe `.sommaire-collant`).

## 5. Primitives

Toutes sont typées, sans dépendance, utilisables dans un composant serveur. Pour assembler des classes, `cx` de
`@/lib/cx`.

### `Button` (`components/ui/Button.tsx`)

Rectangle (angles de 3 px), Instrument Sans 600. Rend un `<button>` sans `href`, un lien Next pour une adresse interne,
un `<a>` pour une adresse externe (nouvel onglet annoncé aux lecteurs d'écran) ou `mailto:`.

| Prop | Valeurs | Défaut |
|---|---|---|
| `variant` | `primary` (bleu de Prusse plein, survol bleu foncé), `secondary` (encre plein), `ghost` (lien souligné bleu de Prusse), `inverse` (surligneur, texte encre, sur la bande bleue) | `primary` |
| `size` | `sm` et `md` 44 px, `lg` 52 px | `md` |
| `fleche` | flèche après le libellé, qui glisse au survol | |
| `icone` | nom d'icône avant le libellé | |
| `pleineLargeur` | `true` ou `'mobile'` (pleine largeur sous 640 px) | |

```tsx
<Button href="/simulateur" size="lg" fleche pleineLargeur="mobile">Trouver mes financements</Button>
<Button href="/contact/" variant="secondary">Décrire mon projet</Button>
<Button href="/simulateur/" variant="inverse" fleche>Trouver mes financements</Button> {/* sur la bande d'appel */}
```

Une seule action `primary` par zone. Le libellé dit ce qui se passe (« Trouver mes financements », pas « Valider »).

### `Card` (`components/ui/Card.tsx`)

`tone` : `plain` (feuille, filet), `teintee` (papier foncé, filet), `orange` et `turquoise` (aplat bleu de Prusse),
`nuit` (aplat encre). `padding` : `none`, `sm`, `md`, `lg`. `as` : `div`, `article`, `section`, `aside`, `li`. Carte
cliquable : `interactive` et, dedans, un lien `lien-etendu` qui porte le titre. Une carte claire remet `--focus` au bleu
de Prusse, même posée sur une surface sombre ; dans un aplat, l'anneau se dessine à l'intérieur du bord, en surligneur.

### `Etiquette` (`components/ui/Etiquette.tsx`)

Rectangle (angles de 2 px), DM Mono en capitales, cadre de 1,5 px, sans pastille. `tone` : `neutre` (filet fort,
ardoise), `orange` (bleu de Prusse plein), `turquoise` (cadre et texte bleu de Prusse), `or` (surligneur, texte encre),
`rouge`, `vert-clair` (cadre ardoise en tirets) ; `variante` `douce` ou `flottante` (feuille et filet, qui passe à la
ligne dans une liste étroite) ; `surFondSombre` (cadre blanc à 40 %, texte blanc).

Les étiquettes de fiabilité des montants restent `ConfidenceBadge` (classe `.stamp`) : `exact` en bleu de Prusse plein,
`estimated` en texte bleu de Prusse, `depends_on_branche` en cadre ardoise en tirets (« selon branche »).

### `SectionTitle` (`components/ui/SectionTitle.tsx`)

Surtitre, titre, chapeau. `as` fixe le niveau (`h1`, `h2`, `h3`), `taille` le rôle visuel (`affiche`, `section`,
`sous-section`). `id` pour un `aria-labelledby` de section. `align` : `start` ou `center`. `surFondSombre`.
`titreFocusable` : le titre reçoit le focus par programme, par exemple à chaque étape du simulateur.

### `Callout` (`components/ui/Callout.tsx`)

Encadré à bord gauche de 3 px, sans pastille d'icône (la prop `icone` est ignorée) : `info` (bord bleu de Prusse,
feuille), `confirmation` (bord ardoise, feuille), `avertissement` (bord encre, surligneur doux), `alerte` (bord rouge,
rouge doux), avec `titre` facultatif. Un préfixe réservé aux lecteurs d'écran annonce le ton (« Alerte : »). Contenu
statique : pas de `role="alert"`.

### `Icon` (`components/ui/Icon.tsx`)

Grille 24 px, trait 1,75 px, `currentColor`. Pour les icônes **fonctionnelles** seulement : flèche d'un bouton, lien
externe, courriel, menu, fermer, chevron d'un repli, loupe. Aucune icône décorative dans une pastille de couleur : les
cartes, les étapes et les financeurs s'en passent (un numéro en DM Mono, un carré de couleur). Décorative par défaut
(`aria-hidden`) ; `titre` lui donne un nom quand elle porte seule un sens. Pas d'émoji.

### `Logo` (`components/site/Logo.tsx`)

Un `<img>` aux dimensions explicites (523 x 103), `fond="clair"` ou `fond="sombre"`, `taille` `compacte` (36 px de
haut, en-tête sous 1 024 px) ou `normale` (44 px). Jamais recoloré, déformé ni ombré ; zone de protection d'au moins la
largeur du sceau ; 140 px de large au minimum.

### `Sommaire` (`components/site/Sommaire.tsx`)

Sommaire d'une page longue (fiches OPCO, guides), composant client : `entrees` (`id`, `libelle`, `compte` facultatif en
cadre rouge), `etiquette`, `numerote` (« 01 », « 02 » en DM Mono). Le nombre est muet pour les lecteurs d'écran, qui
l'entendent en toutes lettres (« Alertes (12 alertes) »). Sous 1 024 px, bloc replié `<details>` ; au-delà, colonne
`.sommaire-collant` où la section à l'écran porte un trait bleu de Prusse de 2 px et `aria-current="location"`.

### `TitreDeSection` (`components/site/TitreDeSection.tsx`)

Titre `h2` des fiches et des guides : Newsreader 500, 30 puis 36 px, focalisable par programme, chapeau facultatif ; la
section porte au-dessus son filet encre `.rule-double`. Un mot plus long que la ligne s'y coupe (`break-words`).

### `Abreviation` (`components/ui/Abreviation.tsx`)

Sigle défini à sa première occurrence par une infobulle (`<abbr title>`, souligné en pointillé) ; `TexteAvecSigles`
définit chaque sigle donné à sa première occurrence (`definirAbreviations`, `lib/sigles.ts`). Une fois par page ; un
sigle écrit dans un texte du site l'est en toutes lettres suivies du sigle.

### `BandeAppel` (`components/site/BandeAppel.tsx`)

Bande d'appel de fin de page : aplat bleu de Prusse (`surface-orange`), `h2` Newsreader blanc, phrase facultative en
`texte-sur-prusse`, `Button` inverse. Une par page : l'accueil (« Cinq minutes pour chiffrer votre projet. ») et chaque
guide.

```tsx
<BandeAppel id="titre-appel" titre="Cinq minutes pour chiffrer votre projet." libelle="Trouver mes financements" />
```

### Plan de financement (accueil, `PlanDeFinancement` dans `app/page.tsx`)

Une feuille (`.feuille`) : lignes `.ligne-montant` (libellé, `.pointilles`, montant en DM Mono), total sous un filet
encre, la prise en charge en `.montant-cle`. Exemple étiqueté comme tel, montants fictifs.

### Classes signatures (`globals.css`)

| Classe | Rendu |
|---|---|
| `.surtitre` | DM Mono 13 px, ardoise, sans pastille ; `texte-sur-prusse` ou `texte-sur-encre` sur une surface sombre |
| `.marginalia` | DM Mono 12 px en capitales, texte discret (libellés du simulateur) |
| `.amount` | chiffres DM Mono 500 tabulaires |
| `.montant-cle` | le montant surligné de l'écran : DM Mono 500, surligneur sous le bas des chiffres |
| `.stamp` | étiquette DM Mono en capitales, cadre de 1,5 px dans la couleur du texte (`text-*`) |
| `.mark` | accent d'un titre : italique, surligneur posé sous le bas des lettres (ombre intérieure), redessiné sur chaque ligne (`box-decoration-break: clone`) ; aplat plein et texte encre sur une surface sombre ; souligné à l'impression. Garde : `tests/surlignage.test.ts` |
| `.mark-groupe` | groupe d'un surlignage et de sa ponctuation, qui ne déborde pas de la ligne |
| `.ligne-montant`, `.pointilles` | ligne libellé, pointillés, montant |
| `.feuille` | feuille de document : fond feuille, filet, ombre décalée pleine |
| `.rule-double` | filet encre au-dessus d'un titre de section |
| `.lien` | lien dans un texte : bleu de Prusse souligné, encre au survol ; blanc sur la bande bleue, bleu clair sur l'encre |
| `.lien-etendu` | lien qui couvre sa carte |
| `.sommaire-collant` | sommaire collant sous l'en-tête |
| `.surface-orange`, `.surface-turquoise` | aplat bleu de Prusse, texte blanc, focus surligneur |
| `.surface-encre`, `.surface-nuit` | aplat encre, texte `texte-sur-encre`, focus surligneur |
| `.aplat-turquoise` | ancien aplat de marque, devenu papier foncé (décor) |
| `.apparition` | apparition douce (délai par la variable `--delai`) |
| `.devoilement` | la barre empilée des résultats se dévoile de gauche à droite |
| `.reflet` | ancien balayage lumineux, retiré (classe sans effet, gardée pour les composants anciens) |

## 6. Aplats, couleurs des financeurs et icônes

- Aucun dégradé : les surfaces d'accent sont des aplats pleins, bleu de Prusse (bande d'appel) ou encre (pied de page,
  carte `nuit`). La garde de charte refuse tout dégradé dans `apps/web/src` (section 12).
- Un aplat marque une zone courte : bande d'appel, récapitulatif. Jamais derrière un long texte, jamais deux aplats côte
  à côte.
- Familles de financeurs (barre empilée et lignes du plan de l'écran de résultats, `components/results/Financeur.tsx`) :
  OPCO en bleu de Prusse, CPF en surligneur, Régions en bleu clair, État et France Travail en ardoise, fonds des
  non-salariés en filet foncé, Europe en encre, autres en filet. Chaque segment porte un bord encre à 45 %
  (`BORD_SEGMENT`) : les teintes claires restent visibles sur la feuille (3,20:1 au moins). Le reste à charge est la
  feuille dans un cadre encre en pointillés, jamais une couleur de financeur. Dans le plan, un financeur est repéré par
  un carré de sa couleur, sans icône ; son nom est toujours écrit à côté.
- Étapes, démarches et numéros de section : un chiffre en DM Mono ardoise, sans disque ni pastille.

## 7. Mouvement, accessibilité, impression

- Mouvement sobre : apparition douce au chargement (0,5 s), barre des résultats qui se dévoile, flèche de bouton qui
  glisse. Sous `prefers-reduced-motion: reduce`, tout s'arrête (état final immédiat), y compris le filet de l'en-tête lié
  au défilement.
- Zoom et espacement de texte (WCAG 1.4.10 et 1.4.12, contrôlés à 320, 375 et 640 px) : aucun texte rogné ni défilement
  horizontal de la page. Un mot plus long que sa ligne se coupe (`break-words`, `[overflow-wrap:anywhere]` pour une
  adresse électronique), une rangée de boutons passe à la ligne, un tableau trop large défile dans son cadre
  (`overflow-x-auto`).
- Focus visible partout : anneau de 2 px décalé de 3 px, bleu de Prusse sur fond clair, surligneur sur les aplats bleu
  et encre (`--focus` par surface). Ne jamais retirer `outline` sans le remplacer, et ne pas mettre
  `transition-colors` sur un élément focalisable ; écrire `transition-[color,background-color,border-color]`.
- Contrôles natifs : `accent-color` bleu de Prusse ; texte d'exemple en texte discret ; champ prérempli par le
  navigateur recouvert de la feuille, texte encre.
- Cibles tactiles d'au moins 44 px sous 1 024 px.
- Hiérarchie : un seul `h1` par page ; titres de section reliés par `aria-labelledby`.
- Lien d'évitement « Aller au contenu » en tête de page (cible `#contenu`).
- Impression : en-tête et pied masqués, aplats rendus sur fond blanc en texte foncé, ombre de la feuille retirée,
  surlignage devenu soulignement bleu de Prusse, décors (`.decor`) retirés, animations coupées. La barre empilée des
  résultats garde ses couleurs (`[print-color-adjust:exact]`).

## 8. En-tête et pied de page

- En-tête (`components/site/SiteHeader.tsx`, composant serveur) : fond papier, collant, filet fin. Seuls la page active
  et le menu mobile s'exécutent dans le navigateur (`NavigationClient.tsx`).
  - Navigation : Simulateur, Employeurs, Salariés, Demandeurs d'emploi, CPF, Les 11 OPCO, Contact. Page active : texte
    encre 600 souligné de 2 px en bleu de Prusse, `aria-current="page"` ; aucune pilule ni point.
  - À partir de 1 280 px, une seule ligne (logo, navigation, bouton principal) ; de 1 024 à 1 279 px, la navigation
    suit sur une seconde ligne qui défile avec la page ; sous 1 024 px, logo compact et bouton « Menu » (Échap, clic sur
    le voile, sortie du focus et changement de page le referment).
  - Le bouton principal s'efface sur le simulateur.
- Pied de page (`components/site/SiteFooter.tsx`) : aplat encre, logo pour fond sombre, phrase de présentation, adresse
  `contact@financementopco.fr` en DM Mono bleu clair, colonnes Profils, Guides et Sources (titres DM Mono bleu clair en
  capitales), puis une dernière ligne : « Site édité par SFG Développement · Mentions légales et données » et la date
  des critères en DM Mono (« Critères 2026 · vérifiés en » suivi du mois de la vérification la plus récente des
  barèmes des OPCO, `verificationLaPlusRecente`).
- SFG Développement apparaît à deux endroits seulement : cette ligne du pied de page et la section « Accompagnement » de
  l'accueil (« Accompagnement assuré par SFG Développement, organisme de formation certifié Qualiopi. »). Les mentions
  légales et la page « À propos » le présentent en entier.
- **Mode intégré** (site affiché dans un cadre d'une autre page, `docs/integration-wordpress.md`) : un script de deux
  lignes (`lib/integration.ts`, posé dans `<head>` par `layout.tsx`) pose `data-integre` sur `<html>` quand la fenêtre
  n'est pas celle du sommet. La feuille de style masque alors l'en-tête, la seconde ligne de navigation et le pied, et
  ramène `--hauteur-entete` à 0. Aucun stockage, aucun cookie, aucune requête (`tests/integration.test.ts`).

## 9. Rédaction (tout texte visible)

- Jamais de tiret cadratin : virgule, parenthèses, deux points, point-virgule ou deux phrases.
- Pas d'émoji. Les signes typographiques déjà présents (coche, flèche) sont tolérés ; pour du nouveau travail, `Icon`.
- Le nom du site s'écrit en minuscules : financementopco ; le domaine, financementopco.fr. Contact :
  `contact@financementopco.fr` (`lib/contact.ts`).
- Ton de collègue expert de la formation : phrases de longueur variée, vocabulaire concret, position claire.
- À proscrire : « il est important de noter que », « de plus », « n'hésitez pas à », « dans le monde d'aujourd'hui »,
  les questions rhétoriques d'ouverture, les triades répétées, les résumés automatiques, les adverbes d'intensité, le
  gras et les titres à profusion.
- Apostrophes droites dans le code (`'`, `&apos;` en JSX), accents complets, espaces insécables avant « : ; ? ! ».
- Aucune affirmation nouvelle : un chiffre affiché vient des données (`@opco/core`) ou d'une source officielle citée. Un
  exemple est étiqueté « Exemple » et ses montants dits fictifs ; il ne porte ni étiquette de fiabilité ni lien de
  source.
- Une idée, une fois par page.

## 10. À ne pas faire

- Une couleur hors de la palette (classe, hexadécimal, `rgb()`), et en particulier les anciennes couleurs SFG.
- Une police autre que Newsreader, Instrument Sans et DM Mono.
- Un texte en surligneur, du bleu clair sur papier, du texte en opacité sur un aplat.
- Un dégradé, une ombre douce, une carte arrondie, une pilule, une pastille d'icône décorative.
- Plus d'un montant surligné par écran.
- Recolorer, déformer, ombrer ou redessiner le logo.
- Les noms historiques (`orange`, `turquoise`, `cobalt`, `ink`…) dans un nouveau code.
- Une marge `scroll-mt-*` sur une cible d'ancre : `scroll-padding-top` de `html` compte déjà l'en-tête.
- Un sélecteur CSS accroché à un texte (`nav[aria-label="…"]`) : une classe.
- Une étiquette de fiabilité ou « Source officielle » sur un montant d'exemple.
- Un composant client pour du rendu statique : seuls l'état et les événements justifient `'use client'`.

## 11. Liste de contrôle d'un nouvel écran

1. Les couleurs viennent des jetons de la charte, pas des noms historiques ni de valeurs écrites en dur.
2. Chaque couple texte / fond nouveau est ajouté au tableau des contrastes et atteint 4,5:1 (3:1 pour un grand texte,
   un contour d'élément d'interface ou un graphique).
3. Titres : un `h1`, des titres de section reliés par `aria-labelledby` ; Newsreader 500 ; chapeau en
   `text-chapeau text-texte-doux`.
4. Actions : une `Button primary` par zone, libellé qui dit le résultat ; liens internes avec `/` final.
5. Montants en DM Mono ; au plus un `.montant-cle`.
6. Rendu vérifié à 375, 768 et 1 280 px, sans débordement horizontal (`document.documentElement.scrollWidth` égal à la
   largeur de la fenêtre).
7. Navigation au clavier : ordre logique, focus visible, menus fermables par Échap.
8. Mouvement coupé sous `prefers-reduced-motion`, impression lisible.
9. Textes relus selon la section 9 ; `npm run check:charte` au vert.
10. Aucune affirmation qui devance le produit : toute promesse se vérifie contre l'écran réel.

## 12. Garde de charte

`npm run check:charte` (script `scripts/check-charte-sfg.mjs`, Node seul) parcourt `apps/web/src/**/*.{ts,tsx,css}`
(toutes les règles) ainsi que `apps/web/tests/` et ce fichier (tirets et émojis seulement), et signale, avec fichier,
ligne et colonne (code de sortie 1 en cas de problème) :

- le tiret cadratin et ses variantes (U+2014, U+2015, U+2E3A, U+2E3B, U+FE31, U+FE58), écrits tels quels, en entité HTML
  (`&mdash;`, `&horbar;`, `&#8212;`, `&#x2014;`), en échappement JavaScript ou CSS ;
- les anciennes couleurs de la charte SFG (orange `#E84E1B`, `#C43F13`, `#A93510`, `#FDF0EA`, `#F56A31`, turquoise
  `#5E9F92`, `#3E6860`, `#EDF5F2`, or `#F9B233`, `#FEF4DE`, vert clair `#A3D1C8`, `#E6F2EF`) et toute couleur très
  proche (écart OKLab inférieur à 0,02, sauf si une couleur du kit est plus proche encore), écrites en hexadécimal, en
  fonction de couleur (`rgb()`, `hsl()`, `oklch()`…) ou en couleur nommée CSS dans un contexte de couleur ; les classes
  Tailwind de l'ancienne palette sur les 49 utilitaires de couleur, seulement si le jeton n'est plus défini dans
  `globals.css` (un nom historique qui pointe vers la nouvelle charte est permis) ;
- toute police hors charte : sont permises Newsreader, Instrument Sans et DM Mono, les replis Georgia, Times New Roman,
  Helvetica, Helvetica Neue, Arial, Menlo, et les familles génériques ; Montserrat, IBM Plex et les variables
  `--font-montserrat`, `--font-inter`, `--font-plex` sont signalées partout hors commentaires ;
- les émojis, sous toutes leurs écritures, sauf les signes typographiques tolérés sans sélecteur : ✓ ⚠ ↗ ▸ ▾ © ® ™ ;
- les dégradés, dans `apps/web/src` seulement et hors commentaires : `linear-gradient()`, `radial-gradient()`,
  `conic-gradient()`, leurs variantes `repeating-` et préfixées, utilitaires `bg-linear-*`, `bg-radial*`, `bg-conic*`,
  `bg-gradient-*`.

Un code qui doit reconnaître un tiret ou un émoji construit le caractère (`String.fromCharCode(0x2014)`,
`String.fromCodePoint()`) au lieu de l'écrire.

`npm run check:tirets` (option `--tirets`) cherche les seuls tirets cadratins et leurs variantes dans tous les fichiers
texte suivis du dépôt (`git ls-files`, hors données JSON de `datasets/` et de `packages/core/data/`, contrôlées par
`packages/core/tests/charte-sfg.test.ts`). Les deux contrôles sont des étapes de l'intégration continue.

`node scripts/check-charte-sfg.mjs --self-test` vérifie la garde sur 204 cas : chaque règle a une violation et un jumeau
propre. Limites : la garde lit le texte source, pas le rendu ; une couleur calculée à l'exécution, un hexadécimal sans
contexte de couleur, une couleur encodée dans une image SVG en data URI, une police rangée dans une constante, un
dégradé SVG (`<linearGradient>`), une image ou une icône aux anciennes couleurs lui échappent.

## 13. Dette connue

| Élément | Où | Pourquoi il reste | À retirer par |
|---|---|---|---|
| Noms historiques de couleur (`--orange`, `--turquoise`, `--or`, `--vert-clair`, `--lin`, `--paper`, `--ink`, `--cobalt`…) | `globals.css` (`:root`, `@theme inline`) et la plupart des composants | Ils pointent vers la nouvelle charte : les composants anciens l'ont adoptée sans réécriture de leurs classes. | Réécrire les classes composant par composant, puis supprimer les définitions et le tableau « Noms historiques » (section 2) |
| Noms de tons historiques (`Card tone="orange"`, `Etiquette tone="turquoise"`, `.surface-orange`) | primitives, `globals.css` | Mêmes raisons : le nom ne dit plus la couleur. | Renommer (`prusse`, `encre`…) en même temps que les classes |
| Classes sans effet (`.reflet`, `shadow-douce`, `shadow-etiquette`) et prop `icone` du `Callout` | `globals.css`, composants | Gardées pour ne pas toucher tous les appels en une fois. | Retirer les emplois, puis les définitions |
| Sections 14 à 16 de ce guide | ce fichier | Écrites pour l'ancienne charte ; leurs noms de couleur sont les noms historiques (section 2). | Réécriture au prochain passage sur le simulateur, les résultats et les fiches |
| Espaces ordinaires à l'intérieur des guillemets d'un extrait cité | textes des données et du moteur | `typo()` ne touche jamais une citation (mot pour mot). | À trancher : insécables autour des guillemets dans les données (`@opco/core`) |

## 14. Parcours du simulateur

> Les sections 14 à 16 datent de l'ancienne charte et n'ont pas encore été réécrites. Leurs noms de couleur sont les
> noms historiques (section 2) : lire « orange-deep » comme bleu de Prusse, « turquoise » comme filet foncé,
> « turquoise-deep » comme ardoise, « lin » et « lin-soft » comme papier foncé, « or » et « vert-clair » comme
> surligneur. Les pastilles d'icône, les disques numérotés, les pilules, les rayons de 12 à 28 px et les dégradés
> qu'elles décrivent ont disparu (sections 4 à 6) ; les couleurs des financeurs sont celles de la section 6.

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
  financement », `ID_TITRE_RESULTATS`) ; au retour par « Modifier mes informations », titre « Récapitulatif » (seul
  `showResults` change : l'effet en dépend aussi) ; après « Nouvelle simulation », titre de l'étape Projet. L'écran de
  résultats est chargé à la demande : son titre peut ne pas exister quand `showResults` passe à vrai. L'attente du
  chargement affiche l'en-tête réel de l'écran, titre focalisable compris (le parcours y pose le focus), puis l'écran,
  comme l'écran d'échec du chargement, pose le focus sur son propre titre à son montage (section 15).
- **Navigation** : `Button` secondary « Retour » (flèche seule sous 640 px, nom gardé) et primary « Suivant ». Tant que
  l'étape est incomplète, « Suivant » reste atteignable au clavier mais porte `aria-disabled`, grisé (texte-discret sur
  lin), et un texte dit ce qui manque (« Pour continuer, indiquez la région et la taille de l'entreprise. »), relié par
  `aria-describedby`. À l'étape Participants, un groupe de plusieurs profils dont l'un n'est pas un dirigeant exige
  l'OPCO : s'il manque (un salarié ajouté à un groupe de dirigeants, après l'étape Entreprise), le texte dit
  « l'OPCO (étape 2) ». Sous 1 024 px la barre colle au bas de l'écran (cibles de 44 px) ; au récapitulatif, qui se lit
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
- **Étape Participants** (`StepSituation`, `CarteProfil`, `FormulaireProfil`, `CompteurPersonnes`) : avec un seul
  profil, l'étape garde l'allure d'une personne seule (les questions de son statut) et ajoute le compteur « Nombre de
  personnes » et le bouton secondaire « Ajouter un profil différent ». Dès qu'il y a plusieurs profils, une `Card` par
  profil : titre `h3` que le focus atteint par programme (« Profil 2 »), étiquette du statut, résumé en puces
  (`pucesDuProfil` : contrat, type d'alternance ou statut du dirigeant, puis âge, diplôme, RQTH, solde CPF), compteur
  (sous le titre quand la place manque, donc sur téléphone : la colonne du titre garde au moins 12 rem), puis les
  questions dans un volet qui se replie sur son résumé (`aria-expanded` ; le volet reste dans la page, `hidden`, et ses
  champs gardent leur état). Un seul profil est déplié à la fois ; replié, un profil dit ce qui lui manque
  (« À compléter : le type de contrat », `manquantsDuProfil`). Au-delà d'une personne, une phrase en tête rappelle que
  les réponses valent pour chacune, et l'aide du solde CPF conseille de prendre le plus bas ou de créer un profil par
  solde. Le compteur est un champ texte entier de 1 à 99 entre deux boutons ronds de 44 px, 40 px dès 1 024 px
  (« Retirer une personne », « Ajouter une personne », `aria-disabled` aux bornes pour que le focus ne se perde pas) ;
  une saisie refusée (vide, zéro, négatif, décimal, texte) laisse la valeur retenue, que le champ reprend en le
  quittant, et une saisie au-delà de 99 (ou de la place que laissent les autres profils) est ramenée à cette borne
  (`lireEffectif`). Chaque compteur porte sa propre zone `role="status"` (une par compteur, donc une par carte de
  profil) qui dit le nombre retenu et, dans une carte, nomme le profil (« Profil 2 : 4 personnes ») ; l'aide du
  compteur est reliée au champ de saisie (`aria-describedby`) et ses deux signes, dessinés par des fonds, gardent leur
  couleur en contraste forcé (`forced-colors:bg-[CanvasText]`) ; la zone d'annonce de l'étape, elle aussi `role="status"`, dit « Profil 2 ajouté.
  4 personnes au total. » ou « Profil 2 retiré. 3 personnes au total. ». Le focus va au titre du profil ajouté puis,
  au retrait, à celui du profil précédent (au bouton d'ajout quand il ne reste qu'un profil). À 6 profils ou
  99 personnes, le bouton porte `aria-disabled` et une phrase dit la limite (« Le groupe compte déjà 6 profils, le
  maximum. »). Un profil supplémentaire démarre au statut
  du profil principal et sa première question est ce statut ; en changer remet à vide les réponses que le nouveau
  statut ne pose pas (`champsDepuisProjet` ; l'âge, le diplôme et la RQTH sont gardés).
- **Prix d'un groupe** (étape Formation) : à partir de deux personnes, « Le prix saisi est » propose « Par personne »
  (par défaut, sauf si un prix de groupe est déjà saisi) et « Pour le groupe » ; le libellé du coût suit le mode et une
  aide donne le prix de l'autre (`aideDuPrix` : « Soit 2 800 € par personne. » ou « Soit 11 200 € pour les
  4 personnes. »). Changer de mode convertit le prix sans le ressaisir (`basculerModePrix`). Le coût horaire, le plafond
  indicatif et l'avertissement de dépassement sont ceux d'une personne et le disent. L'état garde `prixDuGroupe` tant
  qu'un prix de groupe est saisi ; `pedagogyCostTotal` reste le coût d'une personne, que le moteur lit
  (`normaliserGroupe`, `etatDepuisPrix`, `lib/groupe.ts`) ; le champ du prix n'affiche que des centimes (`auCentime`)
  sans réécrire dans l'état le nombre affiché. Les frais annexes saisis sont ceux d'une personne, comptés pour chacune.
- **Largeurs étroites** : sous 360 px, la grille des modes de transport passe à une colonne et les cartes Entreprise et
  OPCO posent leur pastille au-dessus du titre ; la liste des régions décide sur la largeur de son conteneur (requête de
  conteneur, `@min-[18.5rem]` : deux colonnes à partir de 296 px de grille et jusqu'à 767 px de fenêtre, trois dès
  768 px, règles exclusives par `max-md`), car celle d'une carte de profil est plus étroite que celle de l'étape
  Entreprise à la même largeur de fenêtre. Aucun mot n'est coupé (« Guadeloupe », « Bourgogne- », « Normandie » ou
  « SFG DEVELOPPEMENT » ne tenaient plus sur leur ligne). `break-words` ne reste qu'en dernier recours, pour un mot plus
  long que la carte.
- **Champs** : 48 px, rayon 12 px, contour filet-fort, orange-deep au focus, rouge en erreur. Libellé Inter 600, aide
  en texte-discret et erreur en rouge avec icône, entre le libellé et le champ ; l'erreur paraît quand on quitte le
  champ et s'annonce poliment. Les nombres se lisent à la française (`lib/saisie.ts`) : milliers collés ou groupés par
  trois chiffres avec des espaces (insécables et fines comprises) ; décimales, dans un champ décimal, après une virgule
  ou un point suivi d'un ou de deux chiffres ; virgule et point ensemble, le dernier est décimal et l'autre groupe les
  milliers par trois (« 1.500,50 ») ; « € » ou « euros » final accepté dans un montant (`euros`), refusé ailleurs. Toute
  ambiguïté est refusée avec son explication, jamais devinée : « 1.500 » ou « 1,500 » (« Pour 1 500 €, écrivez 1500 ou
  1 500 ; la virgule sert aux centimes. »), « 1 5 00 », un nombre trop grand, une virgule dans un champ entier.
- **Coût horaire** (`coutsDeFormation`, `lib/parcours.ts`) : le coût total divisé par la durée, jamais arrondi dans
  l'état ; le moteur le multiplie par la durée, et arrondi au centime il faisait financer 4 250,40 € pour 4 250 €
  demandés (30,36 €/h × 140 h). L'affichage l'arrondit (`formatEuro` : « 30,36 €/h ») ; à l'étape Formation, le
  dépassement du plafond indicatif se juge au centime affiché (`depassePlafondHoraire` : jamais « 30 €/h dépasse le
  plafond de 30 €/h » dans l'encadré de l'étape). Ce « jamais » ne vaut que pour l'étape Formation : le moteur compare le
  coût non arrondi (4 200,50 € sur 140 h, soit 30,0036 €/h, dépassent de 0,50 € un plafond de 30 €/h, financés 4 200 €)
  et, quand le coût horaire arrondi au centime égale le plafond, il écrit le dépassement en euros, dans le détail du
  calcul et les points d'attention (« Le coût demandé dépasse le plafond AKTO (30 €/h) de 0,50 € sur la formation : ce
  montant reste à charge. »), jamais en €/h. Le texte du moteur écrit le coût horaire à trois décimales ou plus
  (« 17.875 €/h ») : l'écran l'arrondit comme l'étape Formation (« 17,88 €/h », `texteMoteur`, section 15).
- **Champs masqués** : un champ que l'écran ne montre plus revient à vide, car le moteur et le profil des aides lisent
  tout l'état : questions d'un autre statut et budget déjà consommé d'un projet qui n'ouvre pas le budget de l'OPCO
  (`etatDepuisProjet` pour le profil principal, `champsDepuisProjet` pour chaque profil ; le budget reste tant qu'un
  profil relève d'un projet salarié), besoins de frais et nombre de jours quand l'étape Frais est sautée
  (`etatDepuisModeFormation`). Un prix de groupe ne survit pas à un groupe réduit à une personne (`normaliserGroupe`).
  Audit et test : `tests/parcours.test.ts` (« aucun champ invisible ne pèse sur le résultat »).
- **Région** (`ChampRegion`) : la région connue s'affiche avec « Modifier », qui ouvre la liste sur la région choisie ;
  un choix referme la liste et rend le focus au nom de la région.
- **Recherche d'entreprise et sources** (`StepIdentification`, `lib/entreprise.ts`, `lib/mentions.ts`) : sous le champ,
  une phrase dit que la recherche interroge l'API Recherche d'entreprises de l'État et que le site n'en conserve rien,
  avec le lien « Mentions légales et données » vers la rubrique « Données personnelles », ouvert dans un nouvel onglet
  (quitter le simulateur effacerait les réponses, que le site ne garde nulle part). Sous les résultats et au bas de la
  carte de l'entreprise : « Source : API Recherche d'entreprises (DINUM), données SIRENE de l'INSEE, licence ouverte
  2.0. » (`SOURCE_ENTREPRISES`). Le sigle IDCC est défini à sa première occurrence dans les résultats (`Abreviation`,
  `<abbr title>`). La carte de l'OPCO recalcule la résolution depuis l'état par `entreeDeResolution` (conventions, code
  NAF, catégorie juridique : un employeur public sans convention ne reçoit aucun OPCO d'après son code NAF) ; quand
  l'OPCO présélectionné vient du code NAF (`preselectionParNaf` : sans les suggestions, le résolveur ne l'aurait pas
  présélectionné), le motif est suivi de la source des suggestions (« Source de la suggestion : Table SIRET-OPCO de
  France compétences (data.gouv.fr), licence ouverte 2.0, mise à jour du 24/09/2026. »). Motifs et avertissements du
  résolveur passent par `texteDuResolveur` (dates JJ/MM/AAAA, espaces insécables : « 86 % des établissements »). Ces
  lignes de source et d'information sont en Inter 12 px, texte-discret (5,35:1).
- **Alertes** : `Callout` avertissement pour le plafond horaire indicatif (rien n'est bloqué) ; le rouge reste réservé
  aux saisies refusées et à l'échec de la recherche d'entreprise.
- **Récapitulatif** : une `Card` par étape (pastille d'icône, `h3`, « Modifier ») ; une valeur absente s'écrit
  « Non renseigné » en texte-discret, jamais un tiret ; une réponse « Je ne sais pas » ou « Ne sait pas » s'écrit telle
  quelle. Libellés propres à la section : « Objectif » (section Projet), « Intitulé » (nom de la formation). Le lot de
  l'écran de résultats s'y précharge (section 15). Un groupe de plusieurs profils a une section « Participants » (le
  total, « 4 personnes · 2 profils », comme à l'étape Participants) puis une section « Profil N » par profil
  (personnes, statut, réponses) ; un groupe d'un seul profil garde la section « Participants » avec une ligne
  « Personnes » de plus. Dès deux personnes, la section Formation écrit le coût par personne, le coût pour le groupe et
  le coût horaire par personne, et la section Frais annexes commence par une ligne « Montants saisis » (« Pour une
  personne, comptés pour chacune des 4 personnes »).
- **Limite connue** : un dirigeant « assimilé salarié » dont l'entreprise relève d'un OPCO peut relever du plan de
  développement des compétences de sa branche (Afdas : « dirigeants salariés » ; Uniformation : « dirigeants bénévoles
  dans certaines branches ») ; le projet « Former le dirigeant » n'affiche pourtant ni plafond horaire ni budget OPCO,
  et l'écran de résultats ne calcule ce plan que pour les projets salariés (former, reconvertir : `ouvreBudgetOpco`,
  dans `calculer`, `lib/resultats.ts`). Une note le dit au dirigeant (`titreNoteOpco` : « Pas de calcul du plan de
  développement des compétences pour ce projet » sans OPCO, la saisie manuelle de ce projet n'en demandant pas ;
  « OPCO non compté pour un dirigeant » avec un OPCO ; corps inchangé, avec le cas de l'assimilé salarié ; un groupe,
  `notesOpco`, section 15). Hors périmètre.
- **Mois de début prévu** (étape Formation, `MM/AAAA`) : un mois inexistant (« 13/2026 ») est une erreur comme une
  saisie mal formée (`erreurDuMoisDeDebut`, `lib/parcours.ts` : « Ce mois n'existe pas : écrivez un mois de 01 à 12 »),
  signalée quand on quitte le champ (`aria-invalid`, message relié).

## 15. Écran de résultats (« Votre plan de financement »)

Composants : `components/results/` (`EcranResultats` ; `PlanFinancement`, `BandeauSynthese`, `BarreEmpilee`, `ParProfil` ;
`AidesList`, `AideCard` ; `FundingBreakdown`, `DetailParPoste`, `DispositifsOpco`, `BadgeEstimation` ;
`PortailsRegionaux`, `Financeur` ; `EtatsResultats` et `FiletTricolore`, seuls du lot initial). Calcul (`calculer`) et
logique de présentation en fonctions pures : `lib/resultats.ts` ; encadrés du bandeau (aucun financement chiffré, fonds
épuisés) : `lib/encadres-resultats.ts` ; étiquettes de la situation : `lib/situation.ts`, sans le catalogue ;
préchargement : `lib/prechargement.ts` (tests : `tests/resultats.test.ts`, `tests/resultats-groupe.test.ts`, `tests/prechargement.test.ts`). Chaque
montant vient du moteur (`@opco/core`) et n'est arrondi qu'à l'affichage (`formatEuro` : un montant entier sans
décimales, tout autre avec deux, « 1 500,50 € », jugé au centime près), y compris dans les textes du moteur (voir
« Textes des données » plus bas) ; un montant d'aide non éligible n'est jamais affiché.

- **Chargement** : `EcranResultats` est chargé à la demande par `WizardContainer` (`next/dynamic`, `ssr: false`) : le
  catalogue d'aides (lot de 798 691 octets bruts, 150 418 octets gzip, build du 08/10/2026) et le calcul restent hors du
  lot initial du simulateur. Le parcours ne lui passe que l'état et deux actions ; le calcul est une dérivation pure de l'état
  (`calculer`, en `useMemo`), la date du jour est lue dans le composant, jamais dans `@opco/core`. Le lot est préchargé
  dès l'étape Récapitulatif (`prechargerEcranResultats`, fait par `creerPrechargeur` : la même fonction de chargement que
  `next/dynamic`, une fois par page, échec absorbé) : une coupure de connexion après le récapitulatif ne l'empêche plus
  de s'afficher. Jamais hors ligne (`navigator.onLine` faux) : un lot en échec le resterait toute la session ; le
  préchargement attend alors l'événement `online` (écouteur retiré dès qu'il est lancé ou que l'étape change).
- **Attente** (`ChargementResultats`) : l'en-tête réel de l'écran (`EnTeteResultats` : titre focalisable, actions,
  étiquettes de la situation), puis un squelette du bandeau seul (`aria-busy`, « Calcul en cours… », `FiletTricolore`,
  le même composant que le bandeau). `next/dynamic` ne passe aucune propriété à son composant d'attente : le parcours
  les lui donne par `ContexteResultats`. Le bandeau ne bouge plus à l'arrivée de l'écran (scénario 1, haut du bandeau :
  728 puis 728 px à 375 px de large, au lieu de 585 puis 728 ; 563 puis 563 px à 1 280 px, au lieu de 514 puis 563).
  La zone d'attente occupe au moins la hauteur de l'écran (`min-h-svh`) : à 1 280 × 900, le pied de page sombre restait
  visible sous le squelette (haut à 631 px) puis sortait de la vue à l'arrivée de l'écran, décalage de mise en page de
  0,2989 (API `layout-shift`, source `FOOTER`, lot retenu 2,5 s) ; après, pied à 1 101 px pendant l'attente et 0
  décalage, à 1 280 × 900 comme à 375 × 812 (où il était déjà nul).
- **Échec du chargement** (`EchecChargementResultats`) : le chargeur de Turbopack garde la promesse d'un lot qui a
  échoué, un nouvel essai sans recharger la page n'émet aucune requête ; les réponses ne sont enregistrées nulle part
  (certaines sont sensibles : âge, handicap), recharger les efface. L'écran le dit (`Callout` alerte « L'écran de
  résultats n'a pas pu se charger » : connexion peut-être coupée, recharger la page, réponses à saisir de nouveau) et
  ne propose qu'un bouton, « Recharger la page » (`window.location.reload()`) ; le focus va à son titre.
- **Ordre** : titre `h2` et actions (Modifier, Imprimer : libellés courts sous 640 px, nom accessible complet ; la
  rangée passe à la ligne, `flex-wrap`, plutôt que de déborder à 640 px avec l'espacement de texte), étiquettes de la
  situation (projet, OPCO, région, durée, écrite par `nombreEtUnite` : « 1 500 h »), bandeau de synthèse, note sur
  l'OPCO s'il y a lieu, cartes du plan, détail par profil (`h2`, à partir de deux profils et d'un coût connu), aides par
  financeur (`h2`), détail de l'estimation OPCO (`h2`), portails de la région (`h2`), mention, date de la simulation et
  actions. Aucun élément collant.
- **Bandeau de synthèse** : carte blanche à grands chiffres (`rounded-panneau`, filet turquoise / or / orange en tête),
  pas un dégradé : le reste à charge est en orange foncé (5,16:1 sur blanc ; moins de 2:1 sur le dégradé turquoise), la
  barre empilée a besoin d'un fond clair pour ses couleurs de famille (le turquoise de l'OPCO se perdrait dans un
  dégradé turquoise), et le bandeau porte plus qu'une accroche (chiffres, barre, légende, alerte) : section 6, un
  dégradé ne passe pas derrière un long contenu. Trois chiffres en Montserrat 700 tabulaires : Coût de la formation,
  **Financé** (le plus grand), Reste à charge (orange foncé) ; sous Financé, la part du coût (`partFinancee` : jamais
  « 100 % » avec un reste, jamais « 0 % » avec un financement). Sous 640 px, une ligne par chiffre. Aucune phrase sous
  un reste à charge nul : ce n'est qu'une estimation, que l'OPCO peut refuser (fonds épuisés, étude du dossier).
- **Groupe de plusieurs personnes** (`calculer(...).groupe`, `lib/resultats.ts`) : le moteur de l'OPCO est appelé une
  fois pour les personnes qui relèvent du plan de développement des compétences (un seul plafond annuel), son résultat
  est réparti au centime entre les profils qui en relèvent, et le plan du groupe fusionne ceux des profils. Avec
  plusieurs profils, le coût pédagogique du groupe est réparti de la même façon : le plan du groupe coûte exactement le
  prix du groupe (1 000 € pour trois profils d'une personne : 333,34, 333,33 et 333,33 €). L'étiquette « 4 personnes ·
  2 profils » suit la durée dans la situation (« 5 personnes » pour un seul profil). Les trois chiffres du bandeau sont
  ceux du groupe, avec « 4 × 2 800 € » sous le coût (« 333,33 € par personne en moyenne » quand le coût ne se divise pas
  au centime) et « 1 706,25 € par personne en moyenne » sous le reste à charge (`detailsDuBandeau` : rien pour une
  personne seule, un coût inconnu ou une moyenne qui s'arrondit à zéro ; sans financement chiffré, le coût seul).
  Chaque ligne chiffrée du plan dit pour combien de personnes elle vaut, sous le nom du financeur (« pour 3 personnes »,
  `pourPersonnes`) ; la carte des options, dont les lignes n'ont pas cette mention, dit « Les montants valent pour les
  personnes du groupe qu'elles concernent. » (une option vaut pour les seuls profils qui l'ont). Les aides du catalogue
  sont fusionnées (`fusionnerAides` : meilleur statut, plus grand montant par personne, « jusqu'à … par personne ») ;
  une carte dont l'aide ne concerne pas tous les profils, ou pas au même statut, porte un bloc « Concerne »
  (`concerneAAfficher` : « Profil 2 · Dirigeant artisan, 52 ans, 1 personne : éligible »). Une aide qui a une ligne dans
  le plan du groupe (chiffrée ou option) n'est plus listée parmi les aides sans montant : chiffrée pour un profil et
  sans montant pour un autre (solde CPF connu pour l'un, inconnu pour l'autre), elle n'apparaît qu'une fois, par sa
  ligne (« pour 2 personnes »). Tests :
  `tests/resultats-groupe.test.ts` (identité avec l'ancien calcul pour une personne, 1 000 groupes tirés, graine 17).
- **Détail par profil** (`ParProfil`, `colonnesParProfil`, `lignesParProfil`) : avec plusieurs profils, une section `h2`
  « Détail par profil » suit les cartes du plan. L'état du plan du groupe (`etatEnTete`) en gouverne les colonnes, parce
  que le bandeau n'écrit jamais « Financé 0 € » ni « 0 € » pour un coût inconnu : le tableau suit la même règle. Coût
  inconnu, aucune section ; aucun financement chiffré, les seules colonnes Profil, Personnes et Coût (le chapeau et la
  légende du tableau ne parlent alors que du coût) ; plan chiffré, les cinq colonnes Profil / Personnes / Coût / Financé
  / Reste à charge, où une ligne dont le propre plan n'est pas chiffré (`chiffre` de `LigneParProfil` : un apprenti
  parmi des salariés, un dirigeant assimilé salarié parmi des artisans) écrit « Non chiffré » à la place de « Financé »
  et de « Reste à charge ». La ligne « Total » reste celle du plan du groupe, égale aux chiffres du bandeau. Le tableau
  paraît à partir de 640 px et à l'impression (aucune ligne ne se coupe, `break-inside-avoid`) ; sous 640 px, un bloc
  empilé par profil suit les mêmes règles, « Total » en dernier. Les chiffres sont ceux du plan de chaque profil, jamais
  recalculés.
- **Détail de l'OPCO et notes d'un groupe** : le détail de l'OPCO est un calcul unique, dont la carte de total dit
  « Total estimé, tous postes, pour 3 personnes ». Son chapeau « poste par poste » n'existe qu'avec le tableau des postes
  (`chapeauDetailOpco`) et c'est à lui que s'ajoute la mention de qui est calculé (`mentionOpcoDuGroupe` : « Calcul pour
  les 3 salariés du groupe (4 personnes au total). », ou « Calcul pour les 4 personnes du groupe. » quand toutes relèvent
  du plan) : jamais seule, donc jamais quand le plan est fermé aux 50 salariés et plus, ni sans ligne à afficher. Les
  notes sous le bandeau (`notesOpco`) s'additionnent, une fois chacune. Avec un seul projet dans le groupe, c'est la
  note d'une personne seule (`titreNoteOpco`) : des seuls dirigeants lisent « OPCO non compté pour un dirigeant »,
  ou « Pas de calcul du plan de développement des compétences pour ce projet » sans OPCO. Avec des projets mêlés,
  « Aucun OPCO renseigné » quand un projet salarié est sans OPCO, puis « OPCO non compté pour le dirigeant du groupe »
  quand le groupe compte un dirigeant, avec ou sans OPCO. Le corps de la note du dirigeant est celui de l'assimilé
  salarié dès qu'un dirigeant du groupe l'est (`assimileSalarie`) : un groupe de dirigeants de régimes différents ne lit
  que ce texte-là. Fonds épuisés, relais du plan conventionnel et plan fermé aux 50 salariés et plus sont jugés une
  fois, pour l'entreprise.
- **Promesses** : aucune phrase plus forte que le moteur (« entièrement », « garanti », « assuré », « vous
  obtiendrez »…) dans le bandeau, les cartes, les aides et le détail de l'OPCO. Le moteur non plus : sous son plafond, un
  poste dit « Votre coût horaire ne dépasse pas le plafond : l'estimation le retient en entier. » (de même « par nuit »
  pour l'hébergement et « le forfait » pour les repas), et non plus « intégralement pris en charge » ; un test du cœur
  vérifie qu'aucun texte du calcul ne dit « intégralement », « garanti », « assuré » ou « totalité », toutes données
  réelles.
- **`.mark`** : le trait de base vert clair (le souligné du film de marque) sous le seul chiffre Financé, sur fond
  blanc. L'aplat plein ne sert plus sur cet écran (plus de carte sombre) : la règle héritée `.mark.text-ink` est
  retirée de `globals.css`.
- **États du bandeau** (`etatEnTete`) : coût inconnu (`Callout` « Coût de la formation non renseigné », bouton
  « Indiquer le coût », jamais « 0 € ») ; aucun financement chiffré (coût seul, `Callout`, liens vers les cartes Montant
  selon dossier, Aides versées à l'employeur et Revenus et aides à la personne, placées en tête) ; plan chiffré
  (chiffres, barre, légende). L'encadré sans financement chiffré (`encadreSansFinancement`, qui reçoit le plan et les
  aides évaluées) ne cite que ce que la page montre plus bas, cartes du plan et liste « Aides et financements
  identifiés », sans rien en nier : des options au choix chiffrées, « à comparer » ; sinon les aides identifiées
  (« Voici les aides identifiées », l'étude du dossier n'étant citée que pour des aides au montant selon dossier) ; sinon
  ni option chiffrée ni carte d'aides : « aucune autre aide à montant n'a été identifiée » seulement si la liste ne
  montre ni aide « à vérifier » ni montant (dirigeant assimilé salarié dont la formation n'est pas éligible au CPF), et
  « Seuls des services gratuits sont proposés ci-dessous » seulement si toute carte et toute aide de la liste sont des
  services gratuits ; renvoi à l'OPCO ou au fonds d'assurance formation compétent et aux portails de la région. Des
  aides « à vérifier » listées avec un montant ne sont jamais tues, quelle que soit la variante : « Le montant d'une aide
  « à vérifier » listée plus bas n'est pas compté dans le plan : une information manque ou le financeur doit
  confirmer. » (au pluriel « Les montants des aides… » ; FAFCEA à 735 € quand l'organisme certifié Qualiopi est inconnu,
  CPF à 900 € d'un assimilé salarié), « à ce stade » au lieu de « pour cette situation », et une pilule « N aides à
  vérifier » mène à la liste (`#aides-identifiees`, `ID_SECTION_AIDES`) ; dans la dernière variante, des aides « à
  vérifier » sans montant sont citées de même (« Une aide « à vérifier » est listée plus bas »). Test de propriété sur
  1 500 états : chaque phrase écrite est confrontée aux aides et aux cartes affichées. Fonds épuisés
  signalés par l'OPCO alors que le plan compte son plan de développement des compétences (`fondsEpuisesSurLePlan`) :
  `Callout` avertissement sous la barre, lien vers les alertes de l'OPCO (`#alertes-opco`).
- **Plan fermé aux 50 salariés et plus** (`planFermeDe`, `raisonPlanFerme`, `lib/encadres-resultats.ts`) : quand le
  plan de développement des compétences de l'OPCO est fermé pour la taille (fonds mutualisés réservés aux moins de
  50 salariés, aucune enveloppe pour cette taille dans le barème appliqué), le bandeau le dit d'emblée : la raison ouvre
  l'encadré sans financement chiffré (« les autres financeurs » fixent alors le montant après étude du dossier), ou un
  encadré à part (« Aucune prise en charge estimée sur le plan de développement des compétences d'AKTO ») quand
  d'autres financeurs chiffrent un montant ; lien vers le détail de l'OPCO (`#titre-detail-opco`). Propriété : 1 000
  états à plan fermé tirés (graine 41), la raison toujours dans le bandeau.
- **Relais du plan conventionnel** (AKTO, organismes de formation : variante `relais_plan_conventionnel` du cœur) : la
  ligne du plan s'appelle « Plan conventionnel de branche », AKTO (`libellesDeLigne`), l'encadré des fonds épuisés
  dit que les demandes sont financées sur ce plan dans la limite de son budget annuel par entreprise, sous réserve de
  l'accord de l'OPCO (`texteFondsEpuises`), et le détail de l'OPCO nomme le même financement (`dispositifAffiche`). Une
  branche épuisée sans relais garde « la prise en charge peut être refusée ». Propriété : 600 états (graine 23), le
  relais n'apparaît que si la variante appliquée porte le champ.
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
| Reste à charge | | rayures orange foncé de 2 px sur blanc (5,16:1 ; l'orange doux d'avant était à 1,12:1), bord orange foncé | |

- **Barre empilée** (`partsBarre`) : une part par famille (lignes additionnées, dans l'ordre d'empilement), puis le
  reste à charge ; pourcentages entiers dont la somme vaut exactement 100 (plus fort reste), largeurs proportionnelles
  aux montants (6 px au moins), 2 px de blanc entre les parts. Bord intérieur encre à 35 % sur chaque part (or 3,71:1
  et vert clair 3,41:1 contre le blanc, au lieu de 1,84:1 et 1,68:1). Jamais seule porteuse d'information :
  `role="img"` et nom accessible complet (`descriptionBarre`), légende écrite (« AKTO 67 % », « moins de 1 % »). Libellé
  d'une part : le nom de financeur commun à ses lignes s'il est court (« AKTO », « FAFCEA »), sinon celui de la famille.
  La légende est une liste (`role="list"` : Safari et VoiceOver retirent le rôle d'une liste sans puces), comme les
  lignes du plan.
- **Plan en pile** : la carte « Financement de la formation » liste les lignes dans l'ordre d'empilement (pastille,
  nom, financeur, étiquette de fiabilité, « estimation à confirmer auprès du financeur » si elle n'est pas exacte,
  montant à droite ; `role="list"`, le nombre de lignes est annoncé) ; avec plusieurs lignes, un fil (`filet`) les
  relie jusqu'au total, « plafonné au coût de la formation » ; c'est la seule carte à total. Les autres cartes (options au choix, aides versées à l'employeur, revenus
  et aides à la personne, avantages fiscaux et sociaux, montant selon dossier, services gratuits) : en-tête à pastille
  d'icône turquoise et phrase d'aide, aucune somme, aucune carte vide (`cartesDuPlan`). La raison d'une option (« Au
  choix avec « X » ») reste du texte, sans lien. Une option chiffrée porte la fiabilité de sa source, comme une ligne du
  plan (`confianceDOption` : l'aide du catalogue, sinon le dispositif de l'OPCO, « Selon branche » pour Espace
  Formation d'AKTO ou campusAtlas), avec « estimation à confirmer auprès du financeur » quand elle n'est pas exacte ;
  une option sans montant n'en porte pas.
- **Aides par financeur** (`groupesAidesVisibles`) : groupées par financeur du catalogue, dans l'ordre de la liste
  évaluée. Titre : libellé de la famille pour CPF, État, Europe, OPCO, France Travail, Transitions Pro, Agefiph,
  Fiscalité (même titre d'une simulation à l'autre) ; nom propre commun pour Région, Département, fonds d'assurance
  formation, branche et autres (« Région Occitanie », « FAFCEA », « Action Logement »). Carte d'aide : étiquette
  Éligible (turquoise) ou À vérifier (or, texte foncé), montant en gros (« jusqu'à », « Montant selon dossier »,
  « Aucun montant estimé pour ce profil », « … pour ce groupe » sur la carte d'un groupe de plusieurs personnes), règle de calcul, description, points à confirmer, cumul ; détail dépliable
  (chevron, `aria-expanded`) : conditions, démarches numérotées, « Faire la demande », pages officielles citées (titre
  complet) ; pied : fiabilité, date de vérification, un lien par site source (`sourcesDeLAide` : le catalogue cite
  souvent dix pages d'un même site). Un identifiant technique d'aide cité par le catalogue (« nat-cpf ») devient le
  nom de l'aide (`nommerAides`). Le sigle FSE+ est défini une fois, dans le titre de la première carte qui le cite
  (`siglesDesTitres`, `Abreviation`). Aides non éligibles : repliées, nom et raisons, jamais de montant ; celles d'un
  autre projet, public, région ou type de formation ne sont jamais affichées.
- **Détail de l'estimation OPCO** (`FundingBreakdown`) : total de tous les postes (le plan ne retient que ceux de la
  formation, le chapeau le dit quand salaires ou transport sont financés) ; chapeau « poste par poste » seulement
  avec le tableau des postes (`chapeauDetailOpco` : ni plan fermé, ni tableau vide) ; tableau (`DetailParPoste`,
  lignes `lignesDuDetail`) Poste / Demandé / Financé / Reste / Source ; sous 640 px, « Demandé », « Reste » et la source
  passent dans la colonne du poste (deux colonnes : à trois, le tableau débordait de sa carte de 42 px à 320 px et de
  3 px à 375 px) ; ligne non chiffrée : « à confirmer », reste « - », règle
  sous le poste ; détail du calcul d'un poste dépliable par son seul bouton chevron (`aria-expanded`, `aria-controls` ;
  un clic ailleurs sur la ligne ne fait rien), toujours dans la page : replié, il reste imprimé
  (`hidden print:table-row`) ; listes de plus de 6 conventions collectives repliées
  (`replierIdcc`) ; 50 salariés et plus : `Callout` avertissement (barème général ou de la branche ; choisir sa branche à
  l'étape Entreprise).
- **Textes des données** : `texteDonnees` (dates JJ/MM/AAAA, montants et `typo` : insécables avant « : ; ? ! », entre
  un nombre et son unité, entre les milliers), jamais à l'intérieur d'un extrait cité. Le moteur écrit les montants de
  ses textes de calcul à l'anglaise (« 840.00 € », « 42.86 €/h », « 12600.00 € », « 17.875 €/h » : détail du calcul,
  notes de poste, points d'attention) ; `montantsFr` les réécrit par `formatEuro` (« 840 € », « 42,86 €/h »,
  « 12 600 € »). Un montant déjà écrit à la française reste tel quel ; un nombre collé à un autre n'est pas
  réinterprété. Le point de milliers dépend de l'auteur du texte : dans un texte des données (notes, conditions,
  démarches), « 2.000 € » écrit par un humain reste tel quel, jamais lu 2 € ; un texte du moteur passe par
  `texteMoteur` (`montantsFr(texte, 'moteur')`), où tout nombre à point est décimal, puisque le moteur n'écrit jamais de
  séparateur de milliers : « 17.875 €/h » (1 001 € sur 56 h) devient « 17,88 €/h », comme à l'étape Formation, et non
  plus « 17.875 €/h », que l'on lisait 17 875 €/h ; un nombre décimal hors montant y prend la virgule (« 3,5h », durée
  minimale d'OCAPIAT). Le seul texte des données que le moteur insère dans un point d'attention, la description d'une
  enveloppe des 50 salariés et plus, ne contient aucun nombre à point (test). Balayage : 1 000 états tirés, tous OPCO
  et branches, durées multiples de 8 h et courantes, coûts ronds et à centimes, aucun nombre à point dans un texte du
  moteur rendu (hors extraits cités et adresses web). Une adresse web longue passe à la ligne
  (`break-words` ; `[overflow-wrap:anywhere]` dans le tableau, pour que la largeur des colonnes n'en dépende pas). Le
  texte d'un élément flexible (puce ou icône suivie d'un texte : conditions, démarches, raisons, points d'attention,
  pages citées, sites sources, prochaines étapes) porte `TEXTE_SOUPLE` (`components/results/classes.ts` :
  `min-w-0 [overflow-wrap:anywhere]`) : `break-words` ne réduit pas la largeur minimale d'un élément flexible, celle de
  son mot le plus long, et la carte d'aide (`overflow-hidden`) rognait « servicenouvelleschances@laregion.fr » ou
  « (financeurs.moncompteformation.gouv.fr) » à 320 px (WCAG 1.4.10). Contrôle : chaque nœud de texte rendu est contenu
  dans l'ancêtre le plus proche qui rogne et dans la fenêtre, tous les détails ouverts (0 sur 2 464 à 320 et 375 px,
  cinq scénarios, aucun défilement horizontal, tableau de l'OPCO compris).
- **Mouvement** : apparition douce du bandeau et des cartes (`.apparition`, délais échelonnés), barre qui se dévoile
  (`.devoilement`), trait `.mark` qui se déploie ; tout s'arrête sous `prefers-reduced-motion`.
- **Impression** : section 7 ; détail des aides, liste des non éligibles et listes de conventions repliées imprimés en
  entier (`hidden print:block`), détail du calcul des postes de l'OPCO aussi (`hidden print:table-row`), boutons
  masqués, cartes d'aide non coupées (`break-inside-avoid`). Tableau de l'OPCO : un `tbody` par poste
  (`print:break-inside-avoid`), le poste et le détail de son calcul ne se séparent jamais d'une page à l'autre ; en-tête
  et pied en `print:table-row-group`, Chrome ne les répète plus en haut et en bas de chaque page (PDF A4 du scénario 1,
  marge haute de 0,4 à 3,9 pouces : « Total » imprimé une fois, au lieu de deux quand le tableau tombait sur deux pages).

## 16. Fiches OPCO, liste des OPCO, guides, contact, mentions légales et page 404

Pages de référence et de lecture. Logique de présentation en fonctions pures : `lib/fiche.ts` (tests :
`tests/fiche.test.ts`), `lib/contact.ts` (`tests/contact.test.ts`), `lib/typographie.ts` (`tests/typographie.test.ts`).
Composants des fiches : `components/opco/`.

- **Gabarit** : en-tête de page blanc bordé d'un filet (surtitre, `h1` en `text-affiche` avec au plus un `.mark`,
  chapeau) ; corps en grille `grid-cols-1`, colonne de contenu `min-w-0` (un tableau large ne fait plus déborder la
  page) ; à partir de 1 024 px, `Sommaire` collant à gauche (13,5 rem), et à l'impression une seule colonne
  (`print:grid-cols-1`, voir « Impression ») ; sections séparées de 64 px, chacune sous son filet `.rule-double`, titrée
  par `TitreDeSection`.
- **Fiche OPCO, ordre** : fil d'Ariane, nom, nom complet, « Barèmes vérifiés le JJ/MM/AAAA » (étiquette turquoise),
  « Estimer pour cet OPCO » (primaire) et « Site d'AKTO » (secondaire, nouvel onglet annoncé), une phrase qui dit comment
  retrouver l'OPCO dans le simulateur (il n'est pas présélectionné), carte teintée « Secteurs couverts » (repère
  complémentaire nommé par un libellé `.surtitre`, pas un titre : il n'entre pas dans l'échelle des sections) ; encadré
  des alertes (type et nombre, lien vers la liste) ; barème général du plan de développement des compétences (PDC) ;
  selon la taille de l'entreprise ; barèmes par branche professionnelle ; « Alertes publiées par AKTO », section à
  part entière (`TitreDeSection`, `h2` de 28 à 32 px comme les autres) dont l'encadré rouge `AlertesOpco` n'a plus de
  titre propre (`titre={false}` ; l'écran de résultats garde son `h3`) ; financements complémentaires ; alternance, CPF
  et VAE ; en pratique. Une section sans
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
  (« 14,50 €/h »). Dans les deux présentations, « Voir la précision » ne montre que le reste de la note
  (`restePrecision` : extraits cités qui l'ouvrent, phrases suivantes, parenthèse de source, date de vérification, dans
  leur ordre), jamais la règle déjà affichée, et n'existe pas quand la note ne dit rien d'autre (`precisionDuPoste`,
  `reste` nul). Testé sur les 257 notes des 11 OPCO (le test en exige au moins 240) : la règle et le reste redonnent la
  note, aux espaces près.
- **Montant absent et légende** : « non publié », « incluse dans le plafond horaire », « sans montant fixe », ou un renvoi
  à la précision qui cite ce qui est visible : « montant précisé dans la colonne Précision » dans le tableau,
  « montant précisé ci-dessous » dans les cartes. La légende, une par présentation, n'explique que les libellés affichés
  dans le barème général et ceux des branches (`legendeDuBareme`).
- **Branches** (`Branche.tsx`) : une carte `<details>` par branche, repliée ; son ancre est l'identifiant de la branche,
  et `OuvertureDesDetails` l'ouvre quand l'adresse la vise. L'ancre est lue par `decoderAncre` (`lib/ancre.ts`, module
  sans importation, réexporté par `lib/fiche.ts`) : décodée, ou telle quelle si elle est mal encodée (`#taux-100%`,
  `#%E0%A4%A`), jamais d'exception (un `decodeURIComponent` nu faisait tomber la fiche sur la page d'erreur de Next).
  Résumé en grille (un `<summary>` n'admet que du texte courant et un titre) : chevron en pastille turquoise doux, nom en
  `h3`, conventions collectives (citées jusqu'à trois, comptées au-delà), fiabilité, une étiquette rouge par type
  d'alerte qui vise la branche (`alertesDeLaBranche` : un code IDCC en commun ; une alerte sans code reste dans la liste
  générale) ; à l'impression, pastille masquée et résumé sur une colonne (`print:grid-cols-1`). Contenu : ces alertes
  (extrait mot pour mot), note, source, postes de la branche, barème dégressif, budget, tailles ; plus de 6 codes IDCC
  repliés (`ListeIdcc`).
- **Dispositifs** : légende des seules règles de cumul présentes ; carte : nom et `CumulBadge`, montant en turquoise
  foncé (`montantDuDispositif`), description, public, tailles et conventions concernées, conditions à coches, démarche
  en étapes numérotées (`etapesDeDemarche` : coupe à « ; » et à « puis », jamais dans une citation ni une parenthèse ; une
  démarche d'une seule étape reste une phrase), précision, fiabilité et source.
- **Textes des données** : `TexteDonnees` (`texteDonnees` : dates, montants et typographie, hors citations). Les textes
  « A | B | C » (`specificites`, `points_cles_maximisation`) s'affichent en liste (`elementsDeTexte`, objets `FreeText`
  compris, jamais « [object Object] ») ; le séparateur est une barre entre deux espaces, le bord du texte en tenant lieu
  (seule forme des 11 OPCO) : une barre collée à un caractère (« A|B », adresse web) reste dans le texte, deux
  séparateurs de suite (« A | | B ») ne laissent aucun élément vide ; une adresse web longue passe à la ligne
  (`[overflow-wrap:anywhere]`). Un sigle est défini à sa première occurrence dans chaque texte (`<abbr title>`,
  `definirAbreviations`) seulement s'il a été vérifié sur la page officielle de l'OPCO (`ABREVIATIONS_PAR_OPCO` : DAF
  chez Uniformation ; SSSMS, HP, SPSTI et « hors CC » chez OPCO Santé). BETIC (ATLAS) n'est pas défini : les pages de critères d'ATLAS consultées le 07/10/2026 ne l'emploient pas.
- **Impression** : en-tête, sommaire, boutons et « Voir la précision » masqués ; tous les `<details>` ouverts (script
  `beforeprint` d'`OuvertureDesDetails` et, sans script, `details::details-content { content-visibility: visible }`) ;
  ni ombre ni dégradé ; chaque précision imprimée une fois (la règle, puis le reste de la note). À la largeur d'une page
  A4 portrait (moins de 768 px), le barème s'imprime en cartes ; en paysage, en tableau. Règle : une grille dont un
  enfant est masqué à l'impression passe à une colonne (`print:grid-cols-1` sur le corps des fiches et des guides et sur
  le résumé des branches). Sans elle, dès 1 024 px de largeur de page (A4 paysage, environ 1 046 px), le contenu se
  rangeait dans la colonne du sommaire masqué, large de 216 px (fiche AKTO haute de 345 611 px, légendes à un mot par
  ligne hors de leur cadre), et, à toutes les largeurs, le titre d'une branche poussait sa ligne d'informations hors de
  la page. Mesure (média `print`, JavaScript coupé, 17 routes de contenu et l'accueil, à 720, 1 046 et 1 123 px) :
  aucune page ne dépasse 1,01 fois sa hauteur à 720 px (fiche AKTO : 25 198, 20 085 et 19 314 px ; `obligations` :
  3 828, 3 843 et 3 852 px), aucune liste de définitions ne sort de son cadre, aucun texte n'est rogné ni hors de la
  page.
- **Limites connues** : le focus peut s'arrêter à demi masqué sous l'en-tête collant du tableau de barème (critère
  2.4.11 satisfait, 2.4.12 non). Le HTML de `/opco/akto/` pèse 838 851 octets (59 028 octets
  en gzip, build du 08/10/2026), dont environ 6 Ko de double rendu du barème (tableau et cartes) :
  accepté ; un seul tableau mis en cartes
  par CSS le réduirait (hors périmètre). Safari et iOS ne sont pas testés (`::details-content`, `position: sticky` sur
  un `th`).
- **Liste des OPCO** : 12 cases (11 cartes triées par `trierParNom`, article élidé ignoré : L'Opcommerce se range à O,
  puis la tuile teintée « Vous ne connaissez pas votre OPCO »), `ul` en `contents` ; carte : nom (lien étendu), nom
  complet, extrait des secteurs (110 caractères), « Vérifié le JJ/MM/AAAA », « Voir la fiche » (décoratif : le nom du
  lien est celui de l'OPCO).
- **Guides** (`Guide.tsx`) : texte courant mesuré à 34 rem (66 à 69 caractères par ligne pleine en Inter 16 px, mesurés
  dans Chrome), tableaux et cartes sur toute la colonne ; numéro de section en jalon turquoise ; encadrés en `Callout`
  (information, avertissement, confirmation) ; sources en `.lien`, nouvel onglet annoncé ; un lien vers un catalogue
  porte un nom (« campusAtlas sur opco-atlas.fr », « Sélexion sur opcoep.fr »), l'adresse complète en infobulle
  (`Source`, propriété `titre`) ; tableau « Ce que finance un OPCO » empilé en cartes sous 640 px (en-tête repris devant
  chaque cellule par `data-label`) ; `typoDesEnfants` pose les espaces insécables des textes écrits dans le JSX (nombre
  et unité, « : ») sans changer un mot ; les guillemets s'écrivent avec leurs espaces insécables (`«&nbsp;…&nbsp;»`,
  ou `INSECABLE` dans une chaîne), que `typo` ne pose pas (il ne touche jamais l'intérieur d'une citation) ;
  `BandeAppel` en fin de page, la même que l'accueil.
- **Contact** : formulaire en carte, champs au dessin du simulateur (`FieldLabel`, contour filet-fort), erreurs entre le
  libellé et le champ (`aria-invalid`, `aria-describedby`, zone `aria-live`) quand on quitte le champ ou à l'envoi,
  focus sur le premier champ à corriger ; même lien `mailto` qu'avant (`lienMailto` : destinataire, objet, corps), le
  bouton dit ce qui se passe (« Ouvrir ma messagerie ») ; carte SFG Développement (logo, domaines de formation aux
  couleurs de la charte, `DOMAINES_DE_FORMATION` de `lib/domaines.ts`, partagés avec l'accueil ; adresse e-mail).
  `FieldLabel` vit dans `components/ui/FieldLabel.tsx`, sans `'use client'` (composant sans état), et le dessin du
  champ comme sa zone d'erreur dans `components/ui/Champ.tsx` (`CHAMP`, `ZoneErreur`), partagés avec les champs du
  simulateur ; le formulaire de contact les importe directement et n'embarque ni les champs du simulateur (`OpcoPicker`,
  `NumberField`, `lib/saisie`) ni `lib/format.ts` (`lib/contact.ts` ne prend que l'espace insécable de
  `lib/insecable.ts`). Liste « Sujet » à libellés courts (`LIBELLES_DES_SUJETS` :
  « Financement OPCO », « Former mes salariés »… ; 153 px au plus en Inter 16 px, le champ en montre 162 à 320 px avec
  une barre de défilement classique) ; la valeur choisie reste le sujet complet, si bien que l'objet et le corps du
  message sont mot pour mot ceux d'avant (testé sujet par sujet contre 7c791cf).
- **Mentions légales et données** (`app/mentions-legales/page.tsx` ; données `lib/mentions.ts`, module sans autre
  importation que l'espace insécable ; tests `tests/mentions.test.ts`) : gabarit des guides (`GuideHero`, `GuideBody`
  dont le sommaire s'appelle « Sommaire de la page »), six rubriques numérotées : éditeur, directeur de la publication,
  hébergement, données personnelles (aucun cookie, aucune mesure d'audience, aucun script tiers ; recherche
  d'entreprise ; formulaire de contact ; droits et CNIL), sources et licences (API Recherche d'entreprises, Table
  SIRET-OPCO de France compétences, barèmes, polices, marque), limites des estimations. Informations en liste de
  définitions (libellé, puis valeur à côté à partir de 640 px). **État « à compléter »** : chaque information légale est
  une chaîne ou `null` ; `null` s'écrit « [à compléter : libellé] » sur fond or doux (texte #1A1A1A), et tant que
  `mentionsIncompletes()` n'est pas vide, un `Callout` d'avertissement ouvre la page (« Page à compléter avant
  publication »). Aucune donnée légale n'est devinée : seuls les faits du répertoire SIRENE (dénomination, forme, SIREN,
  SIRET et adresse du siège, relus le 08/10/2026) et l'adresse électronique du site sont remplis ; le reste attend
  l'éditeur (le contrôleur l'inscrit dans `MENTIONS`). Lien « Mentions légales et données », souligné, dans la dernière
  ligne du pied de page ; adresse `/mentions-legales/` au plan du site (priorité 0,3).
- **Métadonnées** (`lib/metadonnees.ts`, tests `tests/metadonnees.test.ts`) : chaque page déclare titre, description,
  adresse canonique à barre finale, Open Graph (titre, description, adresse, nom du site, `fr_FR`, `website`) et carte
  Twitter `summary`, sans image ; `metadataBase` (layout) les rend absolues. Le gabarit « %s | financementOPCO » suit le
  titre, sauf à l'accueil (titre complet). La page 404 garde un titre et une description simples.
- **Textes JSX et espaces** : SWC, le compilateur de Next 16.2, perd l'espace de tête d'un texte JSX écrit sur
  plusieurs lignes qui contient une entité (« <strong>Titre.</strong> Le site n&apos;envoie », suivi d'un saut de
  ligne, s'affichait « Titre.Le site ») ; écrire `{' '}` avant le texte. Garde : `tests/jsx-espaces.test.ts`.
- **Page 404** (`app/not-found.tsx`) : dans le gabarit du site, un message court, trois liens (simulateur, liste des
  OPCO, accueil) et le rail de la marque au jalon manquant (décor) ; l'export produit `out/404.html`.

## Annexe : tableau des contrastes

Généré par script à partir des valeurs des jetons de la charte financementopco (formule WCAG 2.x ; un bord en
`color-mix()` est mélangé à sa couleur comme le fait le navigateur). `text-white` vaut `#FBF9F4` (la feuille) ; les
aplats écrivent `#FFFFFF`. Seuils : 4,5:1 pour le texte, 3:1 pour un grand texte, un contour d'élément d'interface, une
part de graphique ou un anneau de focus. Les lignes « repère » ne sont pas des emplois : elles expliquent une règle.

| Texte | Fond | Emploi | Rapport | Seuil | Verdict |
|---|---|---|---|---|---|
| `#161C27` | `#F4F1E9` | texte (encre) sur papier, fond de page | 15,13:1 | 4,50:1 | conforme |
| `#161C27` | `#EAE5D8` | texte sur papier foncé (sections alternées, carte teintée) | 13,58:1 | 4,50:1 | conforme |
| `#161C27` | `#FBF9F4` | texte sur la feuille (cartes, plan de financement, champs) | 16,23:1 | 4,50:1 | conforme |
| `#4A5262` | `#F4F1E9` | texte-doux (ardoise), .surtitre, numéros de section sur papier | 6,96:1 | 4,50:1 | conforme |
| `#4A5262` | `#EAE5D8` | texte-doux sur papier foncé | 6,24:1 | 4,50:1 | conforme |
| `#4A5262` | `#FBF9F4` | texte-doux, numéros d'étape (DM Mono) sur la feuille | 7,46:1 | 4,50:1 | conforme |
| `#59616F` | `#F4F1E9` | texte-discret, .marginalia, légendes sur papier | 5,53:1 | 4,50:1 | conforme |
| `#59616F` | `#EAE5D8` | texte-discret sur papier foncé | 4,96:1 | 4,50:1 | conforme |
| `#59616F` | `#FBF9F4` | texte-discret, texte d'exemple des champs (placeholder) sur la feuille | 5,93:1 | 4,50:1 | conforme |
| `#1F3B63` | `#F4F1E9` | liens (.lien), Button ghost, étiquette « Estimé » sur papier | 9,98:1 | 4,50:1 | conforme |
| `#1F3B63` | `#EAE5D8` | lien sur papier foncé | 8,96:1 | 4,50:1 | conforme |
| `#1F3B63` | `#FBF9F4` | lien, étiquette turquoise (historique) sur la feuille | 10,71:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#1F3B63` | surface-orange (bande d'appel) : texte blanc #FFF sur prusse | 11,27:1 | 4,50:1 | conforme |
| `#FBF9F4` | `#1F3B63` | Button primary, ConfidenceBadge exact, étiquette orange : text-white (#FBF9F4) sur prusse | 10,71:1 | 4,50:1 | conforme |
| `#FBF9F4` | `#172D4C` | Button primary au survol : text-white sur prusse foncé | 13,16:1 | 4,50:1 | conforme |
| `#D6DEEA` | `#1F3B63` | surtitre et texte secondaire sur surface prusse | 8,31:1 | 4,50:1 | conforme |
| `#161C27` | `#F1D84B` | Button inverse, .montant-cle, .mark sur fond sombre, étiquette or : encre sur surligneur | 11,93:1 | 4,50:1 | conforme |
| `#161C27` | `#FBF9F4` | Button inverse au survol : encre sur feuille | 16,23:1 | 4,50:1 | conforme |
| `#FBF9F4` | `#161C27` | Button secondary : text-white sur encre | 16,23:1 | 4,50:1 | conforme |
| `#FBF9F4` | `#0E121A` | Button secondary au survol : text-white sur nuit | 17,82:1 | 4,50:1 | conforme |
| `#B9BFCA` | `#161C27` | pied de page : texte et liens (texte-sur-encre) | 9,25:1 | 4,50:1 | conforme |
| `#B9C8DE` | `#161C27` | pied de page : titres de colonne (DM Mono), adresse e-mail ; .lien sur encre | 10,07:1 | 4,50:1 | conforme |
| `#FFFFFF` | `#161C27` | pied de page : lien « Mentions légales et données » | 17,08:1 | 4,50:1 | conforme |
| `#F1D84B` | `#161C27` | anneau de focus surligneur sur encre (pied de page) | 11,93:1 | 3,00:1 | conforme |
| `#F1D84B` | `#1F3B63` | anneau de focus surligneur sur la bande prusse | 7,87:1 | 3,00:1 | conforme |
| `#2E3647` | `#161C27` | repère : filet de séparation du pied (décor) | 1,41:1 | - | repère |
| `#1F3B63` | `#F4F1E9` | anneau de focus prusse sur papier | 9,98:1 | 3,00:1 | conforme |
| `#1F3B63` | `#EAE5D8` | anneau de focus prusse sur papier foncé | 8,96:1 | 3,00:1 | conforme |
| `#1F3B63` | `#FBF9F4` | anneau de focus prusse sur la feuille ; case cochée (accent-color) | 10,71:1 | 3,00:1 | conforme |
| `#161C27` | `#FBF9F4` | contour 1,5 px des champs et du compteur (encre) sur la feuille | 16,23:1 | 3,00:1 | conforme |
| `#7A7364` | `#F4F1E9` | filet-fort : contour d'élément d'interface sur papier | 4,17:1 | 3,00:1 | conforme |
| `#7A7364` | `#EAE5D8` | filet-fort sur papier foncé | 3,74:1 | 3,00:1 | conforme |
| `#7A7364` | `#FBF9F4` | filet-fort sur la feuille (étiquette neutre) | 4,47:1 | 3,00:1 | conforme |
| `#4A5262` | `#FBF9F4` | cadre en tirets « Selon branche » (ardoise) sur la feuille | 7,46:1 | 3,00:1 | conforme |
| `#1F3B63` | `#F4F1E9` | soulignement de la page active (navigation) | 9,98:1 | 3,00:1 | conforme |
| `#BC1723` | `#F4F1E9` | rouge (alertes, erreurs de champ) sur papier | 5,66:1 | 4,50:1 | conforme |
| `#BC1723` | `#EAE5D8` | rouge sur papier foncé | 5,08:1 | 4,50:1 | conforme |
| `#BC1723` | `#FBF9F4` | étiquette rouge, message d'erreur sur la feuille | 6,08:1 | 4,50:1 | conforme |
| `#BC1723` | `#F6E3E1` | nombre d'alertes du sommaire (rouge sur rouge doux) | 5,17:1 | 4,50:1 | conforme |
| `#161C27` | `#F6E3E1` | Callout alerte : titre | 13,82:1 | 4,50:1 | conforme |
| `#4A5262` | `#F6E3E1` | Callout alerte : corps (texte-doux) | 6,35:1 | 4,50:1 | conforme |
| `#161C27` | `#F8EFBF` | Callout avertissement : titre | 14,71:1 | 4,50:1 | conforme |
| `#4A5262` | `#F8EFBF` | Callout avertissement : corps (texte-doux) | 6,76:1 | 4,50:1 | conforme |
| `#BC1723` | `#FBF9F4` | bord gauche du Callout alerte | 6,08:1 | 3,00:1 | conforme |
| `#1F3B63` | `#FBF9F4` | bord gauche du Callout info | 10,71:1 | 3,00:1 | conforme |
| `#FBF9F4` | `#1F3B63` | résultats : texte sur un segment OPCO, prusse | 10,71:1 | 4,50:1 | conforme |
| `#161C27` | `#F1D84B` | résultats : texte sur un segment CPF, surligneur | 11,93:1 | 4,50:1 | conforme |
| `#161C27` | `#B9C8DE` | résultats : texte sur un segment Région, bleu clair | 10,07:1 | 4,50:1 | conforme |
| `#FBF9F4` | `#4A5262` | résultats : texte sur un segment État et France Travail, ardoise | 7,46:1 | 4,50:1 | conforme |
| `#161C27` | `#B9B2A2` | résultats : texte sur un segment fonds des non-salariés, filet foncé | 8,09:1 | 4,50:1 | conforme |
| `#FBF9F4` | `#161C27` | résultats : texte sur un segment Europe, encre | 16,23:1 | 4,50:1 | conforme |
| `#161C27` | `#CFC8B8` | résultats : texte sur un segment autres, filet | 10,25:1 | 4,50:1 | conforme |
| `#1B2D48` | `#FBF9F4` | résultats : bord encre 45 % d'un segment OPCO, prusse contre la feuille | 13,17:1 | 3,00:1 | conforme |
| `#8E833B` | `#FBF9F4` | résultats : bord encre 45 % d'un segment CPF, surligneur contre la feuille | 3,66:1 | 3,00:1 | conforme |
| `#707B8C` | `#FBF9F4` | résultats : bord encre 45 % d'un segment Région, bleu clair contre la feuille | 4,07:1 | 3,00:1 | conforme |
| `#333A47` | `#FBF9F4` | résultats : bord encre 45 % d'un segment État et France Travail, ardoise contre la feuille | 10,86:1 | 3,00:1 | conforme |
| `#706E6B` | `#FBF9F4` | résultats : bord encre 45 % d'un segment fonds des non-salariés, filet foncé contre la feuille | 4,83:1 | 3,00:1 | conforme |
| `#161C27` | `#FBF9F4` | résultats : bord encre 45 % d'un segment Europe, encre contre la feuille | 16,23:1 | 3,00:1 | conforme |
| `#7C7B77` | `#FBF9F4` | résultats : bord encre 45 % d'un segment autres, filet contre la feuille | 4,03:1 | 3,00:1 | conforme |
| `#161C27` | `#FBF9F4` | résultats : cadre en pointillés du reste à charge | 16,23:1 | 3,00:1 | conforme |
| `#F1D84B` | `#FBF9F4` | repère : segment surligneur sans bord (d'où le bord encre 45 %) | 1,36:1 | - | repère |
| `#CFC8B8` | `#FBF9F4` | repère : segment filet sans bord | 1,58:1 | - | repère |
| `#F1D84B` | `#F4F1E9` | repère : surligneur sur papier (jamais pour du texte) | 1,27:1 | - | repère |
| `#CFC8B8` | `#F4F1E9` | repère : filet sur papier (décor seul, jamais un contour d'interface) | 1,48:1 | - | repère |
| `#A9A293` | `#FBF9F4` | repère : pointillés entre libellé et montant (décor) | 2,41:1 | - | repère |
| `#B9C8DE` | `#F4F1E9` | repère : bleu clair sur papier (réservé aux fonds sombres) | 1,50:1 | - | repère |

66 couples (dont 7 repères), aucun sous son seuil.
