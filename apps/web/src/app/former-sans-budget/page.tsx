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
    "Actions collectives des OPCO, CPF, période de reconversion, et cofinancement FSE+ quand votre OPCO en ouvre un : les leviers 2026 pour former sans consommer l'enveloppe de l'entreprise.",
};

const TOC = [
  { id: 'principe', label: 'Le principe' },
  { id: 'actions-collectives', label: 'Les actions collectives par OPCO' },
  { id: 'cpf', label: 'Le CPF du salarié' },
  { id: 'fse', label: 'Le cofinancement FSE+' },
  { id: 'reconversion', label: 'Période de reconversion & PTP' },
  { id: 'disparus', label: "Ce qui n'existe plus" },
];

const ACTIONS_COLLECTIVES = [
  {
    opco: 'ATLAS',
    slug: 'atlas',
    dispositif: 'campusAtlas (actions collectives)',
    detail:
      "Formations clés en main choisies par chaque branche, aux critères propres : voir la fiche ATLAS. Branche des bureaux d'études (IDCC 1486) : 100 % des coûts pédagogiques pris en charge, dans la limite de crédits annuels par taille (3 crédits sous 11 salariés, 5 de 11 à 49, 7 de 50 à 299, un nombre de parcours égal à 3 % de l'effectif au-delà), et certaines thématiques en libre accès au-delà des crédits (tutorat, développement durable, harcèlement sexuel, salariés BOETH). Le plan IA-tlas finance à 100 % des modules IA pour les moins de 50 salariés (dossiers du 1er juillet au 15 décembre 2026, dans la limite des fonds disponibles).",
    url: 'https://www.opco-atlas.fr/entreprise/actions-collectives-campus-atlas.html',
  },
  {
    opco: 'AKTO',
    slug: 'akto',
    dispositif: 'Espace Formation (actions collectives)',
    detail:
      'Les formations mobilisées via Espace Formation « ne sont pas déduites de votre budget annuel » (dans la plupart des branches) : coûts pédagogiques entièrement pris en charge pour les moins de 50 salariés, dans la limite des places et des fonds disponibles.',
    url: 'https://www.akto.fr/entreprise/financer-une-formation/regles-de-prise-en-charge/',
  },
  {
    opco: "L'Opcommerce",
    slug: 'opcommerce',
    dispositif: 'Click&Form',
    detail:
      "Catalogue de formations sélectionnées par l'Opcommerce, à tarifs négociés. Pour les moins de 50 salariés, la prise en charge dépend de la branche : 100 % des coûts pédagogiques dans la limite d'un quota d'inscriptions par an (de 1 à 5 selon la branche), ou financement sur le budget « Compétences+ » dans d'autres branches (commerces de détail non alimentaires, optique, prédominance alimentaire, par exemple).",
    url: 'https://clickandform.lopcommerce.com/',
  },
  {
    opco: 'OPCO EP',
    slug: 'opco-ep',
    dispositif: 'Catalogue Sélexion et actions collectives de branche',
    detail:
      "Sélexion : 36 formations sélectionnées par OPCO EP, dont les coûts pédagogiques sont financés à 100 % en 2026 pour les entreprises de moins de 50 salariés (catalogue fermé aux entreprises de 50 salariés et plus depuis le 1er septembre 2026). Certaines branches financent aussi des actions collectives clés en main hors du plafond annuel de l'entreprise (librairie, détaillants en chaussures, par exemple).",
    url: 'https://www.opcoep.fr/entreprise/offre-de-services/selexion',
  },
  {
    opco: 'OCAPIAT',
    slug: 'ocapiat',
    dispositif: 'Offre régionale TPE-PME',
    detail:
      "Plus de 3 500 formations courtes clés en main sélectionnées par OCAPIAT, dont les coûts pédagogiques sont financés à 100 % pour les entreprises de moins de 50 salariés, dans la limite de l'enveloppe annuelle. Le catalogue est réservé aux entreprises du champ d'OCAPIAT, avec une priorité donnée à celles de moins de 50 salariés.",
    url: 'https://www.ocapiat.fr/catalogue-de-formations-et-financement/',
  },
];

export default function FormerSansBudgetPage() {
  return (
    <main>
      <GuideHero
        eyebrow="Guide nº 3 · dispositifs vérifiés octobre 2026"
        title={
          <>
            Se former{' '}
            <span className="mark">sans toucher</span>
            <br />
            au budget formation
          </>
        }
        lead="Les OPCO achètent eux-mêmes des formations et les proposent à leurs adhérents : ces « actions collectives » ne consomment généralement pas l'enveloppe annuelle de votre entreprise. Le CPF du salarié et, selon l'OPCO, le cofinancement FSE+ peuvent compléter ces catalogues."
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
            Les coûts pédagogiques sont réglés directement par l&apos;OPCO (souvent à 100 %),
            l&apos;entreprise n&apos;avance rien (la réforme de la TVA des OPCO du 1er octobre 2026
            limite la subrogation de paiement selon l&apos;OPCO : voir sa fiche), et{' '}
            <strong>son enveloppe annuelle reste intacte</strong>{' '}pour d&apos;autres projets,
            selon l&apos;OPCO et la branche. Les places sont limitées par des quotas et par les
            fonds disponibles, les catalogues s&apos;épuisent en cours d&apos;année.
          </p>
          <Callout tone="ok" title="Le catalogue d'abord">
            Consultez le catalogue d&apos;actions collectives de votre OPCO <strong>en début
            d&apos;année</strong>, avant de chercher un organisme par vous-même : si la
            formation y figure, elle est souvent prise en charge sans entamer votre budget.
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
            Uniformation) ont leurs propres dispositifs, souvent sous d&apos;autres formes
            (catalogues de formations clés en main, fonds conventionnels de branche) :
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
              <strong>Participation forfaitaire</strong> : depuis le 2 avril 2026, le salarié paie
              150 € sur chaque formation CPF,{' '}
              <strong>sauf si l&apos;employeur cofinance la formation par un abondement</strong>.
              Le projet de loi de finances 2027, présenté le 1er octobre 2026 et non adopté au
              6 octobre 2026, prévoit un complément pouvant atteindre 200 € pour les formations
              validées depuis le 2 octobre 2026. Les secteurs prioritaires et la plupart des
              formations cofinancées par un tiers à hauteur d&apos;au moins 150 € en seraient
              exonérés.
            </li>
            <li>
              <strong>Abondements employeur</strong> : versés via le portail des financeurs
              (EDEF), ils permettent de co-construire un projet en partageant le coût avec le
              salarié, utile notamment pour les entreprises de 50+ salariés privées de fonds
              mutualisés.
            </li>
            <li>
              Certains OPCO et branches proposent des <strong>abondements conventionnels</strong>{' '}
              sur des certifications prioritaires, voir la fiche de votre OPCO.
            </li>
          </ul>
          <p className="text-sm">
            Sources :{' '}
            <Source href="https://www.moncompteformation.gouv.fr/">
              moncompteformation.gouv.fr
            </Source>
            {' · '}
            <Source href="https://www.service-public.gouv.fr/particuliers/actualites/A17364">
              service-public.gouv.fr (participation forfaitaire)
            </Source>
            {' · '}
            <Source href="https://www.moncompteformation.gouv.fr/espace-public/evolution-des-regles-dutilisation-du-cpf-compter-du-2-octobre-2026">
              moncompteformation.gouv.fr (règles à compter du 2 octobre 2026)
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="fse" number="04" title="Le cofinancement européen FSE+">
          <p>
            Le <strong>Fonds social européen plus (FSE+ 2021-2027)</strong>{' '}peut cofinancer,
            par l&apos;intermédiaire des OPCO, des formations de salariés sur des thématiques
            ciblées (transitions écologique, numérique et démographique, par exemple), jusqu&apos;à{' '}
            <strong>50 % du coût éligible</strong>. Le reste est couvert par un versement
            volontaire de l&apos;entreprise ou par les fonds conventionnels de la branche : le
            FSE+ ne se cumule pas avec une autre aide publique sur les mêmes dépenses.
          </p>
          <p>
            Condition préalable : votre OPCO doit avoir une opération FSE+ ouverte aux demandes.
            L&apos;appel à projets national 2026-2027, réservé aux OPCO, est clos depuis le 8 juin
            2026, et chaque OPCO fixe ses thèmes, ses taux et ses plafonds. État des lieux au
            6 octobre 2026, à confirmer auprès de votre conseiller :
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Link href="/opco/atlas" className="font-semibold text-cobalt underline">ATLAS</Link>{' '}:
              opération ouverte, sous réserve des fonds disponibles : FSE+ à 50 % des coûts
              pédagogiques (500 000 € au maximum par entreprise), demande à déposer avant le
              début de la formation et au plus tard le 15 décembre 2027.
            </li>
            <li>
              <Link href="/opco/akto" className="font-semibold text-cobalt underline">AKTO</Link>,{' '}
              <Link href="/opco/opco-ep" className="font-semibold text-cobalt underline">OPCO EP</Link> et{' '}
              <Link href="/opco/ocapiat" className="font-semibold text-cobalt underline">OCAPIAT</Link>{' '}:
              dispositifs 2025-2026 clos (dépôts jusqu&apos;au 6 avril 2026 chez OPCO EP, jusqu&apos;au
              13 mars 2026 chez OCAPIAT).
            </li>
            <li>
              <Link href="/opco/opco2i" className="font-semibold text-cobalt underline">OPCO 2i</Link>,{' '}
              <Link href="/opco/constructys" className="font-semibold text-cobalt underline">Constructys</Link>,{' '}
              <Link href="/opco/opco-sante" className="font-semibold text-cobalt underline">OPCO Santé</Link> et{' '}
              <Link href="/opco/afdas" className="font-semibold text-cobalt underline">AFDAS</Link>{' '}:
              opérations 2025 terminées ou fonds épuisés, aucune opération 2026 confirmée.
            </li>
            <li>
              <Link href="/opco/opco-mobilites" className="font-semibold text-cobalt underline">OPCO Mobilités</Link>,{' '}
              <Link href="/opco/uniformation" className="font-semibold text-cobalt underline">Uniformation</Link> et{' '}
              <Link href="/opco/opcommerce" className="font-semibold text-cobalt underline">L&apos;Opcommerce</Link>{' '}:
              aucune opération ouverte confirmée à ce jour (pour OPCO Mobilités, à vérifier auprès
              de son conseiller).
            </li>
          </ul>
          <p className="text-sm">
            Sources :{' '}
            <Source href="https://fse.gouv.fr/les-appels-a-projets/investir-dans-les-competences-pour-accompagner-les-mutations-economiques-0">
              fse.gouv.fr
            </Source>
            {' · '}
            <Source href="https://www.opco-atlas.fr/entreprise/beneficier-fse.html">ATLAS</Source>
            {' · '}
            <Source href="https://www.akto.fr/beneficier-dune-aide-du-fse-en-2025-comment-faire/">AKTO</Source>
            {' · '}
            <Source href="https://www.opcoep.fr/fonds-social-europeen">OPCO EP</Source>
            {' · '}
            <Source href="https://www.ocapiat.fr/fse-une-aide-financiere-pour-former-vos-salaries/">OCAPIAT</Source>
            {' · '}
            <Source href="https://www.afdas.com/entreprise/financer-vos-actions-de-formation/choisir-le-bon-financement/les-subventions-pour-elargir-vos-capacites-de-financement/fonds-social-europeen-fse-2025.html">
              Afdas
            </Source>
            {' · '}
            <Source href="https://www.opco2i.fr/formation-et-financement/subventions/fse-fond-social-europeen/">OPCO 2i</Source>
            {' · '}
            <Source href="https://www.constructys.fr/fse">Constructys</Source>
            {' · '}
            <Source href="https://www.opco-sante.fr/actualites/le-fse-une-opportunite-a-ne-pas-manquer-pour-financer-vos-projets-rh-et-formation/">
              OPCO Santé
            </Source>
          </p>
        </GuideSection>

        <GuideSection id="reconversion" number="05" title="Reconversions : deux voies qui ne consomment pas votre enveloppe formation">
          <ul className="list-disc space-y-3 pl-5">
            <li>
              <strong>La période de reconversion</strong>{' '}(depuis février 2026) : financée par
              l&apos;OPCO sur une enveloppe dédiée, dans la limite de la dotation de France
              compétences, 9,15 €/h à défaut d&apos;accord de branche, montant moyen de prise en
              charge par OPCO fixé à 5 000 € (art. D.6332-90), dossier complet adressé à
              l&apos;OPCO dans les 30 jours calendaires qui précèdent le début de la période de
              reconversion.{' '}
              <Source href="https://entreprendre.service-public.gouv.fr/actualites/A18798">
                service-public.gouv.fr
              </Source>
              {' · '}
              <Source href="https://code.travail.gouv.fr/code-du-travail/l6332-3">
                art. L.6332-3
              </Source>
              {' · '}
              <Source href="https://code.travail.gouv.fr/code-du-travail/d6332-90">
                art. D.6332-90
              </Source>
            </li>
            <li>
              <strong>Le projet de transition professionnelle (PTP)</strong>{' '}: à
              l&apos;initiative du salarié, financé par les associations{' '}
              <strong>Transitions Pro</strong>{' '}régionales (pas par l&apos;OPCO), rémunération
              maintenue à 100 % jusqu&apos;à 2 SMIC. Aucun impact sur le budget formation de
              l&apos;entreprise.{' '}
              <Source href="https://www.transitionspro.fr/nos-dispositifs/projet-de-transition-professionnelle/">
                transitionspro.fr
              </Source>
              {' · '}
              <Source href="https://code.travail.gouv.fr/code-du-travail/d6323-18-4">
                art. D.6323-18-4
              </Source>
            </li>
          </ul>
        </GuideSection>

        <GuideSection id="disparus" number="06" title="Ce qui n'existe plus en 2026">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>FNE-Formation</strong>{' '}: plus de nouveaux financements, les derniers
              accords devaient être conclus fin 2024 et le dispositif n&apos;a pas été doté
              depuis. Méfiez-vous des pages qui le présentent encore comme actif.
            </li>
            <li>
              <strong>Pro-A</strong>{' '}et <strong>Transitions collectives</strong> : absorbées par
              la période de reconversion au 1er février 2026 (les Pro-A signées avant 2026
              restent valables).
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
