import type { Metadata } from 'next';
import Link from 'next/link';
import { EMBEDDED_OPCOS } from '@opco/core';
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
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { trierParNom } from '@/lib/fiche';
import { grapheDePage } from '@/lib/donnees-structurees';
import type { QuestionReponse } from '@/lib/donnees-structurees';
import { PAGES, REVUE_DES_GUIDES, metadonnees } from '@/lib/metadonnees';
import { FORMATION_OBLIGATOIRE_ENTREPRISE } from '@/lib/sites-lies';

/* Page d'entrée des employeurs : ce que l'OPCO finance selon la taille, puis les guides détaillés. Faits tirés des
   dossiers vérifiés du 27/11/2026 et des guides du site (taux de la contribution formation, règle des 50 salariés,
   actions collectives) ; chaque section cite ses sources. */

/* Tableau « selon la taille » : même dessin que celui de « Comprendre les OPCO » (en-tête en petites majuscules ; sous
   640 px, une carte par ligne, l'en-tête de colonne repris devant chaque cellule). */
const EN_TETE = 'px-4 py-3 text-left text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase sm:px-5';
const LIGNE = 'align-top max-sm:block max-sm:px-4 max-sm:py-4';
const TITRE_LIGNE = 'px-4 py-3.5 text-left leading-snug font-semibold text-texte sm:px-5 max-sm:block max-sm:p-0';
const CELLULE =
  'px-4 py-3.5 leading-relaxed text-texte-doux sm:px-5 max-sm:mt-2 max-sm:block max-sm:p-0 max-sm:before:block max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:tracking-[0.12em] max-sm:before:text-texte-discret max-sm:before:uppercase max-sm:before:content-[attr(data-label)]';

export const metadata: Metadata = metadonnees(PAGES.employeurs);

/** Questions fréquentes : affichées en fin de page et reprises mot pour mot dans les données structurées. */
const QUESTIONS: QuestionReponse[] = [
  {
    question: "Entreprise de 50 salariés ou plus : l'OPCO finance-t-il la formation ?",
    reponse:
      "En partie. Sur ses fonds légaux, l'OPCO ne prend en charge le plan de développement des compétences que sous 50 salariés. L'alternance et la période de reconversion restent financées quelle que soit la taille. À partir de 50 salariés, le plan relève de votre budget, sauf fonds conventionnels de la branche ou versements volontaires à l'OPCO.",
  },
  {
    question: "Comment faire financer la formation d'un candidat avant de l'embaucher ?",
    reponse:
      "Avec la POEI, France Travail finance la formation d'un demandeur d'emploi avant son embauche : jusqu'à 450 heures en organisme, ou 300 heures en tutorat interne indemnisées jusqu'à 5 € net de l'heure. Vous vous engagez à le recruter : CDI, CDD d'au moins 6 mois, contrat saisonnier d'au moins 4 mois ou alternance de plus de 6 mois.",
  },
  {
    question: 'Le FNE-Formation est-il encore possible ?',
    reponse:
      "Non pour un nouveau projet. Selon les documents budgétaires de l'État, le FNE-Formation ne fait plus l'objet de conventions depuis 2025 ; les crédits prévus pour 2027 servent seulement à payer les conventions déjà signées. Pour financer des formations liées aux transitions de votre secteur, interrogez votre OPCO et la DREETS de votre région.",
  },
  {
    question: "L'Agefiph aide-t-elle à embaucher une personne handicapée en alternance ?",
    reponse:
      "Oui. L'Agefiph verse à l'employeur jusqu'à 3 000 € pour un contrat d'apprentissage ou de professionnalisation d'au moins 6 mois, selon sa durée : pour un apprenti, 500 € pour un contrat de 6 mois et 3 000 € pour un CDI. Côté État, l'aide à l'embauche atteint 6 000 € pour un apprenti reconnu travailleur handicapé, quelle que soit la taille de l'entreprise.",
  },
  {
    question: 'La Région peut-elle aider mon entreprise à former ses salariés ?',
    reponse:
      "Cela dépend de votre Région : ses aides aux entreprises varient d'une Région à l'autre, et nous n'avons trouvé aucune règle nationale. Consultez le site de votre conseil régional. Les Régions financent aussi des formations pour les demandeurs d'emploi, ce qui peut vous aider à recruter des candidats déjà formés. Pour vos salariés, le premier interlocuteur reste votre OPCO.",
  },
  {
    question: "Qu'est-ce que la RGDU change pour les cotisations patronales ?",
    reponse:
      "Depuis le 1er janvier 2026, la réduction générale des cotisations patronales est devenue la réduction générale dégressive unique (RGDU). Elle s'applique aux salaires inférieurs à 3 Smic, pour tous les types de contrats, y compris l'alternance et le temps partiel. Pour un apprenti du secteur privé, il n'existe plus d'exonération patronale propre à l'apprentissage : c'est la RGDU qui joue.",
  },
];

const GRAPHE = grapheDePage({
  chemin: PAGES.employeurs.chemin,
  titre: PAGES.employeurs.titre,
  description: PAGES.employeurs.description,
  type: 'Article',
  nomCourt: 'Employeurs',
  questions: QUESTIONS,
  modifieLe: REVUE_DES_GUIDES,
  publieLe: REVUE_DES_GUIDES,
});

const TOC = [
  { id: 'taille', label: "Ce que finance l'OPCO selon votre taille" },
  { id: 'alternance', label: "L'alternance en bref" },
  { id: 'recruter', label: "Recruter un demandeur d'emploi" },
  { id: 'disparus', label: "Ce qui n'existe plus" },
  { id: 'guides', label: 'Les guides pour aller plus loin' },
  { id: 'questions', label: 'Questions fréquentes' },
];

/** Guides détaillés, dans l'ordre où un employeur en a besoin : trouver son OPCO, puis chaque sujet. */
const GUIDES = [
  {
    href: '/quel-est-mon-opco/',
    titre: 'Quel est mon OPCO ?',
    texte: "Le rattachement par la convention collective (IDCC), où lire ce code, les 11 OPCO et leurs branches.",
  },
  {
    href: '/comprendre-les-opco/',
    titre: 'Comprendre les OPCO',
    texte: "Le rôle des opérateurs de compétences, ce qu'ils financent, la règle des 50 salariés et la période de reconversion.",
  },
  {
    href: '/obligations/',
    titre: 'Obligations des entreprises',
    texte: "Contribution formation, taxe d'apprentissage, entretien de parcours professionnel et abondement correctif.",
  },
  {
    href: '/former-sans-budget/',
    titre: 'Se former sans budget',
    texte: 'Les actions collectives des OPCO, le CPF du salarié et le cofinancement européen FSE+.',
  },
  {
    href: '/alternance/',
    titre: 'Alternance',
    texte: "Prise en charge par l'OPCO, aide à l'embauche, participation de l'employeur et salaire de l'alternant.",
  },
  {
    href: '/opco/',
    titre: 'Les 11 OPCO',
    texte: 'Une fiche par OPCO : barèmes de prise en charge 2026, frais annexes, actions collectives et sources.',
  },
];

/** Les fiches des OPCO, par ordre alphabétique (article élidé ignoré). */
const OPCOS = trierParNom(EMBEDDED_OPCOS);

export default function EmployeursPage() {
  return (
    <main>
      <DonneesStructurees graphe={GRAPHE} />
      <GuideHero
        fil={{ page: 'Employeurs' }}
        revue={REVUE_DES_GUIDES}
        eyebrow="Employeurs · vue d'ensemble"
        title={
          <>
            Financer la formation
            <br />
            de vos <span className="mark">salariés</span>
          </>
        }
        lead="Ce que votre OPCO prend en charge dépend d'abord de votre effectif : le seuil de 50 salariés décide du financement du plan de développement des compétences, pas de celui de l'alternance. Cette page fait le tri entre les financements de l'employeur, signale ceux qui ont disparu et vous oriente vers le guide qui répond à votre cas."
      />

      <GuideBody toc={TOC} etiquette="Sommaire de la page">
        <GuideSection id="taille" number="01" title="Ce que finance l'OPCO selon votre taille">
          <p>
            Votre OPCO finance l&apos;alternance et la période de reconversion quelle que soit la
            taille de l&apos;entreprise. Sur ses fonds légaux, il ne prend en charge le plan de
            développement des compétences que sous 50 salariés. À partir de 50, ce plan relève de
            votre budget, sauf contributions conventionnelles de votre branche ou versements
            volontaires à l&apos;OPCO.
          </p>
          {/* Sous 640 px, chaque ligne devient une carte (en-têtes repris devant chaque cellule) : aucun défilement. */}
          <div className="overflow-clip rounded-carte border border-filet bg-white shadow-douce">
            <table className="w-full text-sm max-sm:block">
              <caption className="sr-only">Ce que finance l&apos;OPCO selon la taille de l&apos;entreprise</caption>
              <thead className="bg-lin-soft max-sm:sr-only">
                <tr>
                  <th scope="col" className={EN_TETE}>Ce qui est financé</th>
                  <th scope="col" className={EN_TETE}>Moins de 50 salariés</th>
                  <th scope="col" className={EN_TETE}>50 salariés et plus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet max-sm:block">
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Plan de développement des compétences</th>
                  <td data-label="Moins de 50 salariés" className={CELLULE}>Fonds mutualisés de l&apos;OPCO : coûts pédagogiques, parfois salaires et frais annexes, selon les barèmes de la branche</td>
                  <td data-label="50 salariés et plus" className={CELLULE}>Budget de l&apos;entreprise, sauf fonds conventionnels de la branche ou versements volontaires</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Contrat d&apos;apprentissage</th>
                  <td data-label="Moins de 50 salariés" className={CELLULE}>Coût de formation du CFA, au niveau de prise en charge (NPEC) fixé par la branche</td>
                  <td data-label="50 salariés et plus" className={CELLULE}>Même prise en charge</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Contrat de professionnalisation</th>
                  <td data-label="Moins de 50 salariés" className={CELLULE}>Forfait horaire fixé par la branche (9,15 €/h à défaut d&apos;accord)</td>
                  <td data-label="50 salariés et plus" className={CELLULE}>Même prise en charge</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Période de reconversion</th>
                  <td data-label="Moins de 50 salariés" className={CELLULE}>9,15 €/h à défaut d&apos;accord de branche</td>
                  <td data-label="50 salariés et plus" className={CELLULE}>Même prise en charge</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Actions collectives de l&apos;OPCO</th>
                  <td data-label="Moins de 50 salariés" className={CELLULE}>Souvent prises en charge à 100 %, dans la limite des places et des fonds</td>
                  <td data-label="50 salariés et plus" className={CELLULE}>Selon l&apos;OPCO : certains catalogues sont réservés aux moins de 50 salariés</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Votre entreprise finance déjà ce système par sa contribution à la formation
            professionnelle (0,55 % sous 11 salariés, 1 % à partir de 11), collectée par
            l&apos;Urssaf (ou la MSA) via la DSN. À partir de 50 salariés, cette contribution est un impôt
            affecté, pas une cagnotte à récupérer. Pour un projet précis, vous pouvez aussi abonder
            le CPF d&apos;un salarié depuis l&apos;espace des employeurs et des financeurs (EDEF) :
            votre dotation est déduite en priorité, et le salarié ne paie pas la participation
            forfaitaire de 150 €.
          </p>
          <Callout tone="warn" title="50 salariés et plus : l'abondement correctif de 3 000 €">
            Si un salarié n&apos;a eu, sur les 8 dernières années, ni ses entretiens de parcours
            professionnel ni aucune formation non obligatoire, vous devez verser 3 000 € sur son
            CPF. Le premier entretien a lieu au cours de la première année, puis tous les 4 ans.
          </Callout>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.legifrance.gouv.fr/codes/id/LEGISCTA000037387475">
              Code du travail, art. L.6332-14 à L.6332-17-1
            </Source>
            {' · '}
            <Source href="https://www.francecompetences.fr/fiche-ruf/le-soutien-au-plan-de-developpement-des-competences-des-entreprises/">
              France compétences
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F22570">
              service-public.gouv.fr (contribution formation)
            </Source>
            {' · '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/dotation-volontaire-employeur">
              Mon Compte Formation (dotation de l&apos;employeur)
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F32040">
              service-public.gouv.fr (entretien et abondement correctif)
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="alternance" number="02" title="L'alternance en bref">
          <p>
            L&apos;OPCO finance la formation de vos alternants quelle que soit votre taille : le
            coût du CFA pour un apprenti, un forfait horaire pour un contrat de
            professionnalisation. L&apos;État ajoute une aide à l&apos;embauche des apprentis qui,
            pour les contrats conclus depuis le 8 mars 2026, dépend de la taille de
            l&apos;entreprise et du niveau du diplôme.
          </p>
          <p>Pour un contrat d&apos;apprentissage qui commence avant le 1er janvier 2027&nbsp;:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Moins de 250 salariés : 5 000 € jusqu&apos;au bac, 4 500 € à bac+2, 2 000 € à
              bac+3 et plus.
            </li>
            <li>
              250 salariés et plus : 2 000 €, 1 500 € et 750 € pour les mêmes niveaux, sous
              condition d&apos;un quota d&apos;alternants.
            </li>
            <li>Apprenti reconnu travailleur handicapé : 6 000 €, quelle que soit la taille.</li>
            <li>
              Diplôme de niveau 6 ou plus (bac+3 et au-delà) : vous versez une participation de
              750 € par contrat depuis le 1er juillet 2025.
            </li>
          </ul>
          <p>
            Pour 2027, le projet de loi de finances prévoit de reconduire ces montants, mais nous
            n&apos;avions trouvé aucun décret au 27 novembre 2026. Seule l&apos;aide unique de
            5 000 € (moins de 250 salariés, diplôme jusqu&apos;au bac) ne dépend d&apos;aucune
            date : elle est inscrite dans le Code du travail. Salaire minimum de l&apos;apprenti et
            frais annexes pris en charge : voir notre guide{' '}
            <Link href="/alternance/" className="lien">
              Alternance
            </Link>
            .
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F23556">
              service-public.gouv.fr (aide à l&apos;embauche)
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18837">
              décret du 6 mars 2026
            </Source>
            {' · '}
            <Source href="https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000018498570/2026-10-04/">
              Code du travail, art. R.6332-25-1
            </Source>
            {' · '}
            <Source href="https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1128284/file/PAP%202027%20-%20Travail%20emploi%20et%20administration%20des%20minist%C3%A8res%20sociaux.pdf">
              projet annuel de performances 2027
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="recruter" number="03" title="Recruter un demandeur d'emploi">
          <p>
            Pour recruter un demandeur d&apos;emploi qui n&apos;a pas toutes les compétences du
            poste, la préparation opérationnelle à l&apos;emploi individuelle (POEI) finance sa
            formation avant l&apos;embauche. En contrat de professionnalisation, France Travail
            verse jusqu&apos;à 2 000 € à partir de 26 ans, et l&apos;État ajoute 2 000 € à partir
            de 45 ans. L&apos;Agefiph aide en plus pour une personne handicapée.
          </p>
          <p>
            <strong>La POEI</strong>{' '}prépare un candidat à un poste précis : 450 heures de
            formation au plus en organisme certifié Qualiopi, jusqu&apos;à 600 heures pour les
            publics prioritaires, 300 heures si tout se fait en tutorat dans l&apos;entreprise. En
            tutorat interne, France Travail vous verse jusqu&apos;à 5 € net par heure ; en
            organisme externe, la prise en charge est décidée sur dossier, et votre OPCO peut
            cofinancer. Vous vous engagez ensuite à le recruter : CDI, CDD d&apos;au moins 6 mois,
            contrat saisonnier d&apos;au moins 4 mois ou alternance de plus de 6 mois. Pendant la
            formation, le candidat garde son statut de stagiaire de la formation professionnelle.
          </p>
          <p>
            <strong>Le contrat de professionnalisation</strong>{' '}ouvre deux aides cumulables,
            jusqu&apos;à 4 000 € au total. Celle de France Travail, versée en deux échéances, se
            demande depuis votre espace employeur dans les 3 mois qui suivent l&apos;embauche.
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.francetravail.fr/employeur/aides-aux-recrutements/les-aides-a-la-formation/la-preparation-operationnelle-a.html">
              France Travail (POEI)
            </Source>
            {' · '}
            <Source href="https://www.francetravail.fr/employeur/aides-aux-recrutements/les-aides-a-lembauche/aide-a-lembauche-dun-demandeur-d.html">
              France Travail (aide de 2 000 €)
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F35391">
              service-public.gouv.fr (contrat de professionnalisation)
            </Source>
            {' · '}
            <Source href="https://www.agefiph.fr/aides-financieres/aide-lembauche-en-contrat-dapprentissage-dune-personne-en-situation-de-handicap">
              Agefiph
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="disparus" number="04" title="Ce qui n'existe plus">
          <p>
            Plusieurs aides encore citées en ligne n&apos;existent plus pour un nouveau projet :
            le FNE-Formation, sans nouvelle convention depuis 2025, l&apos;action de formation
            préalable au recrutement (AFPR), supprimée en 2024, l&apos;aide de 500 € au permis des
            apprentis, supprimée le 21 février 2026, et l&apos;aide exceptionnelle au contrat de
            professionnalisation, terminée pour les contrats signés après le 30 avril 2024.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>FNE-Formation</strong>{' '}: le projet de loi de finances pour 2027 ne prévoit
              que 19,85 M€, pour payer les conventions déjà signées.
            </li>
            <li>
              <strong>AFPR</strong>{' '}: France Travail l&apos;a fondue dans la POEI, élargie aux CDD
              d&apos;au moins 6 mois.
            </li>
            <li>
              <strong>Aide au permis des apprentis</strong>{' '}: supprimée par la loi de finances
              pour 2026. Si la conduite est nécessaire au poste, vous pouvez financer le permis
              par le plan de développement des compétences.
            </li>
            <li>
              <strong>Aide exceptionnelle au contrat de professionnalisation</strong>{' '}: restent
              les aides de France Travail, de l&apos;État et de l&apos;Agefiph présentées plus haut.
            </li>
          </ul>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1128284/file/PAP%202027%20-%20Travail%20emploi%20et%20administration%20des%20minist%C3%A8res%20sociaux.pdf">
              projet annuel de performances 2027 (FNE-Formation)
            </Source>
            {' · '}
            <Source href="https://bo.francetravail.org/bulletinsofficiels/deliberation-n-2024-30-du-24-avril-2024-bo-n-2024-23.html?type=dossiers%2F2024%2Fbo-n-2024-23-du-30-avril-2024">
              France Travail, délibération du 24 avril 2024 (AFPR)
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/actualites/A18840">
              service-public.gouv.fr (aide au permis)
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18873">
              service-public.gouv.fr (permis et plan de formation)
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F35391">
              service-public.gouv.fr (contrat de professionnalisation)
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="guides" number="05" title="Les guides pour aller plus loin">
          <p>
            Chaque guide traite une question en détail, avec ses sources officielles. Commencez
            par identifier votre OPCO, dont les barèmes fixent ce qu&apos;il prend en charge, puis
            ouvrez le guide qui correspond à votre projet. Les sigles de cette page sont définis
            dans le{' '}
            <Link href="/lexique/" className="lien">
              lexique
            </Link>
            . Pour savoir ce que la réglementation impose à vos salariés avant de chercher un
            financement, consultez{' '}
            <a href={FORMATION_OBLIGATOIRE_ENTREPRISE} className="lien">
              les formations obligatoires de votre entreprise
            </a>
            , sur le référentiel du même éditeur.
          </p>
          {/* Enveloppe : les cartes prennent toute la largeur de la colonne (un `ul` direct serait mesuré à 34 rem). */}
          <div>
            <ul role="list" className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {GUIDES.map((g) => (
                <Card as="li" key={g.href} interactive padding="none" className="group flex min-w-0 flex-col">
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg leading-snug font-bold tracking-[-0.01em] text-texte">
                      <Link href={g.href} className="lien-etendu">
                        {g.titre}
                      </Link>
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-texte-doux">{g.texte}</p>
                    <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-orange-deep">
                      Lire
                      <Icon name="fleche" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Card>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-texte">Accès direct aux fiches des OPCO&nbsp;:</p>
            <ul role="list" className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {OPCOS.map((o) => (
                <li key={o.slug}>
                  <Link href={`/opco/${o.slug}/`} className="lien">
                    {o.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </GuideSection>

        <QuestionsFrequentes questions={QUESTIONS} />
      </GuideBody>

      <GuideCta
        title="Chiffrez la prise en charge de votre projet"
        text="Le simulateur identifie votre OPCO à partir du nom ou du SIREN de votre entreprise et applique ses barèmes 2026 à votre projet de formation."
        href="/simulateur/"
        label="Estimer mon financement"
      />
    </main>
  );
}
