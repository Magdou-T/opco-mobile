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

export const metadata: Metadata = metadonnees(PAGES.cpf);

/** Fil d'Ariane : la page dépend directement de l'accueil. */
const FIL = { page: 'CPF' };

/**
 * Questions fréquentes : affichées en dernière section et reprises mot pour mot dans les données structurées. Chaque
 * réponse vient du dossier de faits vérifiés du 27/11/2026 (service-public.gouv.fr, moncompteformation.gouv.fr, Sénat).
 */
const QUESTIONS: QuestionReponse[] = [
  {
    question: 'Combien coûte une formation CPF en 2026 ?',
    reponse:
      "Depuis avril 2026, vous payez 150 € à chaque achat de formation avec votre CPF, au moment de l'inscription. Pour une formation à 1 000 €, vous mobilisez donc 850 € de droits. Vous êtes exonéré si vous êtes demandeur d'emploi, si votre employeur abonde la formation ou si votre OPCO la finance.",
  },
  {
    question: 'Faudra-t-il payer un complément de 200 € en 2027 ?',
    reponse:
      'Peut-être. Pour toute formation validée depuis le 2 octobre 2026, Mon Compte Formation annonce un complément pouvant atteindre 200 €, à régler en 2027 si le projet de loi de finances est adopté. Au 27 novembre 2026, ce texte est en discussion au Parlement : vérifiez le montant affiché en validant votre dossier.',
  },
  {
    question: "Combien d'argent reçoit-on sur son CPF chaque année ?",
    reponse:
      "Si vous travaillez au moins à mi-temps, votre CPF reçoit 500 € par an, jusqu'à 5 000 €. Les salariés peu qualifiés, les travailleurs handicapés et les victimes d'accident du travail avec au moins 10 % d'incapacité permanente reçoivent 800 € par an, jusqu'à 8 000 €. En dessous d'un mi-temps, le calcul se fait au prorata.",
  },
  {
    question: 'Peut-on financer le permis B avec son CPF quand on est salarié ?',
    reponse:
      "Oui, si un tiers cofinance au moins 100 € : votre employeur, votre OPCO ou une collectivité, par exemple. Le permis doit servir votre projet professionnel et vous ne devez détenir aucun permis valide. Votre CPF couvre alors 900 € au plus. Les demandeurs d'emploi inscrits à France Travail restent éligibles sans cofinancement.",
  },
  {
    question: 'Mon employeur peut-il refuser ma formation CPF ?',
    reponse:
      "Oui, si elle a lieu pendant votre temps de travail. Demandez son accord au moins 60 jours avant, 120 jours si la formation dure plus de 6 mois ; son silence pendant 30 jours calendaires vaut accord. Hors temps de travail, aucun accord n'est nécessaire, mais ces heures ne sont pas rémunérées.",
  },
  {
    question: 'Quel est le plafond du CPF pour un bilan de compétences ?',
    reponse:
      "Depuis le 26 février 2026, votre CPF finance au plus 1 600 € d'un bilan de compétences, si vous n'avez eu aucun bilan financé dans les cinq années précédant votre demande. La participation de 150 € s'applique, sauf exonération. Le bilan dure 24 heures au maximum.",
  },
  {
    question: 'Que faire après un appel ou un SMS au nom de Mon Compte Formation ?',
    reponse:
      "Ne cliquez sur aucun lien et ne donnez jamais votre mot de passe. Transférez le SMS au 33 700 et signalez l'appel commercial sur SignalConso. Si vos droits ont été utilisés à votre insu, changez votre mot de passe, portez plainte, puis signalez la fraude depuis votre espace.",
  },
];

const GRAPHE = grapheDePage({
  chemin: PAGES.cpf.chemin,
  titre: PAGES.cpf.titre,
  description: PAGES.cpf.description,
  type: 'Article',
  nomCourt: FIL.page,
  questions: QUESTIONS,
  modifieLe: REVUE_DES_GUIDES,
  publieLe: REVUE_DES_GUIDES,
});

const TOC = [
  { id: 'droits', label: 'Combien vous avez' },
  { id: 'reste-a-charge', label: 'Le reste à charge en 2026' },
  { id: 'formations', label: 'Ce que vous pouvez financer' },
  { id: 'temps-de-travail', label: 'Pendant ou hors temps de travail' },
  { id: 'abondements', label: 'Compléter votre solde' },
  { id: 'arnaques', label: 'Se protéger des arnaques' },
  { id: 'questions', label: 'Questions fréquentes' },
];

export default function CpfPage() {
  return (
    <main>
      <DonneesStructurees graphe={GRAPHE} />
      <GuideHero
        fil={FIL}
        revue={REVUE_DES_GUIDES}
        eyebrow="Guide · compte personnel de formation"
        title={
          <>
            CPF 2026&nbsp;: ce que vous avez,
            <br />
            ce que vous <span className="mark">payez</span>
          </>
        }
        lead="Chaque année de travail alimente votre compte personnel de formation. Depuis avril 2026, chaque achat vous coûte aussi 150 €, sauf exonération, et le budget 2027 pourrait alourdir la note. Voici les règles en vigueur au 27 novembre 2026, sources officielles à l'appui."
      />

      <GuideBody toc={TOC}>
        <GuideSection id="droits" number="01" title="Combien d'argent sur votre CPF">
          <p>
            Si vous travaillez au moins à mi-temps, votre CPF reçoit 500 € par année de travail,
            jusqu&apos;à 5 000 €. Les salariés peu qualifiés, les travailleurs handicapés et les
            victimes d&apos;accident du travail avec au moins 10 % d&apos;incapacité reçoivent
            800 € par an, jusqu&apos;à 8 000 €. Les droits d&apos;une année sont crédités
            l&apos;année suivante, au plus tard le 15 juin.
          </p>
          {/* Sous 640 px, chaque ligne devient une carte (en-têtes repris devant chaque cellule) : aucun défilement. */}
          <div className="overflow-clip rounded-carte border border-filet bg-white shadow-douce">
            <table className="w-full text-sm max-sm:block">
              <caption className="sr-only">Alimentation annuelle et plafond du CPF selon votre situation</caption>
              <thead className="bg-lin-soft max-sm:sr-only">
                <tr>
                  <th scope="col" className={EN_TETE}>Votre situation</th>
                  <th scope="col" className={EN_TETE}>Par année</th>
                  <th scope="col" className={EN_TETE}>Plafond</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet max-sm:block">
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Salarié au moins à mi-temps</th>
                  <td data-label="Par année" className={CELLULE}>500 €</td>
                  <td data-label="Plafond" className={CELLULE}>5 000 €</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Travailleur indépendant</th>
                  <td data-label="Par année" className={CELLULE}>500 € par année d&apos;activité, au prorata si elle a été partielle</td>
                  <td data-label="Plafond" className={CELLULE}>5 000 €</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Salarié peu qualifié (sans CAP, BEP, titre de niveau 3 du RNCP ni certification reconnue par la convention collective), au moins à mi-temps</th>
                  <td data-label="Par année" className={CELLULE}>800 €</td>
                  <td data-label="Plafond" className={CELLULE}>8 000 €</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Travailleur handicapé ou bénéficiaire de l&apos;obligation d&apos;emploi, salarié au moins à mi-temps</th>
                  <td data-label="Par année" className={CELLULE}>800 €</td>
                  <td data-label="Plafond" className={CELLULE}>8 000 €</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Victime d&apos;accident du travail ou de maladie professionnelle (incapacité permanente d&apos;au moins 10 %)</th>
                  <td data-label="Par année" className={CELLULE}>800 €</td>
                  <td data-label="Plafond" className={CELLULE}>8 000 €</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Travailleur accueilli en ESAT</th>
                  <td data-label="Par année" className={CELLULE}>800 € par année d&apos;admission, selon l&apos;article R6323-29 du code du travail</td>
                  <td data-label="Plafond" className={CELLULE}>8 000 €</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            En dessous d&apos;un mi-temps, le calcul se fait au prorata. L&apos;exemple de
            service-public.gouv.fr : 700 heures travaillées dans l&apos;année, pour une durée légale
            de 1 607 heures, donnent 217,80 € au lieu de 500 €.
          </p>
          <p>
            Maternité, paternité, adoption, congé parental d&apos;éducation, présence parentale,
            proche aidant, accident du travail ou maladie professionnelle : ces absences comptent
            pour l&apos;alimentation du compte. Si votre employeur ne connaît pas votre handicap,
            déclarez-le vous-même sur Mon Compte Formation pour obtenir la majoration. Les sommes
            inscrites ne sont pas imposables.
          </p>
          <Callout tone="info" title="Démission, fonction publique : vos droits vous suivent">
            Vous gardez vos droits CPF quel que soit le motif du départ : démission, licenciement
            ou rupture conventionnelle. Si vous devenez fonctionnaire, un second CPF s&apos;ouvre,
            alimenté en heures et non en euros ; les droits acquis dans le privé sont conservés.
          </Callout>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F10705">
              service-public.gouv.fr, fiche F10705
            </Source>
            {' · '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/les-personnes-en-situation-de-handicap">
              Mon Compte Formation, handicap
            </Source>
            {' · '}
            <Source href="https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038006432">
              Code du travail, art. R6323-29
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="reste-a-charge" number="02" title="Le reste à charge en 2026 : 150 € par formation">
          <p>
            Depuis avril 2026, vous payez 150 € de votre poche à chaque achat de formation avec
            votre CPF, par carte bancaire ou virement au moment de l&apos;inscription, faute de
            quoi celle-ci n&apos;est pas validée. Vous êtes exonéré si vous êtes demandeur
            d&apos;emploi, si votre employeur abonde la formation ou si votre OPCO la finance.
          </p>
          <p>
            Cette participation existe depuis le 2 mai 2024 : 100 € au départ, 103,20 € au
            1er janvier 2026, puis 150 €. Pour une formation à 1 000 €, avec assez de droits, vous
            mobilisez 850 € de CPF et réglez 150 €.
          </p>
          <p>Vous êtes aussi exonéré si :</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>un accord de branche ou un accord de groupe finance la formation ;</li>
            <li>vous mobilisez des points de votre compte professionnel de prévention (C2P) ;</li>
            <li>
              vous avez droit à l&apos;abondement accident du travail ou maladie professionnelle
              (incapacité permanente d&apos;au moins 10 %).
            </li>
          </ul>
          <p>
            Un abondement du compte d&apos;engagement citoyen ou d&apos;un fonds d&apos;assurance
            formation des indépendants ne vous exonère pas. Seuls votre employeur ou votre OPCO
            peuvent prendre ces 150 € en charge à votre place. Le montant est revu chaque
            1er janvier : celui de 2027 n&apos;est pas connu au 27 novembre 2026.
          </p>

          <h3 className={SOUS_TITRE}>Projet de loi de finances pour 2027 : envisagé, pas adopté</h3>
          <p>
            Mon Compte Formation prévient que toute formation validée à partir du 2 octobre 2026
            peut donner lieu, en 2027, à un complément pouvant atteindre 200 €, si le projet de loi
            de finances pour 2027 est adopté. En confirmant l&apos;achat, vous vous engagez à le
            régler le cas échéant : le reste à charge pourrait atteindre 350 €.
          </p>
          <p>
            Le texte en cause est l&apos;article 89 de ce projet, déposé le 1er octobre 2026 : il
            viserait les demandes faites à compter de cette date et renvoie le montant de la
            majoration à un décret.
          </p>
          <p>
            Seraient épargnés : les formations des secteurs prioritaires (défense, industrie,
            souveraineté alimentaire, transition écologique, numérique, médico-social), dont la
            liste doit être fixée par arrêté en 2027 ; la plupart des formations cofinancées par un
            tiers à hauteur d&apos;au moins 150 € ; la VAE ; les travailleurs en ESAT. Demandeur
            d&apos;emploi, vous resteriez exonéré pour une formation prioritaire ou cofinancée, et
            paieriez sinon la participation de base, sans majoration.
          </p>
          <p>
            Au 27 novembre 2026, le texte est en discussion au Parlement. Faute d&apos;adoption de sa
            première partie, il a été considéré comme rejeté par l&apos;Assemblée nationale le
            4 novembre, puis transmis au Sénat le 19 novembre ; la séance publique y est prévue
            jusqu&apos;au 9 décembre. Le 19 novembre, la commission des finances du Sénat a proposé
            sept amendements à l&apos;article 89, dont le maintien de l&apos;exonération pour les
            demandeurs d&apos;emploi les plus éloignés de l&apos;emploi. Une proposition de
            commission ne vaut pas adoption.
          </p>
          <Callout tone="warn" title="Rien n'est adopté : vérifiez le montant au moment de valider">
            Un projet de loi de finances n&apos;est pas une loi tant que le Parlement ne l&apos;a
            pas adopté définitivement ; service-public.gouv.fr rappelle que les règles actuelles
            restent valables en attendant. Avant de confirmer un achat, vérifiez le montant affiché
            sur Mon Compte Formation au moment de valider votre dossier.
          </Callout>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/actualites/A17364">
              service-public.gouv.fr, A17364
            </Source>
            {' · '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/une-participation-financiere-obligatoire-pour-mobiliser-vos-droits-cpf">
              Mon Compte Formation, participation
            </Source>
            {' · '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/evolution-des-regles-dutilisation-du-cpf-compter-du-2-octobre-2026">
              règles au 2 octobre 2026
            </Source>
            {' · '}
            <Source href="https://www.assemblee-nationale.fr/dyn/opendata/PRJLANR5L17B3210.html">
              projet de loi n° 3210
            </Source>
            {' · '}
            <Source href="https://www.senat.fr/rap/l26-156-332/l26-156-332_mono.html">
              rapport du Sénat
            </Source>
            {' · '}
            <Source href="https://www.senat.fr/dossier-legislatif/pjlf2027.html">
              dossier législatif
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F10705">
              fiche F10705
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="formations" number="03" title="Ce que votre CPF peut financer">
          <p>
            Votre CPF finance sans plafond les formations qui préparent une certification inscrite
            au RNCP : diplômes, titres professionnels, CQP. Depuis le 26 février 2026, trois
            actions sont plafonnées sur vos droits : 1 500 € pour une certification du Répertoire
            spécifique, 1 600 € pour un bilan de compétences et 900 € pour le permis voiture ou
            moto.
          </p>
          <div className="overflow-clip rounded-carte border border-filet bg-white shadow-douce">
            <table className="w-full text-sm max-sm:block">
              <caption className="sr-only">Plafonds 2026 de vos droits CPF par type d&apos;action</caption>
              <thead className="bg-lin-soft max-sm:sr-only">
                <tr>
                  <th scope="col" className={EN_TETE}>Action</th>
                  <th scope="col" className={EN_TETE}>Plafond de vos droits CPF</th>
                  <th scope="col" className={EN_TETE}>Conditions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet max-sm:block">
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Certification inscrite au RNCP (diplôme, titre professionnel, CQP)</th>
                  <td data-label="Plafond de vos droits CPF" className={CELLULE}>Aucun plafond</td>
                  <td data-label="Conditions" className={CELLULE}>La formation prépare la certification</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Certification du Répertoire spécifique (habilitation électrique, CACES, TOEIC, certification informatique)</th>
                  <td data-label="Plafond de vos droits CPF" className={CELLULE}>1 500 €</td>
                  <td data-label="Conditions" className={CELLULE}>Exception : la certification CléA reste sans plafond</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Bilan de compétences</th>
                  <td data-label="Plafond de vos droits CPF" className={CELLULE}>1 600 €</td>
                  <td data-label="Conditions" className={CELLULE}>Aucun bilan financé au cours des cinq années précédant votre demande, quel que soit le financeur selon Mon Compte Formation</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Permis du groupe léger (A1, A2, B, B1, BE)</th>
                  <td data-label="Plafond de vos droits CPF" className={CELLULE}>900 €</td>
                  <td data-label="Conditions" className={CELLULE}>Demandeur d&apos;emploi inscrit à France Travail, ou salarié avec un cofinancement d&apos;au moins 100 € ; permis utile à votre projet professionnel ; aucun permis en cours de validité, ni suspension, ni interdiction</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Permis poids lourd et transport de personnes (C1, C1E, C, CE, D1, D1E, D, DE)</th>
                  <td data-label="Plafond de vos droits CPF" className={CELLULE}>Aucun plafond</td>
                  <td data-label="Conditions" className={CELLULE}>Ouverts à tous les titulaires</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Le plafond porte sur vos droits CPF : un cofinancement de votre employeur, de la Région
            ou de votre OPCO peut compléter au-delà.
          </p>
          <p>
            Le CPF finance aussi l&apos;accompagnement à la VAE, le socle CléA et les formations des
            bénévoles et des volontaires en service civique. Pour créer ou reprendre une entreprise,
            la formation doit déboucher sur une certification (RNCP ou Répertoire spécifique) depuis
            le 16 février 2025. Les organismes étrangers sont exclus. VAE et bilan sont détaillés sur
            notre page{' '}
            <Link href="/salaries/#vae-bilan" className="lien">
              Salariés
            </Link>
            , les sigles dans le{' '}
            <Link href="/lexique/" className="lien">
              lexique
            </Link>
            .
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/de-nouvelles-regles-pour-mobiliser-votre-cpf">
              Mon Compte Formation, nouvelles règles
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/actualites/A18831">
              service-public.gouv.fr, A18831
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F10705">
              fiche F10705
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="temps-de-travail" number="04" title="Pendant ou hors temps de travail">
          <p>
            Hors temps de travail, vous utilisez votre CPF librement, sans l&apos;accord de votre
            employeur, mais ces heures ne sont pas rémunérées. Sur votre temps de travail, il faut
            son autorisation : demandez-la au moins 60 jours avant le début de la formation,
            120 jours si elle dure plus de 6 mois. Il a 30 jours calendaires pour répondre.
          </p>
          <p>
            Sans réponse dans ce délai, la demande est acceptée, et votre rémunération est maintenue
            pendant la formation. Le soir, le week-end, les congés et les RTT comptent comme hors
            temps de travail.
          </p>
          <p>
            Votre employeur ne peut pas vous imposer d&apos;utiliser votre CPF, et refuser ne
            constitue pas une faute. Une formation utile à votre poste relève plutôt du plan de
            développement des compétences : voir notre page{' '}
            <Link href="/salaries/" className="lien">
              Salariés
            </Link>
            .
          </p>
          <p className="text-sm text-texte-discret">
            Source :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F10705">
              service-public.gouv.fr, fiche F10705
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="abondements" number="05" title="Compléter votre solde : les abondements">
          <p>
            Si votre solde ne couvre pas le prix de la formation, d&apos;autres financeurs peuvent
            compléter : votre employeur, votre OPCO, France Travail, la Région, l&apos;Agefiph, le
            département, la commune ou l&apos;Assurance maladie. Un abondement de l&apos;employeur
            ou un financement de l&apos;OPCO vous dispense en outre de la participation de 150 €.
          </p>
          <p>
            Votre employeur verse sa dotation depuis l&apos;espace des employeurs et des financeurs
            de Mon Compte Formation (EDEF). De votre côté :
          </p>
          <ol className="max-w-[34rem] list-decimal space-y-2 pl-5">
            <li>choisissez la formation sur Mon Compte Formation ;</li>
            <li>téléchargez le PDF de demande de financement ;</li>
            <li>
              transmettez-le à votre employeur. À l&apos;achat, sa dotation est déduite en priorité,
              vos droits complètent.
            </li>
          </ol>
          <p>
            Les autres financeurs fixent leurs règles : ils peuvent réserver leur abondement à
            certaines formations, imposer un délai d&apos;utilisation et réclamer les sommes non
            utilisées. Montants et publics varient : renseignez-vous auprès de chacun.
          </p>
          <Callout tone="ok" title="Entreprise d'au moins 50 salariés : 3 000 € possibles">
            Votre employeur doit verser 3 000 € sur votre CPF s&apos;il a manqué à ses obligations
            d&apos;entretiens et de formation sur 8 ans. Conditions sur notre page{' '}
            <Link href="/salaries/#entretien" className="lien">
              Salariés
            </Link>
            .
          </Callout>
          <p>
            Sans emploi, voyez la page{' '}
            <Link href="/demandeurs-emploi/" className="lien">
              Demandeurs d&apos;emploi
            </Link>
            . Employeur, la page{' '}
            <Link href="/employeurs/" className="lien">
              Employeurs
            </Link>
            {' '}et le guide{' '}
            <Link href="/former-sans-budget/" className="lien">
              Se former sans budget
            </Link>
            . Le{' '}
            <Link href="/simulateur/" className="lien">
              simulateur
            </Link>
            {' '}recense les autres financements possibles.
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://politiques-sociales.caissedesdepots.fr/formation-professionnelle/soutenir-le-projet-dun-de-mes-salaries-les-dotations">
              Caisse des Dépôts, dotations
            </Source>
            {' · '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/dotation-volontaire-employeur">
              Mon Compte Formation, dotation
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F10705">
              fiche F10705
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="arnaques" number="06" title="Arnaques au CPF : se protéger et signaler">
          <p>
            Selon la loi du 19 décembre 2022, personne n&apos;a le droit de démarcher les titulaires
            du CPF, que ce soit par téléphone, SMS, e-mail ou réseaux sociaux. Un appel ou un
            message au nom de Mon Compte Formation doit donc vous alerter. Pour acheter une
            formation, vous devez vous identifier avec FranceConnect+.
          </p>
          <p>
            FranceConnect+ fonctionne avec l&apos;Identité Numérique La Poste ou une identité
            numérique certifiée France Identité. Sans smartphone, mineur ou sans titre
            compatible, demandez une vérification manuelle : comptez environ quatre semaines.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>SMS suspect : ne cliquez sur aucun lien et transférez-le au 33 700.</li>
            <li>Appel commercial non sollicité : signalez-le sur SignalConso.</li>
            <li>Un doute : Info Escroqueries répond gratuitement au 0 805 805 817.</li>
            <li>Mot de passe : ne le communiquez jamais. Vos droits ne se donnent ni ne se vendent.</li>
          </ul>
          <p>Si vos droits ont été utilisés à votre insu :</p>
          <ol className="max-w-[34rem] list-decimal space-y-2 pl-5">
            <li>changez votre mot de passe et conservez les preuves ;</li>
            <li>portez plainte : la restitution de vos droits dépend de l&apos;analyse de votre plainte ;</li>
            <li>
              signalez l&apos;escroquerie depuis votre espace, rubrique «&nbsp;Besoin
              d&apos;aide&nbsp;» puis «&nbsp;Signalement de fraude&nbsp;».
            </li>
          </ol>
          <Callout tone="warn" title="On vous propose de rembourser les 150 € : méfiance">
            Selon Mon Compte Formation, un organisme de formation n&apos;a pas le droit de vous
            proposer le remboursement de la participation obligatoire. Une telle offre est un signal
            d&apos;alerte.
          </Callout>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/je-ne-remplis-pas-les-conditions-pour-utiliser-franceconnect-0">
              Mon Compte Formation, FranceConnect+
            </Source>
            {' · '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/comment-signaler-une-escroquerie-sur-mon-compte-formation">
              signaler une escroquerie
            </Source>
            {' · '}
            <Source href="https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046760877">
              loi n° 2022-1587
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F10705">
              fiche F10705
            </Source>
          </p>
        </GuideSection>

        <QuestionsFrequentes questions={QUESTIONS} />
      </GuideBody>

      <GuideCta
        title="Trouvez ce qui complète votre CPF"
        text="En six étapes, le simulateur passe en revue les financements de votre projet : OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe."
        href="/simulateur/"
        label="Estimer mon financement"
      />
    </main>
  );
}
