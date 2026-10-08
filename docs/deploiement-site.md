# Publier le site sur Hostinger

Le site financementOPCO est un export statique : `npm run build --workspace web` écrit dans `apps/web/out` des fichiers HTML, CSS et JavaScript qu'un hébergement mutualisé sert tels quels. Le serveur n'exécute aucun code du site. Publier revient à compléter ce qui doit l'être avant le build (§ 3), construire le dossier, l'archiver, l'extraire à la racine du site sur Hostinger, puis contrôler le résultat.

Les mesures (tests, nombre de fichiers, tailles, archive) sont rassemblées dans le tableau « Vérifications » du `README.md` à la racine du dépôt ; ce guide n'en recopie pas les chiffres.

## 1. Ce que produit le build

```bash
npm install                       # une fois, à la racine du dépôt
npm run build --workspace web     # écrit apps/web/out
```

Ces deux commandes n'ont pas été relancées pour rédiger ce guide (non testées ici) ; le build du 08/10/2026 est mesuré dans le tableau du README.

Il faut Node 20.9 ou plus (exigence de Next.js 16.2.1 ; la CI utilise Node 22) et une connexion Internet : le build télécharge les polices Montserrat et Inter chez Google et les range dans le site (`_next/static/media/`). Une fois construit, le site n'appelle plus Google. Le premier build après une longue session de développement (`next dev`) a déjà échoué avec le message « next/font/google queries have exactly one entry » : le relancer une fois avant de conclure à une panne.

Le build annonce 24 pages. `apps/web/out` contient :

- 21 fichiers `index.html` : l'accueil, `simulateur/`, `comprendre-les-opco/`, `obligations/`, `former-sans-budget/`, `contact/`, `mentions-legales/`, `opco/` et les 11 fiches `opco/<slug>/`, plus `404/` et `_not-found/` (deux copies de la page 404) ;
- `404.html`, la page d'erreur du site, `robots.txt`, `sitemap.xml`, `favicon.ico` et `logo-sfg.png` ;
- des fichiers `.txt` (`index.txt`, `__next.*.txt`) : les données que Next charge quand le visiteur passe d'une page à l'autre ;
- `_next/`, les scripts, feuilles de style et polices du site, dont les noms portent une empreinte ;
- `.htaccess`, copié tel quel depuis `apps/web/public/.htaccess`.

Les adresses se terminent par une barre oblique (`/simulateur/`, réglage `trailingSlash` de `next.config.ts`), y compris dans `sitemap.xml`. Apache sert `simulateur/index.html` pour `/simulateur/` et renvoie `/simulateur` vers `/simulateur/` de lui-même.

Le `.htaccess` règle l'encodage (UTF-8), interdit la liste des dossiers (`Options -Indexes`), désigne `404.html` comme page d'erreur 404, compresse les textes et fixe la durée de mise en cache :

- le HTML reçoit `max-age=0` : le navigateur peut le garder, mais redemande au serveur à chaque visite s'il a changé (ce n'est pas une interdiction de mise en cache comme `no-store`) ;
- `sitemap.xml` est gardé une heure, `favicon.ico` et les images SVG un mois, les scripts, feuilles de style et polices un an, car leurs noms changent quand leur contenu change.

Il ne contient aucune réécriture ni redirection : la redirection vers HTTPS se règle chez l'hébergeur (§ 5), celle entre `www` et le domaine nu est une décision à prendre (§ 3).

Le site doit être servi à la racine d'un nom de domaine ou d'un sous-domaine, pas dans un sous-dossier : ses liens commencent par `/` et la page 404 est cherchée à `/404.html`.

Pour voir `out/` avant de le déposer, un double-clic sur `index.html` ne suffit pas (les liens partent de la racine du site). Next refuse `npm run start` sur un export statique et propose, dans son message d'erreur, de servir le dossier avec `npx serve@latest out` (non testée ici).

## 2. Les données sont embarquées au build

Barèmes des OPCO, table IDCC, suggestions par code NAF, catalogue d'aides et portails régionaux (`packages/core/data`) sont compilés dans les scripts du site au moment du build. Le site ne les lit nulle part en ligne. Ce que cela implique :

- toute modification du catalogue d'aides, des barèmes ou de la table IDCC n'apparaît sur le site qu'après un nouveau build et un nouveau dépôt ;
- le workflow hebdomadaire `update-dataset.yml` ne met pas le site à jour : il contrôle les liens et la fraîcheur des données et, s'il est activé, met à jour `datasets/`, les données de l'application mobile ;
- le workflow `ci.yml` construit le site à chaque pull request et à chaque push sur `main`, mais ne dépose rien.

La procédure de mise à jour des données est dans `docs/donnees-aides.md`, section « Mettre à jour les données du site ».

## 3. Avant le build : page légale et nom de domaine

### Compléter la page légale

La page « Mentions légales et données » (`/mentions-legales/`, liée depuis le pied de page) lit ses informations dans `apps/web/src/lib/mentions.ts`, objet `MENTIONS`. Chaque champ qui vaut `null` s'affiche « [à compléter : libellé] » sur un fond doré, et tant qu'il en reste un, l'encadré « Page à compléter avant publication » s'affiche en tête de la page. Le build du 08/10/2026 en compte 13, à fournir par l'éditeur :

- éditeur : capital social, ville du greffe (RCS), numéro de TVA intracommunautaire, téléphone ;
- directeur de la publication : nom et fonction ;
- hébergeur : dénomination exacte, adresse et téléphone, à confirmer dans hPanel ou dans les conditions de service d'Hostinger (le commentaire du fichier cite Hostinger International Ltd, Chypre, comme piste, pas comme fait vérifié) ;
- données personnelles : base légale et durée de conservation des messages du formulaire de contact, adresse où exercer ses droits, délégué à la protection des données (s'il n'y en a pas, écrire « non désigné » : le champ reste « à compléter » tant qu'il vaut `null`).

Les informations déjà remplies (dénomination, forme juridique, SIREN, SIRET et adresse du siège) viennent du répertoire SIRENE : les confirmer sur l'extrait Kbis.

Ne publiez pas tant que la page affiche une information à compléter. Une fois les champs remplis, mettre à jour les deux tests de `apps/web/tests/mentions.test.ts` qui attendent aujourd'hui ces champs à `null` (« les informations que seul l'éditeur peut fournir sont vides » et « aucune donnée légale devinée » : directeur de la publication et hébergeur), lancer `npm run test:web`, reconstruire le site, puis produire une nouvelle archive (§ 4).

### Choisir le nom de domaine du site

L'adresse du site est fixée par la constante `ADRESSE_DU_SITE` de `apps/web/src/lib/metadonnees.ts` (ligne 12) : `https://www.financementopco.fr`. Elle donne l'adresse canonique de chaque page, celle des aperçus de partage et celles du plan du site ; `apps/web/src/app/robots.ts` (ligne 8) la répète pour annoncer le plan du site. Rien ne redirige le domaine nu (`financementopco.fr`) vers `www`.

Vérifié le 08/10/2026 : `financementopco.fr` n'est pas enregistré (registre de l'AFNIC) et aucun des deux noms ne répond dans le DNS public. Le domaine est donc à réserver, ou un autre à choisir, avant la publication.

C'est une décision de l'utilisateur, entre deux options :

- (a) Garder `www` : faire pointer `www.financementopco.fr` et `financementopco.fr` vers l'hébergement, puis rediriger le domaine nu vers `www` en ajoutant ces lignes en tête du `.htaccess` de `public_html` (ou de `apps/web/public/.htaccess`, avant le build, pour qu'elles suivent chaque archive) :

  ```apache
  RewriteEngine On
  RewriteCond %{HTTP_HOST} ^financementopco\.fr [NC]
  RewriteRule ^(.*)$ https://www.financementopco.fr/$1 [L,R=301]
  ```

  Cet extrait n'est pas actif dans le fichier livré et n'a pas été testé ici (le serveur de test local ne lit pas le `.htaccess`) : la liste de contrôle du § 6 le vérifie après dépôt.
- (b) Choisir le domaine nu, ou un autre nom : remplacer l'adresse dans `ADRESSE_DU_SITE` et dans `robots.ts`, mettre à jour les tests qui la vérifient (`apps/web/tests/metadonnees.test.ts`, qui compare `ADRESSE_DU_SITE` à l'adresse actuelle, et le test « plan du site » de `apps/web/tests/mentions.test.ts`), lancer `npm run test:web`, puis reconstruire. Le brouillon de lettre `docs/demande-licence-france-competences.md` cite aussi `www.financementopco.fr`.

## 4. Construire l'archive

L'archive d'octobre 2026 s'appelle `financementOPCO-hostinger-2026-10.zip`. Elle est construite à la toute fin, après la revue finale de la branche, la page légale complétée et le nom de domaine choisi, à partir du dernier commit : le site déposé correspond ainsi au code relu. L'archive de juillet, `financementOPCO-hostinger.zip`, n'est ni écrasée ni déplacée ; elle sert de version de repli (§ 7). Une publication ultérieure remplace `2026-10` par l'année et le mois.

Le modèle est l'archive de juillet, déposée avec succès : ses 212 entrées sont des fichiers nommés à partir de la racine du site (`.htaccess`, `index.html`, `_next/...`), sans dossier englobant ni préfixe `./`.

Ne jamais écrire l'archive dans `apps/web/out` (elle s'y inclurait) ; la garder hors du dépôt, car git n'ignore pas les `.zip`.

Sous Windows, depuis la racine du dépôt (`tar` est le bsdtar livré avec Windows 10 et 11), dans PowerShell :

```powershell
tar -a -c -f <chemin>\financementOPCO-hostinger-AAAA-MM.zip -C apps/web/out (Get-ChildItem apps/web/out -Force -Name)
```

ou, dans cmd comme dans PowerShell :

```bat
tar -a -c -f <chemin>\financementOPCO-hostinger-AAAA-MM.zip -C apps/web/out *
```

`<chemin>` est un dossier hors du dépôt. `-a` choisit le format zip d'après l'extension et `-C` se place dans `apps/web/out`. `Get-ChildItem -Force -Name` donne les noms du premier niveau du dossier, `.htaccess` compris ; dans la seconde forme, le bsdtar de Windows développe lui-même `*`, `.htaccess` compris.

Essai du 08/10/2026 sur le build du jour : les deux commandes produisent la même archive, environ 2,6 Mo. Elle compte une entrée par fichier de `apps/web/out` et une par dossier, sans préfixe `./` ni barre oblique inverse ; extraite par `tar -xf` et par `Expand-Archive`, elle redonne exactement les fichiers de `apps/web/out` (empreintes SHA-256 identiques), `.htaccess` à la racine. L'archive de juillet n'avait pas d'entrée de dossier ; Hostinger n'a pas encore extrait une archive qui en contient : l'étape 7 du § 5 le vérifie.

En secours, la commande avec un point prend aussi tout le contenu, mais chaque nom commence par `./` (`./.htaccess`, `./index.html`) et la liste s'ouvre sur une entrée `./` pour le dossier lui-même (le bsdtar de Windows refuse l'option `-s` qui retirerait ce préfixe) :

```powershell
tar -a -c -f <chemin>\financementOPCO-hostinger-AAAA-MM.zip -C apps/web/out .
```

Sous Linux ou macOS (non testée ici ; contrôler ensuite les noms avec `unzip -l`) :

```bash
cd apps/web/out && zip -r <chemin>/financementOPCO-hostinger-AAAA-MM.zip .
```

Artefact de la CI : sur GitHub, onglet Actions, workflow « CI » dans la barre latérale, ouvrir un run réussi et télécharger `site-hostinger` dans la rubrique Artifacts (un fichier zip, conservé 30 jours). L'artefact n'existe que si toutes les vérifications du run ont réussi. Sa racine est le contenu de `apps/web/out`, sans dossier englobant, `.htaccess` compris (`include-hidden-files: true` dans `ci.yml`) ; `ci.yml` n'a encore jamais tourné sur GitHub (la branche n'est pas poussée) : le premier run le confirmera, et le zip téléchargé se vérifie comme les autres avant tout dépôt. Une branche sans pull request peut être construite à la main (bouton Run workflow, qui choisit la branche), mais ce bouton n'apparaît qu'une fois `ci.yml` présent sur la branche par défaut, `main`.

Contrôler le contenu avant tout dépôt (`tar -tf <archive>` liste les entrées sous Windows, `unzip -l <archive>` sous Linux et macOS). Sous PowerShell, commandes essayées le 08/10/2026 :

```powershell
tar -tf <archive> | Select-String -SimpleMatch '\'           # rien : aucune barre oblique inverse
tar -tf <archive> | Select-String -Pattern '^\./'             # rien, sauf avec la commande de secours
tar -tf <archive> | Select-String -Pattern '^(\.htaccess|index\.html|404\.html|robots\.txt|sitemap\.xml|_next/)$'
(tar -tf <archive> | Where-Object { $_ -notlike '*/' }).Count
(Get-ChildItem apps/web/out -Recurse -File -Force).Count
```

La troisième commande doit afficher six lignes (le premier niveau attendu) et les deux dernières le même nombre (les fichiers de l'archive et ceux de `apps/web/out`). Vérifier aussi que `simulateur/index.html`, `mentions-legales/index.html` et les 11 fiches `opco/<slug>/index.html` sont présents (afdas, akto, atlas, constructys, ocapiat, opco-ep, opco-mobilites, opco-sante, opco2i, opcommerce, uniformation).

## 5. Déposer sur Hostinger

Les libellés de hPanel viennent des pages d'aide d'Hostinger relues le 08/10/2026 ; ils peuvent varier selon la langue et la version de l'interface.

1. Sauvegarder d'abord. Dans le tableau de bord du site, rubrique Sauvegardes (Backups) : générer une sauvegarde (l'aide indique une par 24 heures, à partir de l'offre Business) ou télécharger la plus récente. À défaut, télécharger le contenu actuel de `public_html` depuis le Gestionnaire de fichiers. Si le site en ligne vient de l'archive de juillet, `financementOPCO-hostinger.zip` sert aussi de repli.
2. Ouvrir le Gestionnaire de fichiers (File Manager) depuis la barre latérale du tableau de bord du site.
3. Ouvrir le dossier racine du site : `public_html` pour le domaine principal ; pour un sous-domaine, le dossier que hPanel lui attribue.
4. Supprimer le contenu précédent du site, `.htaccess` compris. Laisser en place ce que Hostinger y a créé, comme un dossier `.well-known` s'il existe. Supprimer la page d'attente `default.php` que Hostinger crée pour un nouveau domaine, s'il y en a une.
5. Envoyer l'archive dans ce dossier (bouton d'envoi du Gestionnaire de fichiers ou glisser-déposer).
6. Clic droit sur l'archive, puis Extraire (Extract). Dans la boîte d'extraction : laisser vide le nom de dossier (Choose folder name ; un nom saisi crée ce dossier, d'après l'aide), choisir `public_html` lui-même comme destination (Select the destination) et cocher l'écrasement des fichiers existants (Overwrite existing files). L'aide ne dit pas ce que fait un nom laissé vide : l'étape suivante le vérifie.
7. Vérifier que `index.html`, `.htaccess` et le dossier `_next` se trouvent directement dans `public_html`, sans dossier intermédiaire. Le Gestionnaire de fichiers affiche les fichiers cachés par défaut (aide d'Hostinger) : `.htaccess` doit apparaître dans la liste.
8. Supprimer l'archive du serveur : tant qu'elle y reste, n'importe qui peut la télécharger à son adresse.
9. Certificat SSL : page SSL du site (l'aide conseille de chercher « SSL » dans la barre latérale du tableau de bord). Le certificat doit être installé et actif sur le domaine final, et sur `www` comme sur le domaine nu si les deux servent. D'après l'aide, HTTPS est forcé par défaut dès qu'un certificat est installé ; vérifier que Forcer HTTPS (Force HTTPS, dans le menu de la ligne du domaine) est actif. Ce réglage vit dans le compte d'hébergement, hors du dépôt : c'est pourquoi le `.htaccess` ne contient aucune redirection vers HTTPS.
10. Après chaque dépôt, vider le cache du serveur : tableau de bord du site, rubrique Avancé, Gestionnaire de cache (Cache Manager), bouton Purger tout (Purge all). Sans cela, des visiteurs peuvent recevoir les anciennes pages.

Pages d'aide Hostinger consultées le 08/10/2026 : [extraire une archive](https://www.hostinger.com/support/1583613-how-to-extract-archives-using-the-file-manager-in-hostinger/), [sauvegardes](https://docs.hostinger.com/websites/backups), [fichiers cachés et `.htaccess`](https://www.hostinger.com/support/1583395-what-to-do-if-the-htaccess-file-is-missing/), [page d'attente `default.php`](https://www.hostinger.com/support/5811527-the-website-shows-a-you-are-all-set-to-go-message/), [activer HTTPS](https://www.hostinger.com/support/1583201-how-to-enable-or-disable-https-for-your-website-at-hostinger/), [gestionnaire de cache](https://www.hostinger.com/support/6215624-how-to-use-cache-manager-at-hostinger/).

Entre la suppression et la fin de l'extraction, le site est indisponible : choisir un moment calme.

## 6. Liste de contrôle après dépôt

Ouvrir chaque adresse dans une fenêtre de navigation privée, sur le domaine final en `https`.

| Adresse | Attendu |
|---|---|
| `/` | L'accueil, avec le logo SFG et les polices Montserrat et Inter. |
| `/simulateur/` | Les cinq parcours mènent à l'écran « Votre plan de financement » : Former un salarié, Reconversion d'un salarié, Recruter et former un demandeur d'emploi, Recruter en alternance, Former le dirigeant. À l'étape Entreprise, une recherche par SIREN ou par nom renvoie des résultats : le navigateur interroge l'API publique `recherche-entreprises.api.gouv.fr` (il faut une connexion Internet). |
| `/opco/akto/` | La fiche complète d'un OPCO ; la liste est à `/opco/`. |
| `/former-sans-budget/` | Le guide. |
| `/contact/` | Le bouton « Ouvrir ma messagerie » ouvre la messagerie du visiteur avec le message prérempli : le site n'envoie rien lui-même. |
| `/mentions-legales/` | La page s'affiche sans l'encadré « Page à compléter avant publication » et sans aucun « [à compléter ». |
| `/une-page-qui-n-existe-pas` | La page 404 du site (« Cette page n'existe pas »), pas celle d'Hostinger. |
| `http://` suivi du domaine | Redirigé vers `https://`. |
| Domaine nu, si l'option (a) du § 3 est retenue | Redirigé vers `https://www.` suivi du domaine. |

Ouvrir aussi `/robots.txt` et `/sitemap.xml` : les adresses citées sont celles du domaine choisi. Dans la console du navigateur, des erreurs 404 sur des fichiers `__next.*.__PAGE__.txt` sont attendues (§ 8) ; toute autre erreur mérite d'être examinée.

Parcourir aussi l'accueil et le simulateur sur un téléphone Android et sur un iPhone.

## 7. Retour arrière

Refaire les étapes 3 à 8 et 10 du § 5 avec l'archive précédente : `financementOPCO-hostinger.zip` (juillet) ou la dernière archive qui fonctionnait, ou restaurer la sauvegarde de l'étape 1. Puis reprendre la liste de contrôle du § 6. Le site est de nouveau indisponible pendant la manipulation.

## 8. Limites connues

- **Préchargement des pages.** Next précharge les pages liées en demandant des fichiers `__next.<segment>.__PAGE__.txt?_rsc=...` (par exemple `/simulateur/__next.simulateur.__PAGE__.txt`). L'export de Next 16.2.1 écrit ces fichiers dans des dossiers (`simulateur/__next.simulateur/__PAGE__.txt`), pas sous ce nom : l'hébergement répond 404. Chaque lien préchargé laisse une erreur « Failed to load resource » dans la console, sans conséquence sur la navigation : le clic charge la page par `index.txt`. Constaté sur un serveur qui imite Apache (archive extraite, navigateur Chromium) ; à confirmer sur l'hébergement réel avec la liste de contrôle.
- **Safari et iOS non testés.** Les essais ont eu lieu dans un navigateur Chromium. À vérifier sur un iPhone après le dépôt : la barre de navigation collante du simulateur et le menu mobile.
- **Écran de résultats chargé à la demande.** L'écran de résultats et le catalogue d'aides forment un lot JavaScript d'environ 800 Ko (150 Ko compressés), téléchargé quand l'écran s'affiche et non avec la page. Si la connexion tombe à ce moment, l'écran propose de recharger la page et les réponses sont à saisir de nouveau : le site ne conserve aucune réponse, par choix. Un visiteur qui avait ouvert le simulateur avant un nouveau dépôt peut voir le même écran, car le nom d'un fichier change quand son contenu change et l'ancien n'existe plus.
- **Données figées au build.** Voir le § 2.

## 9. Ce qui reste à faire de votre côté

- Compléter la page légale, puis reconstruire (§ 3).
- Réserver le nom de domaine et choisir entre `www` et le domaine nu (§ 3).
- Construire l'archive sans préfixe et la contrôler (§ 4).
- Sauvegarder, déposer, extraire et vérifier sur Hostinger ; certificat SSL et Forcer HTTPS ; purge du gestionnaire de cache (§ 5).
- Dérouler la liste de contrôle en navigation privée, sur un téléphone Android et sur un iPhone (§ 6).
- Après le premier push, vérifier que la CI passe sur GitHub et que son artefact `site-hostinger` a la forme attendue (§ 4).
- Pipeline d'extraction par IA : il met à jour les applications mobiles, pas le site, et reste désactivé tant que le secret `ANTHROPIC_API_KEY` ET la variable de dépôt `PIPELINE_LIVE` (valeur `true`) ne sont pas tous deux définis. Ne les créer qu'après la publication d'un jeu de données v4 compatible avec le cœur actuel (règle de `datasets/README.md`, section « Compatibilité avec le cœur actuel »), et après avoir autorisé GitHub Actions à créer des pull requests : Settings, Actions, General, Workflow permissions, case « Allow GitHub Actions to create and approve pull requests » (libellé relu le 08/10/2026 dans l'aide de GitHub), puis Save. Détail : `docs/donnees-aides.md`, section « Mise à jour automatique ».
- La lettre `docs/demande-licence-france-competences.md` est un brouillon, non envoyé ; elle n'est plus nécessaire pour identifier l'OPCO à partir du SIRET (la Table SIRET-OPCO est publiée en données ouvertes) et son canal d'envoi reste à choisir.
