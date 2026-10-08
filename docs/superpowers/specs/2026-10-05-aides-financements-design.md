# Spécification — Moteur d'aides et financements + identification fiable de l'OPCO

- **Application** : `opco-mobile` (app Expo « Financement OPCO », moteur `@opco/core`, pipeline `@opco/backend`, datasets publiés)
- **Version cible** : app 1.3.0 (versionCode 4), dataset v4
- **Date** : 05/10/2026
- **Statut** : conception validée par l'utilisateur le 05/10/2026
- **Branche** : `feature/aides-financements`

---

> **Révision du 06/10/2026 — cible : site web.** À la demande de l'utilisateur, le support final est le **site financementOPCO** (Next.js, export statique, hébergement Hostinger), et non plus l'app mobile. Conséquences :
> - le site est intégré au monorepo sous `apps/web` et consomme `@opco/core` (moteur, données, schémas) ; le dossier d'origine `opco-funding` n'est pas modifié ;
> - le moteur (`@opco/core` : détection OPCO, catalogue d'aides, évaluation, plan de financement, corrections du calcul) et les données restent tels que spécifiés ci-dessous ;
> - les écrans décrits aux §4 et §6 sont réalisés dans le site, avec sa charte (SFG) et ses composants ; les pages guides, fiches OPCO et contact sont conservées et alimentées par `@opco/core` ;
> - l'app mobile reste en l'état : les changements de `@opco/core` restent rétrocompatibles pour elle (pas de suppression d'export qu'elle utilise ; la liste d'étapes du site est définie dans `apps/web`) ;
> - publication : export statique du site + archive zip pour Hostinger (données embarquées au build) ; la publication du dataset v4 pour les APK devient facultative ;
> - §11 : le build EAS est remplacé par le dépôt de l'archive sur Hostinger.

## 1. Objectifs

1. **Revoir et corriger l'app existante** : justesse des montants, règles légales, fraîcheur des données, robustesse.
2. **Identifier l'OPCO de l'entreprise de façon fiable**, avec un niveau de certitude explicite et un recours à la source officielle.
3. **Nouvelle fonctionnalité : identifier toutes les aides et tous les financements mobilisables** pour un projet de formation (Région, CPF, France Travail, Transitions Pro, Agefiph, Union européenne, fonds des non-salariés, fiscalité…), pour l'entreprise **ou** le bénéficiaire, et **toutes les possibilités de réduction des coûts**.

Principe non négociable, hérité de l'app : **aucun montant inventé**. Toute valeur chiffrée provient d'une source officielle citée (URL + extrait + date de vérification), sinon elle n'est pas chiffrée.

## 2. Constats de la revue (état au 05/10/2026)

| # | Constat | Gravité |
|---|---|---|
| 1 | Le workflow hebdomadaire `Update OPCO dataset` échoue à chaque exécution depuis juin (10/10) : le secret `ANTHROPIC_API_KEY` n'est pas configuré. GitHub l'a ensuite désactivé (`disabled_inactivity`). Les APK utilisent toujours le dataset v3 du 11/06/2026. | Bloquant |
| 2 | Les barèmes de l'app (juin) et ceux du site web (vérifiés en juillet) divergent sur 31 champs principaux et sur la plupart des plafonds par taille (ex. OPCO Santé 2 500 € vs 6 000 €, Opcommerce 1 000/1 500 € vs 1 500/2 500 €). Constructys a des entrées `plafonds_par_taille` en double (`less_11`, `11_49`) : le calcul prend la première sans prévenir. | Bloquant |
| 3 | Règle légale absente : les fonds mutualisés du plan de développement des compétences (PDC) sont réservés aux entreprises de moins de 50 salariés. L'app calcule un financement PDC pour une entreprise de 300 salariés sans avertissement. | Bloquant |
| 4 | « Enveloppe maximale potentielle » = financement PDC + dispositifs calculés sur le coût **total** : elle peut dépasser le prix de la formation. | Bloquant |
| 5 | Plusieurs IDCC → le premier OPCO trouvé est retenu silencieusement. Codes échappatoires (5501, 5100, 9998, 9999) non gérés. Aucune aide si l'IDCC est absent. Table IDCC → OPCO (952 codes, libellés génériques) jamais vérifiée et non corrigeable à distance. | Majeur |
| 6 | Données de l'API entreprise inexploitées : tranche d'effectif, région, département, code NAF, ESS/SIAE/association. | Majeur |
| 7 | Moteur moins complet que celui du site : pas de barème dégressif (Uniformation), pas de plafond limité à la pédagogie (AKTO). | Majeur |
| 8 | E-mail OPCO parfois vide (« Contact : » sans adresse). Helpers inutilisés. Liens du monorepo cassés après déplacement du dossier (réparés par `npm install`). Modèles par défaut du pipeline à revoir. | Mineur |

## 3. Périmètre

**Inclus**
- Corrections des constats 1 à 8.
- Détection d'OPCO v2 (données ouvertes) + emplacement prévu pour les données officielles France Compétences (sous licence).
- Moteur d'aides (catalogue + évaluation + plan de financement) dans `@opco/core`.
- Parcours en 6 étapes et nouvel écran de résultats dans l'app.
- Catalogue d'aides vérifié : national, Union européenne, 18 régions (13 métropolitaines + 5 DROM), fonds d'assurance formation des non-salariés, fiscalité/exonérations.
- Dataset v4 (aides + table IDCC + portails régionaux), mises à jour à distance.
- Réparation du pipeline + contrôle automatique des liens sources.

**Exclu (évolutions possibles)**
- Site web `opco-funding` (le moteur `@opco/core` pourra y être réutilisé plus tard).
- Interrogation en direct d'API d'aides (clés non protégeables dans un APK, données non structurées).
- Recensement exhaustif des aides départementales/communales (couvertes par des liens vers les portails officiels).
- Re-vérification automatique des aides par IA (le pipeline la fera dans une itération suivante ; ici : contrôle des liens + dates de vérification affichées).
- Build iOS, comptes utilisateurs, serveur.

## 4. Parcours utilisateur

| Étape | Contenu | Obligatoire pour avancer |
|---|---|---|
| 0. **Votre projet** | Former un salarié · Reconversion d'un salarié · Recruter et former un demandeur d'emploi · Recruter en alternance · Former le dirigeant | Un projet choisi |
| 1. **Entreprise** | Recherche nom/SIREN/SIRET → OPCO (avec certitude), conventions, région, département, effectif (tranche INSEE), NAF, ESS/SIAE/association pré-remplis et modifiables. Sélection manuelle possible (OPCO, région). Bouton « Vérifier sur l'outil officiel France Compétences ». | Région + taille ; OPCO sauf pour « Former le dirigeant » |
| 2. **Bénéficiaire** | Questions selon le projet (voir §4.1) | Champs requis du projet |
| 3. **Formation** | Nom, type, mode, durée, coût (existant) + type de certification (RNCP, RS, CQP, diplôme, habilitation, aucune), niveau visé (3 à 8), éligibilité CPF (oui/non/je ne sais pas), date de début, organisme certifié Qualiopi (oui/non/je ne sais pas) | Durée, coût, mode |
| 4. **Frais annexes** | Inchangé (sauté si 100 % à distance) | — |
| 5. **Récapitulatif** | Toutes les réponses, modifiables | — |

### 4.1 Questions « Bénéficiaire » selon le projet

| Projet | Statut bénéficiaire | Questions |
|---|---|---|
| Former un salarié | `salarie` | Contrat*, ancienneté, âge, RQTH, niveau de diplôme, solde CPF (facultatif) |
| Reconversion d'un salarié | `salarie` | Contrat*, ancienneté*, âge, RQTH, niveau de diplôme, solde CPF |
| Recruter et former un demandeur d'emploi | `demandeur_emploi` | Inscrit à France Travail*, âge, RQTH, niveau de diplôme, région de résidence (par défaut celle de l'entreprise) |
| Recruter en alternance | `alternant` | Type de contrat (apprentissage / professionnalisation)*, âge*, RQTH, niveau de diplôme, inscrit à France Travail |
| Former le dirigeant | `dirigeant` | Statut* (commerçant, artisan, profession libérale, exploitant agricole, dirigeant assimilé salarié), micro-entrepreneur (oui/non) |

(* = requis)

## 5. Architecture

### 5.1 Vue d'ensemble

```
packages/core/src/
  types.ts              (+ types projet/bénéficiaire, champs WizardState)
  calculator.ts         (corrections OPCO, §5.6)
  opco-resolver.ts      (v2, §5.5)
  geo.ts                (codes région/département INSEE)
  aides/
    types.ts            (catalogue, §5.2)
    profil.ts           (WizardState → ProfilAides)
    evaluer.ts          (éligibilité + montants, §5.3)
    plan.ts             (plan de financement, §5.4)
  schema.ts             (Zod : aides, IDCC, portails, dataset v4)
  data.ts               (données embarquées : opcos + aides + idcc + portails)
packages/core/data/
  opcos/*.json          (11 OPCO, revérifiés)
  idcc/idcc-opco.json   (table IDCC v2)
  idcc/naf-suggestions.json
  aides/nationales.json, aides/europe.json, aides/regions/<code>-<nom>.json
  portails/portails-regionaux.json
apps/mobile/src/
  components/wizard/StepProjet.tsx (nouveau), StepIdentification → « Entreprise », StepSituation → « Bénéficiaire »
  components/results/PlanFinancement.tsx, AidesList.tsx, AideCard.tsx, PortailsRegionaux.tsx (nouveaux)
  lib/dataset-sync.ts   (dataset actif complet : opcos + aides + idcc + portails)
backend/
  src/check-sources.ts  (nouveau : contrôle des liens)
  src/publish.ts        (dataset v4)
```

Toutes les fonctions de `@opco/core` restent **pures** (aucune E/S, aucune lecture d'horloge : la date de référence est passée en paramètre).

### 5.2 Modèle du catalogue d'aides

Les fichiers JSON suivent la convention existante (snake_case) ; les résultats calculés sont en camelCase.

```ts
export type ProjetType =
  | 'formation_salarie' | 'reconversion_salarie' | 'recrutement_demandeur_emploi'
  | 'alternance' | 'formation_dirigeant';

export type StatutBeneficiaire = 'salarie' | 'demandeur_emploi' | 'alternant' | 'dirigeant';

export type Financeur =
  | 'etat' | 'region' | 'departement' | 'france_travail' | 'transitions_pro' | 'agefiph'
  | 'europe' | 'cpf' | 'opco' | 'faf' | 'fiscal' | 'branche' | 'autre';

/** Ce que l'aide réduit ou apporte. */
export type CategorieAide =
  | 'cout_formation'            // réduit le coût pédagogique / frais annexes
  | 'aide_employeur'            // versée à l'employeur (embauche, salaires…)
  | 'remuneration_beneficiaire' // revenu du bénéficiaire pendant la formation
  | 'avantage_fiscal_social'    // crédit d'impôt, exonérations
  | 'service_gratuit';          // conseil/diagnostic gratuit (pas de montant)

export type CodeRegion =
  | '84' | '27' | '53' | '24' | '94' | '44' | '32' | '11' | '28' | '75' | '76' | '52' | '93'
  | '01' | '02' | '03' | '04' | '06';

export type NiveauDiplome = 'sans_diplome' | 'cap_bep' | 'bac' | 'bac_plus_2' | 'bac_plus_3_et_plus';
export type NiveauCertification = 3 | 4 | 5 | 6 | 7 | 8;
export type StatutDirigeant =
  | 'commercant' | 'artisan' | 'profession_liberale' | 'exploitant_agricole' | 'assimile_salarie';
export type TypeStructure = 'ess' | 'siae' | 'association';

export interface Aide {
  id: string;                          // kebab-case unique, ex. 'cpf', 'r11-aire'
  nom: string;
  financeur: Financeur;
  financeur_nom: string;               // ex. 'Région Île-de-France'
  categorie: CategorieAide;
  projets: ProjetType[];               // ≥ 1
  beneficiaires: StatutBeneficiaire[]; // ≥ 1
  description: string;
  criteres: CriteresAide;              // critères vérifiés automatiquement
  conditions: string[];                // conditions affichées, non vérifiables automatiquement
  montant: MontantAide;
  cumul: RegleCumul;
  demarches: string[];                 // ≥ 1 étape, dans l'ordre
  url_demarche: string | null;
  liens_par_region?: Partial<Record<CodeRegion, string>>; // dispositifs nationaux gérés en région
  sources: SourceAide[];               // ≥ 1, officielles, https
  derniere_verification: string;       // 'AAAA-MM-JJ'
  validite: { debut: string | null; fin: string | null };
  statut: 'actif' | 'a_confirmer' | 'suspendu';
  confidence: Confidence;              // 'exact' | 'estimated' | 'depends_on_branche'
  ordre_empilement?: number;           // ordre dans le plan (défaut selon financeur)
}

export interface SourceAide { url: string; titre: string; extrait: string } // extrait ≤ 300 car.

export interface CriteresAide {        // tous facultatifs ; absent = pas de contrainte
  regions?: CodeRegion[];
  perimetre_region?: 'entreprise' | 'beneficiaire'; // défaut 'entreprise'
  departements?: string[];
  effectif_min?: number; effectif_max?: number;
  age_min?: number; age_max?: number;
  rqth?: true;                         // RQTH requise (uniquement vrai : false n'ajoute aucune restriction)
  niveaux_diplome?: NiveauDiplome[];   // diplôme le plus élevé du bénéficiaire
  niveau_certification_max?: NiveauCertification; // niveau de la formation visée
  niveau_certification_min?: NiveauCertification;
  contrats?: ContractType[];
  types_alternance?: ('apprentissage' | 'professionnalisation')[];
  anciennete_min_mois?: number;
  inscrit_france_travail?: boolean;
  statuts_dirigeant?: StatutDirigeant[];
  micro_entrepreneur?: boolean;        // true = réservé ; false = exclu
  certifications?: CertificationType[];
  types_formation?: TrainingType[];    // type de formation du parcours ; une aide propre à un type (par exemple la VAE) ne s'applique pas aux autres
  eligible_cpf?: true;                 // formation éligible au CPF requise (uniquement vrai)
  duree_min_heures?: number; duree_max_heures?: number;
  opcos?: string[]; idcc?: string[]; naf_prefixes?: string[];
  structures?: TypeStructure[];        // l'une au moins
  qualiopi_requis?: true;              // organisme de formation certifié Qualiopi requis (uniquement vrai)
}

export interface MontantAide {
  mode: 'forfait' | 'pourcentage' | 'par_heure' | 'par_mois' | 'solde_cpf' | 'non_chiffre';
  valeur: number | null;               // € (forfait, par_heure, par_mois)
  pourcentage: number | null;          // % (mode pourcentage)
  base: 'cout_pedagogique' | 'cout_total' | null;
  plafond: number | null;              // €
  duree_max_mois: number | null;       // mode par_mois
  libelle: string;                     // règle lisible : « Jusqu'à 5 000 € la 1re année »
  majorations?: MajorationAide[];      // 1re majoration dont les critères sont remplis
}

export interface MajorationAide {
  criteres: CriteresAide;
  valeur?: number | null; pourcentage?: number | null; plafond?: number | null;
  libelle: string;
}

export interface RegleCumul {
  cumulable: boolean;
  alternatives?: string[];             // ids d'aides « au choix » (non additionnées)
  note?: string;
}

export interface PortailRegional {
  region: CodeRegion;
  nom_region: string;
  liens: { titre: string; url: string;
           type: 'region' | 'carif_oref' | 'transitions_pro' | 'france_travail' | 'agefiph' | 'autre' }[];
  derniere_verification: string;
}
```

`OpcoData` gagne `derniere_verification?: string`, `cout_horaire_seuils?` et `budget_annuel_portee?` (§5.6).

Types existants étendus : `CertificationType` reçoit `'rs'` et `'aucune'` ; `WizardState` reçoit les champs du parcours (§4) : `projetType`, `siret`, `regionCode`, `departementCode`, `regionBeneficiaireCode`, `codeNaf`, `effectif`, `structures`, `idccCandidats`, `opcoCertitude`, `ageBeneficiaire`, `niveauDiplome`, `typeAlternance`, `inscritFranceTravail`, `statutDirigeant`, `microEntrepreneur`, `soldeCpf`, `niveauFormationVise`, `eligibleCpf`, `dateDebutFormation`, `organismeQualiopi`. La taille d'entreprise (`companySize`) passe de l'étape « Situation » à l'étape « Entreprise ». Les états enregistrés par l'app 1.2.0 restent lisibles (fusion avec l'état initial, comportement actuel de `loadWizardState`).

### 5.3 Évaluation de l'éligibilité

`evaluerAides(aides: Aide[], profil: ProfilAides, dateRef: string): AideEvaluee[]`

- `ProfilAides` est dérivé de `WizardState` + résolution OPCO par `profilDepuisWizard()` (projet, statut, région entreprise/bénéficiaire, département, effectif ou tranche, NAF, IDCC, OPCO, structures, âge, RQTH, diplôme, contrat, ancienneté, inscription France Travail, statut dirigeant, micro-entreprise, certification, type de formation, niveau visé, CPF, durée, coûts, Qualiopi, solde CPF, date de début).
- Chaque critère défini est évalué en **trois états** : `ok`, `ko` (raison : « Réservé aux … »), `inconnu` (raison : « Précisez … »).
  - Effectif : si l'effectif exact est inconnu, on utilise les bornes de la tranche (`less_11` = 0–10, `11_49` = 11–49, `50_299` = 50–299, `300_plus` = ≥ 300) ; un seuil situé à l'intérieur de la tranche donne `inconnu` (ex. « Vérifiez que l'effectif est inférieur à 250 salariés »).
- Statut global :
  - `non_eligible` si un critère est `ko`, si le projet ou le statut du bénéficiaire ne correspondent pas, si `statut = 'suspendu'` ou si la fin de validité est dépassée à `dateRef` ;
  - sinon `a_verifier` si un critère est `inconnu`, si `statut = 'a_confirmer'` ou si la validité commence après `dateRef` (`validite.debut` postérieur : raison « Dispositif ouvert à partir du JJ/MM/AAAA ») ;
  - sinon `eligible` (les `conditions` non vérifiables restent affichées).
- **Hors périmètre** (`horsPerimetre`, l'aide est masquée à l'écran car sans rapport avec la situation) : autre projet, autre public ou autre région (critère `regions` renseigné, région connue et différente) ; une aide propre à un type de formation (par exemple la VAE) est hors périmètre quand le type du parcours est connu et différent ; inconnu : à vérifier. Une information inconnue ne rend jamais une aide hors périmètre, et une aide hors périmètre n'est jamais `eligible` ni `a_verifier`.
- Montant estimé (arrondi au centime, jamais négatif) :
  - `forfait` → `valeur` ; `pourcentage` → `pourcentage × base` ; `par_heure` → `valeur × durée` ; `par_mois` → `valeur × min(duree_max_mois, durée de la formation en mois à temps plein)` (« jusqu'à » ; 1 mois = 151,67 h = 35 h × 52 / 12, au prorata sans arrondi supérieur ; `null` si la durée du profil, `valeur` ou `duree_max_mois` est inconnu) ; `solde_cpf` → solde CPF saisi, sinon `null` (« jusqu'au montant de vos droits ») ; `non_chiffre` → `null`. Une aide versée sur une période indépendante de la formation (par exemple 500 € par mois pendant 3 mois après une rupture de contrat) est un `forfait` du total maximal, pas un `par_mois`.
  - Le `plafond` s'applique ; la première `majoration` dont les critères sont tous `ok` remplace valeur/pourcentage/plafond (un `plafond: null` explicite lève le plafond de base). Une information inconnue ne déclenche jamais une majoration : le plafond de 1 500 € du CPF pour le répertoire spécifique (§5.4) ne s'applique que si la certification visée est connue.
  - Une aide de catégorie `cout_formation` est limitée au coût connu de la formation (coût pédagogique + frais annexes) ; le montant estimé est aussi renseigné pour une aide `non_eligible` (ce qu'elle verserait si le profil y avait droit) : il n'est jamais affiché ni additionné.
- Tri : éligibles, puis à vérifier, puis non éligibles ; à l'intérieur, par montant décroissant.

### 5.4 Plan de financement

`construirePlan(opco: FundingResult | null, aides: AideEvaluee[], profil: ProfilAides): PlanFinancement`

- `coutFormation` = coût pédagogique + frais annexes demandés ; **nul quand le coût pédagogique est inconnu** (jamais les frais annexes seuls : le plan ne présente alors aucun financement de la formation) et jamais négatif.
- Seules les aides **`eligible`** comptent dans le plan : les aides « à vérifier » et non éligibles n'y figurent nulle part (l'écran les présente à part, avec les informations à préciser).
- **Financements de la formation** (catégorie `cout_formation` : l'aide paie la formation elle-même ; éligibles, chiffrés, cumulables ; les aides à la personne, c'est-à-dire rémunération, transport, hébergement, restauration, permis, équipement et mobilité, sont de catégorie `remuneration_beneficiaire`, jamais déduites du coût de la formation et présentées à part sous « Revenus et aides à la personne »), empilés par ordre croissant de `ordre_empilement` (défaut : OPCO 10, dispositifs OPCO chiffrés 12, branche 15, Région 20, Agefiph 30, Europe 40, État / France Travail / Transitions Pro 50, FAF 60, CPF 90), la plus grosse d'abord à ordre égal. Chaque ligne est **plafonnée au reste à charge courant** : le total ne dépasse jamais le coût. Le CPF passe en dernier (droits du bénéficiaire, mobilisés avec son accord). Une aide `cout_formation` non cumulable est une option « à comparer », jamais empilée.
- **Solde CPF partagé** : les aides qui prélèvent sur le compte du bénéficiaire (`mode_montant: solde_cpf`) partagent **un seul** solde, celui du profil (`soldeCpf`, nul s'il est inconnu) : chacune est plafonnée par le reste à charge et par ce qui reste du solde après les aides empilées avant elle. Une autre aide chiffrée du financeur CPF n'est pas concernée : elle s'empile en plus du solde.
- **Modélisation du CPF** (revue finale, octobre 2026) :
  - `nat-cpf` vaut le solde saisi, c'est-à-dire le solde affiché sur Mon Compte Formation (droits acquis et dotations), dans la limite du coût. Les plafonds de 5 000 € et 8 000 € ne bornent que l'alimentation annuelle des droits acquis (article R. 6323-1 ; « Le compte formation des titulaires n'est donc pas plafonné », financeurs.moncompteformation.gouv.fr ; abondements au-delà des plafonds, article L. 6323-4, II) : ils restent écrits dans le libellé, jamais appliqués au solde ;
  - usage plafonné : une majoration placée en tête limite le CPF à 1 500 € pour une certification du répertoire spécifique (hors CléA, décret en vigueur depuis le 26 février 2026) ; le bilan de compétences (1 600 €) et le permis (900 €) ont leurs propres aides ;
  - CléA (`nat-clea`) n'est proposé que pour une certification du répertoire spécifique (critère `certifications: ['rs']`, « à vérifier » si la certification est inconnue) et n'est jamais chiffré : il reste « au choix » avec le CPF, dont il mobilise le même solde sans le plafond de 1 500 € ;
  - la dotation volontaire de l'employeur (`nat-cpf-abondement-employeur`) est l'argent de l'employeur, pas une aide extérieure : non chiffrée (montant selon dossier), jamais empilée. La participation forfaitaire de 150 € reste dans les conditions du CPF.
- La ligne OPCO (`opco-pdc`) reprend `calculateFunding()` (projet « Former un salarié ») : pédagogie, hébergement, restauration et frais annexes financés → financements de la formation ; « Prise en charge salaires » et forfait de transport → aides à l'employeur, présentés à part avec leur propre fiabilité. La fiabilité de la ligne OPCO est la plus faible de ses postes de formation (toutes les lignes financées quand le plafond annuel a été appliqué). Les dispositifs complémentaires OPCO sont intégrés selon leur règle de cumul : `hors_budget` / `additif` chiffrés → empilés (ordre 12) ; sans montant chiffré → affichés par l'écran à partir de `FundingResult.dispositifsComplementaires` ; `alternatif` → options.
- **Alternatives** (aides « au choix », déclarées dans un sens ou dans l'autre) : sélection **gloutonne**, pas optimale : des mieux chiffrées aux moins bien chiffrées ; à montant égal, le « pivot » (l'aide déclarée comme alternative par le plus grand nombre d'autres aides éligibles) l'emporte, puis l'ordre de la liste évaluée. Une aide dont une alternative est déjà retenue devient une option « au choix » ; deux aides seulement liées par un tiers (a–b, b–c) peuvent être retenues ensemble. Une aide plafonnée à 0 € (coût déjà couvert, solde CPF épuisé) n'apparaît ni dans les financements ni dans les options : l'écran ne doit pas compter sur l'affichage du « gagnant » nommé par une option.
- Sorties séparées : `financements`, `totalFinance`, `resteACharge` (≥ 0), `aidesEmployeur`, `remunerations`, `avantagesFiscauxSociaux`, `options`, `nonChiffrees` (éligibles sans montant) et `servicesGratuits`.
- `FundingResult.enveloppeMaxPotentielle` est conservé pour compatibilité mais corrigé (plafonné au coût demandé).

### 5.5 Identification de l'OPCO

`resoudreOpco(entree, table, suggestionsNaf): ResolutionOpco` (`packages/core/src/opco-resolver.ts`). La signature n'a aucun paramètre de source officielle ; `entree` porte un champ facultatif `natureJuridique`, que le site doit transmettre (règle 5).

```ts
export type CertitudeOpco = 'confirme' | 'fiable' | 'a_confirmer' | 'inconnu';
export interface EntreeResolution {
  idccs: string[];                  // conventions de l'entreprise et de ses établissements
  idccSiege?: string[] | null;      // conventions du siège (présélection entre plusieurs candidats)
  codeNaf?: string | null;          // activité principale de l'unité légale
  natureJuridique?: string | null;  // catégorie juridique INSEE (7xxx : droit administratif)
}
export interface IdccEntree {
  idcc: string; titre: string; opco: string | null;
  statut: 'actif' | 'fusionne' | 'echappatoire' | 'partage';
  idcc_cible?: string;          // statut 'fusionne' : convention de remplacement, quand elle est connue
  opcos_possibles?: string[];   // statut 'partage' (ex. filière forêt-bois : OCAPIAT ou AKTO)
  a_confirmer?: boolean;        // OPCO établi par aucune source officielle propre à cet IDCC (la note dit pourquoi)
  note?: string; source: string;
}
export interface SuggestionNaf {
  prefixe: string;              // division '47', groupe '47.1', classe '47.11' ou sous-classe '47.11F'
  opco: string;
  part: number | null;          // part observée (de 0,60 à 1 dans les données embarquées)
  effectif_etablissements?: number | null;  // taille de l'échantillon (au moins 30)
  libelle: string;              // intitulé officiel de la NAF rév. 2 (INSEE)
  source: string;               // https://www.data.gouv.fr/datasets/table-siret-opco
}
export interface ResolutionOpco {
  opcoSlug: string | null;
  certitude: CertitudeOpco;
  motif: string;                                   // explication affichée
  candidats: { opcoSlug: string; idccs: { idcc: string; titre: string }[] }[];
  idccRetenu: string | null;
  avertissements: string[];
  urlVerificationOfficielle: string;               // outil France Compétences
}
```

Règles (état du code) :
1. Normalisation sur 4 chiffres, suppression de `0000`, dédoublonnage. Une convention `fusionne` dont la cible figure dans la table est redirigée vers elle (avertissement). Cible absente de la table, ou convention close sans convention de remplacement (50 entrées de la table, dont 7509, 0438, 1237, 0779, 5545) : l'ancienne convention sert de rattachement si elle a un OPCO, jamais en `fiable`.
2. Codes échappatoires (5501, 5100, 9998, 9999) : ils ne désignent aucun OPCO (avertissement). La constante `CODES_ECHAPPATOIRES` les reconnaît même quand la table fournie (jeu de données téléchargé) ne les contient pas ; une entrée `echappatoire` de la table vaut de même.
3. Un seul OPCO candidat → `fiable` seulement si au moins une convention est ferme (en vigueur, avec OPCO, non marquée `a_confirmer` ; une convention redirigée est jugée sur sa cible) et si aucune convention n'est restée non rattachée (absente de la table, ou présente sans OPCO confirmé). Sinon `a_confirmer`, avec « Rattachement à confirmer » (conventions marquées `a_confirmer`), « Rattachement d'après l'ancienne convention ..., fusionnée ou close » et, s'il y a lieu, l'invitation à vérifier les conventions non rattachées. `idccRetenu` : la convention du siège si elle fait partie de celles du candidat, sinon la première convention ferme, sinon la première.
4. Plusieurs OPCO candidats (conventions d'OPCO différents, ou convention `partage`) → `a_confirmer` : tous les candidats avec le titre de leurs conventions, et le rappel de la règle (une convention par entreprise, déterminée par l'activité principale, sauf établissement autonome). Présélection : le seul candidat qui porte une convention du siège ; à défaut, le candidat que désigne la suggestion par code NAF (règle 6) ; sinon aucune (`opcoSlug` nul) et l'utilisateur choisit.
5. Aucune convention exploitable et employeur de droit public (catégorie juridique INSEE 7xxx, « personne morale et organisme soumis au droit administratif », nomenclature de septembre 2022 : État, collectivités territoriales, établissements publics administratifs dont les hôpitaux et les établissements sociaux et médico-sociaux publics, autres personnes morales de droit public administratif) → `inconnu`, aucune suggestion par le code NAF ; le motif dit que la plupart des employeurs publics ne cotisent pas à un OPCO et qu'on peut en choisir un dans la liste si l'établissement en a un. Les établissements publics industriels et commerciaux (41xx), les sociétés et les associations suivent la règle 6. Avec une convention exploitable, les règles 3 et 4 s'appliquent comme pour tout employeur.
6. Aucune convention exploitable, autre employeur → suggestion par le code NAF de l'unité légale (sous-classe, sinon classe, groupe, division) → `a_confirmer`, motif avec la part observée et la taille de l'échantillon (« 88 % des établissements employeurs observés dans ce secteur (échantillon de 33) relèvent de cet OPCO ») ; à défaut → `inconnu` et sélection manuelle.
7. Toujours : lien « Vérifier sur l'outil officiel » (`https://quel-est-mon-opco.francecompetences.fr/`).
8. `confirme` n'est jamais produit : il est réservé à une lecture directe du SIRET dans une source officielle, que le produit ne fait pas. La Table SIRET-OPCO de France Compétences, publiée en données ouvertes, permettrait cette lecture ; son intégration au site attend la décision de l'utilisateur. Elle sert seulement, hors ligne, à mesurer les parts des suggestions par code NAF.

**Suggestions par code NAF** (`packages/core/data/idcc/naf-suggestions.json`, 100 entrées) :
- Source : Table SIRET-OPCO, France Compétences, https://www.data.gouv.fr/datasets/table-siret-opco, Licence Ouverte 2.0 ; fichier `siro-202606.csv` (DSN de juin 2026) mis à jour sur data.gouv.fr le 24/09/2026, lu par l'API tabulaire de data.gouv.fr ; colonne `OPCO_PROPRIETAIRE` (OPCO de rattachement selon le dictionnaire de données de la table). Toute réutilisation mentionne cette source et cette date.
- Échantillon : unités légales actives de l'API Recherche d'entreprises dont l'activité principale relève du préfixe, employeuses (tranche d'effectif INSEE connue et non nulle), tirées sur des pages au hasard (graine fixe) en deux strates (1 à 9 salariés, 10 salariés et plus) ; le SIRET du siège est cherché dans la table. Comptent les employeurs dont la table donne un OPCO, hors catégories juridiques 7xxx (règle 5). Préparation du 08/10/2026 : 6 749 unités légales lues, 5 857 employeurs comptés, 7 397 requêtes en tout (au plus 4 par seconde, aucune à `api.francecompetences.fr`).
- Part : proportion de l'OPCO le plus fréquent parmi les établissements que l'entrée sert réellement (ses sous-classes, moins celles qui ont leur propre entrée), arrondie à deux décimales ; `effectif_etablissements` : taille de cet échantillon. Une entrée n'existe que si l'échantillon compte au moins 30 établissements et si la part atteint 0,60 : un secteur partagé entre plusieurs OPCO n'a pas d'entrée et le résolveur dit « non identifié » (commerce de gros 46, holdings 64.20Z et 70.10Z, associations 94.99Z, taxis 49.32Z, aide à domicile 88.10A, par exemple). Une sous-classe ou une classe dont l'OPCO diffère de celui de son parent est une exception observée, déclarée avec sa raison dans `packages/core/tests/naf-suggestions.test.ts` (10.13B, 10.71C, 10.71D, 41.1, 55.30Z).
- Évaluation sur 240 établissements tirés après avoir figé la table (recherche par mots-clés, aucun SIREN du calibrage), dont 167 que la table rattache à un OPCO : accord 50,3 % avant, 85,6 % après ; « non identifié » 45,5 % puis 10,2 % ; réponses `fiable` inchangées (51, dont 50 exactes) ; réponses `a_confirmer` fausses : 6 sur 41 avant, 6 sur 100 après. Détail : `.superpowers/sdd/final-fix-F1b-report.md`.
- Mise à jour : à refaire avec une version plus récente de la table quand on veut des parts à jour ; le produit ne lit aucune de ces données à l'exécution.

**Contrainte juridique** : la table de correspondance IDCC → OPCO de France Compétences (art. R. 6123-34, arrêté du 15/06/2022) et son API (`api.francecompetences.fr`) restent hors du produit : leur réutilisation exige une licence (art. R. 6123-35). La table IDCC v2 est reconstruite à partir de sources réutilisables : arrêtés d'agrément des OPCO et modificatifs (Journal officiel, Légifrance), listes de branches publiées par chaque OPCO, liste des IDCC du ministère du Travail (data.gouv.fr). La Table SIRET-OPCO, publiée par France Compétences sous Licence Ouverte 2.0, se réutilise librement avec mention de la source et de la date de mise à jour.

### 5.6 Corrections du moteur OPCO (`calculateFunding`)

1. **Règle des 50 salariés** : pour `50_299` et `300_plus`, si l'OPCO ou la branche ne publie pas d'enveloppe pour cette taille (plafond par taille non nul), la ligne pédagogique est financée à 0 € avec explication (fonds mutualisés réservés aux moins de 50 salariés ; pistes : contributions conventionnelles ou volontaires, alternance, période de reconversion, actions collectives). Si une enveloppe 50+ est publiée (ex. plan conventionnel), elle est appliquée avec un avertissement.
2. **Barème dégressif** `cout_horaire_seuils` (port du site web).
3. **Portée du plafond annuel** `budget_annuel_portee: 'global' | 'pedagogie'` (port du site web).
4. **Dispositifs complémentaires** calculés sur le **reste** à financer (sauf `alternatif`, calculé sur le coût complet) ; enveloppe plafonnée au coût demandé.
5. Validation : pas de doublon de taille dans `plafonds_par_taille` (schéma + test de données).
6. E-mail OPCO vide → le lien « Contact » n'est pas affiché.
7. Textes du calcul (revue finale) : « de » élidé devant le nom de l'OPCO (« d'AKTO », « d'OPCO 2i », « de l'Opcommerce », utilitaire pur `src/texte.ts`), espace insécable entre un nombre et son unité (« 140 h », « 50 % »), « coûts pédagogiques » en toutes lettres, aucun glyphe d'avertissement ; quand une variante de branche est appliquée et qu'un poste n'est pas publié pour elle (salaires, transport, hébergement, restauration), le texte nomme la branche (« non publié pour la branche … ») au lieu de renvoyer à « votre accord de branche ».
8. Variante de branche `relais_plan_conventionnel: true` (facultatif, jamais `false`) : son barème est celui d'un plan conventionnel de branche qui prend le relais d'une enveloppe de plan de développement des compétences épuisée, dans la limite de `budget_annuel_max` (AKTO, organismes de formation, IDCC 1516 : 10 000 € par an et par entreprise). Le site le lit sur la variante rendue par `resolveVarianteBranche(opco, state)`.

### 5.7 Dataset v4 et mises à jour

- `DatasetSchema` : `{ version, generatedAt, opcos, aides?, idcc?, naf?, portails? }`. Les nouvelles clés sont **facultatives** : les APK 1.2.0 déjà installés les ignorent (Zod retire les clés inconnues) et profitent des barèmes OPCO corrigés.
- `validateDataset` valide les nouvelles sections si présentes : ids uniques, `alternatives` existantes, sources https non vides (extraits de 300 caractères au plus), montants ∈ [0 ; 100 000], pourcentages ∈ [0 ; 100], dates valides ; les sources des variantes de branche et des dispositifs complémentaires sont aussi des adresses https. En revanche, `validateDataset` ne vérifie ni la présence d'au moins une aide nationale ni celle d'un portail par région : seuls les tests des données embarquées le font (`donnees-aides.test.ts`).
- Manifest : `aidesCount` facultatif.
- App : `getActiveDataset()` renvoie opcos + aides + idcc + naf + portails ; chaque section absente du cache retombe sur les données embarquées.
- `EMBEDDED_DATASET_VERSION = 4` et date mise à jour ; `build-example-dataset.mjs` et `publish.ts` intègrent les nouvelles sections.

## 6. Écrans

- **Accueil** : promesse élargie (« toutes les aides pour financer une formation »), état des données (OPCO + aides, date), vérification des mises à jour.
- **Étapes 0 à 5** : §4. Composants existants réutilisés (`ChoiceButton`, `OpcoPicker`, `forms.tsx`) ; nouveaux sélecteurs région/département.
- **Résultats** :
  1. `PlanFinancement` : coût total, financé, reste à charge ; lignes empilées ; options au choix.
  2. Aides à l'employeur, rémunération du bénéficiaire, avantages fiscaux et sociaux (montants séparés, jamais additionnés au financement de la formation).
  3. `AidesList` groupée par financeur : `AideCard` (badge Éligible / À vérifier, montant ou « montant selon dossier », description, conditions, démarches, sources cliquables, date de vérification, fiabilité). Section « Non éligibles » repliée, avec la raison.
  4. Détail OPCO (`FundingBreakdown` existant) quand le calcul PDC s'applique.
  5. `PortailsRegionaux` : « Pour aller plus loin » (Région, Carif-Oref, Transitions Pro, France Travail, Agefiph).
  6. Avertissement : estimation indicative, seul le financeur décide.

## 7. Données : collecte et vérification

- **Sources autorisées** : sites officiels uniquement (Légifrance, service-public.fr, travail-emploi.gouv.fr, francetravail.fr, moncompteformation.gouv.fr, france-competences, transitionspro.fr et sites régionaux, agefiph.fr, fse.gouv.fr / europa.eu / erasmusplus.fr, urssaf.fr, impots.gouv.fr / BOFiP, sites des OPCO, des FAF (AGEFICE, FAFCEA, FIF PL, VIVEA), des conseils régionaux et des Carif-Oref).
- **Chaque valeur chiffrée** : URL + extrait mot pour mot (≤ 300 caractères) + date de consultation.
- **En cas de doute** (source muette, contradictoire, enveloppe incertaine) : `statut: 'a_confirmer'`, montant `non_chiffre` si nécessaire. Jamais d'extrapolation.
- **Dispositifs terminés ou suspendus** : exclus du catalogue et listés dans un rapport « ce qui n'existe plus » (pour ne pas les présenter comme actifs).
- **Double vérification** : une seconde passe indépendante rouvre chaque source et confirme valeurs et extraits ; tout désaccord non tranché → `a_confirmer`.
- **Barèmes OPCO** : revérification complète des 11 OPCO à date d'octobre 2026 (y compris annonces d'épuisement des fonds), réconciliation des écarts app/site, `derniere_verification` renseignée.
- **Table IDCC v2** : reconstruction et diff avec la table actuelle (ajouts, corrections, codes fusionnés, codes partagés), libellés officiels des conventions.

## 8. Pipeline et maintenance

- `backend/src/check-sources.ts` : vérifie toutes les URL (OPCO, aides, portails) avec délai et redirections ; rapport JSON + Markdown ; utilisable sans clé d'API.
- Workflow : contrôle des liens à chaque exécution ; étape IA exécutée seulement si le secret `ANTHROPIC_API_KEY` existe (sinon annotation explicite au lieu d'un échec) ; actions mises à jour (Node 24) ; tests core + backend.
- Modèles par défaut du pipeline mis à jour (vérifiés via la documentation de l'API Claude).
- Guide de maintenance des données (`docs/donnees-aides.md`) : format, sources, procédure de mise à jour et de publication.

## 9. Tests et critères d'acceptation

**Tests unitaires (vitest, écrits avant le code)**
- Résolveur OPCO : IDCC unique, multi-IDCC même OPCO, multi-IDCC OPCO différents, fusionné, partagé, échappatoires, sans IDCC + NAF, sans rien.
- Évaluation : chaque critère (ok / ko / inconnu), bornes de tranche d'effectif, majorations, validité, statuts `a_confirmer`/`suspendu`, projets/bénéficiaires.
- Plan : empilement ordonné, plafonnement au coût, alternatives, catégories séparées, CPF en dernier, reste à charge ≥ 0.
- Moteur OPCO : règle des 50 salariés, barème dégressif, portée du plafond, dispositifs sur le reste, enveloppe plafonnée.
- Données : validation Zod de tout le catalogue embarqué, ids uniques, sources https, `derniere_verification` de moins de 12 mois à la date d'exécution des tests (garde-fou volontaire : un catalogue périmé fait échouer la CI et impose une revérification), portail pour chacune des 18 régions, pas de doublon de taille.
- Scénarios de bout en bout (profils types) :
  1. TPE d'Île-de-France (AKTO, 8 salariés), salarié CDI, formation RNCP 140 h à 4 200 €.
  2. Entreprise de 120 salariés : PDC mutualisé à 0 € + explication, autres aides affichées.
  3. Recrutement d'un demandeur d'emploi en Occitanie : POEI/AFPR, aides France Travail et Région.
  4. Apprenti de 19 ans en Hauts-de-France : aides à l'embauche, NPEC, aides apprentis.
  5. Artisan non salarié en Bretagne : FAFCEA, crédit d'impôt, CPF.

**Vérifications**
- `tsc --noEmit` (core, backend, app), tests core + backend verts, `expo export --platform android` sans erreur.
- Parcours complets testés dans le navigateur (Expo web) pour les 5 projets.
- Contrôle des liens : 100 % des sources accessibles ou explicitement signalées.

## 10. Phases de livraison

1. **Socle** : corrections du moteur (§5.6), barèmes OPCO revérifiés, table IDCC v2 + suggestions NAF, résolveur v2, étape « Entreprise ».
2. **Moteur d'aides** : types, schéma, évaluation, plan, étapes « Projet » et « Bénéficiaire », champs Formation, écran de résultats (avec un premier lot d'aides nationales vérifiées).
3. **Catalogue complet** : aides nationales, européennes, 18 régions, FAF, fiscalité ; portails régionaux ; double vérification ; tests de données.
4. **Publication** : dataset v4, pipeline réparé + contrôle des liens, app 1.3.0, documentation, brouillon de demande de licence France Compétences. **Aucun push** sans accord explicite.

## 11. Actions requises de l'utilisateur

1. Ajouter le secret GitHub `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions) et réactiver le workflow `Update OPCO dataset`.
2. Envoyer la demande de licence gratuite de réutilisation à France Compétences (`affaires-juridiques@francecompetences.fr`) — brouillon fourni.
3. Valider le push de la branche et la publication du dataset v4 (qui mettra à jour les APK déjà installés).
4. Lancer le build EAS de l'APK 1.3.0 (`npx eas-cli build -p android --profile preview`, compte Expo `magdou_t`).
