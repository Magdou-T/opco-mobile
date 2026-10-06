# Vérification du fichier nat-2-recrutement-alternance.json

Date de vérification : 6 octobre 2026. Vérificateur indépendant (tâche 16), selon `CONSIGNE-VERIFICATION.md`.
Fichier d'origine : `research/nat-2-recrutement-alternance.json` (22 aides, 7 exclues). Fichier corrigé : `research/nat-2-recrutement-alternance.verifie.json`.
Pages ouvertes le 06/10 : `research/tmp-verif-nat2/` (une ouverture par URL distincte ; copies du chercheur du 05/10 dans `research/tmp-nat2/`).

## Résumé

| Verdict | Aides |
|---|---|
| confirmé | 19 |
| corrigé | 3 (fis-exoneration-cotisations-apprentis, nat-opco-contrat-pro-forfait-horaire, nat-npec-apprentissage) |
| à confirmer | 0 |
| exclu | 0 (aucune aide déplacée vers `exclues`) |

Les 7 exclusions du chercheur sont confirmées (extraits retrouvés sur les pages ouvertes le 06/10). Aucun identifiant modifié, aucune aide ajoutée ; les 22 `id` d'origine sont dans `aides`, les 7 entrées de `exclues` sont inchangées. JSON valide (`json.load`), enums contrôlés, extraits de 300 caractères maximum.

Extraits examinés : 137 dans le fichier d'origine.
- 118 retrouvés mot pour mot (espaces et apostrophes normalisés) sur les pages ouvertes le 06/10.
- 15 extraits Légifrance relus le 06/10 via WebFetch (Légifrance renvoie HTTP 403 à curl, voir plus bas) : tous concordants.
- 3 extraits de pro.francetravail.fr contrôlés dans la copie du 05/10 (page JavaScript vide le 06/10).
- 1 extrait de la notice AFE (PDF image) lu visuellement sur les deux pages rendues.
Aucun extrait faux. Écarts de fond trouvés : seuil RGDU périmé (3 Smic au lieu de 2,9293 Smic depuis le 01/06/2026), exception à la minoration NPEC omise, statut « a_confirmer » devenu sans objet (voir corrections).

## Accès aux sources le 06/10/2026 (44 URL distinctes dans le fichier)

- 34 pages lues directement (curl avec User-Agent navigateur, HTTP 200). Deux échecs TLS transitoires sur service-public (F23556, F35391) résolus par une seconde tentative.
- Urssaf.fr (3 URL) : injoignable le 06/10 de 08h05 à environ 10h30 (curl : délai dépassé ; WebFetch : ECONNREFUSED puis ECONNRESET). Pages ouvertes à 10h41 : même taille en octets que les copies du 05/10 (359 241, 378 653 et 345 171 octets). Tous les extraits Urssaf sont retrouvés sur les pages du 06/10 (« Mis à jour le 03 juillet 2026 » et « Mis à jour le 13 juillet 2026 »).
- Légifrance (8 URL) : HTTP 403 (page « Just a moment », Cloudflare) pour curl ; r.jina.ai est lui aussi bloqué par Cloudflare ; navigation du volet Browser refusée. Aucune protection contournée. Les 8 pages ont été lues avec WebFetch (citations limitées à 125 caractères par le service ; deux pages, décrets 2026-168 et 2025-586, interrogées plusieurs fois pour obtenir des citations plus précises) : les passages chiffrés sont retrouvés mot pour mot, les extraits plus longs sont concordants.
- pro.francetravail.fr/accueil/description/contrat-professionnalisation : page JavaScript sans contenu lisible (curl et WebFetch). Verdict « confirmé (copie du 05/10, page illisible sans JavaScript le 06/10) » pour 3 extraits ; mêmes montants confirmés sur des pages lisibles (France Travail, service-public F35391, notice PDF).
- Notice AFE (PDF image, identique octet pour octet à la copie du 05/10) : pages rendues en image et lues (p. 1 : « D'un montant plafonné à 2000 € chacune » ; p. 2 §5 : 2 000 € et 2 000 €, 1 000 € au 3e mois, solde au 10e mois).
- Pages complémentaires ouvertes pour trancher (hors fichier) : communiqué Unédic du 30/06/2026 ; France Travail « Données à connaître » (DAC) mis à jour au 1er avril 2026 ; BO France Travail, instruction n° 2024-6 (mise à jour de janvier 2026) ; fiche OPCO EP du 06/08/2026 ; 1jeune1solution.gouv.fr (Mobili-Jeune) ; Code du travail numérique R6332-25-1.

## Tableau des 22 aides

Légende des URL abrégées : FT = francetravail.fr ; SP = service-public.gouv.fr ; les dates entre parenthèses sont les dates affichées par les pages le 06/10.

| id | verdict | justification courte (URL, nombres vérifiés) |
|---|---|---|
| nat-aide-unique-apprentissage | confirmé | entreprendre.service-public.gouv.fr/vosdroits/F23556 (vérifié le 22/07/2026) : 5 000 € (niveau 4 maximum), 6 000 € (apprenti handicapé), moins de 250 salariés, transmission à l'OPCO sous 6 mois. Légifrance D6243-2 (WebFetch, version du 01/11/2025) : « Son montant est de 5 000 euros maximum » et 6 000 €. Pas de date limite pour l'aide unique. |
| nat-aide-unique-apprentissage-outre-mer | confirmé | Légifrance D6522-2 (WebFetch) : « au niveau 5 » dans les Drom, en vigueur depuis le 21/02/2020. Fiche OPCO EP du 06/08/2026 (opcoep.fr, Fiche-aide-exceptionnelle-aide-unique-contrat-apprentissage-opcoep.pdf) : « ou Bac +2 dans les Outre-Mer », 5 000 € et 6 000 €. F23556 : 5 000 € et 6 000 € (son extrait « bac + 2 ans dans les Outre-mer » figure dans la section des contrats du 01/01 au 07/03/2026 de la fiche). Source OPCO EP ajoutée, confidence « estimated » passée à « exact ». |
| nat-aide-exceptionnelle-apprentissage-pme-niveau5 | confirmé | F23556 : 4 500 € (niveau 5), contrat conclu depuis le 08/03/2026 et commençant avant le 01/01/2027, 6 000 € si handicap. Décret n° 2026-168 (Légifrance, WebFetch) : « 4 500 euros maximum » (1° du I), non-cumul avec l'aide unique. Fiche OPCO EP 06/08/2026 : mêmes montants. Ouverte jusqu'aux contrats débutant avant le 01/01/2027. |
| nat-aide-exceptionnelle-apprentissage-pme-niveaux-6-7 | confirmé | F23556 : 2 000 € (jusqu'au niveau 7). Décret 2026-168 : « 2 000 euros maximum » (2° et 3° du I). Même fenêtre d'ouverture. |
| nat-aide-exceptionnelle-apprentissage-250-plus | confirmé | F23556 : 2 000 € / 1 500 € / 750 €, 5 % de contrats favorisant l'insertion ou 3 % d'alternants avec +10 %, au 31/12/2027. Décret 2026-168 : « délai de huit mois » pour l'engagement envoyé à l'ASP, déclaration « au plus tard le 31 mai de la seconde année ». Fiche OPCO EP : mêmes montants. |
| nat-afe-contrat-pro-26-ans | confirmé | FT employeur (aide-a-lembauche-dun-demandeur-d.html, modifiée le 03/09/2026) : 2 000 € maximum en deux échéances. Notice AFE PDF : 1 000 € au 3e mois, solde au 10e mois, demande sous 3 mois. SP entreprendre F35391 (vérifié le 09/07/2025) : 2 000 €, 3 mois. Extraits pro.francetravail.fr : copie du 05/10. |
| nat-aide-etat-contrat-pro-45-ans | confirmé | Notice AFE PDF p. 2 : « 2 000 € pour l'aide de l'État si le demandeur d'emploi est âgé de 45 ans ou plus ». F35391 : 2 000 €, cumul jusqu'à 4 000 €. Légifrance décret 2011-524 art. 3 (WebFetch, en vigueur au 06/10/2026, dernière modification 01/07/2024) : « fixé à 2 000 € ». |
| nat-aide-geiq-accompagnement | confirmé | Circulaire DGEFP 2026/39 du 03/04/2026 (bulletins-officiels.social.gouv.fr, TRSD2606611C_0.pdf) : 1 400 € et 814 €, crédits 2026 de 12,88 M€, 208 structures. F35391 : 814 €, versement 75 % puis 25 %. |
| nat-npec-apprentissage | corrigé | NPEC : décret n° 2026-832 du 29/08/2026 (DREETS Normandie, publié le 15/09/2026) et référentiel France compétences du 25/09/2026. Participation 750 € / 200 € / 45 jours : F39190 (vérifié le 02/07/2025) et Code du travail numérique R6332-25-1 (mis à jour le 30/06/2025). Minoration 20 %, 80 %, plancher 4 000 € : décret 2025-586 (WebFetch). Délai de 5 jours ouvrables : Urssaf. Correction : exception à la minoration ajoutée. |
| nat-opco-frais-annexes-apprentis | confirmé | code.travail.gouv.fr (29/07/2026) : premier équipement 500 € (niveaux 3-4), 300 € (niveau 5), niveaux 3 à 5 seulement, demande du CFA sous 12 mois. Arrêté du 30/07/2019 (Légifrance, WebFetch, en vigueur) : 6 € par nuitée, 3 € par repas. D6332-83 en vigueur depuis le 30/07/2026. |
| fis-exoneration-cotisations-apprentis | corrigé | Urssaf contrat d'apprentissage (mis à jour le 03/07/2026) : 50 % du Smic pour les contrats conclus depuis le 01/03/2025, 79 % avant ; SP F11249 (vérifié le 01/01/2026) : 21 622 €. Correction : seuil RGDU. |
| nat-mobili-jeune | confirmé | actionlogement.fr/l-aide-mobili-jeune (06/10) : moins de 30 ans, 120 % du Smic, 10 à 100 € par mois, 1 100 € par année sur 11 mensualités, 2 années maximum, demande 3 mois avant à 5 mois après. Source 1jeune1solution.gouv.fr (ministère du Travail) ajoutée : 100 € pendant 11 mois, 120 % du Smic. |
| ue-erasmus-mobilite-alternants | confirmé | agence.erasmusplus.fr/priorites-et-thematiques/la-mobilite-des-alternants-avec-erasmus/ : 10 jours à 12 mois (EFP), ErasmusPro dès 3 mois, 2 à 12 mois (supérieur), un an et la moitié du contrat au maximum, cofinancement OPCO obligatoire. |
| nat-opco-contrat-pro-forfait-horaire | corrigé | Légifrance D6332-86 (WebFetch, version en vigueur au 06/10/2026) : 9,15 € par heure, 15 € par heure pour les publics visés, aucun autre montant par défaut. Urssaf : dépôt sous 5 jours. Correction : statut « a_confirmer » devenu « actif ». |
| nat-poei | confirmé | FT (la-preparation-operationnelle-a.html, modifiée le 15/09/2026) : 5 €/h net, 300 h, 450 h, 600 h (publics prioritaires), CDD d'au moins 6 mois, intérim 6 mois sur 9 mois. AFPR fusionnée avec la POEI. |
| nat-poec | confirmé | FT (la-preparation-operationnelle-1.html, modifiée le 18/08/2026) : 400 h, 434 h, CDD d'au moins 12 mois ; article FT du 28/07/2026 : POEC gratuite pour le demandeur d'emploi. |
| nat-aif | confirmé | FT (laide-individuelle-a-la-formatio.html, modifiée le 21/09/2026) : conditions, devis, complément CPF demandé à France Travail depuis Mon Compte Formation. Aucun plafond national publié. |
| nat-aref | confirmé | SP F291 (vérifié le 07/08/2026) : 40 heures, montant brut égal à l'ARE, plancher net de 22,99 €/jour (maintenu : Unédic, pas de revalorisation au 01/07/2026). SP F292 (vérifié le 01/04/2026) : RFF au plus 775,65 €/mois, réponse sous 21 jours ; DAC FT du 01/04/2026 : RFF « ne peut excéder 775,65 € par mois ». |
| nat-rfft | confirmé | Barème 775,65 € retenu (voir « Points connus »). SP F760 (vérifié le 01/04/2026) : 775,65 € (26 ans et plus), 566,17 € (18-25 ans), 226,48 € (moins de 18 ans), 775,65 € à 2 188,27 € (handicap). FT POEI (15/09/2026) : 775,65 € en 2026. 3 ans maximum, diviseur 151,67 : FT RFFT et F760. |
| nat-aide-mobilite-france-travail | confirmé | FT (jentre-en-formation---laide-au-d.html, modifiée le 28/09/2026) : 0,23 €/km, 6,25 €/jour, 31,20 €/nuit, 5 200 €/an, 60 km ou 2 h aller-retour (20 km hors métropole), demande sous 30 jours, factures sous 60 jours. |
| nat-age-garde-enfants | confirmé | FT (formation---laide-a-la-garde-den.html, modifiée le 06/08/2026) : 416 € + 62,40 € par enfant (540,80 € maximum) ; 176,80 € + 26 € (228,80 € maximum) ; moins de 12 ans, 40 heures minimum, 1,3 fois l'ARE minimale, demande sous 3 mois. |
| nat-pec-cui-cae | confirmé | FT CUI (modifiée le 10/07/2026) : « 95% du SMIC brut » maximum pour le CUI-CAE ; SP entreprendre F21006 (vérifié le 01/06/2026) : CDD de 6 mois à 2 ans (5 ans pour 50 ans et plus et handicap), 20 heures minimum ; circulaire DGEFP 2026/39 : 37 % métropole, 43,5 % outre-mer, 6 mois, 21 heures (paramètres moyens), enveloppe en forte baisse. Point de vigilance ci-dessous. |

## Aides exclues (7) : exclusions confirmées

| Entrée de `exclues` | Verdict | Preuve retrouvée le 06/10 |
|---|---|---|
| Aide exceptionnelle 2025 (contrats du 24/02 au 31/12/2025) | exclusion confirmée | F23556 : « Le contrat doit être conclu entre le 24 février 2025 et le 31 décembre 2025 » ; section 01/01-07/03/2026 : aide unique seule |
| Aide exceptionnelle contrat de professionnalisation (moins de 30 ans) | exclusion confirmée | F35391 : « supprimé pour les contrats signés après le 30 avril 2024 » ; actualité A14253 (mise à jour le 29/04/2024) |
| Aide de 500 € au permis B des apprentis | exclusion confirmée | SP A18840 (19/03/2026) : suppression par la loi de finances 2026 (loi n° 2026-103), en vigueur le 21/02/2026 |
| Aide FT au permis B (demandeurs d'emploi) | exclusion confirmée | BO France Travail, délibération n° 2025-48 : délibération 2011/13 abrogée à effet du 01/04/2026 ; SP A18840 |
| AFPR | exclusion confirmée | FT POEI : « fusionnée avec la POEI » (loi du 18/12/2023) |
| Emplois francs | exclusion confirmée | SP F34547 (vérifié le 18/12/2025) : dispositif terminé, contrats signés jusqu'au 31/12/2024 ; rapport du Sénat (PLF 2026) : crédits en AE nuls |
| CUI-CIE (secteur marchand) | exclusion confirmée | Sénat : extinction des CUI-CIE (LFI 2025) ; FT CUI : version marchande limitée aux Dom et aux CIE financés par les départements |

## Corrections apportées au fichier .verifie.json

1. fis-exoneration-cotisations-apprentis (corrigé) : la condition « rémunération inférieure à 3 SMIC » (RGDU) était périmée. La page Urssaf « La réduction générale dégressive unique » (mise à jour le 13/07/2026) indique : « à 3 Smic applicable au 1er janvier 2026 (ou 2,9293 Smic applicable au 1er juin 2026) en métropole et dans les Drom (hors Mayotte) ; à 1,6 Smic applicable à Mayotte en 2026 ». Condition et extrait corrigés.
2. nat-opco-contrat-pro-forfait-horaire (corrigé) : les montants par défaut 9,15 €/h et 15 €/h (article D6332-86) sont reconfirmés sur Légifrance le 06/10/2026 (version en vigueur au 06/10/2026). Le statut passe de « a_confirmer » à « actif » ; `montant.mode` reste « non_chiffre » (forfait de branche) ; note de cumul mise à jour.
3. nat-npec-apprentissage (corrigé) : condition sur la minoration de 20 % complétée par l'exception du décret n° 2025-586 (pas de minoration lorsque tous les CFA préparant la certification dispensent au moins 80 % à distance) ; titre exact de la fiche F39190 ; source Code du travail numérique R6332-25-1 ajoutée pour 750 € / 200 € (la fiche F39190 date du 02/07/2025).
4. Ajouts sans changement de valeur : nat-aide-unique-apprentissage-outre-mer (source OPCO EP du 06/08/2026, confidence « exact ») ; nat-mobili-jeune (source 1jeune1solution.gouv.fr, car actionlogement.fr, site du financeur, ne figure pas dans la liste de sources du protocole).
5. `derniere_verification` = 2026-10-06 pour les 22 aides ; `meta.date_verification` = 2026-10-06 ; 5 notes ajoutées à `notes` (barème RFFT, Outre-mer, Légifrance/WebFetch, Urssaf, synthèse).

## Points connus à trancher

- Barème de rémunération des stagiaires : 775,65 € (26 ans et plus) est retenu, pas 769,49 €. Preuves : service-public F760 (vérifié le 01/04/2026) ; France Travail, « Données à connaître » mis à jour au 1er avril 2026 (RFFT : 226,48 € / 566,17 € / 775,65 € ; BOETH jusqu'à 2 188,27 € ; RFF au plus 775,65 €) ; page POEI de France Travail modifiée le 15/09/2026 (« 775,65 euros par mois en 2026 »). Le barème 224,68 € / 561,68 € / 769,49 € / 2 170,90 € est celui de l'instruction France Travail n° 2024-6 mise à jour en janvier 2026 (BO n° 2026-04) ; il subsiste sur la page France Travail dédiée à la RFFT (modifiée le 31/08/2026), devenue obsolète. Aucune revalorisation de l'assurance chômage au 01/07/2026 (Unédic, communiqué du 30/06/2026).
- Aide VAE de France Travail supprimée le 08/05/2026 : ne concerne pas nat-2 (aucune aide VAE ; la VAE n'apparaît que comme exclusion de la RFFT, de la RFF et de l'aide à la mobilité).
- Complément CPF du PLF 2027 : ne concerne pas nat-2 ; le fichier ne mentionne aucune mesure du PLF 2027. Le « complément » décrit dans l'AIF est le dispositif en vigueur (page France Travail du 21/09/2026 : demande à France Travail depuis Mon Compte Formation si le solde CPF est insuffisant).
- POEI nationale et POEI régionale : doublon à traiter à l'intégration entre `nat-poei` (ce fichier) et `r52-poei-region` (regions-2.json, Région Pays de la Loire) : même dispositif POEI mis en œuvre par France Travail, mêmes plafonds de 300 / 450 / 600 heures et mêmes contrats d'embauche. Pour une entreprise des Pays de la Loire, les deux entrées s'affichent pour la même aide. Aucun doublon POEC trouvé (`nat-poec` seul). `r11-recrutup` (Île-de-France) cite la POEI seulement pour exclure son cofinancement : pas un doublon.

## Points de vigilance (fichier non modifié)

- nat-pec-cui-cae : enveloppe 2026 en forte baisse (31,6 M€ en AE pour PEC et CIE, priorité aux renouvellements, circulaire du 03/04/2026) ; 37 % et 43,5 % sont des paramètres moyens de programmation, pas un droit. Aucune preuve de suspension nationale ni d'épuisement : statut « actif » conservé. Le critère `structures: ["association"]` est plus étroit que la règle (collectivités, personnes morales de droit public, entreprises gérant un service public).
- nat-poei (`duree_max_heures` 600) et nat-poec (434) : ce sont les maximums de cas particuliers (publics prioritaires ; deux formations de conduite) ; la borne générale est de 450 h pour la POEI et de 400 h pour la POEC.
- Aides exceptionnelles : valables seulement pour les contrats commençant avant le 01/01/2027 ; à réexaminer en janvier 2027.
- Source DEETS Martinique (nat-aide-unique-apprentissage-outre-mer) : page mise à jour le 06/05/2025 qui affiche d'anciens montants (4 125 € / 2 000 € / 1 200 €) ; l'extrait cité est exact, mais ne pas reprendre les montants de cette page.
- Pages service-public F35391 (09/07/2025) et F39190 (02/07/2025) non revérifiées depuis plus d'un an : contenu corroboré par France Travail (03/09/2026), la notice PDF, le décret 2011-524 et le Code du travail numérique.
- RGDU : la page Urssaf précise qu'elle s'applique aux apprentis « pour lesquels l'employeur ne bénéficie pas de l'exonération spécifique liée au contrat d'apprentissage » ; la formulation du fichier (employeur privé, sous conditions) reste conforme.

## Contrôles techniques

- `python json.load` : fichier .verifie.json valide ; 22 aides, 7 exclues, 0 portail, 21 notes.
- Identifiants : les 22 `id` d'origine sont présents dans `aides` (ordre et clés inchangés) ; aucune aide dans `exclues` en plus.
- Écart entre l'original et le fichier corrigé, hors dates de vérification : fis (1 condition, 1 extrait) ; forfait horaire (statut, note de cumul) ; NPEC (1 condition, 4 titres, 1 source ajoutée) ; Outre-mer (1 source ajoutée, confidence) ; Mobili-Jeune (2 sources ajoutées, même URL) ; meta (date_verification) ; notes (5 ajoutées). Rien d'autre (vérifié par comparaison champ à champ).
- Scripts et copies de travail : `research/tmp-verif-nat2/` (fetch_all.py, check_extraits.py, build_verifie.py, number_scan.py, index.json, check_result.txt).
