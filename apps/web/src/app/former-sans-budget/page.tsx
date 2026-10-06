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
  title: 'Se former sans toucher au budget formation : actions collectives, CPF, FSE+',
  description:
    'Actions collectives des OPCO financées à 100 %, catalogues clé en main, CPF, cofinancement FSE+, période de reconversion : tous les leviers 2026 pour former sans consommer l’enveloppe de l’entreprise.',
};

const TOC = [
  { id: 'principe', label: 'Le principe' },
  { id: 'actions-collectives', label: 'Les actions collectives par OPCO' },
  { id: 'cpf', label: 'Le CPF du salarié' },
  { id: 'fse', label: 'Le cofinancement FSE+' },
  { id: 'reconversion', label: 'Période de reconversion & PTP' },
  { id: 'disparus', label: 'Ce qui n’existe plus' },
];

const ACTIONS_COLLECTIVES = [
  {
    opco: 'ATLAS',
    slug: 'atlas',
    dispositif: 'campusAtlas (actions collectives)',
    detail:
      '100 % des coûts pédagogiques pris en charge, dans la limite de crédits annuels par taille (3 crédits < 11 salariés, 5 pour 11-49, 7 pour 50-299, 3 % de l’effectif au-delà). Certaines thématiques sont en accès libre au-delà des crédits (tutorat, développement durable, harcèlement sexuel, salariés BOETH). Le plan IA-tlas finance à 100 % des modules IA en 2026.',
    url: 'https://www.opco-atlas.fr/entreprise/actions-collectives-campus-atlas.html',
  },
  {
    opco: 'AKTO',
    slug: 'akto',
    dispositif: 'Espace Formation (actions collectives)',
    detail:
      'Les formations mobilisées via Espace Formation « ne sont pas déduites de votre budget annuel » : coûts pédagogiques entièrement pris en charge pour les moins de 50 salariés, sans limite de nombre de salariés formés.',
    url: 'https://www.akto.fr/entreprise/financer-une-formation/regles-de-prise-en-charge/',
  },
  {
    opco: "L'Opcommerce",
    slug: 'opcommerce',
    dispositif: 'Click&Form',
    detail:
      'Catalogue d’environ 400 formations négociées (~40 % sous les prix du marché). Pour les moins de 50 salariés : 100 % des coûts pédagogiques pris en charge, dans la limite d’un quota d’inscriptions par branche (2 à 5 par an), financement distinct du plafond « Compétences+ ».',
    url: 'https://clickandform.lopcommerce.com/',
  },
  {
    opco: 'OPCO EP',
    slug: 'opco-ep',
    dispositif: 'Actions clés en main',
    detail:
      'Formations définies par branche avec coûts pédagogiques (et parfois rémunération) pris en charge, sans consommer le budget de l’entreprise.',
    url: 'https://www.opcoep.fr/',
  },
  {
    opco: 'OCAPIAT',
    slug: 'ocapiat',
    dispositif: 'Offre collective clé en main',
    detail:
      'Catalogue de formations mutualisées, particulièrement avantageux pour les entreprises de moins de 11 salariés.',
    url: 'https://www.ocapiat.fr/',
  },
];

export default function FormerSansBudgetPage() {
  return (
    <main>
      <GuideHero
        eyebrow="Guide nº 3 · dispositifs vérifiés juillet 2026"
        title={
          <>
            Se former{' '}
            <span className="mark">sans toucher</span>
            <br />
            au budget formation
          </>
        }
        lead="Les OPCO achètent eux-mêmes des formations et les offrent à leurs adhérents : ces « actions collectives » ne consomment pas l'enveloppe annuelle de votre entreprise. Ajoutez le CPF et le FSE+, et beaucoup de projets peuvent se financer à coût quasi nul."
      />

      <GuideBody toc={TOC}>
        <GuideSection id="principe" number="01" title="Le principe : deux poches distinctes">
          <p>
            Quand votre OPCO finance une formation de votre plan de développement des
            compétences, il puise dans <strong>votre enveloppe annuelle</strong>{' '}(plafonnée,
            souvent quelques milliers d&apos;euros par an). Mais les OPCO gèrent aussi des{' '}
            <strong>achats groupés de formations</strong>, sélectionnées par appel d&apos;offres
            auprès d&apos;organismes certifiés Qualiopi et financées sur leurs fonds mutualisés
            ou conventionnels : les <strong>actions collectives</strong>.
          </p>
          <p>
            Concrètement : les coûts pédagogiques sont réglés directement par l&apos;OPCO
            (souvent à 100 %), l&apos;entreprise n&apos;avance rien, et{' '}
            <strong>son enveloppe annuelle reste intacte</strong>{' '}pour d&apos;autres projets.
            Les places sont limitées par des quotas et par les fonds disponibles, les
            catalogues s&apos;épuisent en cours d&apos;année.
          </p>
          <Callout tone="ok" title="Le bon réflexe">
            Consultez le catalogue d&apos;actions collectives de votre OPCO <strong>en début
            d&apos;année</strong>, avant de chercher un organisme par vous-même : si la
            formation y figure, elle ne coûtera rien à votre budget.
          </Callout>
        </GuideSection>

        <GuideSection id="actions-collectives" number="02" title="Les actions collectives, OPCO par OPCO">
          <div className="space-y-4">
            {ACTIONS_COLLECTIVES.map((a) => (
              <div key={a.opco} className="rounded border border-rule bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display font-bold text-ink">
                    {a.opco}, {a.dispositif}
                  </h3>
                  <Link
                    href={`/opco/${a.slug}`}
                    className="text-xs font-semibold text-cobalt hover:underline"
                  >
                    Voir la fiche {a.opco} →
                  </Link>
                </div>
                <p className="mt-2 text-sm leading-relaxed">{a.detail}</p>
                <p className="mt-2 text-xs">
                  <Source href={a.url}>{a.url.replace('https://', '')}</Source>
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-ink-faint">
            Les autres OPCO (AFDAS, Constructys, OPCO 2i, OPCO Mobilités, OPCO Santé,
            Uniformation) proposent des dispositifs équivalents sous d&apos;autres formes,
            retrouvez-les sur <Link href="/opco" className="text-cobalt underline">les fiches OPCO</Link>.
            Les règles d&apos;éligibilité (taille, quotas) varient par OPCO et par année budgétaire.
          </p>
        </GuideSection>

        <GuideSection id="cpf" number="03" title="Le CPF du salarié, avec ou sans abondement">
          <p>
            Chaque salarié cumule <strong>500 € par an</strong>{' '}sur son compte personnel de
            formation (plafond 5 000 € ; montants majorés pour les moins qualifiés). Ces droits
            appartiennent au salarié et ne touchent pas le budget de l&apos;entreprise.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Participation forfaitaire</strong> : depuis mai 2024, le salarié paie un
              ticket modérateur (~100 €, indexé) sur chaque formation CPF, <strong>sauf si
              l&apos;employeur abonde</strong>, même d&apos;un euro symbolique.
            </li>
            <li>
              <strong>Abondements employeur</strong> : versés via le portail des financeurs
              (EDEF), ils permettent de co-construire un projet en partageant le coût avec le
              salarié, utile notamment pour les entreprises de 50+ salariés privées de fonds
              mutualisés.
            </li>
            <li>
              Certains OPCO et branches proposent des <strong>abondements automatiques</strong>{' '}
              sur des certifications prioritaires, voir la fiche de votre OPCO.
            </li>
          </ul>
          <p className="text-sm">
            Source :{' '}
            <Source href="https://www.moncompteformation.gouv.fr/">
              moncompteformation.gouv.fr
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="fse" number="04" title="Le cofinancement européen FSE+">
          <p>
            La quasi-totalité des OPCO mobilise des enveloppes du{' '}
            <strong>Fonds social européen (FSE+ 2021-2027)</strong>{' '}pour cofinancer des
            formations sur des thématiques ciblées (numérique, transition écologique,
            compétences de base), typiquement <strong>autour de 50 % des coûts
            pédagogiques</strong>, parfois cumulables avec les autres prises en charge. Chez
            OPCO EP par exemple : jusqu&apos;à 350 € par stagiaire et par jour, plafonné à
            150 000 € par entreprise sur 2025-2026.
          </p>
          <p className="text-sm">
            Sources :{' '}
            <Source href="https://www.fse.gouv.fr/actualites-evenements/les-opco-pour-developper-la-formation-professionnelle">
              fse.gouv.fr
            </Source>
            {' · '}
            <Source href="https://www.opcoep.fr/">OPCO EP</Source>
          </p>
        </GuideSection>

        <GuideSection id="reconversion" number="05" title="Reconversions : deux voies qui ne touchent pas votre budget">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>La période de reconversion</strong>{' '}(depuis février 2026) : financée par
              l&apos;OPCO sur ses fonds alternance, 9,15 €/h à défaut d&apos;accord de branche,
              ~5 000 € en moyenne, dossier à déposer 30 jours avant.{' '}
              <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18798">
                service-public.gouv.fr
              </Source>
            </li>
            <li>
              <strong>Le projet de transition professionnelle (PTP)</strong> : à
              l&apos;initiative du salarié, financé par les associations{' '}
              <strong>Transitions Pro</strong>{' '}régionales (pas par l&apos;OPCO), rémunération
              maintenue à 100 % jusqu&apos;à 2 SMIC. Aucun impact sur le budget formation de
              l&apos;entreprise.{' '}
              <Source href="https://www.transitionspro.fr/nos-dispositifs/projet-de-transition-professionnelle/">
                transitionspro.fr
              </Source>
            </li>
          </ul>
        </GuideSection>

        <GuideSection id="disparus" number="06" title="Ce qui n'existe plus en 2026">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>FNE-Formation</strong> : plus de nouveaux financements, les derniers
              accords devaient être conclus fin 2024 et le dispositif n&apos;a pas été doté
              depuis. Méfiez-vous des pages qui le présentent encore comme actif.
            </li>
            <li>
              <strong>Pro-A</strong>{' '}et <strong>Transitions collectives</strong> : absorbées par
              la période de reconversion au 1er février 2026 (les dossiers signés avant restent
              valables).
            </li>
          </ul>
        </GuideSection>

        <GuideCta
          title="Combinez les dispositifs pour votre projet"
          text="Le simulateur estime la prise en charge de votre OPCO sur le plan de développement des compétences ; les fiches OPCO recensent les actions collectives disponibles."
          href="/simulateur"
          label="Estimer mon financement"
        />
      </GuideBody>
    </main>
  );
}
