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
import { QuestionsFrequentes } from '@/components/site/QuestionsFrequentes';
import { DonneesStructurees } from '@/components/site/DonneesStructurees';
import { grapheDePage } from '@/lib/donnees-structurees';
import type { QuestionReponse } from '@/lib/donnees-structurees';
import { PAGES, REVUE_DES_GUIDES, metadonnees } from '@/lib/metadonnees';

/* Tableau des rémunérations : même dessin que le tableau « Ce que finance un OPCO » (comprendre-les-opco). En-tête
   Inter 600 en petites majuscules (texte discret, 4,95:1 sur lin-soft) ; sous 640 px, une carte par ligne, l'en-tête
   de colonne repris devant chaque cellule. */
const EN_TETE = 'px-4 py-3 text-left text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase sm:px-5';
const LIGNE = 'align-top max-sm:block max-sm:px-4 max-sm:py-4';
const TITRE_LIGNE = 'px-4 py-3.5 text-left leading-snug font-semibold text-texte sm:px-5 max-sm:block max-sm:p-0';
const CELLULE =
  'px-4 py-3.5 leading-relaxed text-texte-doux sm:px-5 max-sm:mt-2 max-sm:block max-sm:p-0 max-sm:before:block max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:tracking-[0.12em] max-sm:before:text-texte-discret max-sm:before:uppercase max-sm:before:content-[attr(data-label)]';

export const metadata: Metadata = metadonnees(PAGES.demandeursEmploi);

/** Fil d'Ariane : page de premier niveau, comme les pages Salariés et Employeurs. */
const FIL = { page: "Demandeurs d'emploi" };

/* Questions fréquentes : affichées en dernière section et reprises mot pour mot dans les données structurées. Faits
   du dossier de vérification du 27/11/2026 (sections 1 et 6). */
const QUESTIONS: QuestionReponse[] = [
  {
    question: "Comment faire financer une formation quand on est demandeur d'emploi ?",
    reponse:
      "Commencez par votre CPF : en tant que demandeur d'emploi, vous ne payez pas la participation obligatoire. Si le solde ne suffit pas, France Travail peut compléter avec l'aide individuelle à la formation (AIF), après validation du projet par votre conseiller. La Région finance aussi des formations, et une formation agréée par la Région ou l'État est rémunérée.",
  },
  {
    question: "Demandeur d'emploi : faut-il payer les 150 € de reste à charge du CPF ?",
    reponse:
      "Non. Depuis avril 2026, la participation obligatoire au CPF est de 150 € pour les salariés, mais le Code du travail précise qu'elle n'est pas due par les demandeurs d'emploi. Si un reste à charge s'affiche malgré tout, signalez-le à votre conseiller France Travail pour qu'il vérifie votre situation avant de valider l'inscription.",
  },
  {
    question: 'AIF de France Travail : quelles conditions ?',
    reponse:
      "L'AIF paie les frais pédagogiques quand votre CPF ne suffit pas ou que vous n'avez pas de droits. Trois critères en 2026 : un lien direct avec l'objectif d'emploi de votre projet personnalisé, une formation adaptée au marché local de l'emploi et aucun autre financeur principal possible. Vous devez être inscrit à France Travail.",
  },
  {
    question: "Comment demander l'AIF ?",
    reponse:
      "Demandez un devis à l'organisme de formation. Si vous passez par Mon Compte Formation et que votre CPF ne couvre pas tout, vous pouvez y demander directement le complément à France Travail, qui répond sous 10 jours. Pour une formation hors CPF, voyez votre conseiller : il doit valider le projet avant tout financement.",
  },
  {
    question: 'Est-on payé pendant une formation quand on est au chômage ?',
    reponse:
      "Le plus souvent, oui. Si vous touchez l'ARE et que la formation dure plus de 40 heures, elle devient l'ARE formation, dans la limite de vos droits. Sans allocation, France Travail peut verser la RFFT, 775,65 € par mois à partir de 26 ans, pour une formation qu'il agrée. Pour une formation financée par la Région, celle-ci peut vous rémunérer.",
  },
  {
    question: "POEI : de quoi s'agit-il et combien de temps dure-t-elle ?",
    reponse:
      "La POEI finance une formation avant l'embauche pour adapter vos compétences à un poste précis. L'employeur s'engage ensuite à vous recruter en CDI, en CDD d'au moins 6 mois ou en alternance pour plus de 6 mois. La formation dure au plus 450 heures, 600 heures pour certains publics prioritaires. Vous restez stagiaire rémunéré.",
  },
  {
    question: "L'AFPR existe-t-elle encore ?",
    reponse:
      "Non. France Travail a supprimé l'AFPR en 2024 et l'a intégrée à la POEI élargie, qui couvre désormais les CDD d'au moins 6 mois, autrefois réservés à l'AFPR. Si une offre ou un site vous parle encore d'AFPR, demandez une POEI à votre conseiller ou au recruteur : le principe reste une formation avant l'embauche.",
  },
  {
    question: "Formation et handicap : quelles aides pour un demandeur d'emploi ?",
    reponse:
      "Votre CPF est crédité de 800 € par année de travail salarié, dans la limite de 8 000 €. L'Agefiph peut financer les aménagements de formation liés au handicap et, en cas de graves difficultés financières, une aide au parcours vers l'emploi de 530 € au plus. Votre conseiller France Travail, Cap emploi ou Mission locale fait la demande.",
  },
];

const GRAPHE = grapheDePage({
  chemin: PAGES.demandeursEmploi.chemin,
  titre: PAGES.demandeursEmploi.titre,
  description: PAGES.demandeursEmploi.description,
  type: 'Article',
  nomCourt: FIL.page,
  modifieLe: REVUE_DES_GUIDES,
  publieLe: REVUE_DES_GUIDES,
  questions: QUESTIONS,
});

const TOC = [
  { id: 'cpf', label: 'Votre CPF, sans participation forfaitaire' },
  { id: 'aif', label: "L'aide individuelle à la formation (AIF)" },
  { id: 'region', label: 'Les formations de la Région' },
  { id: 'remuneration', label: 'Être rémunéré pendant la formation' },
  { id: 'poei', label: "La POEI : se former avant l'embauche" },
  { id: 'cas-particuliers', label: 'Handicap, CSP, permis' },
  { id: 'questions', label: 'Questions fréquentes' },
];

export default function DemandeursEmploiPage() {
  return (
    <main>
      <DonneesStructurees graphe={GRAPHE} />
      <GuideHero
        fil={FIL}
        revue={REVUE_DES_GUIDES}
        eyebrow="Guide · demandeurs d'emploi"
        title={
          <>
            Demandeur d&apos;emploi&nbsp;:<br />
            financer votre <span className="mark">formation</span>
          </>
        }
        lead="CPF sans participation forfaitaire, aide individuelle à la formation de France Travail, formations de la Région, POEI : sans emploi, vous avez accès à plusieurs financements, qui s'utilisent dans un ordre précis. Selon votre situation, vous pouvez aussi être rémunéré pendant la formation."
      />

      <GuideBody toc={TOC}>
        <GuideSection id="cpf" number="01" title="Votre CPF, sans participation forfaitaire">
          <p>
            Demandeur d&apos;emploi, vous commencez par votre compte personnel de formation, et
            vous ne payez pas la participation obligatoire de 150 € que versent les autres
            titulaires, salariés notamment, depuis avril 2026. Si votre solde ne couvre pas le prix
            de la formation, France Travail, la Région, un OPCO ou une entreprise peuvent le
            compléter.
          </p>
          <p>
            La règle figure à l&apos;article L6323-7 du Code du travail, qui précise que la
            participation «&nbsp;n&apos;est due ni par les demandeurs d&apos;emploi&nbsp;». Si Mon
            Compte Formation vous réclame malgré tout ces 150 €, signalez-le à votre conseiller
            France Travail avant de valider l&apos;inscription&nbsp;: il vérifiera votre situation.
          </p>
          <p>
            Pour compléter un solde insuffisant, France Travail s&apos;appuie notamment sur
            l&apos;aide individuelle à la formation, présentée ci-dessous. Droits acquis chaque
            année, plafonds, formations éligibles&nbsp;: le détail est dans notre{' '}
            <Link href="/cpf/" className="lien">
              guide du CPF
            </Link>
            . Vous avez retrouvé un poste&nbsp;? Les règles changent, voyez la page{' '}
            <Link href="/salaries/" className="lien">
              Salariés
            </Link>
            .
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000006178205/">
              Code du travail, art. L6323-7
            </Source>
            {' · '}
            <Source href="https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000018498278/">
              décret n° 2026-234 (participation de 150 €)
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18873">
              service-public.gouv.fr
            </Source>
            {' · '}
            <Source href="https://www.francetravail.fr/actualites/a-laffiche/2026/cpf-aif-poec-quel-financement.html">
              France Travail
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="aif" number="02" title="L'aide individuelle à la formation (AIF)">
          <p>
            L&apos;aide individuelle à la formation (AIF) est l&apos;aide de France Travail qui paie
            les frais pédagogiques de votre formation. Elle vient après le CPF&nbsp;: elle finance
            le reste à charge si vos droits ne suffisent pas, ou la totalité si vous n&apos;en avez
            pas. Votre conseiller doit avoir validé le projet.
          </p>
          <p>
            Elle s&apos;adresse aux demandeurs d&apos;emploi inscrits à France Travail, indemnisés
            ou non, ainsi qu&apos;aux personnes en contrat de sécurisation professionnelle (CSP).
            France Travail retient trois critères en 2026&nbsp;:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              un lien direct avec l&apos;objectif d&apos;emploi défini dans votre projet
              personnalisé (PPAE)&nbsp;;
            </li>
            <li>une formation adaptée au marché local de l&apos;emploi&nbsp;;</li>
            <li>aucun autre financeur capable de couvrir le coût à titre principal.</li>
          </ul>
          <p>La démarche tient en trois temps.</p>
          <ol className="max-w-[34rem] list-decimal space-y-2 pl-5">
            <li>Demandez un devis à l&apos;organisme qui dispense la formation visée.</li>
            <li>
              Si la formation est sur Mon Compte Formation et que votre CPF ne couvre pas tout,
              demandez le complément à France Travail directement depuis la plateforme&nbsp;: la
              réponse arrive sous 10 jours.
            </li>
            <li>
              Pour une formation hors CPF, voyez votre conseiller&nbsp;: il doit valider le projet
              avant tout financement.
            </li>
          </ol>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.francetravail.fr/candidat/en-formation/mes-aides-financieres/laide-individuelle-a-la-formatio.html">
              France Travail, l&apos;AIF
            </Source>
            {' · '}
            <Source href="https://www.francetravail.fr/actualites/a-laffiche/2026/cpf-aif-poec-quel-financement.html">
              France Travail, CPF, AIF, POEC (2026)
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="region" number="03" title="Les formations de la Région">
          <p>
            Les Régions et l&apos;État agréent et financent des formations destinées aux
            demandeurs d&apos;emploi. Leur nom et leur contenu changent d&apos;une Région à
            l&apos;autre&nbsp;: renseignez-vous auprès de votre conseiller France Travail ou sur le
            site de votre Région. Si vous suivez une formation agréée par l&apos;État ou la Région,
            vous êtes rémunéré pendant la formation.
          </p>
          <p>
            Pour une formation qu&apos;elle finance, la Région peut vous rémunérer elle-même, au
            titre de la rémunération des stagiaires de la formation professionnelle (RSFP). Ses
            montants et ses règles ne sont pas nationaux&nbsp;: nous ne les reproduisons pas ici.
            Demandez le barème en vigueur à votre Région avant l&apos;entrée en formation.
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.agefiph.fr/centre-aide/se-former">Agefiph, se former</Source>
            {' · '}
            <Source href="https://www.francetravail.fr/candidat/en-formation/les-dispositifs/la-remuneration-pendant-la-forma.html">
              France Travail, la rémunération pendant la formation
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="remuneration" number="04" title="Être rémunéré pendant la formation">
          <p>
            Votre rémunération pendant la formation dépend de votre situation le jour de
            l&apos;entrée. Si vous touchez l&apos;ARE et que la formation dure plus de 40 heures,
            elle devient l&apos;ARE formation (AREF). Sans ARE, France Travail peut vous verser la
            RFFT pour une formation qu&apos;il agrée, de 226,48 € à 775,65 € par mois selon votre
            âge.
          </p>
          {/* Sous 640 px, chaque ligne devient une carte (en-têtes repris devant chaque cellule) : aucun défilement. */}
          <div className="overflow-clip rounded-carte border border-filet bg-white shadow-douce">
            <table className="w-full text-sm max-sm:block">
              <caption className="sr-only">Rémunérations pendant une formation, selon votre situation (2026)</caption>
              <thead className="bg-lin-soft max-sm:sr-only">
                <tr>
                  <th scope="col" className={EN_TETE}>Votre situation</th>
                  <th scope="col" className={EN_TETE}>Ce que vous percevez</th>
                  <th scope="col" className={EN_TETE}>Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet max-sm:block">
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Vous touchez l&apos;ARE et la formation dure plus de 40 heures</th>
                  <td data-label="Ce que vous percevez" className={CELLULE}>ARE formation (AREF)</td>
                  <td data-label="Montant" className={CELLULE}>Versée dans la limite de vos droits</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Vous ne touchez pas l&apos;ARE le jour de l&apos;inscription en formation</th>
                  <td data-label="Ce que vous percevez" className={CELLULE}>Rémunération de formation de France Travail (RFFT), pour une formation qu&apos;il agrée</td>
                  <td data-label="Montant" className={CELLULE}>226,48 € par mois avant 18 ans, 566,17 € de 18 à 25 ans, 775,65 € à partir de 26 ans</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Vos droits à l&apos;ARE ou à l&apos;ASP s&apos;épuisent pendant une formation qualifiante validée et financée par France Travail, vers un métier en tension</th>
                  <td data-label="Ce que vous percevez" className={CELLULE}>Rémunération de fin de formation (RFF)</td>
                  <td data-label="Montant" className={CELLULE}>775,65 € par mois au plus</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Vous suivez une formation financée par la Région</th>
                  <td data-label="Ce que vous percevez" className={CELLULE}>RSFP, versée par la Région</td>
                  <td data-label="Montant" className={CELLULE}>Propre à chaque Région</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            La RFF existe toujours en 2026. Elle prend le relais de l&apos;ARE ou de l&apos;ASP, et
            la durée cumulée de versement des deux ne dépasse pas 3 ans pour une même formation.
            Les montants de la RFFT et de la RFF sont ceux de service-public (pages vérifiées le
            1er avril 2026)&nbsp;; France Travail confirme le montant de 775,65 € par mois pour 2026.
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.francetravail.fr/candidat/en-formation/les-dispositifs/la-remuneration-pendant-la-forma.html">
              France Travail
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F760">
              fiche F760 (RFFT)
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F292">
              fiche F292 (RFF)
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="poei" number="05" title="La POEI : se former avant l'embauche">
          <p>
            La préparation opérationnelle à l&apos;emploi individuelle (POEI) finance une formation
            avant l&apos;embauche pour vous préparer à un poste précis. L&apos;employeur s&apos;engage
            ensuite à vous recruter en CDI, en CDD d&apos;au moins 6 mois, en contrat saisonnier
            d&apos;au moins 4 mois ou en contrat d&apos;alternance pour plus de 6 mois.
          </p>
          <p>Sa durée maximale dépend du lieu de formation&nbsp;:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>450 heures dans un organisme de formation certifié Qualiopi&nbsp;;</li>
            <li>jusqu&apos;à 600 heures pour les publics prioritaires&nbsp;;</li>
            <li>300 heures si la formation se fait entièrement en tutorat dans l&apos;entreprise.</li>
          </ul>
          <p>
            Pendant la POEI, vous gardez le statut de stagiaire de la formation
            professionnelle&nbsp;: ARE formation si vous êtes indemnisé, sinon rémunération de
            formation de France Travail. L&apos;employeur reçoit jusqu&apos;à 5 € net par heure de
            formation en tutorat interne et peut obtenir un cofinancement de son OPCO, un argument
            à rappeler au recruteur. S&apos;il vous embauche ensuite en alternance, notre guide{' '}
            <Link href="/alternance/" className="lien">
              Alternance 2026
            </Link>{' '}
            détaille ses aides.
          </p>
          <p>
            La POEC en est la version collective&nbsp;: une branche identifie un besoin de
            recrutement et France Travail finance une formation courte, de quelques jours à 400
            heures au plus. En 2026, France Travail vise 25 000 préparations opérationnelles à
            l&apos;emploi dans les seuls secteurs industriels.
          </p>
          <Callout tone="warn" title="L'AFPR n'existe plus">
            France Travail l&apos;a supprimée en 2024 et a élargi la POEI aux CDD d&apos;au moins
            6 mois. Si une offre parle encore d&apos;AFPR, demandez une POEI à votre conseiller ou
            au recruteur.
          </Callout>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.francetravail.fr/employeur/aides-aux-recrutements/les-aides-a-la-formation/la-preparation-operationnelle-a.html">
              France Travail, la POEI
            </Source>
            {' · '}
            <Source href="https://www.francetravail.fr/actualites/a-laffiche/2026/cpf-aif-poec-quel-financement.html">
              France Travail, la POEC
            </Source>
            {' · '}
            <Source href="https://bo.francetravail.org/bulletinsofficiels/deliberation-n-2024-30-du-24-avril-2024-bo-n-2024-23.html?type=dossiers%2F2024%2Fbo-n-2024-23-du-30-avril-2024">
              délibération n° 2024-30 de France Travail
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="cas-particuliers" number="06" title="Handicap, CSP, permis : les cas particuliers">
          <p>
            En situation de handicap, votre CPF est crédité de 800 € par an, dans la limite de
            8 000 €, et l&apos;Agefiph peut financer les aménagements de formation nécessaires. En
            contrat de sécurisation professionnelle (CSP), le reclassement peut passer
            par une formation financée notamment par l&apos;AIF. L&apos;aide au permis B de France
            Travail, elle, est supprimée depuis le 1er avril 2026.
          </p>
          <p>
            <strong>Handicap.</strong>{' '}Les aménagements financés par l&apos;Agefiph viennent en
            complément des autres financeurs. Elle verse aussi une aide au parcours vers
            l&apos;emploi de 530 € au plus aux personnes handicapées confrontées à de graves
            difficultés financières&nbsp;: déplacements vers une formation ou un entretien de
            recrutement, hébergement et repas, ou vêtements de travail. C&apos;est votre conseiller
            France Travail, Cap emploi ou Mission locale qui fait la demande.
          </p>
          <p>
            <strong>CSP.</strong>{' '}Le contrat de sécurisation professionnelle dure 12 mois au
            plus, avec un accompagnement de France Travail vers un reclassement rapide. Refuser sans
            motif légitime une action de reclassement et de formation y met fin&nbsp;: parlez de
            votre projet à votre conseiller dès le début.
          </p>
          <p>
            <strong>Permis.</strong>{' '}La préparation aux épreuves reste finançable par le CPF.
            Votre conseiller peut vérifier si une autre aide existe sur votre territoire.
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.agefiph.fr/centre-aide/se-former">Agefiph, se former</Source>
            {' · '}
            <Source href="https://www.agefiph.fr/aides-financieres/aide-au-parcours-vers-lemploi-des-personnes-en-situation-de-handicap">
              Agefiph, aide au parcours vers l&apos;emploi
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F13819">
              fiche F13819 (CSP)
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/actualites/A18840">
              service-public.gouv.fr (permis)
            </Source>
          </p>
        </GuideSection>

        <QuestionsFrequentes questions={QUESTIONS} />
      </GuideBody>

      <GuideCta
        title="Faites le point sur votre cas"
        text="Le simulateur part de votre situation de demandeur d'emploi et recherche les aides qui s'y appliquent, chacune avec sa source. Gratuit, sans inscription."
        href="/simulateur/"
        label="Estimer mon financement"
      />
    </main>
  );
}
