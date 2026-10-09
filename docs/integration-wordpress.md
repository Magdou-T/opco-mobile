# Afficher le simulateur dans une page WordPress (Divi)

Ce guide décrit comment le simulateur est présenté sur sfgdeveloppement.fr, dans la page « simulation-financement » (thème Divi 4.27.5). Il complète `docs/deploiement-site.md`, qui explique comment déposer l'application sur un hébergement.

## Le principe

Le simulateur n'est pas converti en modules Divi : c'est une application React (calcul, 173 aides, 11 barèmes d'OPCO, recherche d'entreprise) que le constructeur de pages ne sait pas reproduire. Il reste l'application statique du dépôt, hébergée à sa propre adresse HTTPS, et la page Divi l'affiche dans un cadre (`iframe`). Tout ce qui l'entoure est en modules Divi, modifiable dans le Divi Builder : titre, trois étapes, questions fréquentes, contact, mentions.

Dans le cadre, le site passe en « mode intégré » : plus d'en-tête, de navigation ni de pied de page, puisque la page WordPress porte les siens (`apps/web/DESIGN.md`, section 8). Ouvert seul à son adresse, le site reste complet.

## Ce qui existe

- La page WordPress `simulation-financement` (n° 12546), **en brouillon** : elle n'est visible de personne tant qu'elle n'est pas publiée. Elle contient l'introduction, les trois étapes, le cadre du simulateur (ancre `#simulateur`), « À savoir avant de vous fier au résultat », quatre questions fréquentes, un bandeau de contact et les mentions. Aperçu : tableau de bord WordPress, Pages, « Simulation de financement de votre formation », Aperçu ou Modifier avec Divi.
- Le cadre pointe vers `https://financement.sfgdeveloppement.fr/simulateur/`. **Ce sous-domaine n'existe pas encore** : tant qu'il n'existe pas, le cadre reste vide.
- Le mode intégré est dans le code du site (`apps/web/src/lib/integration.ts`, `layout.tsx`, `globals.css`, `tests/integration.test.ts`).

## Ce qu'il reste à faire

1. **Choisir l'adresse de l'application.** Le plus simple est un sous-domaine de sfgdeveloppement.fr, par exemple `financement.sfgdeveloppement.fr`, dont la racine est un dossier à part, avec HTTPS. Une autre adresse convient aussi : il faut alors la mettre dans le module « Cadre du simulateur » de la page et dans le lien « Mentions légales et données de l'outil », et dans la constante `ADRESSE_DU_SITE` (`apps/web/src/lib/metadonnees.ts`, adresses canoniques et plan du site).
2. **Compléter la page légale de l'application** (13 champs de `apps/web/src/lib/mentions.ts`), reconstruire le site et produire l'archive (`docs/deploiement-site.md`, § 3 et 4). L'hébergeur à citer est celui du sous-domaine.
3. **Déposer l'archive** à la racine du sous-domaine (même procédure que le § 5 du guide de dépôt : extraire à la racine, `.htaccess` compris), puis ouvrir `https://financement.sfgdeveloppement.fr/simulateur/` : le site s'affiche complet, avec son en-tête.
4. **Ouvrir la page WordPress en aperçu.** Le simulateur doit s'y afficher sans en-tête ni pied de page, la barre « Suivant » restant en bas du cadre. Passer les cinq parcours, sur ordinateur et sur téléphone.
5. **Publier la page**, puis l'ajouter au menu du site si vous le souhaitez (non fait : un changement de menu est visible de tous les visiteurs).

## Réglages utiles

- **N'autoriser que votre site à afficher le simulateur** (facultatif). Dans le `.htaccess` du sous-domaine, avec le module `mod_headers` :
  ```apache
  <IfModule mod_headers.c>
    Header always set Content-Security-Policy "frame-ancestors 'self' https://sfgdeveloppement.fr https://www.sfgdeveloppement.fr"
  </IfModule>
  ```
  Cette ligne n'a pas été testée ici (aucun hébergement à disposition). Une fois en place, un autre site ne peut plus afficher le simulateur, et un aperçu depuis une autre adresse non plus.
- **Référencement.** Le sous-domaine contient aussi les fiches des 11 OPCO et les guides : leurs pages peuvent être référencées à part, avec `ADRESSE_DU_SITE` pour adresse canonique, ou rattachées à la page WordPress par des liens du menu. C'est un choix éditorial, pas technique.

## Confidentialité

La page WordPress dépend du bandeau et de la politique de confidentialité de sfgdeveloppement.fr (lien en bas de page). Le simulateur ne dépose aucun cookie et ne stocke rien dans le navigateur ; seule la recherche d'entreprise envoie ce que le visiteur tape (nom, SIREN ou SIRET) à l'API Recherche d'entreprises de l'État. La page « Mentions légales et données » de l'application décrit ces points : la page WordPress y renvoie.

## Limites

- Le cadre a une hauteur fixe (82 % de la hauteur de l'écran, 680 px au moins) et le contenu défile dans le cadre. Une hauteur qui suivrait le contenu placerait la barre « Suivant » tout en bas de la page, hors de vue.
- Les liens vers les sites officiels s'ouvrent dans un nouvel onglet. Les ancres du résultat (« Détail de l'OPCO », alertes) défilent dans le cadre.
- La page a été écrite sans pouvoir l'afficher avant publication (l'aperçu d'un brouillon demande une session WordPress) : relisez-la dans le Divi Builder, sur ordinateur et sur téléphone, avant de la publier.
