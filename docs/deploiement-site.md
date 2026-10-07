# Publier le site sur Hostinger

Le site financementOPCO est un export statique : `npm run build --workspace web` écrit dans `apps/web/out` des fichiers HTML, CSS et JavaScript qu'un hébergement mutualisé sert tels quels. Le serveur n'exécute aucun code du site : il se contente de servir des fichiers. Publier revient à construire ce dossier, l'archiver, l'extraire à la racine du site sur Hostinger, puis contrôler le résultat.

## 1. Ce que produit le build

```bash
npm install                       # une fois, à la racine du dépôt
npm run build --workspace web     # écrit apps/web/out
```

Il faut Node 20.9 ou plus (exigence de Next.js 16.2.1 ; la CI utilise Node 22) et une connexion Internet : le build télécharge les polices Montserrat et Inter chez Google et les range dans le site. Une fois construit, le site n'appelle plus Google. Après une longue session de développement, le build a déjà échoué avec le message « next/font/google queries have exactly one entry » : le relancer une fois avant de conclure à une panne.

Relevé au commit `7c791cf` le 08/10/2026, `apps/web/out` contient 202 fichiers (environ 20 Mo) :

- 20 fichiers `index.html` : l'accueil, `simulateur/`, `comprendre-les-opco/`, `obligations/`, `former-sans-budget/`, `contact/`, `opco/` et les 11 fiches `opco/<slug>/`, plus `404/` et `_not-found/` (deux copies de la page 404) ;
- `404.html`, la page d'erreur du site, `robots.txt`, `sitemap.xml`, `favicon.ico` et `logo-sfg.png` ;
- `_next/`, les scripts, feuilles de style et polices du site, dont les noms portent une empreinte ;
- `.htaccess`, copié tel quel depuis `apps/web/public/.htaccess`.

Le build annonce 23 pages, soit les 20 `index.html`, `404.html`, `robots.txt` et `sitemap.xml`.

Les adresses se terminent par une barre oblique (`/simulateur/`, réglage `trailingSlash` de `next.config.ts`). Apache sert `simulateur/index.html` pour `/simulateur/` et renvoie `/simulateur` vers `/simulateur/` de lui-même.

Le `.htaccess` règle l'encodage (UTF-8), interdit la liste des dossiers (`Options -Indexes`), désigne `404.html` comme page d'erreur 404 et fixe le cache et la compression : HTML jamais gardé en cache, scripts, styles et polices gardés un an, car leurs noms changent quand leur contenu change. Il ne contient ni réécriture ni redirection vers HTTPS : celle-ci se règle chez l'hébergeur (§ 4).

Deux conséquences à connaître avant de déposer :

- le site doit être servi à la racine d'un nom de domaine ou d'un sous-domaine, pas dans un sous-dossier : ses liens commencent par `/` et la page 404 est cherchée à `/404.html` ;
- `sitemap.xml` et `robots.txt` annoncent `https://www.financementopco.fr` (constantes de `apps/web/src/app/sitemap.ts` et `robots.ts`). Sous un autre nom de domaine, ils pointent encore vers celui-là : modifier ces deux fichiers, puis reconstruire.

Pour voir `out/` avant de le déposer, un double-clic sur `index.html` ne suffit pas (les liens partent de la racine du site) et `npm run start` est refusé par Next sur un export statique. Next.js recommande de servir le dossier : `npx serve@latest out`.

## 2. Les données sont embarquées au build

Barèmes des OPCO, table IDCC, suggestions par code NAF, catalogue d'aides et portails régionaux (`packages/core/data`) sont compilés dans les scripts du site au moment du build. Le site ne les lit nulle part en ligne. Ce que cela implique :

- toute modification du catalogue d'aides, des barèmes ou de la table IDCC n'apparaît sur le site qu'après un nouveau build et un nouveau dépôt ;
- le workflow hebdomadaire `update-dataset.yml` ne met pas le site à jour : il contrôle les liens et, s'il est activé, met à jour `datasets/`, les données de l'application mobile ;
- le workflow `ci.yml` construit le site à chaque pull request et à chaque push sur `main`, mais ne dépose rien.

La procédure de mise à jour des données est dans `docs/donnees-aides.md`, section « Mettre à jour les données du site ».

## 3. Construire l'archive

L'archive d'octobre 2026 s'appelle `financementOPCO-hostinger-2026-10.zip`. Elle est construite à la toute fin, après la revue finale de la branche, à partir du dernier commit : le site déposé correspond ainsi au code relu. L'archive de juillet, `financementOPCO-hostinger.zip`, n'est ni écrasée ni déplacée ; elle sert de version de repli (§ 6). Une publication ultérieure remplace `2026-10` par l'année et le mois.

Trois façons de produire l'archive ; les deux premières partent d'un `npm run build --workspace web` local. Ne jamais l'écrire dans `apps/web/out` (elle s'y inclurait) ; la garder hors du dépôt, car git n'ignore pas les `.zip`.

Windows, PowerShell ou cmd (`tar` est le bsdtar livré avec Windows 10 et 11), depuis la racine du dépôt :

```powershell
tar -a -c -f <chemin>/financementOPCO-hostinger-AAAA-MM.zip -C apps/web/out .
```

`<chemin>` est un dossier hors du dépôt. `-a` choisit le format zip d'après l'extension, `-C` se place dans `apps/web/out`, le point final prend tout le contenu, `.htaccess` compris.

Linux ou macOS :

```bash
cd apps/web/out && zip -r ../../../financementOPCO-hostinger-AAAA-MM.zip .
```

Le zip atterrit à la racine du dépôt : le déplacer hors du dépôt.

Artefact de la CI : sur GitHub, onglet Actions, ouvrir un run « CI » réussi et télécharger `site-hostinger` dans la rubrique Artifacts (fichier `site-hostinger.zip`, conservé 30 jours). Une branche qui n'a pas de pull request peut être construite à la main (« Run workflow » choisit la branche), mais ce bouton n'apparaît qu'une fois `ci.yml` présent sur `main`. L'artefact n'existe que si toutes les vérifications du run ont réussi.

Contrôler le contenu avant tout dépôt (`tar -tf <archive>` liste les entrées sous Windows, `unzip -l <archive>` sous Linux et macOS) :

- `.htaccess`, `index.html`, `404.html`, `robots.txt` et `sitemap.xml` sont au premier niveau, avec le dossier `_next/` ;
- `simulateur/index.html` et 11 fiches `opco/<slug>/index.html` sont présents (afdas, akto, atlas, constructys, ocapiat, opco-ep, opco-mobilites, opco-sante, opco2i, opcommerce, uniformation) ;
- aucun nom d'entrée ne contient de barre oblique inverse. Sous PowerShell, `tar -tf <archive> | Select-String -SimpleMatch '\'` ne doit rien afficher.

Avec bsdtar, tous les noms commencent par `./` (`./.htaccess`, `./index.html`) et la liste s'ouvre sur l'entrée `./` : c'est normal. `unzip`, 7-Zip, Python et `Expand-Archive` de PowerShell extraient cette archive à la racine du dossier de destination (essais du 08/10/2026 : 202 fichiers, `.htaccess` compris). Si l'extraction de Hostinger refuse l'archive ou crée un dossier de trop, la reconstruire sans ce préfixe, sous PowerShell :

```powershell
tar -a -c -f <chemin>/financementOPCO-hostinger-AAAA-MM.zip -C apps/web/out (Get-ChildItem apps/web/out -Force -Name)
```

Lors de l'essai du 08/10/2026, l'archive faisait 2 593 839 octets (environ 2,5 Mo).

## 4. Déposer sur Hostinger

1. Ouvrir hPanel, le site concerné (Sites web, Tableau de bord du domaine ou du sous-domaine), puis le Gestionnaire de fichiers.
2. Garder une version de repli avant de toucher à quoi que ce soit : `financementOPCO-hostinger.zip` (juillet) convient si le site en ligne vient de cette archive ; sinon, télécharger d'abord le contenu actuel depuis le Gestionnaire de fichiers.
3. Ouvrir le dossier racine du site : `public_html` pour le domaine principal ; pour un sous-domaine, le dossier que hPanel lui attribue.
4. Supprimer le contenu précédent du site, `.htaccess` compris. Laisser en place ce que Hostinger y a créé, comme un dossier `.well-known` s'il existe. Supprimer une page d'attente de Hostinger (par exemple `default.php`) s'il y en a une.
5. Envoyer l'archive dans ce dossier (bouton d'envoi du Gestionnaire de fichiers ou glisser-déposer).
6. Clic droit sur l'archive, puis Extraire (« Extract » dans l'interface en anglais). Choisir `public_html` lui-même comme destination, sans créer de sous-dossier.
7. Vérifier que `index.html`, `.htaccess` et le dossier `_next` se trouvent directement dans `public_html`. Le Gestionnaire de fichiers de hPanel affiche les fichiers cachés par défaut ; `.htaccess` doit donc apparaître dans la liste.
8. Supprimer l'archive du serveur : tant qu'elle y reste, n'importe qui peut la télécharger à son adresse.
9. Dans hPanel, rubrique Sécurité puis SSL, vérifier que le certificat est actif et que « Forcer HTTPS » est activé. Hostinger l'active en principe dès qu'un certificat est installé. Ce réglage vit dans le compte d'hébergement, hors du dépôt, et c'est pourquoi le `.htaccess` ne contient aucune redirection.

Pages d'aide Hostinger consultées le 08/10/2026 : [extraire une archive](https://www.hostinger.com/support/1583613-how-to-extract-archives-using-the-file-manager-in-hostinger/), [activer HTTPS](https://www.hostinger.com/support/1583201-how-to-enable-or-disable-https-for-your-website-at-hostinger/), [fichiers cachés et `.htaccess`](https://www.hostinger.com/support/1583395-what-to-do-if-the-htaccess-file-is-missing/). Les intitulés de l'interface peuvent changer.

Entre la suppression et la fin de l'extraction, le site est indisponible : choisir un moment calme.

## 5. Liste de contrôle après dépôt

Ouvrir chaque adresse en navigation privée, sur le domaine final en `https`.

| Adresse | Attendu |
|---|---|
| `/` | L'accueil, avec le logo SFG et les polices Montserrat et Inter. |
| `/simulateur/` | L'étape Projet s'affiche. À l'étape suivante, Entreprise, chercher une entreprise par SIREN ou par nom : les résultats arrivent, car le navigateur interroge l'API publique `recherche-entreprises.api.gouv.fr` (il faut une connexion Internet). |
| `/opco/akto/` | La fiche complète d'un OPCO ; la liste est à `/opco/`. |
| `/former-sans-budget/` | Le guide. |
| `/contact/` | Le bouton « Ouvrir ma messagerie » ouvre la messagerie du visiteur avec le message prérempli : le site n'envoie rien lui-même. |
| `/une-page-qui-n-existe-pas` | La page 404 du site (« Cette page n'existe pas »), pas celle de Hostinger. |
| `http://` suivi du domaine | Redirigé vers `https://`. |

Aller aussi jusqu'à l'écran de résultats du simulateur, qui se charge à la demande (§ 7). Ouvrir `/robots.txt` et `/sitemap.xml`. Dans la console du navigateur, des erreurs 404 sur des fichiers `__next.….__PAGE__.txt` sont attendues (§ 7) ; toute autre erreur mérite d'être examinée.

Parcourir aussi l'accueil et le simulateur sur un téléphone, un iPhone compris.

## 6. Retour arrière

Refaire les étapes 3 à 8 du § 4 avec l'archive précédente : `financementOPCO-hostinger.zip` (juillet) ou la dernière archive qui fonctionnait. Puis reprendre la liste de contrôle du § 5. Le site est de nouveau indisponible pendant la manipulation.

## 7. Limites connues

- **Préchargement des pages.** Next précharge les pages liées en demandant des fichiers `__next.<segment>.__PAGE__.txt?_rsc=...` (par exemple `/simulateur/__next.simulateur.__PAGE__.txt`). L'export de Next 16.2.1 écrit ces fichiers dans des dossiers (`__next.simulateur/__PAGE__.txt`), pas sous ce nom : l'hébergement répond 404. Chaque lien préchargé laisse une erreur « Failed to load resource » dans la console, sans conséquence sur la navigation : le clic charge la page par `index.txt`. Constaté le 08/10/2026 sur un serveur qui imite Apache (archive extraite, navigateur Chromium) ; à confirmer sur l'hébergement réel avec la liste de contrôle.
- **Safari et iOS non testés.** Les essais ont eu lieu dans un navigateur Chromium. À vérifier sur un iPhone après le dépôt : la barre de navigation collante du simulateur et le menu mobile.
- **Écran de résultats chargé à la demande.** L'écran de résultats et le catalogue d'aides forment un lot JavaScript de 792 603 octets (148 830 en gzip, relevé au commit `7c791cf` le 08/10/2026), téléchargé quand l'écran s'affiche et non avec la page. Si la connexion tombe à ce moment, l'écran propose de recharger la page et les réponses sont à saisir de nouveau : le site ne conserve aucune réponse, par choix. Un visiteur qui avait ouvert le simulateur avant un nouveau dépôt peut voir le même écran, car le nom d'un fichier change quand son contenu change et l'ancien n'existe plus.
- **Données figées au build.** Voir le § 2.
- **Plan du site sans barre finale.** `sitemap.xml` liste les pages sans barre oblique finale (`https://www.financementopco.fr/simulateur`) ; Apache les redirige vers l'adresse avec barre (301). Un outil de référencement peut le signaler.

## 8. Ce qui reste à faire de votre côté

- Déposer l'archive sur Hostinger (§ 4), dans `public_html` ou dans le dossier du sous-domaine.
- Vérifier ou activer « Forcer HTTPS » dans hPanel (§ 4, étape 9).
- Tester le site sur un téléphone, un iPhone compris.
- Ajouter dans GitHub (Settings, Secrets and variables, Actions) le secret `ANTHROPIC_API_KEY` ET la variable de dépôt `PIPELINE_LIVE` valant `true`, mais seulement après la publication du dataset v4 : le pipeline d'extraction par IA est désactivé tant que l'un des deux manque, et il échouerait chaque lundi sur le dataset actuel (voir `docs/donnees-aides.md`, section « Mise à jour automatique »). Ce pipeline met à jour les applications mobiles, pas le site.
- La lettre `docs/demande-licence-france-competences.md` est un brouillon : l'adresse de son destinataire n'est pas confirmée.
