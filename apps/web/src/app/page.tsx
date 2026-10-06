import Link from 'next/link';
import type { Metadata } from 'next';
import { ALL_OPCOS } from '../../data/opcos';

export const metadata: Metadata = {
  title: 'financementOPCO : estimez le financement de votre formation par votre OPCO',
  description:
    'Simulateur gratuit basé sur les critères officiels 2026 des 11 OPCO : plafonds horaires, budgets annuels, frais annexes. Plus les guides : fonctionnement des OPCO, obligations des entreprises, formations 100 % financées.',
};

const PILLARS = [
  {
    href: '/comprendre-les-opco',
    label: 'Guide nº 1',
    title: 'Comprendre les OPCO',
    text: 'Qui sont les 11 opérateurs de compétences, comment votre entreprise est rattachée au sien, et ce qu’il peut financer, plan de développement des compétences, alternance, VAE, tutorat.',
  },
  {
    href: '/obligations',
    label: 'Guide nº 2',
    title: 'Les obligations de votre entreprise',
    text: 'Contribution formation, taxe d’apprentissage, entretiens professionnels obligatoires : ce que votre entreprise verse déjà, et pourquoi ne pas utiliser ces droits revient à payer deux fois.',
  },
  {
    href: '/former-sans-budget',
    label: 'Guide nº 3',
    title: 'Se former sans toucher au budget',
    text: 'Actions collectives, catalogues clé en main, CPF, cofinancement européen FSE+ : les dispositifs qui financent une formation sans consommer l’enveloppe annuelle de votre entreprise.',
  },
];

export default function Home() {
  return (
    <main>
      {/* ================= HERO ================= */}
      <section className="border-b border-ink">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:py-20">
          <div>
            <p className="marginalia mb-4">Simulateur · critères officiels 2026 · 11 OPCO</p>
            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Votre entreprise cotise.
              <br />
              Votre formation peut être{' '}
              <span className="mark">prise en charge</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              Chaque année, votre entreprise verse une contribution légale à la formation
              professionnelle. En face, son OPCO peut financer coûts pédagogiques, salaires
              et frais annexes, à condition de connaître les barèmes. financementOPCO les a
              rassemblés, sourcés et vérifiés.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/simulateur"
                className="rounded bg-cobalt px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy"
              >
                Estimer mon financement
              </Link>
              <Link
                href="/comprendre-les-opco"
                className="rounded border border-ink px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-paper-deep"
              >
                D&apos;abord comprendre
              </Link>
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              Gratuit, sans inscription. Chaque montant est accompagné de sa source officielle
              et d&apos;un indicateur de fiabilité.
            </p>
          </div>

          {/* Specimen de résultat, façon dossier annoté */}
          <div aria-hidden="true" className="hidden md:block">
            <div className="rotate-1 rounded border border-ink bg-white p-6 shadow-[6px_6px_0_0_var(--paper-deep)]">
              <div className="flex items-start justify-between">
                <div className="marginalia">Spécimen · estimation</div>
                <span className="stamp text-valid">Sourcé</span>
              </div>
              <div className="rule-double mt-3 pt-4">
                <div className="text-sm text-ink-soft">Formation bureautique, 35 h</div>
                <table className="amount mt-3 w-full text-sm">
                  <tbody>
                    <tr className="border-b border-rule">
                      <td className="py-2 text-ink-soft">Coûts pédagogiques</td>
                      <td className="py-2 text-right">1 750,00 €</td>
                    </tr>
                    <tr className="border-b border-rule">
                      <td className="py-2 text-ink-soft">Plafond OPCO</td>
                      <td className="py-2 text-right">25 €/h</td>
                    </tr>
                    <tr>
                      <td className="py-3 font-semibold">Prise en charge</td>
                      <td className="py-3 text-right">
                        <span className="mark font-semibold">875,00 €</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-ink-faint">
                Chaque ligne renvoie vers la page officielle de l&apos;OPCO concerné.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MÉTHODE ================= */}
      <section className="border-b border-rule bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <p className="marginalia mb-3">La méthode</p>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Des chiffres tamponnés, pas des promesses
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded border border-rule bg-paper p-5">
              <span className="stamp text-valid">Exact</span>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Le montant figure noir sur blanc sur le site officiel de l&apos;OPCO.
                Nous affichons la valeur et le lien vers la page source.
              </p>
            </div>
            <div className="rounded border border-rule bg-paper p-5">
              <span className="stamp text-alert">Estimé</span>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Le montant est reconstitué à partir de documents officiels partiels
                (barèmes de branche, plaquettes). L&apos;ordre de grandeur est fiable,
                le montant exact peut varier.
              </p>
            </div>
            <div className="rounded border border-rule bg-paper p-5">
              <span className="stamp text-ink-faint">Selon branche</span>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                L&apos;OPCO ne publie pas de barème national : le montant dépend de votre
                convention collective. Nous le disons plutôt que d&apos;inventer un chiffre.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= GUIDES ================= */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <p className="marginalia mb-3">Comprendre avant de demander</p>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Trois guides pour ne rien laisser sur la table
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PILLARS.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="group flex flex-col rounded border border-rule bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-[4px_4px_0_0_var(--marker)]"
              >
                <span className="marginalia">{p.label}</span>
                <h3 className="mt-2 font-display text-lg font-bold leading-snug group-hover:underline">
                  {p.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">{p.text}</p>
                <span className="mt-4 text-sm font-semibold text-cobalt">Lire le guide →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= LES 11 OPCO ================= */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="marginalia mb-3">Le répertoire</p>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Les 11 opérateurs de compétences
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-ink-soft">
                Chaque entreprise est rattachée à un seul OPCO, déterminé par sa convention
                collective. Retrouvez pour chacun les barèmes, conditions et dispositifs.
              </p>
            </div>
            <Link href="/opco" className="text-sm font-semibold text-cobalt hover:underline">
              Toutes les fiches →
            </Link>
          </div>
          <ul className="mt-8 grid gap-px overflow-hidden rounded border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {ALL_OPCOS.map((o) => (
              <li key={o.slug} className="bg-white">
                <Link
                  href={`/opco/${o.slug}`}
                  className="block h-full p-4 transition-colors hover:bg-marker-soft"
                >
                  <div className="font-semibold">{o.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-faint">
                    {o.secteurs}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= CONTACT ================= */}
      <section className="border-t border-rule bg-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <p className="marginalia mb-3">Nous contacter</p>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Besoin d&apos;un accompagnement humain ?
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
              Derrière financementOPCO, l&apos;équipe SFG Développement monte des dossiers de
              financement et organise des formations pour les entreprises : bureautique,
              langues, IA, santé et sécurité au travail, soft skills. Décrivez votre projet,
              nous vous répondons sous 48 h ouvrées.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <Link
              href="/contact"
              className="rounded bg-cobalt px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-navy"
            >
              Écrire à SFG Développement
            </Link>
            <a
              href="mailto:contact@sfgdeveloppement.fr"
              className="text-sm font-medium text-cobalt hover:underline"
            >
              contact@sfgdeveloppement.fr
            </a>
          </div>
        </div>
      </section>

      {/* ================= CTA FINAL ================= */}
      <section className="border-t border-ink bg-navy text-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-6">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Cinq minutes pour chiffrer votre projet
            </h2>
            <p className="mt-2 max-w-xl text-sm text-paper/70">
              Identification de votre OPCO par SIREN, calcul détaillé poste par poste,
              export imprimable à joindre à votre demande.
            </p>
          </div>
          <Link
            href="/simulateur"
            className="rounded bg-marker px-6 py-3.5 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5"
          >
            Lancer le simulateur
          </Link>
        </div>
      </section>
    </main>
  );
}
