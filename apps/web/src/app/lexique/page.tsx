import type { Metadata } from 'next';
import Link from 'next/link';
import { GuideHero, Source } from '@/components/site/Guide';
import { DonneesStructurees } from '@/components/site/DonneesStructurees';
import { adresseAbsolue, grapheDePage } from '@/lib/donnees-structurees';
import { typo } from '@/lib/format';
import { PAGES, REVUE_DES_GUIDES, metadonnees } from '@/lib/metadonnees';

/* Lexique de la formation professionnelle : un terme par entrée, défini en une ou deux phrases à partir des dossiers
   vérifiés du 27/11/2026 et des guides du site. Chaque entrée porte une ancre (son `id`) et, quand une page du site
   traite le sujet, un lien vers elle. Les mêmes définitions alimentent le nœud DefinedTermSet des données structurées.
   Index de lettres : liste qui passe à la ligne sous 1 024 px, colonne collante à partir de 1 024 px. */

export const metadata: Metadata = metadonnees(PAGES.lexique);

interface Terme {
  /** Ancre de l'entrée (#opco). */
  id: string;
  /** Terme ou sigle tel qu'on le cherche. */
  nom: string;
  /** Forme développée d'un sigle, ou sigle d'un terme. */
  developpe?: string;
  /** Définition en texte simple (une ou deux phrases). */
  definition: string;
  /** Page du site qui traite le sujet. */
  lien?: { href: string; libelle: string };
}

const TERMES_SAISIS: Terme[] = [
  {
    id: 'abondement-correctif',
    nom: 'Abondement correctif',
    definition:
      "Dans une entreprise d'au moins 50 salariés, somme de 3 000 € que l'employeur doit verser sur le CPF d'un salarié qui n'a eu, sur les 8 dernières années, ni ses entretiens obligatoires ni aucune formation non obligatoire. Le versement intervient au plus tard le dernier jour du trimestre civil qui suit l'entretien d'état des lieux.",
    lien: { href: '/obligations/#sanctions', libelle: 'Obligations des entreprises : la sanction de 3 000 €' },
  },
  {
    id: 'actions-collectives',
    nom: 'Actions collectives',
    definition:
      "Formations que l'OPCO achète lui-même auprès d'organismes certifiés Qualiopi et propose à ses adhérents, souvent prises en charge à 100 %. Selon l'OPCO et la branche, elles ne consomment pas l'enveloppe annuelle de l'entreprise, dans la limite des places et des fonds disponibles.",
    lien: { href: '/former-sans-budget/#actions-collectives', libelle: 'Se former sans budget : les actions collectives par OPCO' },
  },
  {
    id: 'afest',
    nom: 'AFEST',
    developpe: 'action de formation en situation de travail',
    definition:
      "Formation organisée sur le poste de travail, dans l'entreprise. Les OPCO qui la financent appliquent leurs propres forfaits, détaillés dans leurs fiches.",
    lien: { href: '/opco/', libelle: 'Les fiches des 11 OPCO' },
  },
  {
    id: 'afpr',
    nom: 'AFPR',
    developpe: 'action de formation préalable au recrutement',
    definition:
      "Aide de France Travail à la formation avant l'embauche, supprimée en 2024. Elle a été fondue dans la POEI, élargie aux CDD d'au moins 6 mois.",
    lien: { href: '/employeurs/#disparus', libelle: "Employeurs : ce qui n'existe plus" },
  },
  {
    id: 'agefice',
    nom: 'AGEFICE',
    definition:
      "Fonds d'assurance formation des dirigeants non salariés du commerce, de l'industrie et des services, et de leurs conjoints collaborateurs ou associés. En 2026, il finance jusqu'à 3 000 € par an si la CFP atteint au moins 7 €, 600 € en dessous.",
    lien: { href: '/quel-est-mon-opco/#cas', libelle: 'Quel est mon OPCO : cas particuliers, dont les indépendants' },
  },
  {
    id: 'agefiph',
    nom: 'Agefiph',
    definition:
      "Organisme qui soutient l'emploi des personnes handicapées : il verse jusqu'à 3 000 € à l'employeur pour une embauche en apprentissage ou en contrat de professionnalisation d'au moins 6 mois. Il peut aussi financer les aménagements de formation liés au handicap.",
    lien: { href: '/employeurs/#recruter', libelle: "Employeurs : recruter un demandeur d'emploi" },
  },
  {
    id: 'aif',
    nom: 'AIF',
    developpe: 'aide individuelle à la formation',
    definition:
      "Aide de France Travail qui paie les frais pédagogiques d'un demandeur d'emploi quand son CPF ne suffit pas ou qu'il n'a pas de droits. Le projet doit être validé par son conseiller.",
    lien: { href: '/demandeurs-emploi/#aif', libelle: "Demandeur d'emploi : l'aide individuelle à la formation" },
  },
  {
    id: 'are-formation',
    nom: 'ARE formation',
    developpe: 'AREF',
    definition:
      "Forme que prend l'allocation d'aide au retour à l'emploi (ARE) pendant une formation de plus de 40 heures, dans la limite des droits du demandeur d'emploi.",
    lien: { href: '/demandeurs-emploi/#remuneration', libelle: "Demandeur d'emploi : être rémunéré pendant la formation" },
  },
  {
    id: 'bilan-de-competences',
    nom: 'Bilan de compétences',
    definition:
      "Prestation de 24 heures au plus, réalisée par un prestataire que le salarié choisit ; ses résultats lui appartiennent. Depuis le 26 février 2026, le CPF le finance dans la limite de 1 600 €, à condition de ne pas avoir eu de bilan financé dans les cinq années précédentes.",
    lien: { href: '/salaries/#vae-bilan', libelle: 'Salarié : VAE et bilan de compétences' },
  },
  {
    id: 'cfp',
    nom: 'CFP',
    developpe: 'contribution à la formation professionnelle',
    definition:
      "Contribution que les travailleurs indépendants versent en une fois, en novembre : en 2026, 0,25 % du plafond annuel de la sécurité sociale pour les commerçants et les professions libérales, 0,29 % pour les artisans. Chez les employeurs, la contribution formation fait partie de la CUFPA.",
    lien: { href: '/obligations/#contributions', libelle: 'Obligations des entreprises : ce que votre entreprise verse' },
  },
  {
    id: 'clea',
    nom: 'CléA',
    definition:
      "Certification du socle de connaissances et de compétences professionnelles. Exception au plafond du Répertoire spécifique, elle reste finançable par le CPF sans plafond, et une période de reconversion peut la viser.",
    lien: { href: '/cpf/#formations', libelle: 'CPF : ce que votre CPF peut financer' },
  },
  {
    id: 'contributions-conventionnelles',
    nom: 'Contributions conventionnelles',
    definition:
      "Cotisations supplémentaires fixées par un accord de branche et gérées par l'OPCO selon les règles de la branche. Elles peuvent ouvrir des droits à toutes les tailles d'entreprise, y compris à partir de 50 salariés.",
    lien: { href: '/obligations/#budget', libelle: 'Obligations des entreprises : légal, volontaire, conventionnel' },
  },
  {
    id: 'cpf',
    nom: 'CPF',
    developpe: 'compte personnel de formation',
    definition:
      "Compte en euros crédité de 500 € par année de travail pour un salarié au moins à mi-temps, dans la limite de 5 000 €, ou de 800 € par an jusqu'à 8 000 € pour certains publics. Les droits appartiennent au salarié, qui les mobilise sur Mon Compte Formation.",
    lien: { href: '/cpf/', libelle: 'CPF 2026 : droits, reste à charge et démarches' },
  },
  {
    id: 'csp',
    nom: 'CSP',
    developpe: 'contrat de sécurisation professionnelle',
    definition:
      "Accompagnement de 12 mois au plus par France Travail vers un reclassement rapide, qui peut passer par une formation financée notamment par l'AIF.",
    lien: { href: '/demandeurs-emploi/#cas-particuliers', libelle: "Demandeur d'emploi : handicap, CSP, permis" },
  },
  {
    id: 'cufpa',
    nom: 'CUFPA',
    developpe: "contribution unique à la formation professionnelle et à l'alternance",
    definition:
      "Versement de l'employeur collecté chaque mois par l'Urssaf (ou la MSA) via la DSN, puis reversé à France compétences, qui le répartit entre OPCO, Caisse des dépôts, Transitions Pro, État et Régions. Part formation en 2026 : 0,55 % sous 11 salariés, 1 % à partir de 11.",
    lien: { href: '/obligations/#contributions', libelle: 'Obligations des entreprises : ce que votre entreprise verse' },
  },
  {
    id: 'dsn',
    nom: 'DSN',
    developpe: 'déclaration sociale nominative',
    definition:
      "Déclaration de l'employeur par laquelle l'Urssaf (ou la MSA) collecte, depuis le 1er janvier 2022, les contributions formation et apprentissage ; l'entreprise doit y indiquer le bon OPCO. L'embauche d'un apprenti s'y déclare aussi.",
    lien: { href: '/quel-est-mon-opco/#regle', libelle: 'Quel est mon OPCO : la convention collective décide' },
  },
  {
    id: 'edef',
    nom: 'EDEF',
    developpe: 'espace des employeurs et des financeurs',
    definition:
      "Espace de Mon Compte Formation où l'employeur verse une dotation sur le CPF d'un salarié. Lors de l'achat de la formation, cette dotation est déduite en priorité, les droits du salarié complètent.",
    lien: { href: '/cpf/#abondements', libelle: 'CPF : les abondements' },
  },
  {
    id: 'entretien-de-parcours-professionnel',
    nom: 'Entretien de parcours professionnel',
    developpe: 'EPP',
    definition:
      "Rendez-vous obligatoire entre le salarié et l'employeur, qui remplace l'entretien professionnel depuis la loi du 24 octobre 2025 : un premier au cours de la première année, puis tous les 4 ans, avec un état des lieux récapitulatif tous les 8 ans.",
    lien: { href: '/obligations/#entretiens', libelle: "Obligations des entreprises : l'entretien de parcours professionnel" },
  },
  {
    id: 'faf',
    nom: 'FAF',
    developpe: "fonds d'assurance formation",
    definition:
      "Sans salarié, un travailleur indépendant relève d'un fonds d'assurance formation, pas d'un OPCO : AGEFICE, FAFCEA, FIF PL, FAF PM pour les médecins libéraux ou VIVÉA, selon son secteur. Il y accède grâce à sa CFP.",
    lien: { href: '/quel-est-mon-opco/#cas', libelle: 'Quel est mon OPCO : cas particuliers, dont les indépendants' },
  },
  {
    id: 'fafcea',
    nom: 'FAFCEA',
    definition:
      "Fonds d'assurance formation des chefs d'entreprise artisanale, de leurs conjoints collaborateurs ou associés et des auxiliaires familiaux. Pour les formations débutant depuis le 1er septembre 2026, il plafonne sa prise en charge à 600 € par an et par entreprise quand la CFP est inférieure ou égale à 85 €.",
    lien: { href: '/quel-est-mon-opco/#cas', libelle: 'Quel est mon OPCO : cas particuliers, dont les indépendants' },
  },
  {
    id: 'fif-pl',
    nom: 'FIF PL',
    definition:
      "Fonds d'assurance formation des professionnels libéraux et des micro-entrepreneurs libéraux à jour de leur CFP. Ses critères de prise en charge varient selon la profession, repérée par le code NAF.",
    lien: { href: '/quel-est-mon-opco/#cas', libelle: 'Quel est mon OPCO : cas particuliers, dont les indépendants' },
  },
  {
    id: 'fne-formation',
    nom: 'FNE-Formation',
    definition:
      "Dispositif de l'État qui finançait des formations par convention. Depuis 2025, il ne fait plus l'objet de conventions : les crédits prévus pour 2027 servent seulement à payer les conventions passées.",
    lien: { href: '/employeurs/#disparus', libelle: "Employeurs : ce qui n'existe plus" },
  },
  {
    id: 'france-competences',
    nom: 'France compétences',
    definition:
      "Organisme national qui reçoit les contributions formation collectées par l'Urssaf et les répartit entre OPCO, Caisse des dépôts, Transitions Pro, État et Régions. Il publie aussi l'outil officiel qui retrouve l'OPCO d'une entreprise à partir de son SIRET ou de son IDCC.",
    lien: { href: '/comprendre-les-opco/#role', libelle: 'Comprendre les OPCO : leur rôle' },
  },
  {
    id: 'fse-plus',
    nom: 'FSE+',
    developpe: 'Fonds social européen plus',
    definition:
      "Fonds européen (programmation 2021-2027) qui peut cofinancer, par l'intermédiaire des OPCO, des formations de salariés sur des thèmes ciblés, jusqu'à 50 % du coût éligible. Il faut que l'OPCO ait une opération ouverte aux demandes.",
    lien: { href: '/former-sans-budget/#fse', libelle: 'Se former sans budget : le cofinancement FSE+' },
  },
  {
    id: 'idcc',
    nom: 'IDCC',
    developpe: 'identifiant de la convention collective',
    definition:
      "Code de la convention collective appliquée par l'entreprise : c'est lui qui détermine son OPCO, à défaut l'activité principale. Le bulletin de paie doit indiquer la convention collective, mais le code IDCC ne figure pas parmi ses mentions obligatoires.",
    lien: { href: '/quel-est-mon-opco/#idcc', libelle: "Quel est mon OPCO : où trouver l'IDCC" },
  },
  {
    id: 'npec',
    nom: 'NPEC',
    developpe: 'niveau de prise en charge',
    definition:
      "Montant que l'OPCO verse au CFA pour chaque diplôme préparé en apprentissage, fixé par la branche. Pour les contrats conclus depuis le 1er septembre 2026, de nouvelles valeurs s'appliquent quand la branche n'a pas fixé de niveau.",
    lien: { href: '/alternance/#opco', libelle: "Alternance : ce que paie l'OPCO, ce que vous payez" },
  },
  {
    id: 'opco',
    nom: 'OPCO',
    developpe: 'opérateur de compétences',
    definition:
      "L'un des 11 organismes paritaires agréés par l'État qui financent notamment l'alternance, la période de reconversion et, sous 50 salariés, le plan de développement des compétences. Chaque entreprise relève de l'OPCO de sa convention collective.",
    lien: { href: '/comprendre-les-opco/', libelle: 'Comprendre les OPCO : rôle, rattachement, financements' },
  },
  {
    id: 'participation-forfaitaire',
    nom: 'Participation forfaitaire',
    definition:
      "Somme que le titulaire paie à chaque achat de formation avec son CPF : 150 € depuis le 2 avril 2026. Elle n'est pas due par les demandeurs d'emploi, ni quand l'employeur abonde la formation.",
    lien: { href: '/cpf/#reste-a-charge', libelle: 'CPF : le reste à charge en 2026' },
  },
  {
    id: 'periode-de-reconversion',
    nom: 'Période de reconversion',
    definition:
      "Dispositif ouvert à tout salarié du privé depuis le 1er février 2026, qui remplace la Pro-A et les Transitions collectives : une formation de 12 mois au plus vers une certification RNCP, un CQP ou CléA. L'OPCO la prend en charge, à 9,15 €/h à défaut d'accord de branche.",
    lien: { href: '/comprendre-les-opco/#reconversion', libelle: 'Comprendre les OPCO : la période de reconversion' },
  },
  {
    id: 'plan-de-developpement-des-competences',
    nom: 'Plan de développement des compétences',
    definition:
      "Ensemble des formations décidées et payées par l'employeur, sans condition d'ancienneté pour le salarié. Sur ses fonds légaux, l'OPCO ne le prend en charge que pour les entreprises de moins de 50 salariés.",
    lien: { href: '/employeurs/#taille', libelle: "Employeurs : ce que finance l'OPCO selon votre taille" },
  },
  {
    id: 'poec',
    nom: 'POEC',
    developpe: "préparation opérationnelle à l'emploi collective",
    definition:
      "Formation courte et collective, de quelques jours à 400 heures au plus, que France Travail finance quand une branche identifie un besoin de recrutement.",
    lien: { href: '/demandeurs-emploi/#poei', libelle: "Demandeur d'emploi : la POEI et la POEC" },
  },
  {
    id: 'poei',
    nom: 'POEI',
    developpe: "préparation opérationnelle à l'emploi individuelle",
    definition:
      "Formation financée avant l'embauche pour préparer un demandeur d'emploi à un poste précis, 450 heures au plus en organisme certifié Qualiopi. L'employeur s'engage ensuite à le recruter, par exemple en CDI ou en CDD d'au moins 6 mois.",
    lien: { href: '/employeurs/#recruter', libelle: "Employeurs : recruter un demandeur d'emploi" },
  },
  {
    id: 'pro-a',
    nom: 'Pro-A',
    definition:
      "Dispositif de reconversion des salariés qui ne peut plus être conclu depuis le 1er janvier 2026 : la période de reconversion l'a remplacé. Les Pro-A signées avant 2026 continuent de produire leurs effets.",
    lien: { href: '/comprendre-les-opco/#reconversion', libelle: 'Comprendre les OPCO : la période de reconversion' },
  },
  {
    id: 'ptp',
    nom: 'PTP',
    developpe: 'projet de transition professionnelle',
    definition:
      "Absence autorisée pour suivre une formation certifiante afin de changer de métier, en restant rémunéré ; Transitions Pro finance le projet. En CDI, il faut 2 ans d'activité salariée, dont 1 an dans l'entreprise.",
    lien: { href: '/salaries/#changer-de-metier', libelle: 'Salarié : changer de métier' },
  },
  {
    id: 'qualiopi',
    nom: 'Qualiopi',
    definition:
      "Certification des organismes de formation exigée par plusieurs financeurs : la POEI se déroule dans un organisme certifié Qualiopi, et les OPCO achètent leurs actions collectives auprès d'organismes certifiés.",
  },
  {
    id: 'repertoire-specifique',
    nom: 'Répertoire spécifique',
    developpe: 'RS',
    definition:
      "Répertoire de certifications distinct du RNCP : habilitations électriques, CACES, TOEIC, certifications informatiques... Depuis le 26 février 2026, le CPF n'y finance que 1 500 € au plus par formation, sauf pour CléA.",
    lien: { href: '/cpf/#formations', libelle: 'CPF : ce que votre CPF peut financer' },
  },
  {
    id: 'rff',
    nom: 'RFF',
    developpe: 'rémunération de fin de formation',
    definition:
      "Rémunération qui prend le relais si les droits ARE ou ASP d'un demandeur d'emploi s'épuisent pendant une formation qualifiante validée et financée par France Travail, vers un métier en tension. Elle est plafonnée à 775,65 € par mois.",
    lien: { href: '/demandeurs-emploi/#remuneration', libelle: "Demandeur d'emploi : être rémunéré pendant la formation" },
  },
  {
    id: 'rfft',
    nom: 'RFFT',
    developpe: 'rémunération de formation de France Travail',
    definition:
      "Rémunération que France Travail peut verser au demandeur d'emploi qui ne touche pas l'ARE à l'entrée d'une formation qu'il agrée : 226,48 € par mois avant 18 ans, 566,17 € de 18 à 25 ans, 775,65 € à partir de 26 ans.",
    lien: { href: '/demandeurs-emploi/#remuneration', libelle: "Demandeur d'emploi : être rémunéré pendant la formation" },
  },
  {
    id: 'rgdu',
    nom: 'RGDU',
    developpe: 'réduction générale dégressive unique',
    definition:
      "Nom de la réduction générale des cotisations patronales depuis le 1er janvier 2026. Elle s'applique aux salaires inférieurs à 3 Smic, pour tous les contrats, alternance et temps partiel compris.",
    lien: { href: '/alternance/#salaire', libelle: "Alternance : salaire de l'apprenti et cotisations" },
  },
  {
    id: 'rncp',
    nom: 'RNCP',
    developpe: 'Répertoire national des certifications professionnelles',
    definition:
      "Répertoire des diplômes, titres professionnels et CQP. Le CPF finance sans plafond une formation qui prépare une certification inscrite au RNCP, et la VAE aboutit à l'une de ces certifications.",
    lien: { href: '/cpf/#formations', libelle: 'CPF : ce que votre CPF peut financer' },
  },
  {
    id: 'rsfp',
    nom: 'RSFP',
    developpe: 'rémunération des stagiaires de la formation professionnelle',
    definition:
      "Rémunération que la Région peut verser pendant une formation qu'elle finance. Montants et règles varient d'une Région à l'autre.",
    lien: { href: '/demandeurs-emploi/#remuneration', libelle: "Demandeur d'emploi : être rémunéré pendant la formation" },
  },
  {
    id: 'transitions-pro',
    nom: 'Transitions Pro',
    definition:
      "Associations régionales paritaires qui financent le projet de transition professionnelle et attestent le caractère réel et sérieux d'un projet de démission pour reconversion. Elles peuvent aussi financer une VAE, dans la limite d'un forfait de 2 000 €.",
    lien: { href: '/salaries/#changer-de-metier', libelle: 'Salarié : changer de métier' },
  },
  {
    id: 'vae',
    nom: 'VAE',
    developpe: "validation des acquis de l'expérience",
    definition:
      "Démarche qui fait reconnaître une expérience professionnelle, bénévole ou syndicale par une certification inscrite au RNCP. La candidature se dépose sur la plateforme France VAE, sans durée minimale d'expérience.",
    lien: { href: '/salaries/#vae-bilan', libelle: 'Salarié : VAE et bilan de compétences' },
  },
  {
    id: 'versements-volontaires',
    nom: 'Versements volontaires',
    definition:
      "Sommes qu'une entreprise verse à son OPCO par contrat, sur un compte dédié et non mutualisé. Elle les mobilise pour ses propres formations, selon la convention passée avec l'OPCO.",
    lien: { href: '/obligations/#budget', libelle: 'Obligations des entreprises : légal, volontaire, conventionnel' },
  },
  {
    id: 'vivea',
    nom: 'VIVÉA',
    definition:
      "Fonds d'assurance formation des actifs non salariés agricoles : chefs d'exploitation, entrepreneurs du paysage, collaborateurs, aides familiaux, cotisants de solidarité. En 2026, il finance jusqu'à 2 000 € par an et par bénéficiaire, non reportables.",
    lien: { href: '/quel-est-mon-opco/#cas', libelle: 'Quel est mon OPCO : cas particuliers, dont les indépendants' },
  },
];

/** Les termes dans l'ordre alphabétique français (accents et casse ignorés). */
const TERMES = [...TERMES_SAISIS].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));

/** Initiale d'un terme, sans accent (« Période » se range à P, « VIVÉA » à V). */
function lettreDe(nom: string): string {
  return nom.normalize('NFD').charAt(0).toUpperCase();
}

/** Termes regroupés par initiale, dans l'ordre du lexique. */
const GROUPES = TERMES.reduce<{ lettre: string; termes: Terme[] }[]>((groupes, terme) => {
  const lettre = lettreDe(terme.nom);
  const dernier = groupes[groupes.length - 1];
  if (dernier && dernier.lettre === lettre) dernier.termes.push(terme);
  else groupes.push({ lettre, termes: [terme] });
  return groupes;
}, []);

const ADRESSE = adresseAbsolue(PAGES.lexique.chemin);

/** Page, fil d'Ariane et liste des termes (DefinedTermSet), chaque terme avec sa définition et son ancre. */
const GRAPHE = grapheDePage({
  chemin: PAGES.lexique.chemin,
  titre: PAGES.lexique.titre,
  description: PAGES.lexique.description,
  type: 'WebPage',
  nomCourt: 'Lexique',
  modifieLe: REVUE_DES_GUIDES,
  publieLe: REVUE_DES_GUIDES,
  autres: [
    {
      '@type': 'DefinedTermSet',
      '@id': `${ADRESSE}#lexique`,
      name: PAGES.lexique.titre,
      description: PAGES.lexique.description,
      url: ADRESSE,
      inLanguage: 'fr-FR',
      isPartOf: { '@id': `${ADRESSE}#page` },
      hasDefinedTerm: TERMES.map((t) => ({
        '@type': 'DefinedTerm',
        '@id': `${ADRESSE}#${t.id}`,
        name: t.nom,
        ...(t.developpe ? { alternateName: t.developpe } : {}),
        description: t.definition,
        url: `${ADRESSE}#${t.id}`,
        inDefinedTermSet: { '@id': `${ADRESSE}#lexique` },
      })),
    },
  ],
});

/** Titre `h2` des sections du lexique : le dessin de `TitreDeSection` (28 à 32 px). */
const TITRE_H2 = 'text-[1.75rem] leading-[1.15] font-bold tracking-[-0.025em] text-texte sm:text-[2rem]';

/** Sources principales, groupées par site. */
const SOURCES: { site: string; liens: { href: string; nom: string }[] }[] = [
  {
    site: 'service-public.gouv.fr',
    liens: [
      { href: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F10705', nom: 'CPF' },
      { href: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F32040', nom: 'entretien de parcours professionnel' },
      { href: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F14018', nom: 'projet de transition professionnelle' },
      { href: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F13516', nom: 'période de reconversion' },
      { href: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2401', nom: 'VAE' },
      { href: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F3087', nom: 'bilan de compétences' },
      { href: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F292', nom: 'RFF' },
      { href: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F760', nom: 'RFFT' },
      { href: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23459', nom: 'CFP des indépendants' },
      { href: 'https://entreprendre.service-public.gouv.fr/vosdroits/F24542', nom: 'RGDU' },
    ],
  },
  {
    site: 'France Travail',
    liens: [
      {
        href: 'https://www.francetravail.fr/employeur/aides-aux-recrutements/les-aides-a-la-formation/la-preparation-operationnelle-a.html',
        nom: 'POEI',
      },
      {
        href: 'https://www.francetravail.fr/candidat/en-formation/mes-aides-financieres/laide-individuelle-a-la-formatio.html',
        nom: 'AIF',
      },
      {
        href: 'https://www.francetravail.fr/candidat/en-formation/les-dispositifs/la-remuneration-pendant-la-forma.html',
        nom: 'rémunération pendant la formation',
      },
      {
        href: 'https://www.francetravail.fr/actualites/a-laffiche/2026/cpf-aif-poec-quel-financement.html',
        nom: 'POEC',
      },
    ],
  },
  {
    site: 'Mon Compte Formation et Caisse des Dépôts',
    liens: [
      { href: 'https://www.moncompteformation.gouv.fr/espace-public/de-nouvelles-regles-pour-mobiliser-votre-cpf', nom: 'règles du CPF en 2026' },
      {
        href: 'https://politiques-sociales.caissedesdepots.fr/formation-professionnelle/soutenir-le-projet-dun-de-mes-salaries-les-dotations',
        nom: 'EDEF',
      },
    ],
  },
  {
    site: 'Textes et organismes',
    liens: [
      { href: 'https://www.legifrance.gouv.fr/codes/id/LEGISCTA000037387475', nom: 'Code du travail, art. L.6332-14 à L.6332-17-1' },
      {
        href: 'https://www.francecompetences.fr/fiche/nouveau-systeme-de-collecte-des-contributions-formation-apprentissage-france-competences-lance-un-moteur-de-recherche-pour-identifier-son-opco/',
        nom: 'France compétences',
      },
      {
        href: 'https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1128284/file/PAP%202027%20-%20Travail%20emploi%20et%20administration%20des%20minist%C3%A8res%20sociaux.pdf',
        nom: 'projet annuel de performances 2027',
      },
      { href: 'https://www.agefiph.fr/centre-aide/se-former', nom: 'Agefiph' },
    ],
  },
  {
    site: "Fonds d'assurance formation",
    liens: [
      { href: 'https://communication-agefice.fr/plafonds-financiers-annee-2026/', nom: 'AGEFICE' },
      { href: 'https://www.fafcea.com/actualites/evolution-criteres-prise-en-charge-formation-2026/', nom: 'FAFCEA' },
      { href: 'https://fifpl.fr/professions-liberales/suis-je-eligible/', nom: 'FIF PL' },
      { href: 'https://www.fafpm.org/', nom: 'FAF PM' },
      { href: 'https://vivea.fr/chef-dentreprise-agricole/nos-criteres-de-prise-en-charge/', nom: 'VIVÉA' },
    ],
  },
];

export default function LexiquePage() {
  return (
    <main>
      <DonneesStructurees graphe={GRAPHE} />
      <GuideHero
        fil={{ page: 'Lexique' }}
        revue={REVUE_DES_GUIDES}
        eyebrow="Lexique de la formation"
        title={
          <>
            Sigles et termes de la formation,{' '}
            <span className="mark">expliqués</span>
          </>
        }
        lead={`${TERMES.length} termes du financement de la formation professionnelle, chacun défini en une ou deux phrases. Quand un guide du site traite le sujet en détail, la définition y renvoie.`}
      />

      {/* Index de lettres en tête sous 1 024 px (cibles de 44 px), colonne collante à partir de 1 024 px ; à
          l'impression, une seule colonne et pas d'index. */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12 lg:py-14 print:grid-cols-1">
        <nav
          aria-labelledby="titre-index"
          className="lg:sticky lg:top-[calc(var(--hauteur-entete)+1.5rem)] lg:self-start print:hidden"
        >
          <p id="titre-index" className="text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">
            Index des lettres
          </p>
          <ul role="list" className="mt-3 flex flex-wrap gap-2">
            {GROUPES.map((g) => (
              <li key={g.lettre}>
                <a
                  href={`#lettre-${g.lettre.toLowerCase()}`}
                  className="grid size-11 place-items-center rounded-full border border-filet bg-white font-display text-base font-bold text-texte shadow-douce transition-[border-color,color] duration-200 hover:border-orange/45 hover:text-orange-deep"
                >
                  {g.lettre}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-12">
          {GROUPES.map((g) => {
            const id = `lettre-${g.lettre.toLowerCase()}`;
            return (
              <section key={g.lettre} id={id} aria-labelledby={`titre-${id}`} className="rule-double pt-6">
                <h2 id={`titre-${id}`} className={TITRE_H2}>
                  <span className="sr-only">Lettre </span>
                  {g.lettre}
                </h2>
                <dl className="mt-5 divide-y divide-filet overflow-clip rounded-carte border border-filet bg-white shadow-douce">
                  {g.termes.map((t) => (
                    <div key={t.id} id={t.id} className="px-5 py-5 target:bg-lin-soft sm:px-6">
                      <dt className="text-lg leading-snug font-semibold text-texte">
                        <dfn className="not-italic">{t.nom}</dfn>
                        {t.developpe && <span className="font-normal text-texte-doux"> ({t.developpe})</span>}
                      </dt>
                      <dd className="mt-2 max-w-[40rem] text-base leading-relaxed text-texte-doux">{typo(t.definition)}</dd>
                      {t.lien && (
                        <dd className="mt-2 text-sm">
                          <Link href={t.lien.href} className="lien">
                            {typo(t.lien.libelle)}
                          </Link>
                        </dd>
                      )}
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}

          <section aria-labelledby="titre-sources" className="rule-double pt-6">
            <h2 id="titre-sources" className={TITRE_H2}>
              Sources principales
            </h2>
            <p className="mt-4 max-w-[40rem] text-base leading-relaxed text-texte-doux">
              {typo(
                "Les définitions s'appuient sur ces pages officielles, consultées pour la mise à jour du lexique ; chaque guide du site cite en plus ses propres sources, section par section.",
              )}
            </p>
            <ul role="list" className="mt-5 space-y-3 text-sm leading-relaxed text-texte-doux">
              {SOURCES.map((s) => (
                <li key={s.site}>
                  <span className="font-semibold text-texte">{s.site}</span>
                  {typo(' : ')}
                  {s.liens.map((l, i) => (
                    <span key={l.href}>
                      {i > 0 && ' · '}
                      <Source href={l.href} titre={l.href}>
                        {l.nom}
                      </Source>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
