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

/* Tableaux (barème de l'aide, frais pris en charge, grille de salaire) : même dessin que le tableau « Ce que finance
   un OPCO » (comprendre-les-opco). En-tête Inter 600 en petites majuscules (texte discret, 4,95:1 sur lin-soft) ; sous
   640 px, une carte par ligne, l'en-tête de colonne repris devant chaque cellule. */
const EN_TETE = 'px-4 py-3 text-left text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase sm:px-5';
const LIGNE = 'align-top max-sm:block max-sm:px-4 max-sm:py-4';
const TITRE_LIGNE = 'px-4 py-3.5 text-left leading-snug font-semibold text-texte sm:px-5 max-sm:block max-sm:p-0';
const CELLULE =
  'px-4 py-3.5 leading-relaxed text-texte-doux sm:px-5 max-sm:mt-2 max-sm:block max-sm:p-0 max-sm:before:block max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:tracking-[0.12em] max-sm:before:text-texte-discret max-sm:before:uppercase max-sm:before:content-[attr(data-label)]';
const CARTE = 'overflow-clip rounded-carte border border-filet bg-white shadow-douce';

export const metadata: Metadata = metadonnees(PAGES.alternance);

/** Fil d'Ariane du guide : il fait partie des guides de la page Employeurs. */
const FIL = { page: 'Alternance', intermediaires: [{ nom: 'Employeurs', chemin: '/employeurs/' }] };

/* Questions fréquentes : affichées en dernière section et reprises mot pour mot dans les données structurées. Faits
   du dossier de vérification du 27/11/2026 (sections 2, 3 et 6). */
const QUESTIONS: QuestionReponse[] = [
  {
    question: "Aide à l'embauche d'un apprenti en 2026 : quel montant ?",
    reponse:
      "Pour un contrat conclu depuis le 8 mars 2026 et débutant avant 2027 : moins de 250 salariés, 5 000 € jusqu'au bac, 4 500 € à bac+2, 2 000 € à bac+3 et plus. À partir de 250 salariés : 2 000 €, 1 500 € et 750 €, sous condition d'alternants dans l'effectif. Apprenti reconnu travailleur handicapé : 6 000 €.",
  },
  {
    question: "Aide à l'apprentissage en 2027 : sera-t-elle maintenue ?",
    reponse:
      "Le projet de loi de finances pour 2027 prévoit de reconduire l'aide exceptionnelle avec les mêmes montants qu'en 2026, pour les contrats débutant à partir du 1er janvier 2027. Le décret n'était pas paru au 27 novembre 2026. À défaut, seule l'aide unique de 5 000 € s'appliquerait : entreprises de moins de 250 salariés, diplôme jusqu'au bac.",
  },
  {
    question: "Combien coûte un apprenti à l'employeur en 2026 ?",
    reponse:
      "Le coût dépend surtout du salaire : de 27 % du Smic avant 18 ans en première année à 100 % à partir de 26 ans, soit de 504,09 € à 1 867,02 € brut par mois. Les cotisations patronales bénéficient de la RGDU. Pour un bac+3 ou plus, ajoutez 750 € de participation, puis déduisez l'aide à l'embauche.",
  },
  {
    question: 'Participation de 750 € pour un apprenti : qui doit payer ?',
    reponse:
      "Depuis le 1er juillet 2025, l'employeur verse 750 € par contrat d'apprentissage préparant un diplôme de niveau 6 ou plus, soit bac+3 et au-delà. Le CFA vous envoie la facture à l'issue des 45 premiers jours. En cas de rupture pendant cette période, vous devez 50 % du financement dû, dans la limite de 750 €.",
  },
  {
    question: "Salaire d'un apprenti en 2026 : quelle grille ?",
    reponse:
      "Depuis la hausse du Smic du 1er juin 2026, en première année : 504,09 € brut avant 18 ans, 802,82 € de 18 à 20 ans, 989,52 € de 21 à 25 ans, 1 867,02 € à partir de 26 ans. Les taux augmentent chaque année. À partir de 21 ans, le minimum conventionnel s'applique s'il est plus favorable.",
  },
  {
    question: 'Existe-t-il encore une aide exceptionnelle au contrat de professionnalisation ?',
    reponse:
      "Non. Selon service-public, l'aide exceptionnelle de l'État a pris fin pour les contrats signés après le 30 avril 2024. Restent l'aide de l'État de 2 000 € pour un demandeur d'emploi de 45 ans ou plus, l'aide de France Travail pour un demandeur d'emploi de 26 ans ou plus, à faire confirmer, et celle de l'Agefiph pour une personne handicapée.",
  },
];

const GRAPHE = grapheDePage({
  chemin: PAGES.alternance.chemin,
  titre: PAGES.alternance.titre,
  description: PAGES.alternance.description,
  type: 'Article',
  nomCourt: FIL.page,
  intermediaires: FIL.intermediaires,
  modifieLe: REVUE_DES_GUIDES,
  publieLe: REVUE_DES_GUIDES,
  questions: QUESTIONS,
});

const TOC = [
  { id: 'aide-apprenti', label: "L'aide à l'embauche d'un apprenti" },
  { id: 'aide-2027', label: 'Contrats débutant en 2027' },
  { id: 'opco', label: "Ce que paie l'OPCO, ce que vous payez" },
  { id: 'salaire', label: "Salaire de l'apprenti et cotisations" },
  { id: 'professionnalisation', label: 'Le contrat de professionnalisation' },
  { id: 'demarches', label: 'En pratique : les démarches' },
  { id: 'questions', label: 'Questions fréquentes' },
];

export default function AlternancePage() {
  return (
    <main>
      <DonneesStructurees graphe={GRAPHE} />
      <GuideHero
        fil={FIL}
        revue={REVUE_DES_GUIDES}
        eyebrow="Guide · employeurs"
        title={
          <>
            Alternance 2026&nbsp;:<br />
            coût, aides et prise en charge <span className="mark">OPCO</span>
          </>
        }
        lead="Vous recrutez un apprenti ou un salarié en contrat de professionnalisation. L'OPCO finance sa formation et l'État verse une aide la première année d'un contrat d'apprentissage. Voici les montants de 2026 et ce qui reste suspendu à un décret pour les contrats de 2027."
      />

      <GuideBody toc={TOC}>
        <GuideSection id="aide-apprenti" number="01" title="L'aide à l'embauche d'un apprenti en 2026">
          <p>
            Pour un contrat d&apos;apprentissage conclu depuis le 8 mars 2026 et commencé avant le
            1er janvier 2027, l&apos;aide de la première année dépend de la taille de
            l&apos;entreprise et du diplôme&nbsp;: de 5 000 € (moins de 250 salariés, jusqu&apos;au
            bac) à 750 € (250 salariés et plus, bac+3 à bac+5). Elle atteint 6 000 € pour un
            apprenti reconnu travailleur handicapé.
          </p>
          {/* Sous 640 px, chaque ligne devient une carte (en-têtes repris devant chaque cellule) : aucun défilement. */}
          <div className={CARTE}>
            <table className="w-full text-sm max-sm:block">
              <caption className="sr-only">
                Aide à l&apos;embauche d&apos;un apprenti, première année, contrats conclus depuis le 8 mars 2026
              </caption>
              <thead className="bg-lin-soft max-sm:sr-only">
                <tr>
                  <th scope="col" className={EN_TETE}>Diplôme préparé</th>
                  <th scope="col" className={EN_TETE}>Moins de 250 salariés</th>
                  <th scope="col" className={EN_TETE}>250 salariés et plus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet max-sm:block">
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Niveaux 3 et 4 (CAP à bac)</th>
                  <td data-label="Moins de 250 salariés" className={CELLULE}>5 000 € (aide unique)</td>
                  <td data-label="250 salariés et plus" className={CELLULE}>2 000 € (aide exceptionnelle)</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Niveau 5 (bac+2)</th>
                  <td data-label="Moins de 250 salariés" className={CELLULE}>4 500 € (aide exceptionnelle)</td>
                  <td data-label="250 salariés et plus" className={CELLULE}>1 500 €</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Niveaux 6 et 7 (bac+3 à bac+5)</th>
                  <td data-label="Moins de 250 salariés" className={CELLULE}>2 000 €</td>
                  <td data-label="250 salariés et plus" className={CELLULE}>750 €</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Apprenti reconnu travailleur handicapé (niveaux 3 à 7)</th>
                  <td data-label="Moins de 250 salariés" className={CELLULE}>6 000 €</td>
                  <td data-label="250 salariés et plus" className={CELLULE}>6 000 €</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            L&apos;aide unique de 5 000 € n&apos;a pas de date limite&nbsp;: elle est inscrite dans
            le Code du travail (articles D6243-1 à D6243-4) et ne se cumule pas avec l&apos;aide
            exceptionnelle. Les autres montants relèvent de l&apos;aide exceptionnelle fixée par le
            décret n° 2026-168 du 6 mars 2026. Pour les contrats conclus du 1er janvier au 7 mars
            2026, seule l&apos;aide unique s&apos;appliquait.
          </p>
          <p>
            À partir de 250 salariés, l&apos;aide est subordonnée à un objectif d&apos;alternants
            dans l&apos;effectif, à atteindre au 31 décembre 2027. Les seuils et leur mode de calcul
            figurent sur la{' '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F23556">
              fiche F23556 de service-public
            </Source>
            &nbsp;: relisez-les avant de compter sur l&apos;aide.
          </p>
          <p>
            Pour un apprenti handicapé, l&apos;Agefiph verse aussi jusqu&apos;à 3 000 € selon la
            durée du contrat (500 € pour 6 mois, 3 000 € au plus pour un CDI), si ce contrat dure au
            moins 6 mois avec plus de 24 heures par semaine. Son cumul avec l&apos;aide de
            l&apos;État reste à confirmer auprès de l&apos;Agefiph.
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F23556">fiche F23556</Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18837">
              service-public.gouv.fr, décret n° 2026-168
            </Source>
            {' · '}
            <Source href="https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1128284/file/PAP%202027%20-%20Travail%20emploi%20et%20administration%20des%20minist%C3%A8res%20sociaux.pdf">
              projet annuel de performances 2027
            </Source>
            {' · '}
            <Source href="https://www.agefiph.fr/aides-financieres/aide-lembauche-en-contrat-dapprentissage-dune-personne-en-situation-de-handicap">
              Agefiph
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="aide-2027" number="02" title="Contrats débutant en 2027 : ce qui est prévu">
          <p>
            Pour les contrats débutant à partir du 1er janvier 2027, le projet de loi de finances
            pour 2027 prévoit de reconduire l&apos;aide exceptionnelle avec les mêmes montants
            qu&apos;en 2026. Le décret qui doit la fixer n&apos;était pas paru au 27 novembre
            2026&nbsp;: à défaut, seule l&apos;aide unique de 5 000 € resterait applicable (moins
            de 250 salariés, diplôme jusqu&apos;au bac).
          </p>
          <p>
            Le projet annuel de performances annexé au budget l&apos;écrit ainsi&nbsp;:{' '}
            «&nbsp;Pour 2027, il est prévu que l&apos;aide exceptionnelle aux employeurs
            d&apos;apprentis soit reconduite&nbsp;». Le rapport du Sénat déposé le 19 novembre 2026
            va dans le même sens. Rien n&apos;est acquis pour autant&nbsp;: le budget est en
            discussion au Parlement et le décret reste à publier.
          </p>
          <p>
            C&apos;est la date de début du contrat qui compte, pas celle de sa signature. Un
            contrat conclu en décembre 2026 qui commence en janvier 2027 sort du barème de 2026.
            Si le calendrier du CFA le permet, un contrat qui débute avant le 1er janvier 2027 garde
            les montants du tableau ci-dessus.
          </p>
          <Callout tone="warn" title="Avant de signer un contrat qui débute en 2027">
            Vérifiez la publication du décret sur la fiche F23556 de service-public ou au Journal
            officiel.
          </Callout>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1128284/file/PAP%202027%20-%20Travail%20emploi%20et%20administration%20des%20minist%C3%A8res%20sociaux.pdf">
              projet annuel de performances 2027
            </Source>
            {' · '}
            <Source href="https://www.senat.fr/rap/l26-156-332/l26-156-332_mono.html">
              Sénat, rapport général n° 156
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F23556">fiche F23556</Source>
          </p>
        </GuideSection>

        <GuideSection id="opco" number="03" title="Ce que paie l'OPCO, ce que vous payez">
          <p>
            L&apos;OPCO finance la formation de l&apos;apprenti au niveau de prise en charge (NPEC)
            fixé pour chaque diplôme, quelle que soit la taille de l&apos;entreprise, et une partie
            des frais annexes. De votre côté, vous versez 750 € par contrat quand l&apos;apprenti
            prépare un diplôme de niveau 6 ou plus, soit bac+3 et au-delà.
          </p>
          <div className={CARTE}>
            <table className="w-full text-sm max-sm:block">
              <caption className="sr-only">Prise en charge d&apos;un contrat d&apos;apprentissage en 2026</caption>
              <thead className="bg-lin-soft max-sm:sr-only">
                <tr>
                  <th scope="col" className={EN_TETE}>Poste</th>
                  <th scope="col" className={EN_TETE}>Règle en vigueur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet max-sm:block">
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Formation au CFA</th>
                  <td data-label="Règle en vigueur" className={CELLULE}>
                    NPEC du diplôme. Quand la branche n&apos;a pas fixé de niveau, des valeurs de
                    carence s&apos;appliquent, nouvelles pour les contrats conclus depuis le 1er
                    septembre 2026
                  </td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Hébergement</th>
                  <td data-label="Règle en vigueur" className={CELLULE}>6 € par nuitée</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Restauration</th>
                  <td data-label="Règle en vigueur" className={CELLULE}>3 € par repas</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Premier équipement pédagogique</th>
                  <td data-label="Règle en vigueur" className={CELLULE}>
                    Contrats conclus depuis le 30 juillet 2026&nbsp;: 500 € au plus pour les niveaux
                    3 et 4, 300 € pour le niveau 5, rien au-delà
                  </td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>Participation de l&apos;employeur</th>
                  <td data-label="Règle en vigueur" className={CELLULE}>
                    750 € par contrat préparant un diplôme de niveau 6 ou plus, à votre charge
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Les 750 € sont dus depuis le 1er juillet 2025, quelle que soit la durée du contrat
            (article R6332-25-1 du Code du travail)&nbsp;; nous n&apos;avons trouvé aucune évolution
            de ce montant en 2026. Le CFA vous adresse la facture à l&apos;issue des 45 premiers
            jours. Si le contrat est rompu pendant ces 45 premiers jours de formation pratique, vous
            devez 50 % du financement dû par l&apos;OPCO pour la période effectuée, dans la limite
            de 750 €. L&apos;employeur qui reprend un apprenti après une rupture ne paie que 200 €.
          </p>
          <p>
            Le premier équipement est demandé par le CFA, dans les 12 mois suivant la conclusion du
            contrat. Pour connaître le NPEC d&apos;un diplôme, interrogez le CFA ou votre OPCO.
          </p>
          <Callout tone="warn" title="L'aide de 500 € au permis des apprentis est supprimée">
            Elle n&apos;est plus attribuée depuis le 21 février 2026 (loi de finances pour 2026). Si
            la conduite est nécessaire au poste, vous pouvez financer le permis par le plan de
            développement des compétences.
          </Callout>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054762162">
              décret n° 2026-832 (NPEC)
            </Source>
            {' · '}
            <Source href="https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000018498570/2026-10-04/">
              art. R6332-25-1
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F39190">fiche F39190</Source>
            {' · '}
            <Source href="https://www.legifrance.gouv.fr/loda/id/JORFTEXT000038940362">
              arrêté du 30 juillet 2019 (frais annexes)
            </Source>
            {' · '}
            <Source href="https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054541033">
              décret n° 2026-679 (équipement)
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/actualites/A18840">
              service-public.gouv.fr (permis)
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18873">
              plan de développement des compétences
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="salaire" number="04" title="Salaire de l'apprenti et cotisations">
          <p>
            Le salaire minimum d&apos;un apprenti est un pourcentage du Smic qui dépend de son âge
            et de l&apos;année du contrat. Au 1er juin 2026, il va de
            504,09 € brut par mois avant 18 ans en première année à 1 867,02 € à partir de 26 ans.
            Les cotisations patronales bénéficient de la réduction générale dégressive unique
            (RGDU).
          </p>
          <div className={CARTE}>
            <table className="w-full text-sm max-sm:block">
              <caption className="sr-only">
                Salaire minimum de l&apos;apprenti en pourcentage du Smic, brut mensuel, au 1er juin 2026
              </caption>
              <thead className="bg-lin-soft max-sm:sr-only">
                <tr>
                  <th scope="col" className={EN_TETE}>Année du contrat</th>
                  <th scope="col" className={EN_TETE}>Moins de 18 ans</th>
                  <th scope="col" className={EN_TETE}>18 à 20 ans</th>
                  <th scope="col" className={EN_TETE}>21 à 25 ans</th>
                  <th scope="col" className={EN_TETE}>26 ans et plus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet max-sm:block">
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>1re année</th>
                  <td data-label="Moins de 18 ans" className={CELLULE}>27 % (504,09 €)</td>
                  <td data-label="18 à 20 ans" className={CELLULE}>43 % (802,82 €)</td>
                  <td data-label="21 à 25 ans" className={CELLULE}>53 % (989,52 €)</td>
                  <td data-label="26 ans et plus" className={CELLULE}>100 % (1 867,02 €)</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>2e année</th>
                  <td data-label="Moins de 18 ans" className={CELLULE}>39 % (728,14 €)</td>
                  <td data-label="18 à 20 ans" className={CELLULE}>51 % (952,18 €)</td>
                  <td data-label="21 à 25 ans" className={CELLULE}>61 % (1 138,88 €)</td>
                  <td data-label="26 ans et plus" className={CELLULE}>100 %</td>
                </tr>
                <tr className={LIGNE}>
                  <th scope="row" className={TITRE_LIGNE}>3e année</th>
                  <td data-label="Moins de 18 ans" className={CELLULE}>55 % (1 026,86 €)</td>
                  <td data-label="18 à 20 ans" className={CELLULE}>67 % (1 250,90 €)</td>
                  <td data-label="21 à 25 ans" className={CELLULE}>78 % (1 456,27 €)</td>
                  <td data-label="26 ans et plus" className={CELLULE}>100 %</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            De 21 à 25 ans, le minimum devient le même pourcentage du salaire minimum
            conventionnel s&apos;il est plus élevé&nbsp;; à partir de 26 ans, le salaire
            conventionnel s&apos;il est plus élevé. Base de calcul&nbsp;: le Smic de 12,31 € brut de
            l&apos;heure depuis le 1er juin 2026, soit 1 867,02 € brut par mois pour 35 heures.
          </p>
          <p>
            Côté salarié, pour un contrat conclu depuis le 1er mars 2025, l&apos;apprenti ne paie ni
            cotisations salariales ni CSG-CRDS sur la part de son salaire inférieure à 50 % du Smic,
            soit 933,51 € par mois depuis le 1er juin 2026. Les contrats commencés au plus tard le
            28 février 2025 gardent l&apos;ancienne limite de 79 % du Smic.
          </p>
          <p>
            Côté employeur privé, il n&apos;existe plus d&apos;exonération propre à
            l&apos;apprentissage depuis 2019&nbsp;: les cotisations patronales bénéficient des
            allègements généraux, devenus au 1er janvier 2026 la RGDU. Elle s&apos;applique aux
            salaires inférieurs à 3 Smic, pour tous les contrats en alternance, temps partiel
            compris. Les employeurs publics gardent une exonération spécifique de leurs cotisations
            patronales de sécurité sociale, hors accidents du travail.
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F2918">
              fiche F2918 (salaire de l&apos;apprenti)
            </Source>
            {' · '}
            <Source href="https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000054128446">
              arrêté du 22 mai 2026 (Smic)
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F2300">fiche F2300</Source>
            {' · '}
            <Source href="https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1128284/file/PAP%202027%20-%20Travail%20emploi%20et%20administration%20des%20minist%C3%A8res%20sociaux.pdf">
              projet annuel de performances 2027
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F24542">
              fiche F24542 (RGDU)
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="professionnalisation" number="05" title="Le contrat de professionnalisation">
          <p>
            Pour un contrat de professionnalisation, l&apos;État ne verse plus d&apos;aide
            exceptionnelle&nbsp;: selon service-public, elle a pris fin pour les contrats signés
            après le 30 avril 2024. Restent des aides liées au profil de la personne recrutée,
            demandeur d&apos;emploi ou personne handicapée. Comme pour l&apos;apprentissage,
            l&apos;OPCO finance la formation.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Demandeur d&apos;emploi de 45 ans ou plus&nbsp;: l&apos;État verse 2 000 €. Créée en
              2011 sans limitation de durée, cette aide est budgétée pour 2027.
            </li>
            <li>
              Demandeur d&apos;emploi de 26 ans ou plus&nbsp;: France Travail présente une aide
              forfaitaire de 2 000 € au plus, versée en deux échéances. Sa page n&apos;affiche pas de
              date de mise à jour&nbsp;: faites-la confirmer avant l&apos;embauche. Cumulée avec
              l&apos;aide de l&apos;État pour les 45 ans ou plus, elle porte le total à 4 000 €.
            </li>
            <li>
              Personne handicapée&nbsp;: l&apos;Agefiph verse jusqu&apos;à 3 000 € pour un contrat
              d&apos;au moins 6 mois et 24 heures par semaine, selon sa durée, calculés à partir du
              sixième mois.
            </li>
          </ul>
          <p>
            Pour former un demandeur d&apos;emploi avant de le recruter, la POEI finance
            jusqu&apos;à 450 heures de formation, avec un cofinancement possible de l&apos;OPCO&nbsp;:
            voyez notre page{' '}
            <Link href="/demandeurs-emploi/" className="lien">
              Demandeurs d&apos;emploi
            </Link>
            .
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F35391">fiche F35391</Source>
            {' · '}
            <Source href="https://www.francetravail.fr/employeur/aides-aux-recrutements/les-aides-a-lembauche/aide-a-lembauche-dun-demandeur-d.html">
              France Travail, aide à l&apos;embauche
            </Source>
            {' · '}
            <Source href="https://www.assemblee-nationale.fr/dyn/contenu/visualisation/1128284/file/PAP%202027%20-%20Travail%20emploi%20et%20administration%20des%20minist%C3%A8res%20sociaux.pdf">
              projet annuel de performances 2027
            </Source>
            {' · '}
            <Source href="https://www.francetravail.fr/employeur/aides-aux-recrutements/les-aides-a-la-formation/la-preparation-operationnelle-a.html">
              France Travail, la POEI
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="demarches" number="06" title="En pratique : les démarches">
          <p>
            Selon service-public, l&apos;aide à l&apos;embauche d&apos;un apprenti ne se demande
            pas&nbsp;: elle découle de la déclaration de l&apos;embauche en DSN et de la
            transmission du contrat à votre OPCO dans les 6 mois suivant sa conclusion. Elle est
            ensuite versée chaque mois, avant le paiement du salaire, pendant la première année du
            contrat seulement.
          </p>
          <ol className="max-w-[34rem] list-decimal space-y-2 pl-5">
            <li>
              Identifiez votre OPCO&nbsp;: il dépend de la convention collective appliquée (code
              IDCC) ou, à défaut, de votre activité principale. Notre page{' '}
              <Link href="/quel-est-mon-opco/" className="lien">
                Quel est mon OPCO&nbsp;?
              </Link>{' '}
              vous guide, et nos{' '}
              <Link href="/opco/" className="lien">
                fiches des 11 OPCO
              </Link>{' '}
              résument leurs barèmes.
            </li>
            <li>
              Vérifiez la date de début du contrat et le niveau du diplôme&nbsp;: ils fixent le
              montant de l&apos;aide et la participation de 750 €.
            </li>
            <li>Déclarez l&apos;embauche en DSN et transmettez le contrat à l&apos;OPCO.</li>
            <li>
              À partir de 250 salariés, renvoyez à l&apos;ASP l&apos;attestation sur l&apos;honneur
              relative à l&apos;objectif d&apos;alternants.
            </li>
            <li>
              Pour un contrat de professionnalisation d&apos;un demandeur d&apos;emploi de 26 ans ou
              plus, demandez l&apos;aide de France Travail depuis votre espace employeur, dans les 3
              mois suivant l&apos;embauche.
            </li>
          </ol>
          <p>
            La fiche F23556 détaille ces modalités. Pour vos salariés déjà en poste, voyez la page{' '}
            <Link href="/employeurs/" className="lien">
              Employeurs
            </Link>{' '}
            et le guide{' '}
            <Link href="/comprendre-les-opco/" className="lien">
              Comprendre les OPCO
            </Link>
            .
          </p>
          <p className="text-sm text-texte-discret">
            Sources :{' '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F23556">fiche F23556</Source>
            {' · '}
            <Source href="https://www.francecompetences.fr/fiche/nouveau-systeme-de-collecte-des-contributions-formation-apprentissage-france-competences-lance-un-moteur-de-recherche-pour-identifier-son-opco/">
              France compétences
            </Source>
            {' · '}
            <Source href="https://www.francetravail.fr/employeur/aides-aux-recrutements/les-aides-a-lembauche/aide-a-lembauche-dun-demandeur-d.html">
              France Travail
            </Source>
          </p>
        </GuideSection>

        <QuestionsFrequentes questions={QUESTIONS} />
      </GuideBody>

      <GuideCta
        title="Identifiez votre OPCO et vos aides"
        text="Le simulateur retrouve votre OPCO à partir du nom ou du SIREN de l'entreprise et recherche les aides qui s'appliquent à votre projet, chacune avec sa source."
        href="/simulateur/"
        label="Estimer mon financement"
      />
    </main>
  );
}
