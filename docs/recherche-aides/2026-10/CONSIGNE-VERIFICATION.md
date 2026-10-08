# Consigne du vérificateur indépendant (tâche 16)

Tu es vérificateur indépendant d'un fichier d'aides à la formation produit par un autre agent. Date du jour : **6 octobre 2026**.

Dossier : `C:\Users\magdo\AppData\Local\Temp\claude\C--Users-magdo-Desktop-Claude-Projet-OPCO\52697ff6-6d7d-4f13-8eff-c5938bb2697d\scratchpad\research\` (noté `$R`).

1. Lis d'abord le protocole `$R/PROTOCOLE.md` (règles de sources, schéma d'une aide, enums).
2. Fichier à vérifier : `$R/<FICHIER>.json`. Les copies des pages consultées par le chercheur sont dans `$R/<DOSSIER_TMP>/` (fichiers .html / .txt / .pdf).

## Méthode

- Regroupe les sources par URL et ouvre **chaque URL distincte une seule fois** (WebFetch ; sinon curl avec un User-Agent de navigateur ; sinon `https://r.jina.ai/<url>`). Ne contourne aucune protection anti-robot ni CAPTCHA.
- Pour **chaque aide** :
  1. L'`extrait` de chaque source figure-t-il sur la page (mot pour mot ou quasi, espaces normalisés) ?
  2. Chaque nombre du `montant` et des `criteres` (montants, %, plafonds, âges, effectifs, durées, dates) est-il confirmé par une source officielle ?
  3. Le dispositif est-il ouvert aux nouvelles demandes (ni terminé, ni suspendu, ni enveloppe épuisée, ni appel à projets clos) ?
- **Site injoignable ou bloqué aujourd'hui** (maintenance, 403, Cloudflare…) : ce n'est pas une contradiction. Contrôle l'extrait dans la copie locale de `$R/<DOSSIER_TMP>/` ; s'il y figure, verdict « confirmé (copie du 05/10, site injoignable le 06/10) » et l'aide garde ses valeurs ; sinon, verdict « à confirmer ».
- Corrections :
  - nombre faux → corrige avec un nouvel extrait mot pour mot (≤ 300 caractères) de la page officielle ;
  - nombre non confirmable → `montant.mode` = `"non_chiffre"` et `statut` = `"a_confirmer"` ;
  - dispositif mort → déplace l'aide dans `exclues` avec la preuve (URL + extrait + date) ;
  - mets `derniere_verification` = `"2026-10-06"` pour chaque aide vérifiée (confirmée ou corrigée).
- N'ajoute aucune nouvelle aide. Ne change aucun identifiant. Garde la même structure de fichier.
- Points connus à trancher s'ils concernent ton fichier : barème de la rémunération des stagiaires (769,49 € ou 775,65 € pour les 26 ans et plus : retiens le barème en vigueur au 06/10/2026 d'après service-public.fr ou la source officielle la plus récente, en le citant) ; aide VAE de France Travail supprimée le 08/05/2026 ; complément CPF du PLF 2027 non voté (ne pas le présenter comme acquis) ; POEI nationale et POEI régionale (signale tout doublon dans ton rapport).

## Livrables

- `$R/<FICHIER>.verifie.json` : même structure que le fichier d'origine ; valide-le avec python (`json.load`) et contrôle que tous les `id` d'origine se retrouvent dans `aides` ou `exclues`.
- `$R/verification-<FICHIER>.md` : tableau `id | verdict (confirmé / corrigé / à confirmer / exclu) | justification courte (URL, nombre vérifié)`, puis les corrections notables.
- Réponse finale (en français, courte) : nombre d'aides par verdict, corrections notables, sites injoignables.
