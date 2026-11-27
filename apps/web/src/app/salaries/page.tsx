import type { Metadata } from 'next';
import Link from 'next/link';
import {
  GuideHero,
  GuideBody,
  GuideSection,
  Callout,
  Source,
  GuideCta,
} from '@/components/site/Guide';
import { DonneesStructurees } from '@/components/site/DonneesStructurees';
import { QuestionsFrequentes } from '@/components/site/QuestionsFrequentes';
import { grapheDePage } from '@/lib/donnees-structurees';
import type { QuestionReponse } from '@/lib/donnees-structurees';
import { PAGES, REVUE_DES_GUIDES, metadonnees } from '@/lib/metadonnees';

/* Tableaux du guide : ceux de « Comprendre les OPCO » (en-tête Inter 600 en petites majuscules, texte discret 4,95:1 sur
   lin-soft) ; sous 640 px, une carte par ligne, l'en-tête de colonne repris devant chaque cellule. */
const EN_TETE = 'px-4 py-3 text-left text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase sm:px-5';
const LIGNE = 'align-top max-sm:block max-sm:px-4 max-sm:py-4';
const TITRE_LIGNE = 'px-4 py-3.5 text-left leading-snug font-semibold text-texte sm:px-5 max-sm:block max-sm:p-0';
const CELLULE =
  'px-4 py-3.5 leading-relaxed text-texte-doux sm:px-5 max-sm:mt-2 max-sm:block max-sm:p-0 max-sm:before:block max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:tracking-[0.12em] max-sm:before:text-texte-discret max-sm:before:uppercase max-sm:before:content-[attr(data-label)]';
const SOUS_TITRE = 'pt-2 text-lg leading-snug font-semibold text-texte';

export const metadata: Metadata = metadonnees(PAGES.salaries);

/** Fil d'Ariane : la page dépend directement de l'accueil. */
const FIL = { page: 'Salariés' };

/**
 * Questions fréquentes : affichées en dernière section et reprises mot pour mot dans les données structurées. Chaque
 * réponse vient du dossier de faits vérifiés du 27/11/2026 (service-public.gouv.fr, France Travail, Transitions Pro).
 */
const QUESTIONS: QuestionReponse[] = [
  {
    question: 'Peut-on refuser une formation proposée par son employeur ?',
    reponse:
      "Tout dépend de sa nature. Refuser une formation obligatoire, celle qu'un texte exige pour exercer votre poste, est une faute qui peut justifier un licenciement. Refuser une formation non obligatoire n'est ni une faute ni un motif de licenciement. La première se déroule sur votre temps de travail, salaire maintenu.",
  },
  {
    question: 'Quel salaire touche-t-on pendant un projet de transition professionnelle ?',
    reponse:
      "Vous percevez 100 % de votre salaire moyen de référence s'il ne dépasse pas 2 Smic. Au-delà, c'est 90 % la première année, ou les 1 200 premières heures, puis 60 %, sans descendre sous 2 Smic après la première année. Congés payés et protection sociale sont maintenus.",
  },
  {
    question: 'Quelles sont les conditions de la démission pour reconversion ?',
    reponse:
      "Il faut quitter un CDI de droit privé après 1 300 jours travaillés sur les 60 mois précédents, consulter un conseiller en évolution professionnelle avant la démission, puis obtenir de Transitions Pro l'attestation du caractère réel et sérieux du projet. Vous avez ensuite 6 mois pour vous inscrire à France Travail.",
  },
  {
    question: 'La période de reconversion remplace-t-elle la Pro-A ?',
    reponse:
      "Oui. Depuis le 1er janvier 2026, aucun nouvel avenant de Pro-A ne peut être signé. La période de reconversion, ouverte à tout salarié du privé avec l'accord de l'employeur, dure en principe 12 mois au plus, pour 150 à 450 heures de formation payées par l'OPCO.",
  },
  {
    question: "Combien d'heures dure le congé VAE ?",
    reponse:
      "Le congé VAE dure 48 heures par session d'évaluation, avec maintien de votre salaire. Demandez-le par écrit au plus tard 30 jours avant les actions de VAE. Votre employeur a 15 jours calendaires pour répondre, son silence vaut accord, et il ne peut reporter le congé que d'un mois.",
  },
  {
    question: "À quelle fréquence a lieu l'entretien de parcours professionnel ?",
    reponse:
      "Le premier entretien a lieu au cours de votre première année dans l'entreprise, puis tous les 4 ans. Tous les 8 ans, il fait l'état des lieux de votre parcours, et vous en recevez une copie écrite. Un accord collectif peut rapprocher les entretiens, jamais les espacer davantage.",
  },
  {
    question: "Qu'est-ce que l'abondement correctif de 3 000 € ?",
    reponse:
      "Dans une entreprise d'au moins 50 salariés, si vous n'avez pas bénéficié sur 8 ans des entretiens professionnels et d'au moins une formation non obligatoire, votre employeur doit créditer votre CPF de 3 000 €, au plus tard le dernier jour du trimestre civil qui suit l'entretien d'état des lieux.",
  },
];

const GRAPHE = grapheDePage({
  chemin: PAGES.salaries.chemin,
  titre: PAGES.salaries.titre,
  description: PAGES.salaries.description,
  type: 'Article',
  nomCourt: FIL.page,
  questions: QUESTIONS,
  modifieLe: REVUE_DES_GUIDES,
  publieLe: REVUE_DES_GUIDES,
});

const TOC = [
  { id: 'plan', label: "Le plan de formation de l'employeur" },
  { id: 'cpf', label: 'Votre CPF' },
  { id: 'changer-de-metier', label: 'Changer de métier' },
  { id: 'vae-bilan', label: 'VAE et bilan de compétences' },
  { id: 'entretien', label: 'Entretien de parcours et 3 000 €' },
  { id: 'questions', label: 'Questions fréquentes' },
];

export default function SalariesPage() {
  return (
    <main>
      <DonneesStructurees graphe={GRAPHE} />
      <GuideHero
        fil={FIL}
        revue={REVUE_DES_GUIDES}
        eyebrow="Guide · salariés"
        title={
          <>
            Salarié&nbsp;: faire financer
            <br />
            votre <span className="mark">formation</span>
          </>
        }
        lead="Formation utile à votre poste ou changement de métier : ce n'est ni le même financeur ni les mêmes droits. Voici ce que vous pouvez demander en 2026, et à qui."
      />

      <GuideBody toc={TOC}>
        <GuideSection id="plan" number="01" title="Le plan de développement des compétences de votre employeur">
          <p>
            Le plan de développement des compétences regroupe les formations que votre employeur
            décide et paie, sans condition d&apos;ancienneté. Une formation obligatoire pour votre
            poste se déroule sur votre temps de travail, salaire maintenu, et la refuser est une
            faute. Une formation non obligatoire peut se refuser sans risque de sanction.
          </p>
          <p>
            Une formation obligatoire, c&apos;est celle qu&apos;un texte exige pour exercer votre
            poste, comme la FIMO ou la FCO des conducteurs routiers. Seules les formations non
            obligatoires peuvent avoir lieu hors temps de travail, avec votre accord écrit, et ces
            heures ne sont pas rémunérées. Sans accord collectif, la limite est de 30 heures par an
            (ou 2 % du forfait), et vous pouvez revenir sur votre accord dans les 8 jours.
          </p>
          <p>
            Lisez aussi votre contrat : une clause de dédit-formation peut vous obliger à rembourser
            une partie des frais si vous démissionnez après la formation. Ce que l&apos;OPCO finance
            à l&apos;entreprise est détaillé sur notre page{' '}
            <Link href="/employeurs/" className="lien">
              Employeurs
            </Link>
            , les devoirs de l&apos;employeur dans le guide{' '}
            <Link href="/obligations/" className="lien">
              Obligations
            </Link>
            .
          </p>
          <p className="text-sm text-texte-discret">
            Source :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F11267">
              service-public.gouv.fr, fiche F11267
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="cpf" number="02" title="Votre CPF, pour vos projets">
          <p>
            Votre compte personnel de formation reçoit 500 € par année de travail à mi-temps ou
            plus, jusqu&apos;à 5 000 € (800 € et 8 000 € pour certains publics). Vous l&apos;utilisez
            librement hors temps de travail ; sur votre temps de travail, votre employeur doit
            l&apos;autoriser. Chaque achat coûte 150 € de votre poche, sauf exonération.
          </p>
          <p>
            Votre employeur ne peut pas vous imposer d&apos;utiliser votre CPF, mais il peut
            l&apos;abonder depuis son espace EDEF, ce qui vous dispense des 150 €.
          </p>
          <Callout tone="warn" title="Budget 2027 : un complément envisagé, pas adopté">
            Pour les formations validées depuis le 2 octobre 2026, Mon Compte Formation annonce un
            complément pouvant atteindre 200 €, à régler en 2027 si le projet de loi de finances est
            adopté. Au 27 novembre 2026, le texte est en discussion au Parlement. Détails sur notre
            page{' '}
            <Link href="/cpf/" className="lien">
              CPF 2026
            </Link>
            .
          </Callout>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F10705">
              service-public.gouv.fr, fiche F10705
            </Source>
            {' · '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/evolution-des-regles-dutilisation-du-cpf-compter-du-2-octobre-2026">
              Mon Compte Formation, règles au 2 octobre 2026
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="changer-de-metier" number="03" title="Changer de métier : PTP, période de reconversion, démission">
          <p>
            Trois dispositifs financent un changement de métier. Le projet de transition
            professionnelle (PTP) vous laisse partir en formation certifiante en restant rémunéré,
            si Transitions Pro accepte de le financer. La période de reconversion se monte avec
            votre employeur, et l&apos;OPCO paie la formation. La démission pour reconversion peut
            ouvrir droit à l&apos;allocation chômage.
          </p>
          <div className="overflow-clip rounded-carte border border-filet bg-white shadow-douce">
            <table className="w-full text-sm max-sm:block">
              <caption className="sr-only">Comparatif des trois dispositifs de reconversion</caption>
              <thead className="bg-lin-soft max-sm:sr-only">
                <tr>
                  <th scope="col" className={EN_TETE}>Dispositif</th>
                  <th scope="col" className={EN_TETE}>Conditions</th>
                  <th scope="col" className={EN_TETE}>Qui décide ou finance</th>
                  <th scope="col" className={EN_TETE}>Votre revenu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet max-sm:block">
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Projet de transition professionnelle</th>
                  <td data-label="Conditions" className={CELLULE}>CDI : 2 ans d&apos;activité salariée, dont 1 an dans l&apos;entreprise. CDD : 2 ans sur les 5 dernières années, dont 4 mois en CDD sur les 12 derniers mois</td>
                  <td data-label="Qui décide ou finance" className={CELLULE}>Transitions Pro de votre région, sur avis de sa commission</td>
                  <td data-label="Votre revenu" className={CELLULE}>100 % du salaire moyen de référence jusqu&apos;à 2 Smic ; au-delà, 90 % la première année puis 60 %, sans descendre sous 2 Smic après la première année</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Période de reconversion</th>
                  <td data-label="Conditions" className={CELLULE}>Tout salarié du privé, avec l&apos;accord écrit de l&apos;employeur (Cerfa) ; certification RNCP, CQP ou CléA</td>
                  <td data-label="Qui décide ou finance" className={CELLULE}>L&apos;OPCO, à la demande de l&apos;employeur ; votre CPF en complément si vous le souhaitez</td>
                  <td data-label="Votre revenu" className={CELLULE}>Salaire inchangé dans votre entreprise ; celui du nouveau contrat dans une autre</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Démission pour reconversion</th>
                  <td data-label="Conditions" className={CELLULE}>CDI de droit privé ; 1 300 jours travaillés sur les 60 mois précédant la démission</td>
                  <td data-label="Qui décide ou finance" className={CELLULE}>Transitions Pro atteste le projet ; France Travail verse l&apos;allocation</td>
                  <td data-label="Votre revenu" className={CELLULE}>Allocation chômage, aux conditions habituelles</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className={SOUS_TITRE}>Le projet de transition professionnelle</h3>
          <p>
            Demandez l&apos;absence à votre employeur au plus tard 120 jours avant une formation
            continue à temps plein de 6 mois ou plus, 60 jours sinon. Il a 30 jours pour répondre,
            et son silence vaut accord. Il peut reporter votre départ de 9 mois au plus, si votre
            absence nuit à la marche de l&apos;entreprise ou si trop de salariés sont absents en même
            temps. En CDD, déposez la demande avant la fin du contrat : la formation doit commencer
            au plus tard 6 mois après.
          </p>
          <p>
            Le dossier se dépose sur le site Transitions Pro de votre région ; sa commission
            paritaire juge la cohérence du projet, la pertinence de la formation et de son
            financement, et les perspectives d&apos;emploi.
          </p>

          <h3 className={SOUS_TITRE}>La période de reconversion</h3>
          <p>
            Elle remplace la Pro-A, fermée aux nouveaux avenants depuis le 1er janvier 2026, et sert
            une mobilité dans votre entreprise ou dans une autre. Elle dure 12 mois au plus, pour 150
            à 450 heures de formation hors CléA, sauf accord d&apos;entreprise ou de branche (jusqu&apos;à
            2 100 heures sur 36 mois). Dans une autre entreprise, votre contrat est
            suspendu et vous signez un CDI ou un CDD d&apos;au moins 6 mois avec l&apos;entreprise
            d&apos;accueil.
          </p>

          <h3 className={SOUS_TITRE}>La démission pour reconversion</h3>
          <p>
            CDD, intérim, agents publics et indépendants en sont exclus, et les congés sans solde ou
            sabbatiques ne comptent pas dans les 1 300 jours. L&apos;ordre des étapes compte :
          </p>
          <ol className="max-w-[34rem] list-decimal space-y-2 pl-5">
            <li>
              consultez un conseiller en évolution professionnelle avant de démissionner : une
              demande faite après rend le projet irrecevable ;
            </li>
            <li>
              faites attester par Transitions Pro le caractère réel et sérieux du projet, formation
              vers un nouveau métier ou création ou reprise d&apos;entreprise ;
            </li>
            <li>
              inscrivez-vous à France Travail dans les 6 mois qui suivent la notification de sa
              décision, et demandez l&apos;allocation ;
            </li>
            <li>
              mettez le projet en œuvre : France Travail le contrôle dans les 6 mois, sous peine
              d&apos;une radiation de 4 mois et de la suppression de 4 mois d&apos;allocation.
            </li>
          </ol>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F14018">
              fiche F14018
            </Source>
            {' · '}
            <Source href="https://www.transitionspro.fr/nos-dispositifs/projet-de-transition-professionnelle/">
              Transitions Pro, PTP
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F13516">
              fiche F13516
            </Source>
            {' · '}
            <Source href="https://www.francetravail.fr/candidat/mes-droits-aux-aides-et-allocati/a-chaque-situation-son-allocatio/quelle-est-ma-situation-professi/je-perds-ou-je-quitte-un-emploi/je-veux-demissionner-et-jai-un-p.html">
              France Travail, démission
            </Source>
            {' · '}
            <Source href="https://www.transitionspro.fr/nos-dispositifs/demission-reconversion/">
              Transitions Pro, démission
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="vae-bilan" number="04" title="VAE et bilan de compétences">
          <p>
            La VAE fait reconnaître votre expérience, professionnelle, bénévole ou syndicale, par
            une certification inscrite au RNCP, sans durée minimale d&apos;expérience. Le bilan de
            compétences dure 24 heures au plus, et ses résultats vous appartiennent. Votre CPF ou
            votre employeur peuvent financer l&apos;un et l&apos;autre ; Transitions Pro peut aussi
            financer une VAE.
          </p>

          <h3 className={SOUS_TITRE}>La VAE</h3>
          <p>
            La candidature se dépose sur la plateforme France VAE, qui proposait 2 022
            certifications au 24 novembre 2026 ; l&apos;accompagnement est facultatif. Le congé VAE
            vous accorde 48 heures par session d&apos;évaluation, salaire maintenu. Demandez-le par
            écrit au plus tard 30 jours avant, avec la preuve de recevabilité. Pour la financer :
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Votre CPF, avec des abondements possibles (employeur, OPCO, Région) : 150 € de
              participation, sauf abondement de l&apos;employeur. Candidat autonome, vous ne pouvez
              pas l&apos;utiliser pour les frais de jury.
            </li>
            <li>Votre employeur, dans son plan de développement des compétences.</li>
            <li>
              Transitions Pro, jusqu&apos;à un forfait de 2 000 €, avec ou sans votre CPF.
            </li>
          </ul>

          <h3 className={SOUS_TITRE}>Le bilan de compétences</h3>
          <p>
            Avec votre CPF, il est plafonné à 1 600 € de droits, sans autre bilan financé dans les
            5 années précédentes. Réalisé en totalité hors temps de travail, il n&apos;a pas à être signalé à votre
            employeur ; sur le temps de travail, son accord est nécessaire, sous 30 jours, et votre
            salaire est maintenu.
          </p>
          <p>
            À l&apos;initiative de l&apos;employeur, le bilan est à sa charge et exige votre accord,
            par une convention écrite que vous avez 10 jours pour signer ; refuser n&apos;est pas une
            faute. Vous choisissez le prestataire dans tous les cas.
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F2401">
              fiche F2401
            </Source>
            {' · '}
            <Source href="https://vae.gouv.fr/">France VAE</Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F3087">
              fiche F3087
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="entretien" number="05" title="L'entretien de parcours professionnel et l'abondement de 3 000 €">
          <p>
            Depuis la loi du 24 octobre 2025, l&apos;entretien de parcours professionnel remplace
            l&apos;entretien professionnel. Il a lieu au cours de votre première année dans
            l&apos;entreprise, puis tous les 4 ans, et fait l&apos;état des lieux de votre parcours
            tous les 8 ans. Dans une entreprise d&apos;au moins 50 salariés, les manquements de
            l&apos;employeur peuvent valoir 3 000 € sur votre CPF.
          </p>
          <p>
            Il est obligatoire dans toutes les entreprises, quel que soit votre contrat, et se tient
            pendant le temps de travail. Ce n&apos;est pas une évaluation : il porte sur vos
            compétences, vos besoins de formation, vos souhaits d&apos;évolution (reconversion, PTP,
            bilan, VAE) et votre CPF.
          </p>
          <p>
            Deux rendez-vous sont fixés : dans les 2 mois qui suivent la visite médicale de
            mi-carrière (45 ans) et dans les 2 ans qui précèdent vos 60 ans. Un entretien doit aussi
            vous être proposé au retour d&apos;un congé de maternité, parental, d&apos;adoption, de
            proche aidant, sabbatique ou d&apos;un arrêt maladie qui a duré plus de 6 mois, si vous
            n&apos;en avez pas eu dans les 12 mois précédents.
          </p>

          <h3 className={SOUS_TITRE}>L&apos;abondement correctif de 3 000 €</h3>
          <p>
            Selon service-public.gouv.fr, dans une entreprise d&apos;au moins 50 salariés, si vous
            n&apos;avez pas bénéficié sur les 8 dernières années des entretiens professionnels et
            d&apos;au moins une formation non obligatoire, votre employeur doit créditer votre CPF de
            3 000 €, au plus tard le dernier jour du trimestre civil qui suit l&apos;entretien
            d&apos;état des lieux.
          </p>
          <p>
            En dessous de 50 salariés, pas d&apos;abondement automatique, mais l&apos;employeur qui
            manque à ses obligations de formation peut être condamné à des dommages et intérêts.
          </p>
          <Callout tone="info" title="Tous les 2 ans, sur 6 ans : l'ancienne règle">
            La fiche CPF de service-public.gouv.fr cite encore un entretien tous les 2 ans et une
            période de 6 ans. La fiche consacrée à l&apos;entretien, vérifiée le 1er octobre 2026,
            retient 4 et 8 ans.
          </Callout>
          <p className="text-sm text-texte-discret">
            Source :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F32040">
              service-public.gouv.fr, fiche F32040
            </Source>
          </p>
        </GuideSection>

        <QuestionsFrequentes questions={QUESTIONS} />
      </GuideBody>

      <GuideCta
        title="Estimez le financement de votre projet"
        text="En six étapes, le simulateur passe en revue les financements de votre projet : OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe."
        href="/simulateur/"
        label="Estimer mon financement"
      />
    </main>
  );
}
