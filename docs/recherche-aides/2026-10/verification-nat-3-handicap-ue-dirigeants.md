# Vérification indépendante : nat-3-handicap-ue-dirigeants (06/10/2026)

Fichier vérifié : `nat-3-handicap-ue-dirigeants.json` (12 aides, 4 exclues, 117 extraits).
Livrable : `nat-3-handicap-ue-dirigeants.verifie.json` (JSON valide, même structure, les 12 `id` d'origine sont dans `aides`, `meta.nb_aides` = 12 ; le validateur du chercheur renvoie « VALIDATION OK »).

Méthode : les 39 URL distinctes des sources ont été ouvertes une fois (curl avec User-Agent navigateur ; r.jina.ai et WebFetch pour contrôler l'indisponibilité d'agefiph.fr). Chaque extrait est comparé mot pour mot (espaces, apostrophes et tirets normalisés) au texte de la page ; les tableaux en image ou en PDF (FIF PL micro-entrepreneurs, VIVÉA) ont été contrôlés sur le rendu visuel. Pages ouvertes en plus pour l'état d'ouverture : PDF FAFCEA Bâtiment, accueil AGEFICE, accueil et actualités FIF PL, pages FSE+ de 8 OPCO, 3 pages de démarche.

Résultat sur les extraits : 72 retrouvés mot pour mot sur les pages du 06/10 ; 37 mot pour mot sur les copies du 05/10 (Agefiph, site en maintenance) ; 3 lus sur l'image FIF PL ; 5 cellules du tableau VIVÉA (valeurs lues sur le rendu du PDF, ordre de lecture de l'extraction texte).

## Décompte par verdict

- confirmé : 8 (dont 5 Agefiph « copie du 05/10, site injoignable le 06/10 »)
- corrigé : 3 (`faf-fafcea`, `faf-fifpl`, `faf-fafpm`, retouches limitées)
- à confirmer : 1 (`ue-fse-plus-formation-salaries-opco`)
- exclu (aide déplacée dans `exclues`) : 0 ; les 4 exclusions d'origine sont confirmées

## Tableau

| id | verdict | justification |
|---|---|---|
| nat-agefiph-embauche-apprentissage | confirmé (copie du 05/10, site injoignable le 06/10) | agefiph.fr en maintenance le 06/10 (HTTP 503). 9 extraits retrouvés dans la copie du 05/10 (offre Janvier 2026 `https://www.agefiph.fr/media/9453/download` et fiche de l'aide). Barème vérifié : 500 € (6 mois), 900 € (12), 1 700 € (24), 2 500 € (36), 3 000 € (CDI) ; 6 mois, 24 h (10 h), délai de 6 mois. |
| nat-agefiph-embauche-professionnalisation | confirmé (copie du 05/10, site injoignable le 06/10) | Même source, 9 extraits. Barème vérifié : 500 € (6 mois), 1 200 € (12), 2 600 € (24), 3 000 € (CDI). |
| nat-agefiph-accueil-integration-evolution | confirmé (copie du 05/10, site injoignable le 06/10) | 6 extraits. Maximum 3 150 € ; CDI ou CDD de 6 mois et plus, 24 h (10 h) ; 9 mois après la prise de poste ; prescripteur France Travail, Cap emploi, Mission locale, Comète. |
| nat-agefiph-adaptation-situations-formation | confirmé (copie du 05/10, site injoignable le 06/10) | 5 extraits. Aide versée à l'organisme de formation ; montant évalué au cas par cas (aucun chiffre) ; certificat Qualiopi exigé. |
| nat-agefiph-parcours-vers-emploi | confirmé (copie du 05/10, site injoignable le 06/10) | 6 extraits. Maximum 530 €, renouvelable dans la limite de 530 € sur 12 mois ; 1er mois. |
| ue-fse-plus-formation-salaries-opco | à confirmer (`statut` = `a_confirmer`) | 8 extraits retrouvés (PDF de l'appel NATIAGD2000 et page fse.gouv.fr) : taux maximum 50 %, 95 M€, lancement 01/04/2026, **date limite de dépôt 08/06/2026 (appel clos)**, opérations jusqu'au 31/12/2027. Côté entreprises, seul Atlas affiche une opération ouverte (`https://www.opco-atlas.fr/entreprise/beneficier-fse.html` : demande avant la formation et au plus tard le 15/12/2027, « sous réserve de fonds disponibles »). Pages rouvertes le 06/10 : AKTO (dépôts clos depuis le 01/07/2026), Ocapiat (jusqu'au 13/03/2026), Opco EP (jusqu'au 06/04/2026), OPCO 2i, OPCO Santé et Constructys (opérations 2025), Afdas (page « FSE+ 2025 », « fonds épuisés » sur la copie du 05/10), OPCO Mobilités injoignable. Condition réécrite en conséquence. |
| ue-fse-plus-programmes-regionaux | confirmé | 4 extraits retrouvés sur fse.gouv.fr ; programmation 2021-2027 en cours ; pas de demande séparée, aucun montant. |
| faf-agefice | confirmé | 14 extraits retrouvés sur communication-agefice.fr (06/10). 42 / 35 / 20 €/h ; enveloppe 3 000 € (CFP ≥ 7 €), 5 000 € (diplôme national ou RNCP), 600 € (CFP < 7 €) ; 8 €/h et 4 €/h ; 25 participants ; 3 h ; demande entre 4 mois et 15 jours avant ; NDA et Qualiopi ; CPF exclu. |
| faf-fafcea | corrigé (mineur) | 14 extraits retrouvés (PDF du 1er sept. 2026 Services-Fabrication, Alimentation et Bâtiment ; pages du 06/10). 35 €/h et 100 h (services-fabrication et bâtiment), 60 €/h et 54 h (alimentation), 25 €/h et 15 €/h, 600 € (CFP ≤ 85 €), 200 € de frais annexes, Qualiopi depuis le 01/07/2026. Corrections : source du PDF Bâtiment ajoutée (le 35 €/h du bâtiment n'était sourcé par aucun extrait) ; plafond 3 500 € signalé comme un calcul (100 h × 35 €), qui n'est écrit sur aucune page. |
| faf-fifpl | corrigé | 17 extraits retrouvés (6 PDF, 2 pages, tableau micro-entrepreneurs vu en image : 20 %, 60 %, 80 %, 100 %). Relevé des 151 codes NAF recontrôlé sur les 89 grilles : 900 € par an et 300 € par jour pour 108 codes, 1 050 € et 350 € pour 39 ; formations longues 2 000 / 2 500 / 3 000 € dans les 89 grilles. Correction : « 150 € la demi-journée » n'est écrit que dans 6 grilles (avocats et professions du droit) ; libellé limité aux avocats. |
| faf-vivea | confirmé | 14 extraits. Règles 2026 (départs depuis le 5 juin 2026), tableau vu en image : 25 / 26 € (priorités P1 à P5), 20 / 21 € (P6 et formations certifiantes), 16 € (Certiphyto), bilan de compétences 2 070 €, plafond 2 000 € par an ; conditions MSA, Qualiopi, consentement électronique. Aucune suspension affichée. |
| faf-fafpm | corrigé (mineur) | 7 extraits retrouvés. 300 € puis 400 € pour les formations terminées à compter du 31/03/2026 ; plafond collectif 6 400 € (décision du 02/09/2026, rétroactive au 01/01/2026, page d'actualité du 21/09/2026) alors que la page « Frais de fonctionnement » affichait encore 4 000 €. Ajout de la condition « budget global des actions individuelles » (source ajoutée) : le « 100 % » du montant signifie frais pédagogiques réels jusqu'au forfait de 400 €. |
| exclue : crédit d'impôt formation des dirigeants (art. 244 quater M) | exclu (confirmé) | BOFiP BOI-BIC-RICI-10-20260506 lu le 06/10 : supprimé par l'article 17 de la loi n° 2026-103 du 19/02/2026. |
| exclue : crédit d'impôt apprentissage (art. 244 quater G) | exclu (confirmé) | Même page BOFiP : supprimé pour les exercices ouverts à compter du 01/01/2019. |
| exclue : Agefiph, majoration des aides à l'alternance | exclu (confirmé, copie du 05/10) | Page de l'Agefiph (copie du 05/10) : contrats conclus jusqu'au 31/12/2021 ; le barème actuel plafonne les deux aides à 3 000 €. |
| exclue : Agefiph, aide individuelle à la formation | exclu (confirmé, copie du 05/10) | Offre Janvier 2026 : « Des solutions pour vous former » ne liste que des aides de compensation ; la liste des aides du site comptait « 13 Résultats trouvés » au 05/10, aucune aide individuelle de formation. |

## Corrections notables

1. `ue-fse-plus-formation-salaries-opco` : `statut` passé de `actif` à `a_confirmer` ; condition réécrite (appel national clos le 08/06/2026, une seule opération OPCO ouverte confirmée).
2. `faf-fifpl` : la demi-journée à 150 € n'est valable que pour les avocats et quelques professions du droit.
3. `faf-fafcea` : source Bâtiment ajoutée ; plafond 3 500 € indiqué comme calcul.
4. `faf-fafpm` : condition « budget global » et source ajoutées.
5. `derniere_verification` = 2026-10-06 pour les 12 aides ; 3 notes ajoutées en fin de `notes`.

Aucune valeur chiffrée d'une autre aide n'a été modifiée : aucun nombre faux n'a été trouvé.

## Points d'attention (non modifiés)

- `faf-agefice` : la page d'accueil du site renvoie encore vers les critères 2025, mais les pages 2026 (plafonds, critères, étapes) sont en ligne et concordent avec l'aide.
- `nat-agefiph-embauche-apprentissage` : la mention « dont l'aide de l'État à l'embauche d'apprentis » dans `cumul.note` est une déduction (la source dit « aides de droit commun »), sans nombre.
- `faf-vivea` : cinq extraits sont des cellules de tableau, leur ordre est celui de l'extraction texte ; les valeurs sont celles du tableau.
- `faf-fafpm` : le plafond collectif 6 400 € est une décision de principe récente ; l'ancienne valeur 4 000 € reste affichée sur une autre page du site.

## Sites injoignables le 06/10/2026

- agefiph.fr : maintenance (HTTP 503, page « www.agefiph.fr est en maintenance ») sur toutes les pages testées, y compris via r.jina.ai et WebFetch ; le dépôt des demandes (Digit'Hall) reste en ligne mais exige une connexion. Extraits contrôlés sur les copies du 05/10 (`tmp-nat3`) : aucune contradiction ; les 5 aides gardent leurs valeurs.
- opcomobilites.fr : délai dépassé depuis ce poste (page FSE+ non vérifiée, aucun effet sur les verdicts).

## Points connus de la consigne

Barème de rémunération des stagiaires (769,49 € ou 775,65 €), aide VAE de France Travail, complément CPF du PLF 2027, POEI nationale et régionale : aucun ne figure dans ce fichier. Aucun doublon POEI à signaler.
