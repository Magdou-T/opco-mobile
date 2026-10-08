import Link from 'next/link';
import type { Metadata } from 'next';
import { EMBEDDED_AIDES, EMBEDDED_OPCOS } from '@opco/core';
import type { Financeur } from '@opco/core';
import { delai } from '@/lib/apparition';
import { cx } from '@/lib/cx';
import { DOMAINES_DE_FORMATION } from '@/lib/domaines';
import { extrait } from '@/lib/extrait';
import { typo } from '@/lib/format';
import { BandeAppel } from '@/components/site/BandeAppel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: 'financementOPCO : trouvez tous les financements de votre formation',
  description:
    'Simulateur gratuit : OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe. Les aides et financements de votre formation, avec leurs montants indicatifs et leurs sources officielles. Plus les guides : fonctionnement des OPCO, obligations des entreprises, formations 100 % financées.',
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
      "Coût, financé, reste à charge : les financements s'empilent jusqu'au coût de la formation, chaque aide avec sa source. Le plan s'imprime pour accompagner votre demande.",
  },
];

const FIABILITE = [
  {
    confidence: 'exact' as const,
    texte: 'Le montant figure tel quel sur le site officiel du financeur : nous affichons la valeur et le lien vers la page source.',
  },
  {
    confidence: 'estimated' as const,
    texte:
      "Le montant est reconstitué à partir de documents officiels partiels. L'ordre de grandeur est fiable, le montant exact peut varier.",
  },
  {
    confidence: 'depends_on_branche' as const,
    texte:
      "Le financeur ne publie pas de barème unique : le montant dépend de votre branche ou de votre dossier. Nous le disons plutôt que d'inventer un chiffre.",
  },
];

/** Fiches d'OPCO montrées sur téléphone (sous 640 px) ; les autres restent dans la liste, masquées, et toutes sont sur /opco/. */
const OPCO_SUR_TELEPHONE = 6;

/** Ligne de secteurs d'une carte d'OPCO : extrait de 96 caractères au plus (`lib/extrait.ts`), typographie française. */
const secteurs = (texte: string): string => typo(extrait(texte, 96));

/* ============================================================
   Aperçu « plan de financement » du hero : un exemple aux montants fictifs, en HTML et CSS. Seule l'étiquette
   « Exemple » y figure : ni étiquette de fiabilité ni lien de source sur des montants inventés.
   ============================================================ */
function ApercuPlan() {
  return (
    <figure className="mx-auto w-full max-w-[33rem] lg:mr-0">
      <div className="relative">
        {/* Aplat turquoise de la marque : décor seul, aucun texte posé dessus */}
        <div aria-hidden="true" className="decor aplat-turquoise absolute inset-0 overflow-hidden rounded-panneau">
          {/* Rail et jalons de l'animation de marque */}
          <span className="absolute right-8 bottom-7 left-8 h-1.5 sm:bottom-8">
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

        <div className="relative px-5 pt-7 pb-16 sm:px-10 sm:pt-10 sm:pb-20">
          <div className="apparition rounded-carte bg-white p-5 shadow-flottante sm:p-6" style={delai(120)}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.6875rem] leading-[1.4] font-semibold tracking-[0.12em] text-texte-discret uppercase">
                Plan de financement
              </p>
              <Etiquette tone="or">Exemple</Etiquette>
            </div>
            <p className="mt-2 font-display text-lg leading-snug font-semibold text-texte">
              Formation bureautique · 35&nbsp;h
            </p>

            <dl className="mt-4 divide-y divide-filet border-y border-filet text-sm">
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-texte-doux">Coûts pédagogiques</dt>
                <dd className="amount text-texte">1&nbsp;750&nbsp;€</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-texte-doux">Plafond horaire de l&apos;OPCO</dt>
                <dd className="amount text-texte">25&nbsp;€/h</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="font-semibold text-texte">Prise en charge estimée</dt>
                <dd className="amount text-2xl text-texte">
                  <span className="mark">875&nbsp;€</span>
                </dd>
              </div>
            </dl>

            <div className="mt-4" aria-hidden="true">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-lin">
                <span className="w-1/2 rounded-full bg-turquoise" />
              </div>
              <div className="mt-2 flex justify-between text-xs text-texte-discret">
                <span>Financé&nbsp;: 50&nbsp;%</span>
                <span>Reste à charge&nbsp;: 875&nbsp;€</span>
              </div>
            </div>
          </div>
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
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 lg:pb-20">
          <div className="lg:pt-8">
            <p className="apparition max-w-xl text-chapeau text-texte-doux" style={delai(140)}>
              Chaque année, votre entreprise verse une contribution légale à la formation professionnelle. Son OPCO
              peut en retour financer une formation, et d&apos;autres financeurs s&apos;y ajoutent&nbsp;: CPF, Région,
              France Travail, Transitions Pro, Agefiph, Europe. financementOPCO passe en revue tous ces financements et
              retient ceux qui correspondent à votre projet.
            </p>
            <div className="apparition mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap" style={delai(220)}>
              <Button href="/simulateur" size="lg" fleche pleineLargeur="mobile">
                Trouver mes financements
              </Button>
              <Button href="/comprendre-les-opco" variant="secondary" size="lg" pleineLargeur="mobile">
                D&apos;abord comprendre
              </Button>
            </div>
            <p className="apparition mt-5 flex items-start gap-2 text-sm text-texte-discret" style={delai(280)}>
              <Icon name="bouclier" className="mt-px size-[18px] shrink-0 text-turquoise" />
              Gratuit, sans inscription. Chaque aide est accompagnée de sa source officielle et de son niveau de
              fiabilité&nbsp;; les estimations sont signalées.
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
          />

          {/* Rail et jalons au turquoise de la marque : numéros #1A1A1A sur turquoise (5,68:1), décor du rail sans
              exigence de contraste (la liste ordonnée et « Étape n » portent l'ordre). */}
          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {ETAPES.map((e, i) => (
              <li
                key={e.titre}
                className={cx(
                  'relative pl-16 md:pl-0',
                  i < ETAPES.length - 1 &&
                    "after:absolute after:top-14 after:-bottom-8 after:left-[1.375rem] after:w-1 after:rounded-full after:bg-turquoise after:content-[''] md:after:top-[1.375rem] md:after:-right-4 md:after:bottom-auto md:after:left-16 md:after:h-1 md:after:w-auto",
                )}
              >
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-0 grid size-12 place-items-center rounded-full bg-turquoise font-display text-lg font-bold text-texte ring-[5px] ring-lin-soft md:static"
                >
                  {i + 1}
                </span>
                <h3 className="text-xl leading-snug font-bold tracking-[-0.015em] text-texte md:mt-6">
                  <span className="sr-only">Étape {i + 1} : </span>
                  {e.titre}
                </h3>
                <p className="mt-2 max-w-sm leading-relaxed text-texte-doux">{typo(e.texte)}</p>
              </li>
            ))}
          </ol>

          <Card className="mt-14" padding="lg">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-turquoise-soft text-turquoise-deep">
                <Icon name="bouclier" className="size-5" />
              </span>
              <h3 className="text-lg leading-snug font-bold tracking-[-0.015em] text-texte sm:text-xl">
                Une étiquette de fiabilité sur chaque aide
              </h3>
            </div>
            <ul className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8">
              {FIABILITE.map((f) => (
                <li key={f.confidence}>
                  <ConfidenceBadge confidence={f.confidence} />
                  <p className="mt-3 text-sm leading-relaxed text-texte-doux">{typo(f.texte)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* ================= CE QUE LE SIMULATEUR RECHERCHE ================= */}
      {/* Chaque phrase est vérifiée contre l'écran de résultats (W5) : plan de l'OPCO pour les projets salariés, catalogue
          d'aides évalué pour tout projet, aides groupées par financeur (DESIGN.md, sections 11 et 15). */}
      <section aria-labelledby="titre-financeurs">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <SectionTitle
            id="titre-financeurs"
            surtitre="Ce que le simulateur recherche"
            titre="Votre OPCO d'abord, puis les autres financeurs"
            chapeau="Pour former ou reconvertir un salarié, le simulateur part des barèmes de votre OPCO. Pour tout projet, il passe en revue un catalogue d'aides et de financements et vérifie, pour chacun, si votre situation remplit les critères publiés."
          />
          <ul className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {FAMILLES.map((f, i) => (
              <Card as="li" key={f.titre} padding="none" className="flex gap-4 p-4 sm:flex-col sm:gap-0 sm:p-6">
                {/* L'OPCO, point de départ du calcul, prend la couleur de l'action ; les autres financeurs, celle de l'identité */}
                <span
                  aria-hidden="true"
                  className={cx(
                    'grid size-11 shrink-0 place-items-center rounded-2xl',
                    i === 0 ? 'bg-orange-soft text-orange-deep' : 'bg-turquoise-soft text-turquoise-deep',
                  )}
                >
                  <Icon name={f.icone} className="size-[22px]" />
                </span>
                <div className="sm:mt-4">
                  <h3 className="text-base leading-snug font-bold tracking-[-0.01em] text-texte sm:text-[1.0625rem]">
                    {f.titre}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-texte-doux sm:mt-1.5">{typo(f.texte)}</p>
                </div>
              </Card>
            ))}
          </ul>
          <p className="mt-8 max-w-2xl text-texte-doux">
            Former sans entamer le budget annuel de l&apos;entreprise&nbsp;: actions collectives, CPF, FSE+.{' '}
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
            <div className="hidden sm:block">
              <Button href="/opco" variant="ghost" fleche>
                Toutes les fiches
              </Button>
            </div>
          </div>

          {/* La liste ne compte que les OPCO ; `contents` range ses éléments dans la grille, à côté de la tuile qui la
              suit. Sur téléphone, les six premières fiches seulement, puis un lien vers toutes. */}
          <div className="mt-10 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
            <ul role="list" className="contents">
              {EMBEDDED_OPCOS.map((o, i) => (
                <Card
                  as="li"
                  key={o.slug}
                  interactive
                  padding="none"
                  className={cx('group', i >= OPCO_SUR_TELEPHONE && 'max-sm:hidden')}
                >
                  <div className="p-4 sm:p-5">
                    <h3 className="pr-8 text-base leading-snug font-bold tracking-[-0.01em] text-texte sm:text-[1.0625rem]">
                      <Link href={`/opco/${o.slug}/`} className="lien-etendu">
                        {o.name}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-texte-discret sm:mt-1.5">{secteurs(o.secteurs)}</p>
                  </div>
                  <Icon
                    name="fleche"
                    className="absolute top-4 right-4 size-5 text-orange-deep transition-transform duration-200 group-hover:translate-x-0.5 sm:top-5 sm:right-5"
                  />
                </Card>
              ))}
            </ul>
            {/* Pas de second dégradé à 100 px de la bande d'appel : la tuile est teintée, sa flèche orange. */}
            <Card tone="teintee" interactive padding="none" className="group">
              <div className="p-4 sm:p-5">
                <p className="pr-8 font-display text-base leading-snug font-bold tracking-[-0.01em] text-texte sm:text-[1.0625rem]">
                  <Link href="/simulateur" className="lien-etendu">
                    Vous ne connaissez pas votre OPCO
                  </Link>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-texte-doux sm:mt-1.5">
                  Le simulateur le retrouve à partir du nom ou du SIREN de l&apos;entreprise.
                </p>
              </div>
              <Icon
                name="fleche"
                className="absolute top-4 right-4 size-5 text-orange-deep transition-transform duration-200 group-hover:translate-x-0.5 sm:top-5 sm:right-5"
              />
            </Card>
          </div>
          <div className="mt-6 sm:hidden">
            <Button href="/opco" variant="ghost" fleche>
              Voir les {EMBEDDED_OPCOS.length} fiches
            </Button>
          </div>
        </div>
      </section>

      {/* ================= APPEL À L'ACTION ================= */}
      <BandeAppel id="titre-appel" titre="Cinq minutes pour chiffrer votre projet" libelle="Trouver mes financements" />

      {/* ================= CONTACT ================= */}
      <section aria-labelledby="titre-contact">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-16 pb-2 sm:px-6 md:pt-20 md:pb-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div>
            <SectionTitle
              id="titre-contact"
              surtitre="Un service SFG Développement"
              titre="Un conseiller pour monter votre dossier"
              chapeau="Derrière financementOPCO, l'équipe SFG Développement monte des dossiers de financement et organise des formations pour les entreprises. Décrivez votre projet&nbsp;: nous vous répondons sous 48&nbsp;h ouvrées."
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
              {DOMAINES_DE_FORMATION.map((d) => (
                <Etiquette key={d.label} as="li" variante="flottante" tone={d.tone}>
                  {d.label}
                </Etiquette>
              ))}
            </ul>
          </Card>
        </div>
      </section>
    </main>
  );
}
