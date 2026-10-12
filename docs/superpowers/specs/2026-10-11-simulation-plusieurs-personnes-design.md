# Spécification : simuler la formation de plusieurs personnes en même temps

- **Dépôt** : `opco-mobile` (site `apps/web`, moteur `@opco/core`)
- **Cible** : le simulateur du site financementOPCO ; l'app mobile et le backend ne changent pas
- **Date** : 11/10/2026
- **Statut** : cadrage validé par l'utilisateur le 11/10/2026 (profils avec effectif, statuts mélangés, 6 profils et 99 personnes au plus, étape « Participants ») ; spécification à relire avant le plan
- **Branche** : `feature/simulation-groupe` (locale, issue de `feature/integration-wordpress` au commit `c21b924`, rien de poussé)

---

## 1. Objectif

Le simulateur chiffre aujourd'hui la formation d'une seule personne. Les clients de SFG forment souvent une équipe dans la même session : mêmes dates, même formation, des personnes qui ne se ressemblent pas toujours (des salariés, parfois le dirigeant, un salarié reconnu travailleur handicapé, un alternant). La demande de l'utilisateur : *permettre de former plusieurs personnes en même temps, éventuellement avec des profils différents*.

Réussite :

1. Avec une seule personne, le parcours, l'écran et les montants sont ceux d'aujourd'hui, au centime et au caractère près.
2. Avec un groupe, le visiteur voit le coût, le financement et le reste à charge de tout le groupe, qui finance quoi, et ce que donne chaque profil.
3. Aucun montant inventé. Les règles de calcul et leurs sources restent celles du moteur. Une règle qu'on ne sait pas étendre à un groupe reste prudente ou non chiffrée, jamais gonflée : l'incertitude ne s'additionne jamais.

## 2. Décisions arrêtées

| # | Décision | Raison |
|---|---|---|
| D1 | Un groupe est une liste de **profils**, chacun avec un nombre de personnes. Le profil principal est celui que l'étape actuelle demande déjà ; les autres s'ajoutent à la demande. | Trois salariés identiques se saisissent une fois, pas trois. |
| D2 | Une seule formation par simulation : même type, même durée, même prix par personne, mêmes dates. | « En même temps » : plusieurs formations donnent plusieurs simulations. |
| D3 | Chaque profil a son propre statut (salarié, reconversion d'un salarié, demandeur d'emploi à recruter, alternant, dirigeant). | Le cas courant est l'équipe qui forme aussi son dirigeant. |
| D4 | Limites : 6 profils et 99 personnes au total. | Borne l'écran et le calcul. |
| D5 | Le plafond annuel de l'OPCO s'applique une seule fois au total des salariés du groupe. | C'est le plafond de l'entreprise, pas celui d'une personne. |
| D6 | Le prix de la formation se saisit par personne ou pour tout le groupe, au choix, dès deux personnes. | Un devis intra donne un prix de session, un catalogue donne un prix par stagiaire. |
| D7 | L'étape « Bénéficiaire » s'appelle « Participants ». | Le mot couvre une personne comme un groupe. |
| D8 | Les frais annexes (déplacement, hébergement, repas) sont ceux d'une personne, comptés pour chaque personne du groupe. | Pas de saisie par personne ; des frais différents donnent plusieurs simulations. |
| D9 | Le solde CPF d'un profil vaut pour chaque personne de ce profil. | Si les soldes diffèrent, l'étape conseille de saisir le plus bas ou de créer un profil. |

## 3. Périmètre

**Inclus**
- Le modèle d'un groupe dans `@opco/core` (types, état initial, module `groupe.ts`).
- Le moteur de l'OPCO étendu à `n` personnes (`calculateFunding(opco, state, personnes = 1)`).
- Le calcul du groupe : un plan par profil, la fusion en un plan de groupe, la fusion des aides du catalogue.
- Le parcours : étape « Participants », prix par personne ou pour le groupe, frais, récapitulatif.
- L'écran de résultats : synthèse du groupe, tableau « Par profil », profils concernés sur chaque aide.
- Tests, `apps/web/DESIGN.md`, README et guides concernés.

**Exclu**
- Plusieurs formations dans une même simulation (D2).
- Des frais annexes différents d'une personne à l'autre (D8).
- L'application mobile, qui garde son parcours à une personne, et le backend.
- Les plafonds « par entreprise » que le texte de quelques aides mentionne (par exemple FAFCEA : 600 € par an et par entreprise sous condition) : le catalogue ne les chiffre pas aujourd'hui et cette évolution n'en ajoute aucun. Le montant d'une aide du catalogue se calcule par personne.
- Un contrôle du nombre de personnes formées contre l'effectif de l'entreprise.

## 4. Règles de calcul

Notation : `n` est le nombre de personnes qui suivent la formation. Tout montant saisi dans l'état (coût de la formation, nuit d'hôtel, repas) est celui d'**une** personne.

### 4.1 Ce qui se multiplie par le nombre de personnes

| Élément | Règle pour `n` personnes |
|---|---|
| Coût pédagogique demandé | `n` fois le coût d'une personne. |
| Coûts pédagogiques financés | `n` fois (plafond horaire, ou barème dégressif, d'une personne × durée), puis plafond annuel (4.2). |
| Prise en charge des salaires | `n` fois (taux horaire × durée) ; en mode « pourcentage des coûts pédagogiques », ce pourcentage du total financé. |
| Transport, hébergement, restauration | `n` fois le montant d'une personne ; le plafond par nuit ou par jour s'applique à chaque personne. |
| Forfait de frais annexes en % | Pourcentage du total des coûts pédagogiques financés (déjà un total). |
| Dispositifs complémentaires de l'OPCO | Pourcentage du coût et du reste à financer du groupe. Un plafond « par stagiaire » vaut `n` fois sa valeur. Les plafonds « par heure », « par jour », « par dossier », « par an » et les forfaits sans unité ne se multiplient pas (prudence). |
| Aides du catalogue | Calculées pour une personne du profil, puis multipliées par le nombre de personnes du profil. |
| Solde CPF | Celui d'une personne du profil, multiplié par le nombre de personnes du profil. |

### 4.2 Ce qui ne se multiplie pas

- **Durée, heures et jours** : ceux d'une personne. Les tranches d'un barème dégressif et les minimums ou maximums d'heures se jugent par personne.
- **Plafond annuel de l'OPCO** : le plafond restant de l'entreprise (plafond annuel moins budget déjà consommé) se compare au total du groupe, une seule fois. Portée « global » : le total financé de tous les postes est ramené au plafond, par la règle actuelle appliquée au total du groupe. Portée « pédagogie » : seul le poste pédagogique est ramené, salaires et frais annexes restent financés en plus.
- **Règle des 50 salariés**, alertes de l'OPCO, conditions, démarches, délai de validation, mode de paiement : jugés ou écrits une seule fois, pour l'entreprise.

### 4.3 Qui relève du plan de développement des compétences

Comme aujourd'hui pour une personne seule, seuls les profils salariés (former un salarié, reconversion d'un salarié) ouvrent le plan de l'OPCO (`ouvreBudgetOpco`). `nPdc` est le nombre de personnes de ces profils. Les autres profils (dirigeant, alternant, demandeur d'emploi) passent par leurs aides du catalogue.

Le moteur de l'OPCO est appelé **une seule fois**, pour `nPdc` personnes : le plafond annuel s'applique à ce total. Son résultat est ensuite réparti entre les profils salariés (4.4). Sans profil salarié, ou sans OPCO connu, il n'y a pas de calcul de l'OPCO, comme aujourd'hui.

### 4.4 Répartition entre profils

Le résultat de l'OPCO est réparti entre les profils salariés poste par poste, en centimes entiers. Chaque profil reçoit `floor(montant × effectif / nPdc)` centimes ; les centimes qui restent vont aux profils qui ont la plus grande part décimale, et à égalité au premier de la liste. Pour chaque poste, la somme des profils égale exactement le montant du groupe. Le même procédé répartit le montant estimé de chaque dispositif complémentaire. Chaque part porte `personnes` égal à l'effectif de son profil ; les totaux de chaque part sont recalculés à partir de ses lignes.

### 4.5 Plan de financement d'un profil

Le plan d'un profil est celui de `construirePlan` appliqué à un bloc de `nombre` personnes : le coût de la formation, le solde CPF et les montants des aides du catalogue sont multipliés par `nombre`, le financement de l'OPCO est sa part (4.4). L'empilement (ordre, plafond au reste à charge, solde CPF partagé, aides « au choix ») suit les règles d'aujourd'hui, appliquées aux montants du bloc. Pour un seul profil d'une seule personne, le plan est celui de `construirePlan`, sans aucune transformation.

### 4.6 Garanties vérifiées par les tests

1. `n = 1` : `calculateFunding(opco, state, 1)` égale `calculateFunding(opco, state)`, et le calcul de l'écran pour un état à une personne rend ce qu'il rendait avant.
2. `n` personnes identiques, plafond annuel non atteint : chaque montant du groupe égale `n` fois celui d'une personne, à un demi-centime par personne près (l'arrondi se fait une seule fois, sur le total du groupe).
3. Plafond annuel atteint : le total financé du groupe ne dépasse jamais le plafond restant.
4. La somme des profils égale le groupe, poste par poste.
5. Aucun texte du calcul de groupe ne contient de nombre à point une fois rendu, ni les mots « intégralement », « garanti », « assuré » ou « totalité ».

## 5. Modèle de données (`@opco/core`)

Tout changement est additif : les exports existants gardent leur nom et leur sens, l'app mobile et le backend compilent sans modification.

### 5.1 Types (`types.ts`)

```ts
export const MAX_PROFILS = 6;
export const MAX_PERSONNES = 99;

/** Ce qui décrit une personne formée : les réponses de l'étape « Participants », projet compris. */
export type ChampsProfil = Pick<
  WizardState,
  | 'projetType' | 'contractType' | 'anciennete_mois' | 'isHandicap' | 'ageBeneficiaire' | 'niveauDiplome'
  | 'typeAlternance' | 'inscritFranceTravail' | 'statutDirigeant' | 'microEntrepreneur' | 'soldeCpf'
  | 'regionBeneficiaireCode'
>;

export interface ProfilSupplementaire extends ChampsProfil {
  /** 'profil-2', 'profil-3'… : stable tant que le profil existe (clé d'affichage, lien profil / aide). */
  id: string;
  /** Nombre de personnes qui ont ce profil, de 1 à MAX_PERSONNES. */
  nombre: number;
}
```

`isReconversion` et `isSortieChomage`, que le site ne pose pas, n'entrent pas dans `ChampsProfil`. `WizardState` reçoit un bloc (après les champs du bénéficiaire, sous le commentaire `// Étape 2 bis : personnes formées`) :

```ts
/** Personnes qui ont le profil principal (les champs de l'étape 2) ; 1 par défaut. */
nombrePersonnes: number;
/** Profils supplémentaires du groupe, dans l'ordre de saisie ; vide par défaut. */
autresProfils: ProfilSupplementaire[];
/** Prix de la formation pour tout le groupe (€) ; null : `pedagogyCostTotal` est saisi par personne. */
prixDuGroupe: number | null;
```

`createInitialWizardState()` donne `nombrePersonnes: 1`, `autresProfils: []`, `prixDuGroupe: null`. L'app mobile fusionne son état stocké sur cet état initial : un état enregistré avant la modification reste valide.

`FundingResult` reçoit `personnes: number` (le nombre de personnes chiffrées, 1 par défaut) ; `LignePlan` reçoit `personnes?: number`, rempli seulement à partir de deux personnes.

**Invariants** de l'état, maintenus par le parcours (`apps/web/src/lib/groupe.ts`) et vérifiés par test :

- `nombrePersonnes ≥ 1`, chaque `nombre ≥ 1`, total ≤ 99, `autresProfils.length ≤ 5` ;
- `prixDuGroupe` non nul implique au moins 2 personnes, `pedagogyCostTotal = prixDuGroupe / personnes` (non arrondi) et `pedagogyCostPerHour = pedagogyCostTotal / durationHours` (nul sans durée) ;
- `pedagogyCostTotal` reste, pour le moteur, le coût d'**une** personne : le moteur ne lit ni `prixDuGroupe`, ni `nombrePersonnes`, ni `autresProfils`.

### 5.2 Moteur de l'OPCO (`calculator.ts`)

`calculateFunding(opco, state, personnes = 1)`. Le paramètre est ramené à un entier d'au moins 1. Les règles du 4.1 et du 4.2 s'y appliquent, lignes et totaux compris ; `FundingResult.personnes` le rappelle. Les textes :

- pour `personnes = 1`, chaque texte reste identique, caractère pour caractère ;
- au-delà, la ligne de détail d'un calcul par personne est suivie d'une ligne « Pour 4 personnes : 1 050 € × 4 = 4 200 € », les notes de poste et les avertissements chiffrés donnent le montant du groupe et disent pour combien de personnes il vaut. Les montants s'écrivent comme dans les textes actuels du moteur (nombre à point, espace insécable avant l'unité) ; l'écran les réécrit par `texteMoteur`.

`evaluateDispositifs` reçoit le nombre de personnes : seul un plafond d'unité `par_stagiaire` est multiplié (4.1).

### 5.3 Module `groupe.ts` (nouveau, fonctions pures, exporté par `index.ts`)

```ts
export const ID_PROFIL_PRINCIPAL = 'principal';

export interface ProfilDuGroupe {
  id: string;                // ID_PROFIL_PRINCIPAL, puis l'id du profil supplémentaire
  nombre: number;
  champs: ChampsProfil;
  principal: boolean;
}

export function champsDuProfilPrincipal(state: WizardState): ChampsProfil;
export function profilsDuGroupe(state: WizardState): ProfilDuGroupe[];   // principal d'abord, effectifs ramenés à un entier de 1 à 99 ; un projet non choisi compte pour « former un salarié », comme aujourd'hui
export function nombreDePersonnes(state: WizardState): number;
export function etatDuProfil(state: WizardState, profil: ProfilDuGroupe): WizardState; // l'état d'UNE personne de ce profil

export function repartirFinancement(r: FundingResult, effectifs: readonly number[]): FundingResult[];   // 4.4
export function construirePlanDuBloc(
  opco: FundingResult | null, aides: readonly AideEvaluee[], profil: ProfilAides, nombre: number,
): PlanFinancement;                                                       // 4.5
export function fusionnerPlans(
  plans: readonly PlanFinancement[], aides: readonly Pick<AideEvaluee, 'id' | 'ordreEmpilement'>[],
): PlanFinancement;                                                       // 6.1
export function fusionnerAides(
  blocs: readonly { profil: ProfilDuGroupe; aides: readonly AideEvaluee[] }[],
): AideEvaluee[];                                                         // 6.2

export interface ConcerneParAide { profilId: string; nombre: number; statut: StatutEligibilite; montantEstime: number | null }
// aides/types.ts : `AideEvaluee` reçoit le champ facultatif `profils?: ConcerneParAide[]`, renseigné seulement pour un groupe de plusieurs profils.
```

`evaluer.ts` exporte son comparateur de tri (`trierAidesEvaluees`) pour que la liste fusionnée soit triée comme une liste évaluée, sans copie de la règle.

## 6. Fusion des résultats des profils

### 6.1 Plans (`fusionnerPlans`)

Un seul plan : rendu tel quel. Plusieurs plans :

- `coutFormation`, `totalFinance` et `resteACharge` sont les sommes des plans, calculées en centimes entiers ; `coutFormation − resteACharge = totalFinance` reste vrai.
- `financements` : les lignes de même `id` s'additionnent (montant, `personnes`) ; la fiabilité est la plus faible (`depends_on_branche`, puis `estimated`, puis `exact`) ; le nom et le financeur sont ceux de la première occurrence. Les lignes sont triées par ordre d'empilement, puis par montant décroissant : l'ordre d'une aide du catalogue est son `ordreEmpilement`, celui de la ligne `opco-pdc` est 10 et celui d'un dispositif de l'OPCO (`opco-<id>`) 12, comme dans `construirePlan`.
- `aidesEmployeur`, `remunerations`, `avantagesFiscauxSociaux` : même fusion par `id`, même tri que dans `construirePlan` (ordre d'arrivée).
- `options` : fusion par `id` ; le montant est la somme des montants connus (nul si aucun profil n'en a), la raison est celle de la première occurrence.
- `nonChiffrees`, `servicesGratuits` : réunion sans doublon, par `id`, puis retrait de toute aide qui a une ligne dans le plan fusionné : une ligne chiffrée (`financements`, `aidesEmployeur`, `remunerations`, `avantagesFiscauxSociaux`) ou une option, même au montant selon dossier. Une aide chiffrée pour un profil et sans montant pour un autre (solde CPF connu pour l'un, inconnu pour l'autre) n'est donc listée qu'une fois, par sa ligne (« pour 2 personnes ») ; sa carte du catalogue (6.2) dit « jusqu'à … par personne ».

### 6.2 Aides du catalogue (`fusionnerAides`)

Un seul profil : la liste est rendue telle quelle, sans champ `profils`. Plusieurs profils : une entrée par aide, avec :

- le **statut** le meilleur (éligible, puis à vérifier, puis non éligible) ;
- `horsPerimetre` vrai seulement si l'aide est hors périmètre pour tous les profils ;
- `raisons` : vides si l'aide est éligible pour un profil au moins ; sinon la réunion sans doublon des raisons des profils qui portent le statut retenu, sauf, pour une aide non éligible, celles des profils pour lesquels elle est hors périmètre (« Ne concerne pas ce type de projet » n'apprend rien sur les autres profils, et l'écran ne liste jamais une aide hors périmètre pour tous) ;
- `montantEstime` : le plus grand montant **par personne** parmi les profils éligibles ou à vérifier (« jusqu'à »), nul si aucun n'est chiffré ; `libelleMontant` et `urlDemarche` sont ceux de ce profil (à montant égal, celui du meilleur statut, puis le premier de la liste). Une aide non éligible pour tous les profils garde le montant de sa meilleure vue, comme pour une personne seule : le moteur chiffre aussi les aides non éligibles, la liste fusionnée les trie par ce montant et l'écran ne l'affiche jamais ;
- `profils` : un élément par profil éligible ou à vérifier, avec son effectif, son statut et son montant par personne.

La liste fusionnée est triée comme `evaluerAides` (statut, montant décroissant, nom, identifiant).

## 7. Parcours du site

### 7.1 Les six étapes

| Étape | Une personne | Plusieurs personnes |
|---|---|---|
| 1. Projet | Inchangée : le projet est celui du profil principal. | Idem. |
| 2. Entreprise | Inchangée. | L'OPCO est requis dès qu'un profil n'est pas un dirigeant ; le budget déjà consommé s'affiche et se garde tant qu'un profil au moins relève d'un projet salarié (`opcoRequis` et `ouvreBudgetOpco` regardent tous les profils). |
| 3. **Participants** (ex-« Bénéficiaire ») | Les questions actuelles du statut, plus un compteur « Nombre de personnes » (1) et le bouton « Ajouter un profil différent ». | Une carte par profil (statut, compteur, questions, retrait) et le total « 4 personnes · 2 profils ». |
| 4. Formation | Inchangée. | Bascule « Prix saisi : par personne / pour le groupe » ; le libellé du coût la suit ; une ligne dit le prix de l'autre mode. |
| 5. Frais | Inchangée. | Aide sous le titre : montants d'une personne, comptés pour chacune. |
| 6. Récapitulatif | Inchangé (section « Participants » au lieu de « Bénéficiaire »). | Une sous-section par profil ; le prix est écrit par personne et pour le groupe. |

### 7.2 Étape Participants

- **Compteur** (`CompteurPersonnes`) : champ numérique entier de 1 à ce que laisse le total de 99, avec deux boutons « Retirer une personne » et « Ajouter une personne » (cibles de 44 px) ; la valeur est annoncée. Une saisie hors bornes est ramenée à la borne.
- **Carte de profil** (`CarteProfil`) : titre « Profil 1 » pour le profil principal, « Profil 2 » et suivants pour les autres (`h3`), étiquette du statut, compteur, résumé en puces (contrat, âge, diplôme, RQTH, solde CPF) et « Modifier » ; le profil en cours d'édition est déplié, les autres repliés sur leur résumé. Les profils supplémentaires ont « Retirer ce profil ». Le profil principal ne se retire pas.
- **Formulaire d'un profil** (`FormulaireProfil`) : les questions de `StepSituation` d'aujourd'hui, factorisées pour servir au profil principal et aux profils supplémentaires. Un profil supplémentaire commence par le choix de son statut (les cinq projets, en boutons de choix compacts) ; les réponses d'un statut quitté reviennent à vide (`champsDepuisProjet`, extrait de `etatDepuisProjet`, qui garde son comportement).
- **Ajout** : « Ajouter un profil différent » crée un profil de 1 personne, de même statut que le profil principal, sans autre réponse ; il s'affiche déplié, les autres profils se replient sur leur résumé, et le focus va à son titre. Le bouton reste actif jusqu'à 6 profils ou 99 personnes ; au-delà il porte `aria-disabled` et une phrase dit la limite.
- **Solde CPF** : quand un profil compte plusieurs personnes, l'aide du champ dit « Même solde retenu pour chaque personne de ce profil : prenez le plus bas, ou créez un profil par solde. »
- **Annonces** : une zone `aria-live="polite"` dit « Profil 2 ajouté. 4 personnes au total. » ou « Profil 2 retiré. 3 personnes au total. » ; au retrait, le focus passe au titre du profil précédent.
- **« Je ne sais pas »** : chaque profil garde ses propres réponses (`reponsesInconnues` par profil).
- **Champs obligatoires** (`champsManquants`) : chaque profil doit répondre aux questions obligatoires de son statut, comme aujourd'hui. Avec plusieurs profils, chaque manque nomme son profil : « le type de contrat (profil 2) ». Avec un seul profil, les textes d'aujourd'hui.

### 7.3 Étape Formation

À partir de deux personnes, un `ChoiceGroup` « Le prix saisi est » propose « Par personne » (par défaut) et « Pour le groupe ». Le champ « Coût total HT » devient « Coût total HT par personne (€) » ou « Coût total HT pour le groupe (€) », et une aide donne l'autre valeur (« Soit 933,33 € par personne » ; « Soit 5 600 € pour les 6 personnes »). Changer de mode garde le coût réel : le nombre affiché est converti, pas ressaisi. Le coût horaire calculé, le plafond indicatif et l'avertissement de dépassement sont ceux d'**une** personne et le disent (« par personne et par heure »).

`prixDuGroupe` est renseigné dès qu'un prix est saisi pour le groupe ; l'état garde alors `pedagogyCostTotal` égal au prix du groupe divisé par le nombre de personnes, y compris quand ce nombre change plus tard (invariants du 5.1). Une bascule sur « Pour le groupe » sans prix saisi n'écrit rien dans l'état.

### 7.4 Cohérence de l'état (`apps/web/src/lib/groupe.ts`, fonctions pures)

- `normaliserGroupe(etat)` : ramène les effectifs dans les bornes, retire les profils au-delà de 5, réduit le dernier profil si le total dépasse 99, remet `prixDuGroupe` à vide sous 2 personnes, recalcule `pedagogyCostTotal` et `pedagogyCostPerHour` quand `prixDuGroupe` est renseigné, vide `budgetDejaConsomme` quand plus aucun profil ne relève d'un projet salarié (7.1). Idempotente.
- `ajouterProfil`, `retirerProfil`, `majProfil`, `definirNombre` (l'identifiant `principal` désigne le profil principal) : chacune rend un état normalisé.
- `useWizard` applique `normaliserGroupe` après chaque mise à jour et expose ces actions ; « Nouvelle simulation » remet tout à l'état initial.
- L'audit « aucun champ invisible ne pèse sur le résultat » de `tests/parcours.test.ts` couvre les nouveaux champs : `prixDuGroupe` ne survit pas à un groupe réduit à une personne, les réponses d'un profil retiré disparaissent avec lui.

## 8. Écran de résultats

Les composants existants restent ceux de l'écran ; le calcul de l'écran (`calculer`, `lib/resultats.ts`) rend en plus `groupe` : le nombre de personnes, `nPdc` et, pour chaque profil, son profil évalué, ses aides, sa part de l'OPCO et son plan. Pour un état à une personne, tous les autres champs (`funding`, `profil`, `aidesEvaluees`, `plan`) sont ceux d'aujourd'hui.

- **Étiquettes de la situation** : une étiquette « 4 personnes · 2 profils » (« 4 personnes » avec un seul profil) suit la durée ; absente pour une personne.
- **Bandeau de synthèse** : les trois chiffres sont ceux du groupe. Sous « Coût de la formation », « 4 × 2 800 € » ; sous « Reste à charge », « 1 706 € par personne en moyenne » (reste divisé par le nombre de personnes, au centime). Les états `cout_inconnu`, `aucun_financement_chiffre` et `plan_chiffre` suivent les règles actuelles, jugées sur le plan du groupe.
- **Note sur l'OPCO** : chaque note qui s'applique s'affiche une fois. « Aucun OPCO renseigné » dès qu'un profil salarié est sans OPCO ; la note sur le dirigeant quand le groupe en compte un, dite pour « le dirigeant du groupe » ; le dirigeant assimilé salarié garde son cas.
- **Cartes du plan** : mêmes cartes, mêmes règles. Quand le groupe compte plusieurs personnes, chaque ligne dit pour combien de personnes elle vaut, sous le nom du financeur (« pour 3 personnes »). La carte des options, dont les lignes n'ont pas cette mention, dit que ses montants valent pour les personnes du groupe qu'elles concernent.
- **Par profil** (nouvelle section, `h2` « Détail par profil », seulement avec plusieurs profils) : un tableau Profil / Personnes / Coût / Financé / Reste, une ligne par profil puis une ligne « Total » ; les chiffres sont ceux du plan de chaque profil, jamais recalculés. Le tableau suit la règle du bandeau, jamais « 0 € » pour une valeur inconnue ou non chiffrée : l'état du plan du groupe décide des colonnes (coût inconnu : pas de tableau ; aucun financement chiffré : seulement Profil, Personnes et Coût ; plan chiffré : les cinq colonnes), et dans l'état « plan chiffré » une ligne dont le propre plan n'est pas chiffré écrit « Non chiffré » à la place de « Financé » et « Reste à charge » ; la ligne « Total » reste celle du plan du groupe, égale au bandeau. Sous 640 px, chaque profil devient un bloc empilé. Le libellé d'un profil décrit la personne (« Salarié en CDI, 35 ans », « Dirigeant artisan, 52 ans, RQTH »). Le tableau s'imprime en entier et aucune ligne ne se coupe entre deux pages.
- **Aides et financements identifiés** : la liste fusionnée (6.2). Une carte dont les profils concernés ne sont pas tous ceux du groupe porte un bloc « Concerne » (« Profil 1, 3 personnes : éligible · Profil 3, 1 personne : à vérifier »). Avec plusieurs personnes, le montant est « jusqu'à … par personne ».
- **Détail de l'estimation OPCO** : le calcul de `nPdc` personnes, avec la mention « Calcul pour les 3 salariés du groupe » dans le chapeau quand des profils non salariés existent ; le chapeau, donc la mention, n'existe qu'avec le tableau des postes (jamais quand le plan est fermé : aucun calcul n'a lieu). Sa carte de total dit « pour 3 personnes ».
- **Fonds épuisés, relais du plan conventionnel, plan fermé aux 50 salariés et plus** : jugés une fois, pour l'entreprise ; leurs encadrés sont ceux d'aujourd'hui.
- **Encadrés du bandeau** (`encadreSansFinancement`, `encadrePlanFerme`) : reçoivent le plan et les aides fusionnés ; la propriété « chaque phrase écrite est confrontée aux aides et aux cartes affichées » est étendue aux états de groupe.

## 9. Rédaction et charte

Les textes nouveaux suivent la charte SFG : ton direct de collègue expert, aucun tiret cadratin, aucun émoji, Montserrat et Inter seulement, espaces insécables avant « : ; ? ! » et entre un nombre et son unité, aucune promesse (« entièrement », « garanti »). Les boutons disent un verbe (« Ajouter un profil différent », « Retirer ce profil »). `npm run check:charte` et `npm run check:tirets` restent verts.

## 10. Tests et vérifications

Les tests s'écrivent avant le code (échec constaté, puis réussite). Les suites actuelles restent inchangées et vertes, sauf les trois mises à jour listées au 10.3.

### 10.1 Cœur (`packages/core/tests`, Vitest)

- `calculator-groupe.test.ts` (nouveau) :
  - `personnes = 1` égale l'appel sans paramètre, pour les onze OPCO, leurs branches, toutes les tailles, les types de formation et les besoins de frais (comparaison profonde du résultat entier) ;
  - `n` personnes identiques, plafond annuel non atteint : chaque ligne et chaque total égalent `n` fois ceux d'une personne, à un demi-centime par personne près (exactement pour des coûts ronds) ; le détail contient la ligne « Pour n personnes » ;
  - plafond annuel de portée « global » puis « pédagogie » : le total du groupe ne dépasse jamais le plafond restant, le budget déjà consommé est déduit une fois ;
  - 50 salariés et plus sans enveloppe : les lignes à 0 € demandent `n` fois le coût ;
  - dispositif en `par_stagiaire` multiplié, dispositif en `par_dossier`, `par_an`, `par_heure` ou sans unité non multiplié ;
  - propriétés sur états tirés (graine fixe) : aucun nombre à point une fois rendu par `texteMoteur`, aucun mot de promesse.
- Les tests de `groupe.ts` (nouveaux) sont répartis par thème, avec des aides communes dans `fixtures-groupe.ts` : `groupe.test.ts` (`profilsDuGroupe`, `nombreDePersonnes`, `etatDuProfil`) ; `groupe-repartition.test.ts` (`repartirFinancement` : somme exacte au centime pour des effectifs et des montants tirés, ordre des centimes, effectif unique) ; `groupe-plan.test.ts` (`construirePlanDuBloc` : `nombre = 1` égal à `construirePlan`, `nombre = n` cohérent avec l'empilement, solde CPF multiplié, jamais plus que le coût du bloc ; `fusionnerPlans` : sommes en centimes, tri, fiabilité la plus faible, options, aucune aide à la fois chiffrée et sans montant, un seul plan rendu tel quel) ; `groupe-aides.test.ts` (`fusionnerAides` : statut, `horsPerimetre`, montant par personne, `profils`, tri, un seul profil rendu tel quel).
- `empreinte-une-personne.test.ts` (nouveau) : 3 072 calculs d'une personne seule dont l'empreinte reste celle d'avant (la garde de l'identité, section 4.6).
- Garde du schéma de l'état : `createInitialWizardState` porte les trois champs ; l'état stocké d'avant la modification reste valide.

### 10.2 Site (`apps/web/tests`, `node:test`)

- `groupe.test.ts` (nouveau) : `normaliserGroupe` (bornes, profils en trop, total de 99, prix du groupe sous 2 personnes, recalcul du coût, idempotence), `ajouterProfil`, `retirerProfil`, `majProfil`, `definirNombre`, bascule du mode de prix qui garde le coût réel, `coutDuGroupe`, `aideDuPrix`, `auCentime`, suites d'opérations tirées au hasard ; `parcours-groupe.test.ts` : `champsDepuisProjet` et `etatDepuisProjet` avec un groupe.
- `resultats-groupe.test.ts` (nouveau ; `resultats.test.ts` garde les tests d'une personne) : `calculer` d'un état à une personne égal à l'ancien résultat ; groupe de profils identiques ; groupe mixte salariés et dirigeant (OPCO calculé pour les seuls salariés, FAF du dirigeant dans le plan) ; groupe sans OPCO ; plafond annuel atteint ; propriété sur 1 000 états de groupe tirés : la somme des profils égale le groupe, aucun plan ne dépasse son coût, chaque phrase de `encadreSansFinancement` est confrontée aux aides et aux cartes affichées. `par-profil.test.ts` : rendu du détail par profil (`renderToStaticMarkup`, sans nouvelle dépendance) dans les trois états du plan, jamais « 0 € » pour une valeur inconnue ou non chiffrée.
- `etapes-groupe.test.ts` : `champsManquants` avec plusieurs profils (message nommant le profil) ; `parcours.test.ts` : l'audit « aucun champ invisible ne pèse sur le résultat » étendu aux nouveaux champs.
- Étiquettes de situation (`situation.test.ts`), libellés et puces d'un profil (`profils.test.ts`), réponses « Je ne sais pas » par profil (`inconnues-profils.test.ts`), `modules.test.ts` (le lot initial du simulateur n'importe pas le catalogue d'aides), tests de typographie et de charte.

### 10.3 Mises à jour de suites existantes

1. `tests/parcours.test.ts` : le libellé de l'étape 3 devient « Participants », et les gardes qui lisent `types.ts` par blocs de commentaires prennent en compte le bloc `// Étape 2 bis : personnes formées`.
2. `packages/core/tests/aides-plan.test.ts` : l'assistant qui fabrique un `FundingResult` renseigne `personnes`.
3. Les tests qui citent « Bénéficiaire » comme libellé d'étape.

### 10.4 Vérification dans le navigateur

Après construction et service de l'export statique : parcours à une personne identique à l'ancien (captures avant et après) ; groupe de trois salariés puis ajout d'un dirigeant ; clavier seul (ajout, retrait, compteur, bascule du prix) ; 320, 375, 768 et 1 280 px de large sans défilement horizontal ; aperçu d'impression ; lecteur d'écran simulé par l'arbre d'accessibilité (noms, états, annonces). Les commandes de vérification sont celles du tableau « Vérifications » du README : suites du cœur, du backend et du site, typage de chaque espace, lint, garde de charte, build de production.

## 11. Documentation à mettre à jour

- `apps/web/DESIGN.md` : section 14 (étape Participants, prix, cohérence de l'état) et section 15 (synthèse du groupe, détail par profil, aides fusionnées).
- `README.md` : tableau « Vérifications » (nombres de tests, de fichiers, de pages, tailles, mesurés à nouveau) et une phrase sur la simulation d'un groupe.
- `apps/web/README.md`, `docs/donnees-aides.md`, `docs/integration-wordpress.md` : vérification qu'aucun passage ne décrit « un seul bénéficiaire » ; corrections s'il y en a.
- Les six documents de `docs/specifications/` et leurs PDF, **non suivis par git**, décrivent le commit `c21b924` : ils seront à corriger puis à régénérer après cette évolution, avec l'accord de l'utilisateur (lot WP-B5).

## 12. Risques et limites

| # | Risque ou limite | Parade |
|---|---|---|
| R1 | Sous-estimation possible des dispositifs de l'OPCO dont l'unité n'est pas « par stagiaire » (ils ne sont pas multipliés). | Choix prudent assumé (4.1) ; le détail de l'OPCO le dit. |
| R2 | Un solde CPF identique pour toutes les personnes d'un profil. | Aide du champ ; un profil par solde si besoin. |
| R3 | Les plafonds « par entreprise » du texte de quelques aides ne sont pas modélisés (hors périmètre). | Ligne de la section 3 ; le montant d'une aide est par personne. |
| R4 | Un état de groupe incohérent (prix du groupe sans durée, profil sans statut). | `normaliserGroupe`, tests de propriété. |
| R5 | Poids du lot initial du simulateur et du lot de l'écran de résultats. | Mesure avant et après, selon la méthode du tableau « Vérifications » du README (JavaScript chargé d'emblée par `/simulateur/`, gzip niveau 9 ; lot du catalogue) ; le catalogue d'aides ne rejoint pas le lot initial. |
| R6 | Écran de résultats plus long pour un groupe de plusieurs profils. | Cartes repliables déjà en place pour les aides ; tableau « Par profil » compact ; vérification à 320 px. |
| R7 | La formation n'est pas la même pour tous les participants. | Hors périmètre (D2) : une simulation par formation. |

Aucune décision de conception ne reste ouverte. Seule la régénération des documents de `docs/specifications/` attend l'accord de l'utilisateur (section 11). L'ordre des travaux est celui du plan qui suit cette spécification.

