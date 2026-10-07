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

export const metadata: Metadata = {
  title: 'Obligations formation des entreprises en 2026',
  description:
    'CUFPA, taxe d’apprentissage, entretien de parcours professionnel, abondement correctif de 3 000 € : ce que votre entreprise doit verser et organiser en 2026, taux exacts et sources officielles.',
};

const TOC = [
  { id: 'contributions', label: 'Ce que votre entreprise verse' },
  { id: 'former', label: 'L’obligation de former' },
  { id: 'entretiens', label: 'L’entretien de parcours professionnel' },
  { id: 'sanctions', label: 'La sanction : 3 000 € par salarié' },
  { id: 'budget', label: 'Légal, volontaire, conventionnel' },
];

export default function ObligationsPage() {
  return (
    <main>
      <GuideHero
        eyebrow="Guide nº 2 · taux vérifiés octobre 2026"
        title={
          <>
            Votre entreprise paie déjà.
            <br />
            Autant <span className="mark">le savoir</span>.
          </>
        }
        lead="Contribution formation, taxe d'apprentissage, entretiens obligatoires : le système repose sur des versements que toutes les entreprises font déjà. Ne pas activer les droits en face, c'est payer deux fois."
      />

      <GuideBody toc={TOC}>
        <GuideSection id="contributions" number="01" title="Ce que votre entreprise verse">
          <p>
            La <strong>contribution unique à la formation professionnelle et à
            l&apos;alternance (CUFPA)</strong>{' '}est collectée chaque mois par l&apos;Urssaf (ou la
            MSA pour le régime agricole) via la DSN, puis reversée à France compétences qui la
            répartit entre OPCO, Caisse des dépôts (CPF), associations Transitions Pro, État et
            Régions.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border border-rule bg-white text-sm">
              <thead className="bg-paper-deep">
                <tr>
                  <th className="marginalia border-b border-rule px-4 py-3 text-left">Contribution</th>
                  <th className="marginalia border-b border-rule px-4 py-3 text-right">Taux 2026</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                <tr>
                  <td className="px-4 py-3">Formation professionnelle, moins de 11 salariés</td>
                  <td className="amount px-4 py-3 text-right font-semibold">0,55 %</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Formation professionnelle, 11 salariés et plus</td>
                  <td className="amount px-4 py-3 text-right font-semibold">1 %</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    Taxe d&apos;apprentissage, cas général
                    <span className="block text-xs text-ink-faint">
                      part principale 0,59 % (DSN) + solde 0,09 % (affecté via SOLTéA)
                    </span>
                  </td>
                  <td className="amount px-4 py-3 text-right font-semibold">0,68 %</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Taxe d&apos;apprentissage, Alsace-Moselle (pas de solde)</td>
                  <td className="amount px-4 py-3 text-right font-semibold">0,44 %</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">CPF-CDD (sur la masse salariale des CDD)</td>
                  <td className="amount px-4 py-3 text-right font-semibold">1 %</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">
                    Contribution supplémentaire à l&apos;apprentissage
                    <span className="block text-xs text-ink-faint">
                      entreprises de 250 salariés et plus sous le seuil de 5 % d&apos;alternants
                    </span>
                  </td>
                  <td className="amount px-4 py-3 text-right font-semibold">0,05 – 0,60 %</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            Sources :{' '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F22570">
              service-public.gouv.fr (CFP)
            </Source>
            {' · '}
            <Source href="https://entreprendre.service-public.gouv.fr/vosdroits/F22574">
              service-public.gouv.fr (taxe d&apos;apprentissage)
            </Source>
            {' · '}
            <Source href="https://www.urssaf.fr/accueil/employeur/cotisations/liste-cotisations/taxe-apprentissage-csa.html">
              Urssaf (CSA)
            </Source>
          </p>
          <Callout tone="info" title="Des majorations sectorielles existent">
            Travail temporaire (1 % au minimum, plus une contribution conventionnelle d&apos;au
            moins 0,30 %), BTP, intermittents du spectacle (2 % et plus) : certaines branches
            prévoient des contributions conventionnelles supplémentaires, gérées par l&apos;OPCO,
            elles ouvrent souvent des droits additionnels.
          </Callout>
        </GuideSection>

        <GuideSection id="former" number="02" title="L'obligation de former">
          <p>
            Indépendamment des versements, l&apos;employeur a une obligation légale
            (art. L.6321-1 du Code du travail) d&apos;assurer{' '}
            <strong>l&apos;adaptation des salariés à leur poste de travail</strong>{' '}et de{' '}
            <strong>veiller au maintien de leur capacité à occuper un emploi</strong>. Les
            formations obligatoires (sécurité, habilitations réglementaires…) se déroulent sur
            le temps de travail et sont rémunérées comme tel.
          </p>
          <p>
            Le <strong>plan de développement des compétences</strong>{' '}n&apos;est pas un document
            obligatoire en soi, mais il est le support naturel de cette obligation, et, pour
            les entreprises de moins de 50 salariés, la porte d&apos;entrée vers les
            financements mutualisés de l&apos;OPCO.
          </p>
        </GuideSection>

        <GuideSection id="entretiens" number="03" title="L'entretien de parcours professionnel (réforme 2025)">
          <Callout tone="warn" title="L'entretien professionnel biennal n'existe plus">
            La loi n° 2025-989 du 24 octobre 2025 l&apos;a remplacé par{' '}
            <strong>l&apos;entretien de parcours professionnel (EPP)</strong>. Les entreprises
            qu&apos;aucun accord d&apos;entreprise ou de branche ne lie sur la périodicité des
            entretiens appliquent directement les nouvelles règles. Les accords existants
            devaient être révisés : le nouvel article L.6315-1 s&apos;applique à eux à compter
            du <strong>1er octobre 2026</strong>.
          </Callout>
          <ul className="list-disc space-y-2 pl-5">
            <li>Premier entretien <strong>dans l&apos;année suivant l&apos;embauche</strong> ;</li>
            <li>Puis un entretien <strong>tous les 4 ans</strong>{' '}(au lieu de 2) ;</li>
            <li>Un <strong>bilan récapitulatif tous les 8 ans</strong>{' '}(au lieu de 6) ;</li>
            <li>
              Contenu élargi : compétences, perspectives d&apos;évolution, besoins de formation,
              information sur le CPF et la VAE.
            </li>
          </ul>
          <p className="text-sm">
            Sources :{' '}
            <Source href="https://www.akto.fr/lentretien-professionnel-evolue-pour-devenir-lentretien-de-parcours-professionnel/">
              AKTO
            </Source>
            {' · '}
            <Source href="https://www.uniformation.fr/particulier/salaries/formation-et-financements/lentretien-professionnel-et-lentretien-de-parcours-professionnel-epp">
              Uniformation
            </Source>
            {' · '}
            <Source href="https://code.travail.gouv.fr/code-du-travail/l6315-1">
              Code du travail, art. L.6315-1
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="sanctions" number="04" title="La sanction : 3 000 € d'abondement correctif">
          <p>
            Dans les entreprises de <strong>50 salariés et plus</strong>, si un salarié
            n&apos;a pas bénéficié des entretiens obligatoires <strong>et</strong>{' '}d&apos;au
            moins une formation non obligatoire sur la période de référence, l&apos;employeur
            doit verser un <strong>abondement correctif de 3 000 €</strong>{' '}sur son CPF, via la
            Caisse des dépôts.
          </p>
          <p>
            La Cour de cassation a confirmé le 21 janvier 2026 que les deux conditions de
            l&apos;article L.6323-13 sont <strong>cumulatives</strong>{' '}: l&apos;absence
            d&apos;entretiens seule ne déclenche pas l&apos;abondement, mais elle reste une
            faute susceptible d&apos;engager la responsabilité de l&apos;employeur.
          </p>
          <p className="text-sm">
            Sources :{' '}
            <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18781">
              service-public.gouv.fr
            </Source>
            {' · '}
            <Source href="https://financeurs.moncompteformation.gouv.fr/espace-public/aide/comment-attribuer-des-droits-correctifs">
              Caisse des dépôts
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="budget" number="05" title="Légal, volontaire, conventionnel : trois « budgets » différents">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>Le versement légal (CUFPA)</strong>{' '}est un impôt affecté : il ne revient
              pas à l&apos;entreprise sous forme de cagnotte. Il alimente les fonds mutualisés,
              accessibles au titre du plan de développement des compétences uniquement pour les{' '}
              <strong>moins de 50 salariés</strong>.
            </li>
            <li>
              <strong>Les versements volontaires</strong>{' '}à l&apos;OPCO sont contractuels,
              tracés sur un compte dédié, non mutualisés, et mobilisables librement pour les
              formations de l&apos;entreprise.
            </li>
            <li>
              <strong>Les contributions conventionnelles</strong>, fixées par accord de branche,
              sont gérées par l&apos;OPCO selon les règles de la branche et peuvent bénéficier à
              toutes les tailles d&apos;entreprise.
            </li>
          </ul>
          <Callout tone="ok" title="Le réflexe qui change tout">
            Avant de payer une formation sur fonds propres, vérifiez dans l&apos;ordre : les
            fonds mutualisés (si &lt; 50 salariés), les fonds conventionnels de votre branche,
            les <Link href="/former-sans-budget" className="font-semibold underline">actions collectives de votre OPCO</Link>,
            le CPF du salarié, et les cofinancements FSE+ lorsque votre OPCO en propose.
          </Callout>
        </GuideSection>

        <GuideCta
          title="Vérifiez ce que votre OPCO peut prendre en charge"
          text="Le simulateur applique les barèmes 2026 de votre OPCO à votre projet de formation et signale les plafonds applicables."
          href="/simulateur"
          label="Lancer le simulateur"
        />
      </GuideBody>
    </main>
  );
}
