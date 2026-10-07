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
  title: 'Comprendre les OPCO : rôle, rattachement, financements',
  description:
    "Qui sont les 11 opérateurs de compétences, comment votre entreprise est rattachée au sien, et ce qu'ils peuvent financer en 2026 : plan de développement des compétences, alternance, période de reconversion, VAE.",
};

const TOC = [
  { id: 'role', label: 'Le rôle des OPCO' },
  { id: 'rattachement', label: 'À quel OPCO êtes-vous rattaché ?' },
  { id: 'financements', label: 'Ce que finance un OPCO' },
  { id: 'moins-50', label: 'La règle des 50 salariés' },
  { id: 'reconversion', label: 'La période de reconversion (2026)' },
];

export default function ComprendreLesOpcoPage() {
  return (
    <main>
      <GuideHero
        eyebrow="Guide nº 1 · mis à jour octobre 2026"
        title={
          <>
            Les OPCO, mode d&apos;emploi :
            <br />
            qui finance quoi, <span className="mark">pour qui</span>
          </>
        }
        lead="Onze opérateurs de compétences se partagent toutes les entreprises françaises. Comprendre le vôtre, et les règles qu'il applique, est la première étape pour faire financer une formation."
      />

      <GuideBody toc={TOC}>
        <GuideSection id="role" number="01" title="Le rôle des OPCO">
          <p>
            Les <strong>opérateurs de compétences (OPCO)</strong>{' '}sont 11 organismes paritaires
            agréés par l&apos;État, créés par la loi du 5 septembre 2018 « pour la liberté de
            choisir son avenir professionnel ». Ils ont remplacé les anciens OPCA. Depuis 2022,{' '}
            <strong>ils ne collectent plus les contributions légales</strong>{' '}: c&apos;est
            l&apos;Urssaf (ou la MSA) qui s&apos;en charge, avant reversement à France compétences
            qui répartit les fonds.
          </p>
          <p>Leurs missions principales (art. L.6332-1 et L.6332-17 du Code du travail) :</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Financer l&apos;alternance et la reconversion</strong>{' '}: contrats
              d&apos;apprentissage (aux niveaux de prise en charge « NPEC » fixés par les
              branches), contrats de professionnalisation et, depuis février 2026, la période de
              reconversion.
            </li>
            <li>
              <strong>Appuyer les branches professionnelles</strong> : construction des
              certifications, observatoires des métiers, gestion prévisionnelle des emplois.
            </li>
            <li>
              <strong>Accompagner les TPE-PME</strong> : service de proximité et financement du
              plan de développement des compétences des entreprises de{' '}
              <strong>moins de 50 salariés</strong>.
            </li>
          </ul>
          <p className="text-sm">
            Sources :{' '}
            <Source href="https://www.francecompetences.fr/fiche-ruf/le-soutien-au-plan-de-developpement-des-competences-des-entreprises/">
              France compétences
            </Source>
            {' · '}
            <Source href="https://www.centre-inffo.fr/site-droit-formation/site-fiches-pratiques/annexes/presentation-des-11-operateurs-de-competences-opco">
              Centre Inffo
            </Source>
            {' · '}
            <Source href="https://code.travail.gouv.fr/code-du-travail/l6332-1">
              Code du travail, art. L.6332-1
            </Source>
            {' · '}
            <Source href="https://code.travail.gouv.fr/code-du-travail/l6332-17">
              art. L.6332-17
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="rattachement" number="02" title="À quel OPCO êtes-vous rattaché ?">
          <p>
            Le rattachement dépend <strong>exclusivement de la convention collective</strong>{' '}
            appliquée par l&apos;entreprise, identifiée par son code <strong>IDCC</strong>, pas
            du code NAF/APE. En règle générale, une entreprise ne relève que d&apos;un seul
            OPCO. Le bulletin de paie indique la convention collective applicable, souvent avec
            son code IDCC ; à défaut de convention collective, le rattachement se fait selon
            l&apos;activité principale.
          </p>
          <Callout tone="info" title="Trouver son OPCO avec le simulateur">
            Notre simulateur identifie votre OPCO à partir du nom ou du SIREN de votre
            entreprise, via la base officielle des conventions collectives.{' '}
            <Link href="/simulateur" className="font-semibold underline">
              Essayer maintenant →
            </Link>
          </Callout>
        </GuideSection>

        <GuideSection id="financements" number="03" title="Ce que finance un OPCO">
          <div className="overflow-x-auto">
            <table className="w-full border border-rule bg-white text-sm">
              <thead className="bg-paper-deep">
                <tr>
                  <th className="marginalia border-b border-rule px-4 py-3 text-left">Dispositif</th>
                  <th className="marginalia border-b border-rule px-4 py-3 text-left">Pour qui</th>
                  <th className="marginalia border-b border-rule px-4 py-3 text-left">Ce qui est pris en charge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                <tr>
                  <td className="px-4 py-3 font-medium text-ink">Plan de développement des compétences</td>
                  <td className="px-4 py-3">Entreprises &lt; 50 salariés</td>
                  <td className="px-4 py-3">Coûts pédagogiques, parfois salaires et frais annexes, selon les barèmes de branche</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-ink">Contrat d&apos;apprentissage</td>
                  <td className="px-4 py-3">Toutes tailles</td>
                  <td className="px-4 py-3">Coût de formation du CFA au niveau « NPEC » fixé par la branche (révision 2026 de France compétences : valeur de référence plafonnée à 11 000 € pour les niveaux 5 à 7, modulable jusqu&apos;à 20 % en plus ou en moins par la branche, sans descendre sous 4 000 €)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-ink">Contrat de professionnalisation</td>
                  <td className="px-4 py-3">Toutes tailles</td>
                  <td className="px-4 py-3">Forfait horaire fixé par la branche (9,15 €/h à défaut d&apos;accord)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-ink">Période de reconversion <span className="stamp ml-1 text-cobalt">Nouveau 2026</span></td>
                  <td className="px-4 py-3">Tous salariés, toutes tailles</td>
                  <td className="px-4 py-3">9,15 €/h à défaut d&apos;accord de branche, montant moyen de prise en charge par OPCO fixé à 5 000 € (art. D.6332-90)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-ink">VAE, bilan de compétences, AFEST, tutorat</td>
                  <td className="px-4 py-3">Selon OPCO et branche</td>
                  <td className="px-4 py-3">Forfaits propres à chaque OPCO (voir nos fiches)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout tone="warn" title="Apprentissage : 750 € à la charge de l'employeur depuis juillet 2025">
            Pour tout contrat d&apos;apprentissage visant un diplôme de niveau 6 ou 7 (Bac+3 et
            plus), l&apos;employeur verse une participation obligatoire de 750 € par contrat,
            déduite du montant versé au CFA (décret n° 2025-585 du 27 juin 2025).{' '}
            <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18329">
              service-public.gouv.fr
            </Source>
          </Callout>
        </GuideSection>

        <GuideSection id="moins-50" number="04" title="La règle des 50 salariés">
          <p>
            Depuis la loi de 2018, les fonds mutualisés du plan de développement des compétences
            sont <strong>réservés aux entreprises de moins de 50 salariés</strong>{' '}
            (art. L.6332-17 du Code du travail). Une entreprise de 50 salariés ou plus finance
            les formations de son plan <strong>sur ses fonds propres</strong> : sa contribution
            légale est un impôt affecté, pas une cagnotte récupérable.
          </p>
          <p>
            L&apos;écart est réel : pour 2024, France compétences mesure un reste à charge moyen de{' '}
            <strong>38 %</strong>{' '}du coût d&apos;une formation soutenue par les OPCO, contre{' '}
            <strong>67 %</strong>{' '}dans les entreprises de plus de 50 salariés.{' '}
            <Source href="https://www.francecompetences.fr/fiche-ruf/le-soutien-au-plan-de-developpement-des-competences-des-entreprises/">
              France compétences
            </Source>
          </p>
          <p>Trois leviers restent ouverts aux entreprises de 50 salariés et plus :</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Les versements volontaires</strong>{' '}à l&apos;OPCO : compte dédié, non
              mutualisé, mobilisable pour ses propres formations avec les services de l&apos;OPCO.
            </li>
            <li>
              <strong>Les contributions conventionnelles</strong> : certaines branches imposent
              une cotisation supplémentaire qui ouvre des droits, y compris aux 50+.
            </li>
            <li>
              <strong>Les dispositifs fléchés</strong> : alternance, période de reconversion et,
              selon votre OPCO, actions collectives et cofinancements FSE+, voir notre guide{' '}
              <Link href="/former-sans-budget" className="font-semibold text-cobalt underline">
                Se former sans budget
              </Link>.
            </li>
          </ul>
        </GuideSection>

        <GuideSection id="reconversion" number="05" title="La période de reconversion (nouveau 2026)">
          <p>
            Issue de la loi n° 2025-989 du 24 octobre 2025, la{' '}
            <strong>période de reconversion</strong>{' '}est entrée en vigueur le{' '}
            <strong>1er février 2026</strong>{' '}et remplace à la fois la <strong>Pro-A</strong>{' '}et
            les <strong>Transitions collectives</strong>. Contrairement à la Pro-A, elle est
            ouverte à tous les salariés, sans condition de type de contrat, d&apos;âge ni de
            niveau de qualification, pour préparer une certification RNCP, un CQP ou un bloc de
            compétences.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Financement OPCO</strong> : à défaut d&apos;accord de branche, forfait de{' '}
              <strong>9,15 €/heure</strong> ; le montant moyen de prise en charge par OPCO est
              fixé à 5 000 € (art. D.6332-90). Le CPF du salarié peut être mobilisé avec son
              accord.
            </li>
            <li>
              <strong>Procédure</strong>{' '}: accord écrit entre salarié et employeur, dossier
              complet adressé à l&apos;OPCO{' '}
              <strong>dans les 30 jours calendaires qui précèdent</strong>{' '}le début de la
              période de reconversion.
            </li>
            <li>Les Pro-A signées avant 2026 continuent de produire leurs effets.</li>
          </ul>
          <p className="text-sm">
            Sources :{' '}
            <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18798">
              service-public.gouv.fr
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/vosdroits/F13516">
              fiche F13516
            </Source>
            {' · '}
            <Source href="https://code.travail.gouv.fr/code-du-travail/d6332-90">
              art. D.6332-90
            </Source>
            {' · '}
            <Source href="https://code.travail.gouv.fr/code-du-travail/r6324-1">
              art. R.6324-1
            </Source>
          </p>
        </GuideSection>

        <GuideCta
          title="Passez de la théorie aux chiffres"
          text="Identifiez votre OPCO et obtenez une estimation détaillée de la prise en charge de votre projet de formation, poste par poste."
          href="/simulateur"
          label="Estimer mon financement"
        />
      </GuideBody>
    </main>
  );
}
