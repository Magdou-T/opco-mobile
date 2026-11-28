# Vérification du fichier regions-2.json

Périmètre : aides des Conseils régionaux de Bretagne (53), Pays de la Loire (52), Centre-Val de Loire (24) et Bourgogne-Franche-Comté (27). Date de vérification : 6 octobre 2026. Fichier corrigé : `regions-2.verifie.json` (25 aides, 4 exclues, tous les `id` d'origine conservés).

Répartition des verdicts (25 aides) : **confirmé 16**, **corrigé 3**, **à confirmer 6**, **exclu 0** (aucune aide déplacée vers `exclues`).

Contrôle des extraits (fichier corrigé) : 113 extraits retrouvés mot pour mot (espaces, apostrophes et guillemets normalisés) sur les pages ouvertes le 06/10 ; 29 extraits non vérifiables en direct, tous sur bretagne.bzh (403 Cloudflare), dont 5 retrouvés dans la copie locale du 05/10 (délibération `megalis_test.txt`). Dans le fichier d'origine : 99 extraits sur 129 (aides et exclues) retrouvés, les 30 autres sur bretagne.bzh.

## Tableau par aide

| id | verdict | justification |
|---|---|---|
| r53-programme-regional | à confirmer | bretagne.bzh/aides/fiches/qualif-emploi/ et /qualif-sanitaire-et-social/ : HTTP 403 (contrôle Cloudflare) le 06/10, non contourné. Les 6 extraits ne figurent dans aucune copie locale (tmp-r2/bzh_*.html = page « Just a moment »). Montant déjà non_chiffre ; statut → a_confirmer, confidence → estimated ; derniere_verification laissée au 05/10. |
| r53-qualif-emploi-individuel | à confirmer | bretagne.bzh/aides/fiches/qualif-emploi-individuel/ : 403 Cloudflare (le miroir europe.bzh est protégé de la même façon). Les 8 extraits (3 000 €, 18-26 ans, niveaux 3 à 6, 8 trimestres, 20 % de présentiel, 6 mois de résidence) n'existent dans aucune copie locale. Plafond 3 000 € / 100 % non confirmable : montant → non_chiffre, statut → a_confirmer. |
| r53-aide-financiere | confirmé | confirmé (copie du 05/10, site injoignable le 06/10) : bretagne.bzh/aides/fiches/aide-financiere/ en 403, mais 5 des 6 extraits figurent mot pour mot dans tmp-r2/megalis_test.txt = délibération 26_0206_02 du 30/03/2026 (data.megalis.bretagne.bzh, PDF rouvert le 06/10, identique à la copie). Règlement vérifié : socle 315 €, total de 411 à 987 € par échéance à temps plein, garde d'enfant 80/100/120 €, ≥ 70 h, ouverture 01/05/2026, validité jusqu'au 31/12/2028. Extrait « statut » invérifiable remplacé par 5 extraits de la délibération ; validite.debut = 2026-05-01. |
| r53-pass-transitions | à confirmer | bretagne.bzh/aides/fiches/pass-transitions/ : 403 Cloudflare ; les 8 extraits n'existent dans aucune copie locale. 50 %, 3 000 à 10 000 €, 6 000 €, 50 salariés, 10 M€, date limite 31/12/2027 non confirmables : montant → non_chiffre, statut → a_confirmer. |
| r52-programme-regional | confirmé | paysdelaloire.fr (je-trouve-une-formation, prepa-cles-avenir) et monemploi-paysdelaloire.francetravail.fr/je-me-forme : 5/5 extraits retrouvés mot pour mot le 06/10 ; PRÉPA Clés Avenir « plus de 16 ans, niveau 4 maximum » confirmé ; aucun signe de clôture (19 000 demandeurs d'emploi formés en 2025). |
| r52-1-emploi-1-formation | confirmé | paysdelaloire.fr/les-aides/dispositif-1-emploi-1-formation et /economie-et-innovation/former-recruter : 4/4 extraits OK ; contrat ≥ 24 h hebdomadaires, CDD ≥ 6 mois, cofinancement Région + FSE+ confirmés ; dispositif actif (5 000 places annoncées). Composante de r52-programme-regional (risque de double affichage). |
| r52-remuneration-stagiaires | confirmé | paysdelaloire.fr (page + annexe PDF « barèmes au 1er avril 2026 », tableau contrôlé visuellement) : 226,48 / 566,17 / 775,65 €, 1 002,02 € (divorcée/veuve/séparée < 3 ans, parent seul, femme seule enceinte), transport 35 € (15-250 km) / 55 € (≥ 250 km). Identique au barème national de service-public.fr F760 (vérifié le 01/04/2026) : 3 extraits ajoutés. |
| r52-fonds-social-urgence | confirmé | paysdelaloire.fr/les-aides/fonds-social-regional-durgence-fsu : 5/5 extraits OK ; frais ≥ 250 €, renouvelable une fois, dans la limite de l'enveloppe votée. |
| r52-poei-region | confirmé | paysdelaloire.fr/les-aides/preparation-operationnelle-lemploi-individuelle-poei : 6/6 extraits OK ; 300 / 450 / 600 h, contrats de 6 mois (4 mois saisonnier), 12 mois sans licenciement économique confirmés. Doublon à arbitrer avec nat-poei (nat-2-recrutement-alternance.json). |
| r52-pcrh | corrigé | page PCRH + PDF « critères de financement 2026 » : < 11 salariés = 90 % (50 % État + 40 % Région), 11 à 249 salariés = 50 % État, plafond État 15 000 €, actions du 01/01 au 31/12/2026 (ouvert le 06/10, fin dans moins de 3 mois). La page parle d'un « taux maximal » de 40 % : libellé et description précisés (« jusqu'à 40 % »). |
| r52-pass-entreprendre-formation | confirmé | paysdelaloire.fr/les-aides/pass-entreprendre-en-pays-de-la-loire-formation : 2/2 extraits OK ; durée 6 à 8 semaines, accès après PASS Diagnostic ; aucun montant publié (non_chiffre, confidence estimated conservée). |
| r24-programme-regional | confirmé | formation.centre-valdeloire.fr (formations-financees…, aides-pour-les-demandeurs-demploi) : 5/5 extraits OK ; PRF 2025-2028, dès 16 ans, 19 formations sanitaires et sociales confirmés. |
| r24-defi | confirmé | même page PRF : 2/2 extraits OK (recrutement à l'issue : CDD ≥ 6 mois, CDI ou contrat de professionnalisation). |
| r24-remuneration-stagiaires | corrigé | la page régionale (publiée le 13/05/2026) affiche 224,68 / 561,68 / 769,49 € = ancien barème ; barème en vigueur : 226,48 / 566,17 / 775,65 € (service-public.fr F760, vérifié le 01/04/2026, identique à l'annexe Pays de la Loire du 01/04/2026). Montants, majorations et libellé corrigés, 3 extraits service-public.fr ajoutés, extrait de l'ancien barème retiré, confidence → estimated. |
| r24-aide-permis-combo-parfait | confirmé | formation.centre-valdeloire.fr (rémunération et aides régionales, publiée le 13/05/2026 ; aides pour le permis de conduire, publiée le 04/01/2026) : 4/4 extraits OK ; 1 500 €, 18-25 ans, Mission locale, formation du PRF confirmés. |
| r24-aide-transport-hebergement | confirmé | 2/2 extraits OK ; aides non cumulables, variables selon la distance et l'âge ; aucun montant publié (non_chiffre, confidence estimated conservée). |
| r24-abondement-cpf-vae | à confirmer | formation.centre-valdeloire.fr/…/la-validation-des-acquis-de-lexperience-vae : 2/2 extraits OK (« La Région et France Travail peuvent abonder », décret 2025-663), mais public et montant de l'abondement régional ne figurent que dans l'article de centre-valdeloire.fr (Incapsula, 403, non contourné) : statut a_confirmer conservé. |
| r27-programme-regional | confirmé | bourgognefranchecomte.fr (quelles-formations, PDF rémunération janvier 2026, DAQ 2026-2030) : 5/5 extraits OK ; plus de 16 ans, programme qualifiant / DAQ / DFL / E2C confirmés. |
| r27-remuneration-stagiaires | corrigé | PDF BFC « janvier 2026 » (entrants ≥ 01/01/2026) : 350 / 590 / 863 € (moins de 26 ans) confirmés ; 26 ans et plus : 769,49 € = ancien barème national (plafond TH 2 170,90 €) → 775,65 € (service-public.fr F760, 01/04/2026). Description, libellé et majorations corrigés ; extrait BFC raccourci (sans le 769,49) ; confidence → estimated. |
| r27-aide-transport-hebergement | confirmé | bourgognefranchecomte.fr/quelles-autres-aides-puis-je-pretendre : 3/3 extraits OK ; 98,79 € (> 15 km), 37,20 €, 101,84 € (> 250 km) confirmés. Condition citant « 769,49 € » annotée (775,65 € depuis le 01/04/2026). |
| r27-aide-entree-formation | confirmé | 5/5 extraits OK (PDF janvier 2026, page autres aides, DAQ) ; 200 € à l'entrée en formation, demande avant la fin de la formation. |
| r27-pass-vae-accompagnement | confirmé | bourgognefranchecomte.fr/validation-des-acquis-de-lexperience-vae-… : 5/5 extraits OK ; 80 €/h, 20 h / 1 600 € (classique), 30 h / 2 400 € (renforcé), Qualiopi, RNCP confirmés. |
| r27-pass-vae-hybride | confirmé | même page : 3/3 extraits OK ; 100 % des frais pédagogiques, 1 800 € par parcours, activité salariée < 10 h/semaine, 6 mois après validation partielle confirmés. |
| r27-arefe | à confirmer | bourgognefranchecomte.fr/node/3599 : 5/5 extraits OK (page en ligne avec règlement d'intervention et « Déposer un dossier ») mais aucune date d'ouverture ni enveloppe 2026 : statut a_confirmer conservé. |
| r27-aide-apprentis-difficulte | à confirmer | dossier de presse de l'assemblée plénière des 29-30/04/2026 : 3/3 extraits OK (jusqu'à 1 200 € par apprenti, CFA certifiés Qualiopi, critères valables jusqu'à fin 2027) ; simple annonce, règlement et modalités non publiés : statut a_confirmer conservé. |

## Aides déjà placées dans `exclues`

| aide exclue | verdict | justification |
|---|---|---|
| Prime régionale aux employeurs d'apprentis (PREA) – Bourgogne-Franche-Comté | exclu (confirmé) | bourgognefranchecomte.fr/node/449 : extrait « n'existe plus » retrouvé mot pour mot le 06/10. |
| Mobilité européenne et alternance (AAP FSE+, Région Bretagne) | exclu (preuve non vérifiable) | bretagne.bzh en 403 Cloudflare le 06/10, aucune copie locale ; exclusion conservée (appel à projets clos le 31/03/2024 selon l'extrait relevé le 05/10). |
| Aide de l'État de 500 € au permis des apprentis (national) | exclu (confirmé) | formation.centre-valdeloire.fr/focus-sur/lalternance/les-aides-destinees-aux-alternants : 2/2 extraits retrouvés le 06/10 ; la page « permis de conduire » du même site confirme (« supprimé par la dernière loi de finances »). |
| Aide de France Travail au financement de la VAE (national) | exclu (confirmé) | gref-bretagne.com (article VAE) : extrait « Depuis le 8 mai 2026… » retrouvé le 06/10 ; preuve primaire ajoutée : BO France Travail, délibération n° 2026-18 du 30/04/2026 (« L'aide à la validation des acquis de l'expérience est supprimée », en vigueur le 8 mai 2026). |

## Corrections notables

1. **Barème de rémunération des stagiaires (point connu 769,49 € / 775,65 €)** : le barème en vigueur au 06/10/2026 est celui du 1er avril 2026, soit 226,48 € (moins de 18 ans), 566,17 € (18-25 ans) et **775,65 €** (26 ans et plus) par mois. Source : service-public.fr, fiche F760 (« Vérifié le 01 avril 2026 »), identique à l'annexe « barèmes au 1er avril 2026 » de la Région Pays de la Loire. `r52-remuneration-stagiaires` était déjà conforme ; `r24-remuneration-stagiaires` corrigé (la page de la Région, publiée le 13/05/2026, affiche encore l'ancien barème 224,68 / 561,68 / 769,49 €) ; `r27-remuneration-stagiaires` corrigé pour les 26 ans et plus (le document régional de janvier 2026 indique 769,49 €, ancien barème national), les montants des moins de 26 ans (350 / 590 / 863 €) restant ceux de la Région. Les deux fiches sont passées en `confidence: estimated` car la page régionale contredit le barème national.
2. **Bretagne** : `r53-programme-regional`, `r53-qualif-emploi-individuel` et `r53-pass-transitions` passent en `a_confirmer` (règle « site injoignable » : extraits absents des copies locales) ; les deux dernières passent en `montant.mode = non_chiffre` (3 000 € / 100 % et 50 % / 3 000-10 000 € non confirmables) avec une mention dans `conditions`. `r53-aide-financiere` reste `actif` : ses valeurs sont confirmées par la délibération 26_0206_02 du 30/03/2026 ; l'extrait « Date limite » invérifiable est remplacé par 5 extraits de la délibération et `validite.debut` est renseigné (2026-05-01).
3. **`r52-pcrh`** : la page et le PDF 2026 parlent d'un taux régional **maximal** de 40 % ; libellé et description précisés (« jusqu'à 40 % »), `pourcentage` inchangé.
4. **Exclue « Aide de France Travail au financement de la VAE »** : preuve primaire ajoutée (BO France Travail, délibération n° 2026-18 du 30/04/2026, en vigueur le 08/05/2026).
5. `derniere_verification` = 2026-10-06 pour les 22 aides relues ; les 3 fiches bretagne.bzh non relues gardent 2026-10-05. `meta.auteur` complété, trois notes ajoutées à `notes`.

## Points connus tranchés

- **Barème 769,49 € / 775,65 €** : 775,65 € (voir correction 1).
- **Aide VAE de France Travail supprimée le 08/05/2026** : confirmé par le BO de France Travail (délibération n° 2026-18) ; l'aide est déjà dans `exclues`. `r24-abondement-cpf-vae` et `r27-pass-vae-*` sont des aides régionales distinctes, non concernées ; la page Centre-Val de Loire mentionne seulement que « la Région et France Travail peuvent abonder » le CPF.
- **Complément CPF du PLF 2027** : aucune mention dans ce fichier, rien n'est présenté comme acquis. Seule réserve budgétaire : PASS Transitions Bretagne « sous réserve du vote du budget 2027 » (budget régional).
- **POEI nationale / régionale** : doublon potentiel `r52-poei-region` (Région Pays de la Loire, plafonds 300/450/600 h) avec `nat-poei` (`nat-2-recrutement-alternance.json`) ; la fiche régionale décrit la même POEI mise en œuvre par France Travail. À arbitrer (fusionner ou ne garder qu'une entrée par employeur). Aucune autre entrée POEI (hors la POEC collective `nat-poec`) dans les fichiers de recherche présents dans le dossier.

## Sites injoignables ou bloqués (non contournés)

- `www.bretagne.bzh` : HTTP 403, page de contrôle Cloudflare (6 URL de sources + `/aides/`) ; `europe.bzh` (miroir des fiches) : même protection. Règle « site injoignable » appliquée (voir verdicts Bretagne).
- `www.legifrance.gouv.fr` : 403 Cloudflare lors d'une tentative unique (articles R6341-25 à R6341-32), abandonnée ; le barème a été établi avec service-public.fr.
- `www.centre-valdeloire.fr` (Incapsula, signalé par le chercheur) : non retenté ; `formation.centre-valdeloire.fr` est accessible.
- Un moteur de recherche grand public a affiché un CAPTCHA : abandonné sans le résoudre. `www.agefiph.fr` (maintenance 503 les 05-06/10 selon le chercheur) : non retenté, les pages Agefiph restent à ajouter aux portails.
- Liens de portails : 18 sur 19 joignables le 06/10 (seul `bretagne.bzh/aides/` est en 403).

## Autres remarques pour l'intégrateur

- `r52-1-emploi-1-formation` est une composante de `r52-programme-regional` (risque de double affichage).
- `r52-pcrh` est classée `service_gratuit` alors que la prestation est cofinancée (reste à charge possible) ; catégorie non modifiée. L'aide est valable pour les actions débutées jusqu'au 31/12/2026.
- `r27-aide-apprentis-difficulte` repose sur un dossier de presse : à confirmer auprès d'un CFA ou de la Région avant affichage.

## Méthode

Les 35 URL de sources distinctes ont été ouvertes une fois (requête HTTP avec User-Agent de navigateur, texte extrait avec BeautifulSoup / pypdf ; WebFetch d'abord, qui a renvoyé 403 sur bretagne.bzh), ainsi que les 19 liens de portails (statut seulement). Pages complémentaires : service-public.fr (fiche F760), bo.francetravail.org, pages francetravail.fr de contexte. Chaque extrait a été comparé à la page ouverte (comparaison exacte après normalisation, puis comparaison alphanumérique), chaque nombre des champs `montant`, `criteres`, `conditions` et `description` a été recoupé avec les pages sources, et le tableau du PDF Pays de la Loire a été contrôlé visuellement. Fichiers de travail : `tmp-r2v/` (pages ouvertes, scripts `fetch_all.py`, `check_extraits.py`, `check_numbers.py`, `build_verifie.py`, `validate.py`).
