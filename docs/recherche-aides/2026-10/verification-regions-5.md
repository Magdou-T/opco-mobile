# Vérification de regions-5.json (outre-mer : Guadeloupe, Martinique, Guyane, Mayotte + LADOM)

Date de la vérification : 06/10/2026. Vérificateur indépendant, selon CONSIGNE-VERIFICATION.md et PROTOCOLE.md.
Fichier produit : `regions-5.verifie.json` (JSON valide, 17 aides et 2 exclues, tous les `id` d'origine présents, mêmes clés de premier niveau).
Copies des pages relues ce jour : `tmp-r5-v/`. Script de reconstruction : `tmp-r5-v/apply_corrections.py`.

## Résultat en bref

| Verdict | Nombre | Aides |
|---|---|---|
| confirmé | 7 | r01-afmc, r01-programme-regional-formation, r01-aide-emploi-formation-marins, r02-programme-formation-professionnelle, r02-aide-recrutement-apprenti-atr, r02-aide-effort-formation-apprenti-atef, r03-programme-territorial-formations |
| corrigé | 3 | nat-ladom-passeport-mobilite-formation, r02-aide-vae (passée en a_confirmer), r02-aide-formation-mobilite-reste-du-monde |
| à confirmer (inchangé) | 7 | r01-iae-formation-salaries-insertion, r02-remuneration-stagiaires, r02-aide-individuelle-formation, r02-aide-formation-actifs, r02-prime-contrat-professionnalisation, r02-aide-formation-mobilite-france, r06-programme-formation-professionnelle |
| exclu (nouvelle exclusion) | 0 | aucune aide déplacée ; les 2 exclusions du fichier sont confirmées |

État final du fichier : 9 aides `actif`, 8 `a_confirmer`.

## Méthode

1. Les 74 extraits d'origine ont été comparés (espaces normalisés) au texte des pages rouvertes le 06/10/2026 : 74 sur 74 retrouvés mot pour mot, chacun sur la page de l'URL citée. Après corrections, 77 sur 77 (3 extraits ajoutés, relus sur les pages).
2. Chaque nombre de `montant`, `criteres`, `conditions`, `description` et `demarches` a été recherché dans les pages sources (script `audit_numbers.py`). Seuls manquent des valeurs déduites : age_max 29 (« moins de 30 ans »), « janvier 2027 » (déduit de « de chaque année »), « 2026 » dans des mentions « à confirmer pour 2026 ».
3. Ouverture aux nouvelles demandes : lecture des mentions de mise à jour, de campagne, de suspension sur chaque page ; contrôle de la démarche en ligne de la CTM (statistiques publiques) ; contrôle des points connus de la consigne.
4. Outils : WebFetch en premier sur chaque URL distincte (15 lectures abouties ; échecs : ladom.fr, erreur de certificat ; PDF CTM, binaire illisible ; page CPF de la Région Guadeloupe, redirection 301 non suivie). curl avec un User-Agent de navigateur a fourni les copies exactes utilisées pour la comparaison mot pour mot (aucune protection anti-robot contournée). Le quota de session de WebFetch et WebSearch a été atteint de 8 h 15 à 10 h 20. Après la reprise, les contenus déjà téléchargés n'ont pas été relus ; seul un contrôle du statut HTTP des liens `url_demarche` et des portails a été refait.

## Tableau des verdicts

| id | verdict | justification courte |
|---|---|---|
| nat-ladom-passeport-mobilite-formation | corrigé (précision) | https://ladom.fr/vie-active/formation-professionnelle/ : 18 ans et plus (16 ans alternants), quotient familial ≤ 26 631 €, transport à 100 %, 700 €/mois (cumul), 800 €, 1 400 €, billets non modifiables depuis le 01/12/2025, délai de 4 semaines : tous exacts ; fiche France Travail ladom.html : mêmes conditions. Correction : pour une mobilité UE/EEE, la prise en charge ne couvre que le trajet jusqu'à Paris ; libellé précisé et extrait ajouté. Dispositif ouvert (« Je dépose ma demande »). |
| r01-afmc | confirmé | https://aides.regionguadeloupe.fr/afmc (mise à jour 20/08/2026) : barème forfaitaire maximal 7 495 € (niveau 4), 8 108 € (niveau 3), 5 080 € (non certifiant), 9 053 € (rémunération des stagiaires) ; niveaux 6 (3 716 €) et 5 (8 635 €) sur la page mais hors champ ; campagne du 1er juin au 31 octobre 2026 en cours ; dépôt 3 mois avant ; 3 années ; niveau 4 inclus. Réserve : la page ne publie aucun taux, « pourcentage 100 » est une convention pour « dans la limite du plafond ». |
| r01-programme-regional-formation | confirmé (réserve) | Seule trace 2026 : la page AFMC exclut « le programme collectif de formation professionnelle » et « Guadeloupe Formation » ; aucun chiffre ; la gratuité et l'entrée sur prescription ne sont pas énoncées par la page (formule conditionnelle du protocole). Site Guadeloupe Formation injoignable. |
| r01-aide-emploi-formation-marins | confirmé | https://aides.regionguadeloupe.fr/Aide-a-l-emploi-et-a-la-formation-des-marins (mise à jour 17/09/2026) : « forfait unique », 3 000 € par période réglementaire et par marin, dépôt toute l'année, avant la mise en œuvre ; délibération CP/26-83-2 citée dans le cadre juridique. |
| r01-iae-formation-salaries-insertion | à confirmer | https://aides.regionguadeloupe.fr/Aide-a-l-Insertion-par-l-Activite-Economique-IAE (mise à jour 17/09/2026) : plafond 50 000 €, paliers 30 000 / 40 000 / 50 000 € selon le score (5-15, 15-25, 25-30 points), dépôt 6 mois avant, non cumul avec l'IEJ : exacts. Fenêtre 2026 (1er janvier au 31 août) close ; réouverture « de chaque année » : statut a_confirmer maintenu. |
| r02-programme-formation-professionnelle | confirmé (réserve) | https://www.agefma.mq/formation/professionnelle/ctm-aides-formations/ : achat de formations niveaux 3 à 8 par appel d'offres, public demandeurs d'emploi (CCAS, ALI, PLI, E2C) : extraits exacts, aucun chiffre. Page non datée (cite encore Pôle emploi), aucun document CTM 2026 ; le portail Martinique Formation affiche des sessions 2025-2027 sans indiquer le financeur. |
| r02-remuneration-stagiaires | à confirmer | Guide CTM édition 2023 (PDF, mis en ligne 03/2024, page « Aides à la formation professionnelle » modifiée le 15/05/2024) : rémunération via la convention CTM - Pôle emploi et allocation LADOM sous conditions de ressources ; aucun barème. Extraits exacts. |
| r02-aide-individuelle-formation | à confirmer | Guide CTM 2023 : plafond 3 000 € par an et par demandeur, inscription depuis au moins 6 mois, sous conditions de ressources : exacts ; aucun document 2026. |
| r02-aide-vae | corrigé (statut a_confirmer, montant non chiffré) | Plafond 1 200 € exact (Mes aides France Travail « Proposé par CTM », mise à jour 16/04/2026, et guide CTM 2023) mais la fiche reprend le guide 2023, précède la suppression de l'aide VAE de France Travail (délibération n° 2026-18, en vigueur le 08/05/2026) et le dossier transite par une agence France Travail ; aucune source CTM postérieure. Voir « Points connus ». |
| r02-aide-formation-actifs | à confirmer | Guide CTM 2023 : 50 % du coût pédagogique restant à charge, plafond 2 000 € (salariés), 50 % pour les entreprises, demande 3 mois calendaires avant : exacts ; aucun document 2026. |
| r02-aide-recrutement-apprenti-atr | confirmé | Guide CTM 2023 et guide de la démarche en ligne (22 pages, délibération n° 20-142-2) : ATR 915 €, apprenti de 16 ans à moins de 30 ans, demande dans les 6 mois, versement après 2 mois de période d'essai. Démarche ouverte (page « Commencer la démarche ») ; statistiques publiques : 745 dossiers traités depuis le lancement, décisions « accepté » les semaines du 21 et du 28 septembre 2026. |
| r02-aide-effort-formation-apprenti-atef | confirmé | Mêmes sources : ATEF 2 500 € (mineur) ou 2 800 € (majeur) par année de formation, au prorata de la présence, 140 heures d'absence injustifiée. Démarche ouverte (idem). |
| r02-prime-contrat-professionnalisation | à confirmer | Guide CTM 2023 : 2 500 € par année de formation (24 mois maximum), jeunes de 16 à 25 ans, demandeurs d'emploi de 26 ans et plus, RSA, ASS, AAH : exacts ; aucun document 2026 ni démarche en ligne. |
| r02-aide-formation-mobilite-france | à confirmer | Guide CTM 2023 : plafond 10 000 €, référence fiscale inférieure à 26 791 €, inscription de plus de 6 mois : exacts ; aucun document 2026. Le seuil de ressources LADOM 2026 est 26 631 € : les chiffres du guide ne sont plus à jour. |
| r02-aide-formation-mobilite-reste-du-monde | corrigé (précision) | Mes aides France Travail (page sans date, « Documentation » = guide CTM 2023) et guide : « jusqu'à 15000€ », plafond 15 000 €. Correction : la fiche précise « Prise en charge partielle ou totale », « Selon ressources » : libellé corrigé et extrait ajouté ; le taux 100 % reste un maximum par convention. Statut actif conservé (confidence estimated). |
| r03-programme-territorial-formations | confirmé | https://www.ctguyane.fr/une-offre-pour-construire-votre-avenir-plus-de-10-me-au-service-de-la-formation/ (27/02/2026) : programme territorial 2026-2028, une cinquantaine d'actions, plus de 10 M€ sur deux ans, prescripteurs, réunion d'information collective ; article Formanoo du 18/12/2025 ; portail guyane-formation.formanoo.org en ligne. |
| r06-programme-formation-professionnelle | à confirmer | https://www.mayotte.fr/le-departement/fonctionnement-institutionnel/competences : le Département élabore un plan de développement de la formation professionnelle avec un volet adultes (compétence) ; aucun programme 2026 consultable. |
| Exclue : PRFPDOM (Région Guadeloupe) | exclu (confirmé) | https://aides.regionguadeloupe.fr/prfpdom (mise à jour 20/07/2026) : « n'est pas accessible actuellement », renvoi vers l'AFMC. La fiche Mes aides (16/04/2026) le présente encore avec 8 000 € : à ignorer. |
| Exclue : abondement CPF Région Guadeloupe | exclu (confirmé) | Page régionale (mise à jour 12/03/2025) et https://www.moncompteformation.gouv.fr/espace-public/la-region-guadeloupe-finance-votre-formation (publiée le 22/05/2024) : « Jusqu'au 31 décembre 2024 » ; aucune reconduction. |

## Corrections notables (voir regions-5.verifie.json)

1. nat-ladom-passeport-mobilite-formation : `montant.libelle` précisé (mobilité UE/EEE : uniquement le trajet jusqu'à Paris) et extrait ajouté : « Attention pour les mobilités dans un État membre de l'UE ou de l'EEE, la prise en charge de LADOM porte uniquement sur le déplacement du lieu de résidence jusqu'à Paris. »
2. r02-aide-vae : `statut` = a_confirmer, `confidence` = estimated, `montant.mode` = non_chiffre (plafond 1 200 € conservé dans le libellé), condition et note de cumul ajoutées, source ajoutée : Bulletin officiel de France Travail, délibération n° 2026-18 du 30 avril 2026 (« La délibération entre en vigueur le 8 mai 2026. Aucune demande d'aide effectuée à compter de cette date ne sera prise en compte. »), qui supprime l'aide VAE de France Travail (aide nationale distincte).
3. r02-aide-formation-mobilite-reste-du-monde : `montant.libelle` = « partiellement ou totalement selon les ressources, jusqu'à 15 000 € » ; extrait ajouté : « Aide financière - jusqu'à 15000€ Prise en charge partielle ou totale Selon ressources ».
4. Toutes les aides : `derniere_verification` = 2026-10-06. Trois remarques ajoutées dans `notes`.

## Points connus de la consigne

- Barème de rémunération des stagiaires (769,49 € / 775,65 €) : non concerné. r02-remuneration-stagiaires n'a aucun montant ; le 9 053 € de l'AFMC est un plafond régional, pas le barème national.
- Aide VAE de France Travail supprimée le 08/05/2026 : non présente dans le fichier. Preuve officielle : délibération n° 2026-18 du 30/04/2026 (https://bo.francetravail.org/bulletinsofficiels/deliberation-n-2026-18-du-30-avril-2026-bo-n-2026-27.html) : « L'aide à la validation des acquis de l'expérience est supprimée. » Tranché pour r02-aide-vae (aide propre à la CTM) : maintien non confirmable par la CTM, d'où a_confirmer. La page France Travail « Les aides financières à la VAE » (https://www.francetravail.fr/candidat/votre-projet-professionnel/valider-vos-acquis/laide-a-la-validation-des-acquis.html) cite le CPF et « adresser une demande d'aide auprès de votre Conseil Régional » ; elle ne mentionne pas l'aide de la CTM.
- Complément CPF du PLF 2027 non voté : non concerné (aucune règle CPF dans le fichier ; l'abondement CPF de la Région Guadeloupe est exclu, terminé le 31/12/2024). La page Mon Compte Formation signale seulement le projet de loi de finances 2027 présenté le 01/10/2026.
- POEI nationale et régionale : aucune POEI dans regions-5 ; aucun doublon d'id avec les autres fichiers. LADOM n'a qu'une entrée ; r04-pass-formation (regions-4) est une aide de la Région Réunion non cumulable avec LADOM, et nat-aide-unique-apprentissage-outre-mer (nat-2) est une aide d'État distincte des primes CTM.

## Sites injoignables ou instables le 06/10/2026

- guadeloupeformation.com (avec ou sans www) : connexion impossible, comme les 5 et 6/10 ; ce site n'est la source d'aucun extrait.
- mes-aides.francetravail.fr : réponse HTTP 200 à 8 h 07 (pages VAE et « reste du monde » lues), puis 502 Bad Gateway sur tout le site vers 10 h 40 ; la lecture du matin fait foi, pas de contradiction.
- agefiph.fr : répond (HTTP 200) alors que le fichier note un 503 ; les liens régionaux Agefiph restent à ajouter aux portails (hors périmètre de la vérification).
- Tous les autres liens d'aides et de portails (url_demarche et portails) répondent en HTTP 200. Aucun site Cloudflare dans ce fichier (regionreunion.com n'y figure pas).

## Réserves pour l'intégrateur

- « pourcentage 100 + plafond » (r01-afmc, r02-aide-formation-mobilite-reste-du-monde) encode « jusqu'au plafond » : aucun taux n'est publié par les sources.
- Les aides CTM de 2023 (individuelle, actifs, contrat de professionnalisation, mobilité France, rémunération) n'ont aucune source 2026 : la page CTM « Aides à la formation professionnelle » (site provisoire) n'a pas été modifiée depuis le 15/05/2024. Les fiches Mes aides de la CTM reprennent ce même guide : la mobilité « reste du monde » reste actif par prudence envers le travail du chercheur, mais avec le même niveau de preuve que les aides a_confirmer.
- r02-aide-effort-formation-apprenti-atef : le seuil des 140 heures diffère entre les documents (guide 2023 : « dans la limite de 140 heures » ; guide de la démarche : « 140 heures et plus » annule le versement) ; condition non automatisable, laissée telle quelle.
- r01-afmc : « de plus de 16 ans » est lu comme 16 ans révolus (age_min = 16).
- r01-iae-formation-salaries-insertion : la page nomme « entreprises intermédiaires d'insertion (EI) » ; le fichier écrit « entreprises d'insertion » ; sans effet sur les critères.
- Guyane : la « Campagne 2026 de demande de subvention pour les Structures d'Insertion par l'Activité Économique » citée en lien sur l'article CTG n'a pas été analysée (aucune aide ajoutée).
