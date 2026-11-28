import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { EMBEDDED_AIDES, EMBEDDED_OPCOS } from '@opco/core';
import type { Financeur } from '@opco/core';
import { delai } from '@/lib/apparition';
import { CONTACT_EMAIL } from '@/lib/contact';
import { DOMAINES_DE_FORMATION } from '@/lib/domaines';
import { grapheDePage } from '@/lib/donnees-structurees';
import type { QuestionReponse } from '@/lib/donnees-structurees';
import { extrait } from '@/lib/extrait';
import { trierParNom } from '@/lib/fiche';
import { typo } from '@/lib/format';
import { PAGES, metadonnees } from '@/lib/metadonnees';
import { SFG_DEVELOPPEMENT } from '@/lib/sites-lies';
import { BandeAppel } from '@/components/site/BandeAppel';
import { DonneesStructurees } from '@/components/site/DonneesStructurees';
import { QuestionsFrequentes } from '@/components/site/QuestionsFrequentes';
import { Button } from '@/components/ui/Button';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';

export const metadata: Metadata = metadonnees(PAGES.accueil);

/* ============================================================
   Accueil (charte financementopco, maquette reference/accueil.html du kit d'identité) : hero avec un plan de
   financement d'exemple sur une feuille, puis des sections numérotées en DM Mono dans une colonne de repères, des
   filets et des tableaux plutôt que des cartes. Données lues dans le catalogue au build (composant serveur).
   ============================================================ */

const AIDES_ACTIVES = EMBEDDED_AIDES.filter((a) => a.statut !== 'suspendu');

const NB_REGIONS = new Set(
  AIDES_ACTIVES.filter((a) => a.financeur === 'region').flatMap((a) => a.criteres.regions ?? []),
).size;

const FONDS_NON_SALARIES = [
  ...new Set(AIDES_ACTIVES.filter((a) => a.financeur === 'faf').map((a) => a.financeur_nom)),
].join(', ');

/** Une famille de financeurs ne s'affiche que si le catalogue contient au moins une aide de cette famille. */
const TOUTES_LES_FAMILLES: { financeurs: Financeur[]; titre: string; texte: string }[] = [
  {
    financeurs: ['opco'],
    titre: 'Votre OPCO',
    texte: 'Plan de développement des compétences, alternance, période de reconversion.',
  },
  {
    financeurs: ['region'],
    titre: 'Votre Région',
    texte: `Aides à la formation et à la rémunération des stagiaires, dans les ${NB_REGIONS} régions.`,
  },
  {
    financeurs: ['etat', 'france_travail'],
    titre: "L'État et France Travail",
    texte: "Aides à l'embauche en alternance, préparation opérationnelle à l'emploi, aide individuelle à la formation.",
  },
  {
    financeurs: ['cpf'],
    titre: 'Le compte personnel de formation',
    texte:
      "Droits du salarié, abondement de l'employeur, validation des acquis de l'expérience (VAE) et bilan de compétences.",
  },
  {
    financeurs: ['transitions_pro'],
    titre: 'Transitions Pro',
    texte: "Projet de transition professionnelle : la reconversion à l'initiative du salarié, rémunération maintenue.",
  },
  {
    financeurs: ['agefiph'],
    titre: "L'Agefiph",
    texte: "Aides liées au handicap : embauche en alternance, adaptation de la formation, parcours vers l'emploi.",
  },
  {
    financeurs: ['europe'],
    titre: "L'Union européenne",
    texte: 'Cofinancements du Fonds social européen plus (FSE+) et mobilité Erasmus+ des apprentis et des alternants.',
  },
  {
    financeurs: ['faf'],
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
    texte: "Durée et coût de la formation, situation du salarié, frais de transport, d'hébergement et de repas.",
  },
  {
    titre: 'Lisez votre plan',
    texte:
      "Coût, financé, reste à charge : les financements s'empilent jusqu'au coût de la formation, chacun avec sa source. Le plan s'imprime pour accompagner votre demande.",
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

/** Une entrée par public : chacun trouve en un clic la page qui part de sa situation. */
const PROFILS = [
  {
    href: '/employeurs/',
    titre: 'Vous êtes employeur',
    texte: "Former vos salariés, recruter en alternance, vos obligations : ce que finance l'OPCO selon votre taille.",
  },
  {
    href: '/salaries/',
    titre: 'Vous êtes salarié',
    texte: 'Plan de formation, CPF, reconversion, VAE, bilan de compétences : les financements à votre portée.',
  },
  {
    href: '/demandeurs-emploi/',
    titre: 'Vous cherchez un emploi',
    texte: 'CPF, aide de France Travail, formations de la Région, embauche avec formation préalable.',
  },
  {
    href: '/cpf/',
    titre: 'Vous utilisez votre CPF',
    texte: 'Vos droits, le reste à charge, les abondements et les pièges à éviter avant de valider un dossier.',
  },
];

/* Questions fréquentes de l'accueil : affichées telles quelles et reprises dans les données structurées. */
const QUESTIONS: QuestionReponse[] = [
  {
    question: "Qu'est-ce qu'un OPCO ?",
    reponse:
      "Un opérateur de compétences (OPCO) est un organisme agréé par l'État qui finance l'alternance, la reconversion des salariés et, pour les entreprises de moins de 50 salariés, le plan de développement des compétences. Il en existe 11, chacun pour un ensemble de branches professionnelles.",
  },
  {
    question: 'Comment savoir quel est mon OPCO ?',
    reponse:
      "Votre OPCO dépend de la convention collective appliquée par l'entreprise, identifiée par son code IDCC, souvent indiqué sur le bulletin de paie. Le simulateur le retrouve à partir du nom ou du SIREN de l'entreprise ; la page « Quel est mon OPCO ? » détaille la méthode.",
  },
  {
    question: 'Qui peut utiliser financementopco ?',
    reponse:
      "Les employeurs qui forment ou recrutent, les salariés qui préparent une formation ou une reconversion, les demandeurs d'emploi et les dirigeants non salariés. Le simulateur part de votre situation et recherche les financements qui s'y appliquent.",
  },
  {
    question: 'Les montants affichés sont-ils garantis ?',
    reponse:
      "Non. Ce sont des estimations établies à partir des critères publiés par chaque financeur, avec leur source et leur date de vérification. Seul le financeur (OPCO, Caisse des dépôts, France Travail, Région) décide de la prise en charge, après étude du dossier.",
  },
  {
    question: 'Une entreprise de 50 salariés ou plus peut-elle être financée par son OPCO ?',
    reponse:
      "Pas sur les fonds mutualisés du plan de développement des compétences, réservés aux entreprises de moins de 50 salariés. Restent l'alternance, la période de reconversion, les contributions conventionnelles de la branche, les versements volontaires et, selon l'OPCO, des actions collectives ou un cofinancement FSE+.",
  },
  {
    question: 'Le simulateur est-il gratuit ?',
    reponse:
      "Oui, sans inscription. Le calcul se fait dans votre navigateur : aucune réponse n'est conservée et le site ne dépose aucun cookie.",
  },
];

const GRAPHE = grapheDePage({
  chemin: PAGES.accueil.chemin,
  titre: PAGES.accueil.titre,
  description: PAGES.accueil.description,
  nomCourt: 'Accueil',
  questions: QUESTIONS,
});

/** Les OPCO dans l'ordre alphabétique (article élidé ignoré : L'Opcommerce se range à O). */
const OPCOS = trierParNom(EMBEDDED_OPCOS);

/** Branches couvertes par un OPCO : extrait de 96 caractères au plus (`lib/extrait.ts`), typographie française. */
const secteurs = (texte: string): string => typo(extrait(texte, 96));

/* ============================================================
   Mise en page commune : une colonne de repères (« 01 · Méthode », DM Mono) puis le contenu, séparés par un filet.
   ============================================================ */

function Section({
  id,
  repere,
  titre,
  chapeau,
  fonce = false,
  children,
}: {
  id: string;
  repere: string;
  titre: ReactNode;
  chapeau?: string;
  fonce?: boolean;
  children: ReactNode;
}) {
  const idTitre = `titre-${id}`;
  return (
    <section aria-labelledby={idTitre} className={fonce ? 'bg-papier-fonce' : undefined}>
      <div className="mx-auto grid max-w-6xl gap-4 border-t border-filet px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-12">
        <p className="surtitre self-start lg:pt-4">{repere}</p>
        <div className="min-w-0">
          <h2 id={idTitre} className="max-w-3xl text-titre text-texte">
            {titre}
          </h2>
          {chapeau && <p className="mt-5 max-w-2xl text-chapeau text-texte-doux">{typo(chapeau)}</p>}
          <div className="mt-10 md:mt-12">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Ligne libellé · pointillés · montant d'un plan de financement. */
function LigneMontant({ libelle, montant }: { libelle: string; montant: string }) {
  return (
    <div className="ligne-montant">
      <dt className="text-texte-doux">{libelle}</dt>
      <span aria-hidden="true" className="pointilles" />
      <dd className="amount text-texte">{montant}</dd>
    </div>
  );
}

/* Plan de financement d'exemple (montants fictifs) : feuille du kit. Seule l'étiquette « Exemple » y figure : ni
   étiquette de fiabilité ni lien de source sur des montants inventés. */
function PlanDeFinancement() {
  return (
    <figure className="apparition mx-auto w-full max-w-[30rem] lg:mr-0" style={delai(120)}>
      <div className="feuille p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs tracking-[0.06em] text-ardoise uppercase">Plan de financement</p>
          <Etiquette>Exemple</Etiquette>
        </div>
        <p className="mt-3 border-b border-encre pb-3 font-display text-2xl leading-snug text-texte">
          Formation bureautique, 35&nbsp;heures
        </p>
        <dl className="mt-5 space-y-3 text-[0.9375rem]">
          <LigneMontant libelle="Coûts pédagogiques" montant={'1 750,00 €'} />
          <LigneMontant libelle="Plafond horaire de l'OPCO" montant={'25,00 €/h'} />
          <LigneMontant libelle="Durée retenue" montant={'35 h'} />
        </dl>
        <dl className="mt-5 space-y-3 border-t border-encre pt-4 text-[0.9375rem]">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-semibold text-texte">Prise en charge OPCO</dt>
            <dd className="montant-cle text-2xl text-texte">875,00&nbsp;€</dd>
          </div>
          <LigneMontant libelle="Reste à charge" montant={'875,00 €'} />
        </dl>
        <div className="mt-6" aria-hidden="true">
          <div className="flex h-3.5 border border-encre">
            <span className="w-1/2 bg-prusse" />
            <span className="w-1/2 bg-papier-fonce" />
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-texte-discret">
            <span>Financé · 50&nbsp;%</span>
            <span>Reste à charge · 50&nbsp;%</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-5 text-center text-xs text-texte-discret lg:text-right">
        Exemple illustratif, montants fictifs.
      </figcaption>
    </figure>
  );
}

export default function Home() {
  return (
    <main>
      <DonneesStructurees graphe={GRAPHE} />

      {/* ================= HERO ================= */}
      <section>
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16 lg:pt-20 lg:pb-24">
          <div>
            <p className="surtitre apparition">
              Critères officiels 2026 · {EMBEDDED_OPCOS.length} OPCO · gratuit, sans inscription
            </p>
            <h1 className="apparition mt-6 text-affiche text-texte" style={delai(60)}>
              Votre entreprise cotise. Votre formation peut être <span className="mark">prise en charge</span>.
            </h1>
            <p className="apparition mt-7 max-w-xl text-chapeau text-texte-doux" style={delai(140)}>
              Chaque année, votre entreprise verse une contribution à la formation professionnelle. Son OPCO peut en
              retour financer une formation, et d&apos;autres financeurs s&apos;y ajoutent&nbsp;: CPF, Région, France
              Travail, Transitions Pro, Agefiph, Europe. Le simulateur passe ces aides en revue et garde celles qui
              correspondent à votre projet.
            </p>
            <div className="apparition mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" style={delai(220)}>
              <Button href="/simulateur" size="lg" fleche pleineLargeur="mobile">
                Trouver mes financements
              </Button>
              <Button href="/comprendre-les-opco" variant="ghost" size="lg">
                D&apos;abord comprendre
              </Button>
            </div>
            <p className="apparition mt-5 max-w-md text-sm text-texte-discret" style={delai(280)}>
              Chaque aide est donnée avec sa source officielle et son niveau de fiabilité. Ce qui est estimé est dit comme
              tel.
            </p>
          </div>
          <PlanDeFinancement />
        </div>
      </section>

      {/* ================= PAR PROFIL ================= */}
      <Section
        id="profils"
        repere="01 · Par profil"
        titre="Partez de votre situation"
        chapeau="Les financements ne sont pas les mêmes pour un employeur, un salarié ou une personne qui cherche un emploi. Chaque page dit qui paie quoi, à quelles conditions, avec les sources."
      >
        <ul className="grid border-b border-filet sm:grid-cols-2 sm:gap-x-12">
          {PROFILS.map((p) => (
            <li key={p.href} className="group relative border-t border-filet py-5">
              <h3 className="pr-8 text-xl text-texte">
                <Link href={p.href} className="lien-etendu group-hover:text-prusse">
                  {p.titre}
                </Link>
              </h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-texte-doux">{typo(p.texte)}</p>
              <Icon
                name="fleche"
                className="absolute top-6 right-0 size-5 text-prusse transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </li>
          ))}
        </ul>
      </Section>

      {/* ================= MÉTHODE ================= */}
      <Section id="methode" repere="02 · Méthode" titre="De votre SIREN à votre plan de financement">
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {ETAPES.map((e, i) => (
            <li key={e.titre} className="border-t border-encre pt-4">
              <span aria-hidden="true" className="font-display text-5xl leading-none text-prusse italic">
                {i + 1}
              </span>
              <h3 className="mt-4 text-xl text-texte">
                <span className="sr-only">Étape {i + 1} : </span>
                {e.titre}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-texte-doux">{typo(e.texte)}</p>
            </li>
          ))}
        </ol>

        <h3 className="mt-16 text-2xl text-texte">Une étiquette de fiabilité sur chaque aide</h3>
        <ul className="mt-6 border-b border-filet">
          {FIABILITE.map((f) => (
            <li key={f.confidence} className="grid gap-3 border-t border-filet py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
              <span>
                <ConfidenceBadge confidence={f.confidence} />
              </span>
              <p className="text-sm leading-relaxed text-texte-doux">{typo(f.texte)}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* ================= FINANCEURS ================= */}
      {/* Chaque phrase est vérifiée contre l'écran de résultats (W5) : plan de l'OPCO pour les projets salariés, catalogue
          d'aides évalué pour tout projet, aides groupées par financeur (DESIGN.md, sections 11 et 15). */}
      <Section
        id="financeurs"
        repere="03 · Financeurs"
        titre="Votre OPCO d'abord, puis les autres financeurs"
        chapeau="Pour former ou reconvertir un salarié, le simulateur part des barèmes de votre OPCO. Pour tout projet, il passe en revue un catalogue d'aides et vérifie, pour chacune, si votre situation remplit les critères publiés."
      >
        <ul className="grid sm:grid-cols-2 sm:gap-x-12">
          {FAMILLES.map((f) => (
            <li key={f.titre} className="border-t border-filet py-5">
              <h3 className="text-xl text-texte">{f.titre}</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-texte-doux">{typo(f.texte)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-encre pt-4 text-sm text-texte-doux">
          Former sans entamer le budget annuel de l&apos;entreprise&nbsp;: actions collectives, CPF, FSE+.{' '}
          <Link href="/former-sans-budget/" className="lien">
            Lire le guide Se former sans budget
          </Link>
        </p>
      </Section>

      {/* ================= LES 11 OPCO ================= */}
      <Section
        id="repertoire"
        repere="04 · Répertoire"
        titre={`Les ${EMBEDDED_OPCOS.length} opérateurs de compétences`}
        chapeau="En règle générale, une entreprise relève d'un seul OPCO, celui de la convention collective qu'elle applique. Chaque fiche rassemble les barèmes publiés, leur source et les dispositifs complémentaires."
        fonce
      >
        <div className="mb-4 flex justify-end">
          <Link href="/opco/" className="lien text-sm">
            Toutes les fiches
          </Link>
        </div>
        <table className="w-full border-b border-filet-fonce text-sm max-sm:block">
          <thead className="max-sm:sr-only">
            <tr className="border-b border-encre">
              <th scope="col" className="w-48 py-3 pr-4 text-left font-mono text-xs font-normal tracking-[0.06em] text-ardoise uppercase">
                Opérateur
              </th>
              <th scope="col" className="py-3 text-left font-mono text-xs font-normal tracking-[0.06em] text-ardoise uppercase">
                Branches couvertes
              </th>
              <th scope="col" className="w-8 py-3">
                <span className="sr-only">Fiche</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-filet-fonce max-sm:block">
            {OPCOS.map((o) => (
              <tr key={o.slug} className="group relative max-sm:block max-sm:py-3">
                <th scope="row" className="py-3.5 pr-4 text-left align-top max-sm:block max-sm:p-0">
                  <Link href={`/opco/${o.slug}/`} className="lien-etendu font-display text-lg font-medium text-texte group-hover:text-prusse">
                    {o.name}
                  </Link>
                </th>
                <td className="py-3.5 align-top leading-relaxed text-texte-doux max-sm:block max-sm:p-0 max-sm:pr-8">
                  {secteurs(o.secteurs)}
                </td>
                <td className="py-3.5 text-right align-top max-sm:absolute max-sm:top-3 max-sm:right-0 max-sm:p-0">
                  <Icon name="fleche" className="inline size-5 text-prusse transition-transform duration-150 group-hover:translate-x-0.5" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-sm text-texte-doux">
          <strong className="font-semibold text-texte">Vous ne connaissez pas votre OPCO&nbsp;?</strong>
          {' '}Retrouvez-le par l&apos;IDCC de votre convention collective, ou par le nom ou le SIREN de l&apos;entreprise
          dans le simulateur.{' '}
          <Link href="/quel-est-mon-opco/" className="lien">
            Trouver mon OPCO
          </Link>
        </p>
      </Section>

      {/* ================= APPEL À L'ACTION ================= */}
      <BandeAppel
        id="titre-appel"
        titre="Cinq minutes pour chiffrer votre projet."
        texte="Le nom de l'entreprise et les grandes lignes de la formation suffisent."
        libelle="Trouver mes financements"
      />

      {/* ================= QUESTIONS FRÉQUENTES ================= */}
      <Section id="faq" repere="05 · Questions" titre="Questions fréquentes">
        <QuestionsFrequentes questions={QUESTIONS} sansTitre />
      </Section>

      {/* ================= ACCOMPAGNEMENT ================= */}
      <Section id="accompagnement" repere="06 · Accompagnement" titre="Un conseiller pour monter votre dossier">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
          <div>
            <p className="max-w-xl text-chapeau text-texte-doux">
              Le simulateur vous dit ce qui est possible. Pour la suite, un conseiller formation constitue la demande de
              prise en charge avec vous et organise la formation. Décrivez votre projet, vous avez une réponse sous
              48&nbsp;h ouvrées.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button href="/contact/" variant="secondary" size="lg" pleineLargeur="mobile">
                Décrire mon projet
              </Button>
              {/* Adresse coupée n'importe où plutôt que de sortir de l'écran (espacement de texte à 320 px). */}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="lien inline-flex min-h-11 max-w-full items-center font-mono text-sm [overflow-wrap:anywhere]"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
          <div>
            <p className="font-mono text-xs tracking-[0.06em] text-ardoise uppercase">Formations proposées</p>
            <ul className="mt-3 border-b border-filet">
              {DOMAINES_DE_FORMATION.map((d) => (
                <li key={d.label} className="border-t border-filet py-2.5 font-display text-lg text-texte">
                  {d.label}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-texte-discret">
              Accompagnement assuré par{' '}
              <a href={SFG_DEVELOPPEMENT} className="lien">
                SFG Développement
              </a>
              , organisme de formation certifié Qualiopi.
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
