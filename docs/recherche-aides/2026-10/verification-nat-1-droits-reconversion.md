# Vérification indépendante – nat-1-droits-reconversion (06/10/2026)

Fichier vérifié : `nat-1-droits-reconversion.json` (12 aides, 5 exclues d'origine, 97 sources). Livrable corrigé : `nat-1-droits-reconversion.verifie.json` (12 aides, 6 exclues, 103 sources ; JSON valide ; les 12 `id` d'origine sont dans `aides`, aucun identifiant modifié, même structure).

Méthode : les 49 URL distinctes ont été ouvertes une fois par WebFetch (citations mot pour mot), puis comparées mécaniquement avec une copie curl (User-Agent navigateur) des mêmes pages du 06/10 (espaces et apostrophes normalisés). Résultat : 92 extraits sur 92 retrouvés par comparaison automatique ; les 5 extraits Légifrance (curl bloqué par Cloudflare) ont été recopiés mot pour mot par WebFetch. Les 6 nouveaux extraits ajoutés par le vérificateur sont aussi retrouvés par comparaison automatique (98/98 hors Légifrance). Chaque nombre des champs `montant` et `criteres` a été rapproché d'une page officielle ouverte le 06/10.

Verdicts : 10 confirmées, 2 corrigées (nat-vae, nat-vae-transitions-pro), 0 à confirmer, 0 exclue. Exclues d'origine : 5 confirmées, 1 ajoutée.

## Tableau par aide

| id | verdict | justification courte |
|---|---|---|
| nat-cpf | confirmé | 14/14 extraits retrouvés : service-public.gouv.fr F10705 (vérifié le 27/06/2026 : 500 €/an, 5 000 €, 800 €/an, 8 000 €, 60/120 jours, 30 jours), actualités A17364 (150 € depuis le 02/04/2026, maj 02/04/2026), A18831 (plafonds 1 500 € / 1 600 € / 900 €, décret en vigueur le 26/02/2026), A17164 (permis léger : demandeur d'emploi ou cofinancement d'au moins 100 €, depuis le 21/02/2026), F12382, moncompteformation.gouv.fr (indépendants), Légifrance L6323-6 (en vigueur depuis le 27/06/2026). Complément « jusqu'à 200 € » : PLF 2027 présenté le 01/10/2026, non voté, correctement présenté comme non adopté. |
| nat-cpf-abondement-employeur | confirmé | 10/10 extraits retrouvés : Légifrance L6323-7 (en vigueur depuis le 01/01/2023) et R6323 (150 € pour 2026, en vigueur depuis le 02/04/2026) ; moncompteformation.gouv.fr (exceptions, dotation volontaire) ; financeurs.moncompteformation.gouv.fr (paiement sous 90 jours, dotations non plafonnées, exclues de l'assiette sociale). Mesure PLF 2027 rédigée au conditionnel (non adoptée). |
| nat-ptp | confirmé | 9/9 extraits retrouvés : service-public F14018 (vérifié le 01/06/2026 : 2 ans dont 1 an ; 2 ans sur 5 ans dont 4 mois de CDD sur 12 mois ; 120 j / 60 j / 30 j / report 9 mois), F3024 (intérim : 1 600 h sur 18 mois dont 600 h), transitionspro.fr, Légifrance R6323-14-4 (en vigueur depuis le 01/01/2019). Aucun montant chiffré (non_chiffre, confidence estimated). Dépôt toujours ouvert : calendriers de dépôt et de commissions 2026 en ligne sur les sites régionaux (Occitanie : actualité publiée le 22/11/2025 et mise à jour le 24/09/2026 ; Hauts-de-France ; La Réunion ; Normandie : commissions programmées jusqu'au 08/12/2026, dépôt au plus tard 3 mois avant le début de la formation, transitionspro-normandie.fr/ptp-calendrier-des-commissions-2026/) ; 3 193 dossiers pris en charge ou approuvés en 2025 en Hauts-de-France. Accord non automatique (priorités de financement), déjà signalé dans le fichier. |
| nat-ptp-remuneration | confirmé | 6/6 extraits retrouvés. 3 734,04 € = 2 x 1 867,02 € (Smic mensuel, service-public F2300 vérifié le 01/06/2026, Smic horaire 12,31 €) ; 100 %, 90 % (1re année ou 1 200 premières heures), 60 % (service-public F14018) ; plancher de 2 Smic (transitionspro.fr). |
| nat-demission-reconversion | confirmé | 8/8 extraits retrouvés : unedic.org (maj 05/10/2026 : 1 300 jours sur 60 mois, 1 825 jours à Mayotte, radiation de 4 mois, délai de 6 mois), francetravail.fr (CEP préalable, ARE), transitionspro.fr, service-public F34991 (vérifié le 01/04/2025, cohérent). L'exclusion des agents publics figure sur la page France Travail citée. |
| nat-periode-reconversion | confirmé | 10/10 extraits retrouvés : entreprendre.service-public.gouv.fr A18798 (en vigueur le 01/02/2026 ; 9,15 €/h ; 5 000 € en moyenne), Légifrance décret n° 2026-40 (9,15 € par heure, 5 000 euros), service-public F13516 et R75681 (vérifiés le 12/02/2026 : 12 mois, 150-450 h, 2 100 h sur 36 mois, CDD d'au moins 6 mois, dossier 30 jours avant, réponse sous 20 jours). |
| nat-vae | corrigé | 6/6 extraits d'origine retrouvés : vae.gouv.fr (décret n° 2025-663), service-public F2401 (vérifié le 13/08/2026 : 150 €, 48 h, 30 jours), moncompteformation.gouv.fr (VAE hors complément). Correction : l'aide spécifique à la VAE de France Travail est supprimée (« aucune demande d'aide effectuée à compter de cette date » : 8 mai 2026, délibération n° 2026-18, bo.francetravail.org). Description et conditions précisées, 2 sources ajoutées, aide ajoutée aux exclues. |
| nat-vae-transitions-pro | corrigé (précision) | 7/7 extraits d'origine retrouvés. 2 000 € confirmé (vae.gouv.fr et service-public F2401 : montant forfaitaire de 2 000 €, décret n° 2026-678 en vigueur le 30/07/2026 ; transitionspro.fr : « à hauteur de 2 000 euros maximum » ; Hauts-de-France : « 2 000 € maximum »). Montant précisé « au plus 2 000 € », prise en charge non automatique. Statut maintenu `actif` : la page nationale du 06/10 indique une réouverture en cours (objectif 1er octobre 2026, non confirmé) ; réouverture constatée en Hauts-de-France (18/09/2026), Centre-Val de Loire, Bourgogne-Franche-Comté. 2 sources ajoutées. |
| nat-bilan-competences | confirmé | 6/6 extraits retrouvés : moncompteformation.gouv.fr (1 600 €, 5 ans, 150 €), service-public F3087 (vérifié le 02/04/2026 : 24 h maximum, coût à la charge de l'employeur), page du 2 octobre 2026 (participation de base même pour les demandeurs d'emploi, mesure PLF 2027 non adoptée). |
| nat-clea | confirmé | 5/5 extraits retrouvés : of.moncompteformation.gouv.fr (maj 05/08/2026 : CléA sans plafond d'utilisation, plafond de 1 500 € pour le répertoire spécifique), moncompteformation.gouv.fr, transitionspro.fr, service-public F13516. |
| nat-cep | confirmé | 4/4 extraits retrouvés : service-public F32457 (vérifié le 20/02/2026 : gratuit, sans accord de l'employeur), francecompetences.fr (18 opérateurs, marché de 4 ans). |
| nat-c2p-reconversion | confirmé | 5/5 extraits retrouvés : transitionspro.fr (1 point C2P = 500 €, CEP obligatoire, demande non refusable, bilan/VAE avant formation), compteprofessionnelprevention.fr (« Chaque point a une valeur de 500 € »). |

## Exclues (preuves revérifiées le 06/10/2026)

| exclue | verdict | justification courte |
|---|---|---|
| Pro-A | confirmé | service-public F13516 (vérifié le 12/02/2026) : plus de Pro-A, sauf avenants signés avant le 01/01/2026 ; A18798. |
| Transitions collectives (Transco) | confirmé | entreprendre.service-public.gouv.fr A18798 (13/02/2026) : remplacée par la période de reconversion. |
| FNE-Formation | confirmé, preuve ancienne | Jaune budgétaire PLF 2026 (assemblee-nationale.fr) : suspendu en 2025, pas de rétablissement prévu en 2026. Aucune source officielle plus récente trouvée ; les pages DREETS en ligne datent de 2024-2025. À revérifier avec le jaune du PLF 2027. |
| Aide de l'État de 500 € au permis B des apprentis | confirmé | service-public A18840 (19/03/2026) : supprimée, en vigueur le 21/02/2026. |
| Aide au permis B de France Travail | confirmé | service-public F1719 (vérifié le 01/04/2026) : supprimée depuis le 01/04/2026. |
| Aide à la VAE de France Travail (ajout) | ajouté | bo.francetravail.org, délibération n° 2026-18 du 30/04/2026 : « L'aide à la validation des acquis de l'expérience est supprimée », en vigueur le 08/05/2026. |

## Corrections apportées au .verifie.json

1. `derniere_verification` = 2026-10-06 pour les 12 aides.
2. nat-vae : description (France Travail pour un demandeur d'emploi, aide spécifique supprimée depuis le 8 mai 2026), nouvelle condition, 2 sources ajoutées (Bulletin officiel de France Travail).
3. nat-vae-transitions-pro : description et `montant.libelle` (« au plus 2 000 € », prise en charge non automatique), condition sur la réouverture mise à jour (état constaté le 06/10/2026), 2 sources ajoutées (transitionspro.fr, transitionspro-hdf.fr). Montant, mode, plafond et statut inchangés.
4. exclues : ajout de l'aide VAE de France Travail.
5. notes : une note de vérification ajoutée en dernière position.

Aucun nombre des champs `montant` et `criteres` n'était faux ; aucune aide n'est passée en `a_confirmer` ni déplacée dans `exclues`.

## Sites injoignables ou bloqués le 06/10/2026

- legifrance.gouv.fr : Cloudflare bloque curl ; les 5 extraits ont été lus et recopiés par WebFetch (confirmés, pas de recours à la copie locale du 05/10, qui n'existe pas pour ces pages).
- transitionspro-paca.fr : pare-feu anti-robot (page « Security check »). Lien régional conservé dans `liens_par_region` (lien non utilisé comme source) ; les 17 autres sites régionaux répondent (HTTP 200).
- Une coupure réseau ponctuelle (service-public F10705, A17164, A17364) a été résolue par une nouvelle tentative ; aucun autre site injoignable. Les 8 `url_demarche` répondent (HTTP 200).

## Points connus tranchés

- Barème de rémunération des stagiaires (769,49 € / 775,65 €) : ne concerne pas ce fichier (aucune rémunération de stagiaire dans nat-1).
- Aide VAE de France Travail supprimée le 08/05/2026 : confirmée sur le Bulletin officiel de France Travail ; prise en compte (nat-vae corrigé, aide ajoutée aux exclues).
- Complément CPF du PLF 2027 : non voté (page Mon Compte Formation : projet présenté en Conseil des ministres le 01/10/2026). Le fichier le présente comme non adopté dans nat-cpf, nat-cpf-abondement-employeur, nat-bilan-competences, nat-vae et les notes. À revoir après le vote de la loi de finances 2027.
- POEI nationale / régionale : aucune POEI dans ce fichier, aucun doublon à signaler.

## Remarques pour l'intégrateur (sans modification du fichier)

- nat-periode-reconversion : `criteres.duree_max_heures` = 2 100 correspond au maximum possible avec accord d'entreprise ou de branche ; la règle générale est 150 à 450 heures (voir conditions).
- nat-cpf : la date « 25 juin 2026 » de la loi n° 2026-534 ne figure pas dans l'extrait cité ; la version en vigueur de L6323-6 depuis le 27/06/2026 est confirmée sur Légifrance, et l'intitulé de la loi apparaît sur Légifrance (JORFTEXT000054309429, lu via un moteur de recherche, page bloquée à curl).
- nat-cpf-abondement-employeur : « dotation créditée à réception » est étayé par la page financeurs.moncompteformation.gouv.fr « dotation volontaire » (non citée) : « Une fois le paiement réceptionné par la Caisse des Dépôts, le montant est crédité sur le compte CPF ».
- nat-vae-transitions-pro : afficher le montant comme un maximum et rappeler que la réouverture dépend de la région.
- nat-ptp : conditions « pas d'ancienneté » (obligation d'emploi) étayées par service-public F3024 ; licenciés pour inaptitude ou motif économique étayés par la page Transitions Pro Île-de-France, non citée.
