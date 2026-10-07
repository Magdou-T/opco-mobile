import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { EMBEDDED_AIDES, EMBEDDED_OPCOS } from '@opco/core';
import type { Financeur } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { Etiquette } from '@/components/ui/Etiquette';
import type { EtiquetteTone } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: 'financementOPCO : estimez le financement de votre formation par votre OPCO',
  description:
    'Simulateur gratuit basé sur les critères officiels 2026 des 11 OPCO : plafonds horaires, budgets annuels, frais annexes. Plus les guides : fonctionnement des OPCO, obligations des entreprises, formations 100 % financées.',
};

/* ============================================================
   Données lues dans le catalogue au moment du build (composant serveur : rien n'est envoyé au navigateur).
   Une famille de financeurs ne s'affiche que si le catalogue contient au moins une aide de cette famille.
   ============================================================ */

const AIDES_ACTIVES = EMBEDDED_AIDES.filter((a) => a.statut !== 'suspendu');

const NB_REGIONS = new Set(
  AIDES_ACTIVES.filter((a) => a.financeur === 'region').flatMap((a) => a.criteres.regions ?? []),
).size;

const FONDS_NON_SALARIES = [
  ...new Set(AIDES_ACTIVES.filter((a) => a.financeur === 'faf').map((a) => a.financeur_nom)),
].join(', ');

interface Famille {
  financeurs: Financeur[];
  icone: IconName;
  titre: string;
  texte: string;
}

const TOUTES_LES_FAMILLES: Famille[] = [
  {
    financeurs: ['opco'],
    icone: 'batiment',
    titre: 'Votre OPCO',
    texte: 'Plan de développement des compétences, alternance, période de reconversion.',
  },
  {
    financeurs: ['region'],
    icone: 'repere',
    titre: 'Votre Région',
    texte: `Aides à la formation et à la rémunération des stagiaires, dans ${NB_REGIONS} régions.`,
  },
  {
    financeurs: ['etat', 'france_travail'],
    icone: 'document',
    titre: "L'État et France Travail",
    texte: "Aides à l'embauche en alternance, préparation opérationnelle à l'emploi, aide individuelle à la formation.",
  },
  {
    financeurs: ['cpf'],
    icone: 'euro',
    titre: 'Le compte personnel de formation',
    texte: "Droits du salarié, abondement de l'employeur, VAE et bilan de compétences.",
  },
  {
    financeurs: ['transitions_pro'],
    icone: 'fleche',
    titre: 'Transitions Pro',
    texte: "Projet de transition professionnelle : la reconversion à l'initiative du salarié, rémunération maintenue.",
  },
  {
    financeurs: ['agefiph'],
    icone: 'personne',
    titre: "L'Agefiph",
    texte: "Aides liées au handicap : embauche en alternance, adaptation de la formation, parcours vers l'emploi.",
  },
  {
    financeurs: ['europe'],
    icone: 'globe',
    titre: "L'Union européenne",
    texte: 'Cofinancements du FSE+ et mobilité Erasmus+ des apprentis et des alternants.',
  },
  {
    financeurs: ['faf'],
    icone: 'mallette',
    titre: 'Les fonds des non-salariés',
    texte: `${FONDS_NON_SALARIES} : la formation des dirigeants non salariés.`,
  },
];

const FAMILLES = TOUTES_LES_FAMILLES.filter((f) => AIDES_ACTIVES.some((a) => f.financeurs.includes(a.financeur)));

const ETAPES = [
  {
    titre: "Identifiez l'entreprise",
    texte:
      'Saisissez son nom ou son SIREN. Le simulateur retrouve sa convention collective dans la base officielle et en déduit son OPCO.',
  },
  {
    titre: 'Décrivez la formation',
    texte:
      "Durée et coût de la formation, situation du salarié, frais de transport, d'hébergement et de repas.",
  },
  {
    titre: 'Lisez votre plan de financement',
    texte:
      "Le calcul se lit poste par poste, chaque montant avec sa source. Le récapitulatif s'imprime pour accompagner votre demande.",
  },
];

const FIABILITE = [
  {
    confidence: 'exact' as const,
    texte: "Le montant figure tel quel sur le site officiel de l'OPCO : nous affichons la valeur et le lien vers la page source.",
  },
  {
    confidence: 'estimated' as const,
    texte:
      "Le montant est reconstitué à partir de documents officiels partiels. L'ordre de grandeur est fiable, le montant exact peut varier.",
  },
  {
    confidence: 'depends_on_branche' as const,
    texte:
      "L'OPCO ne publie pas de barème national : le montant dépend de votre convention collective. Nous le disons plutôt que d'inventer un chiffre.",
  },
];

const DOMAINES: { label: string; tone: EtiquetteTone }[] = [
  { label: 'Bureautique et TOSA', tone: 'orange' },
  { label: 'Langues', tone: 'turquoise' },
  { label: 'Intelligence artificielle', tone: 'vert-clair' },
  { label: 'Santé et sécurité au travail', tone: 'rouge' },
  { label: 'Soft skills', tone: 'orange' },
  { label: 'Certifications', tone: 'or' },
];

const delai = (ms: number) => ({ '--delai': `${ms}ms` }) as CSSProperties;

/* ============================================================
   Aperçu « plan de financement » du hero : un exemple aux montants fictifs, en HTML et CSS.
   ============================================================ */
function ApercuPlan() {
  return (
    <figure className="mx-auto w-full max-w-[33rem] lg:mr-0">
      <div className="relative">
        {/* Aplat turquoise de la marque : décor seul, aucun texte posé dessus */}
        <div aria-hidden="true" className="decor aplat-turquoise absolute inset-0 overflow-hidden rounded-panneau">
          {/* Rail et jalons de l'animation de marque */}
          <span className="absolute right-8 bottom-8 left-8 h-1.5">
            <span className="absolute inset-0 rounded-full bg-white/25" />
            <span className="absolute inset-y-0 left-0 w-[58%] rounded-full bg-white/80" />
            {[0, 29, 58].map((x) => (
              <span
                key={x}
                className="absolute top-1/2 size-[1.15rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-turquoise"
                style={{ left: `${x}%` }}
              />
            ))}
          </span>
        </div>

        <div className="relative px-5 pt-12 pb-20 sm:px-10 sm:pt-14">
          <div className="apparition rounded-carte bg-white p-5 shadow-flottante sm:p-6" style={delai(120)}>
            <div className="flex items-center justify-between gap-3">
              <p className="marginalia">Plan de financement</p>
              <Etiquette tone="or">Exemple</Etiquette>
            </div>
            <p className="mt-2 font-display text-lg leading-snug font-semibold text-texte">
              Formation bureautique · 35 h
            </p>

            <dl className="mt-4 divide-y divide-filet border-y border-filet text-sm">
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-texte-doux">Coûts pédagogiques</dt>
                <dd className="amount text-texte">1 750 €</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-texte-doux">Plafond horaire de l&apos;OPCO</dt>
                <dd className="amount text-texte">25 €/h</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="font-semibold text-texte">Prise en charge estimée</dt>
                <dd className="amount text-2xl text-texte">
                  <span className="mark">875 €</span>
                </dd>
              </div>
            </dl>

            <div className="mt-4" aria-hidden="true">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-lin">
                <span className="w-1/2 rounded-full bg-turquoise" />
              </div>
              <div className="mt-2 flex justify-between text-xs text-texte-discret">
                <span>Financé : 50 %</span>
                <span>Reste à charge : 875 €</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <ConfidenceBadge confidence="exact" />
              <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-deep">
                <Icon name="lien-externe" className="size-3.5" />
                Source officielle
              </span>
            </div>
          </div>
        </div>

        {/* Étiquettes flottantes : ce qu'un OPCO peut financer (décor) */}
        <div aria-hidden="true" className="decor">
          <Etiquette
            variante="flottante"
            tone="orange"
            className="apparition absolute top-[-0.9rem] left-4 sm:left-6"
            style={delai(420)}
          >
            Coûts pédagogiques
          </Etiquette>
          <Etiquette
            variante="flottante"
            tone="or"
            className="apparition absolute top-[-0.9rem] right-4 sm:right-10"
            style={delai(520)}
          >
            Salaires
          </Etiquette>
          <Etiquette
            variante="flottante"
            tone="turquoise"
            className="apparition absolute right-4 bottom-[1.05rem] sm:right-6"
            style={delai(620)}
          >
            Frais annexes
          </Etiquette>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-texte-discret lg:text-right">
        Exemple illustratif, montants fictifs.
      </figcaption>
    </figure>
  );
}

export default function Home() {
  return (
    <main>
      {/* ================= HERO ================= */}
      <section className="overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-8 sm:px-6 sm:pt-14 lg:pt-16 lg:pb-10">
          <p className="surtitre apparition">Simulateur · critères officiels 2026 · {EMBEDDED_OPCOS.length} OPCO</p>
          <h1 className="apparition mt-5 text-affiche font-bold text-texte" style={delai(60)}>
            Votre entreprise cotise.
            <br />
            Votre formation peut être <span className="mark">prise en charge</span>.
          </h1>
        </div>
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 lg:pb-20">
          <div className="lg:pt-8">
            <p className="apparition max-w-xl text-chapeau text-texte-doux" style={delai(140)}>
              Chaque année, votre entreprise verse une contribution légale à la formation professionnelle. En
              retour, son OPCO peut financer les coûts pédagogiques, les salaires et les frais annexes d&apos;une
              formation, à condition d&apos;en connaître les barèmes. financementOPCO les a rassemblés et cite
              pour chacun sa source officielle.
            </p>
            <div className="apparition mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap" style={delai(220)}>
              <Button href="/simulateur" size="lg" fleche pleineLargeur="mobile">
                Estimer mon financement
              </Button>
              <Button href="/comprendre-les-opco" variant="secondary" size="lg" pleineLargeur="mobile">
                D&apos;abord comprendre
              </Button>
            </div>
            <p className="apparition mt-5 flex items-start gap-2 text-sm text-texte-discret" style={delai(280)}>
              <Icon name="bouclier" className="mt-px size-[18px] shrink-0 text-turquoise-deep" />
              Gratuit, sans inscription. Chaque montant indique sa source officielle et son niveau de fiabilité.
            </p>
          </div>

          <ApercuPlan />
        </div>
      </section>

      {/* ================= COMMENT ÇA MARCHE ================= */}
      <section aria-labelledby="titre-etapes" className="border-y border-filet/70 bg-lin-soft">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <SectionTitle
            id="titre-etapes"
            surtitre="Comment ça marche"
            titre="De votre SIREN à votre plan de financement"
            chapeau="Comptez environ cinq minutes. Gardez sous la main le nom ou le SIREN de l'entreprise, puis la durée et le coût de la formation."
          />

          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {ETAPES.map((e, i) => (
              <li
                key={e.titre}
                className={`relative pl-16 md:pl-0 ${
                  i < ETAPES.length - 1
                    ? "after:absolute after:top-14 after:-bottom-8 after:left-[1.375rem] after:w-1 after:rounded-full after:bg-turquoise/45 after:content-[''] md:after:top-[1.375rem] md:after:-right-4 md:after:bottom-auto md:after:left-16 md:after:h-1 md:after:w-auto"
                    : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 grid size-12 place-items-center rounded-full bg-turquoise-deep font-display text-lg font-bold text-white ring-[5px] ring-lin-soft md:static"
                >
                  {i + 1}
                </span>
                <h3 className="text-xl leading-snug font-bold tracking-[-0.015em] text-texte md:mt-6">
                  <span className="sr-only">Étape {i + 1} : </span>
                  {e.titre}
                </h3>
                <p className="mt-2 max-w-sm leading-relaxed text-texte-doux">{e.texte}</p>
              </li>
            ))}
          </ol>

          <Card className="mt-14" padding="lg">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-turquoise-soft text-turquoise-deep">
                <Icon name="bouclier" className="size-5" />
              </span>
              <h3 className="text-lg leading-snug font-bold tracking-[-0.015em] text-texte sm:text-xl">
                Une étiquette de fiabilité sur chaque montant
              </h3>
            </div>
            <ul className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8">
              {FIABILITE.map((f) => (
                <li key={f.confidence}>
                  <ConfidenceBadge confidence={f.confidence} />
                  <p className="mt-3 text-sm leading-relaxed text-texte-doux">{f.texte}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* ================= CE QUE LE SIMULATEUR RECHERCHE ================= */}
      <section aria-labelledby="titre-financeurs">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <SectionTitle
            id="titre-financeurs"
            surtitre="Ce que le simulateur recherche"
            titre="Votre OPCO d'abord, puis les autres financeurs"
            chapeau="Le simulateur part des barèmes de votre OPCO, puis passe en revue un catalogue d'aides publiques. Pour chacune, il vérifie si votre situation remplit les critères publiés."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FAMILLES.map((f, i) => (
              <Card as="li" key={f.titre} padding="none" className="flex gap-4 p-4 sm:flex-col sm:gap-0 sm:p-6">
                {/* L'OPCO, point de départ du calcul, prend la couleur de l'action ; les autres financeurs, celle de l'identité */}
                <span
                  aria-hidden="true"
                  className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                    i === 0 ? 'bg-orange-soft text-orange-deep' : 'bg-turquoise-soft text-turquoise-deep'
                  }`}
                >
                  <Icon name={f.icone} className="size-[22px]" />
                </span>
                <div className="sm:mt-4">
                  <h3 className="text-base leading-snug font-bold tracking-[-0.01em] text-texte sm:text-[1.0625rem]">
                    {f.titre}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-texte-doux sm:mt-1.5">{f.texte}</p>
                </div>
              </Card>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-texte-doux">
            Former sans entamer le budget annuel de l&apos;entreprise : actions collectives, CPF, FSE+.{' '}
            <Link href="/former-sans-budget" className="lien">
              Lire le guide Se former sans budget
            </Link>
          </p>
        </div>
      </section>

      {/* ================= LES 11 OPCO ================= */}
      <section aria-labelledby="titre-opco" className="border-y border-filet/70 bg-lin-soft">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <SectionTitle
              id="titre-opco"
              surtitre="Le répertoire"
              titre={`Les ${EMBEDDED_OPCOS.length} opérateurs de compétences`}
              chapeau="Chaque entreprise relève d'un seul OPCO, déterminé par sa convention collective. Chaque fiche rassemble les barèmes publiés, leur source et les dispositifs complémentaires."
            />
            <Button href="/opco" variant="ghost" fleche>
              Toutes les fiches
            </Button>
          </div>

          <ul className="mt-10 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {EMBEDDED_OPCOS.map((o) => (
              <Card as="li" key={o.slug} interactive padding="none" className="group">
                <div className="p-4 pr-12 sm:p-5 sm:pr-12">
                  <h3 className="text-base leading-snug font-bold tracking-[-0.01em] text-texte sm:text-[1.0625rem]">
                    <Link href={`/opco/${o.slug}/`} className="lien-etendu">
                      {o.name}
                    </Link>
                  </h3>
                  <p className="mt-1 line-clamp-1 text-sm leading-relaxed text-texte-discret sm:mt-1.5 sm:line-clamp-2">
                    {o.secteurs}
                  </p>
                </div>
                <Icon
                  name="fleche"
                  className="absolute top-4 right-4 size-5 text-orange-deep transition-transform duration-200 group-hover:translate-x-0.5 sm:top-5 sm:right-5"
                />
              </Card>
            ))}
            <Card as="li" tone="turquoise" interactive padding="none" className="group">
              <div className="p-4 pr-12 sm:p-5 sm:pr-12">
                <h3 className="text-base leading-snug font-bold tracking-[-0.01em] sm:text-[1.0625rem]">
                  <Link href="/simulateur" className="lien-etendu">
                    Vous ne connaissez pas votre OPCO
                  </Link>
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-white sm:mt-1.5">
                  Le simulateur l&apos;identifie à partir du nom ou du SIREN de l&apos;entreprise.
                </p>
              </div>
              <Icon
                name="fleche"
                className="absolute top-4 right-4 size-5 text-white transition-transform duration-200 group-hover:translate-x-0.5 sm:top-5 sm:right-5"
              />
            </Card>
          </ul>
        </div>
      </section>

      {/* ================= APPEL À L'ACTION ================= */}
      <section aria-labelledby="titre-appel" className="surface-orange relative overflow-hidden">
        <div aria-hidden="true" className="decor pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] md:block">
          <span className="absolute top-1/2 right-[-3rem] left-0 h-1.5 -translate-y-1/2 rounded-full bg-white/20" />
          {[12, 46, 80].map((x) => (
            <span
              key={x}
              className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70 bg-orange-deep"
              style={{ left: `${x}%` }}
            />
          ))}
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between md:py-16">
          <div className="max-w-xl">
            <h2 id="titre-appel" className="text-titre font-bold">
              Cinq minutes pour chiffrer votre projet
            </h2>
            <p className="mt-3 text-chapeau text-white">
              Le simulateur trouve votre OPCO à partir du SIREN et détaille le calcul poste par poste. Le
              récapitulatif imprimable accompagne votre demande.
            </p>
          </div>
          <Button href="/simulateur" variant="inverse" size="lg" fleche pleineLargeur="mobile" className="shrink-0">
            Estimer mon financement
          </Button>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section aria-labelledby="titre-contact">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-16 pb-2 sm:px-6 md:pt-20 md:pb-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div>
            <SectionTitle
              id="titre-contact"
              surtitre="Un service SFG Développement"
              titre="Un conseiller pour monter votre dossier"
              chapeau="Derrière financementOPCO, l'équipe SFG Développement monte des dossiers de financement et organise des formations pour les entreprises. Décrivez votre projet : nous vous répondons sous 48 h ouvrées."
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button href="/contact" size="lg" pleineLargeur="mobile">
                Écrire à SFG Développement
              </Button>
              <Button href="mailto:contact@sfgdeveloppement.fr" variant="ghost" icone="courriel">
                contact@sfgdeveloppement.fr
              </Button>
            </div>
          </div>

          <Card tone="teintee" padding="lg">
            <p className="surtitre">Nos domaines de formation</p>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {DOMAINES.map((d) => (
                <Etiquette key={d.label} as="li" variante="flottante" tone={d.tone}>
                  {d.label}
                </Etiquette>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-texte-doux">
              Joignez le récapitulatif imprimable du simulateur à votre message : il contient les informations
              utiles pour étudier votre prise en charge.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
