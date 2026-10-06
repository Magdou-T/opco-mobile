import type { Metadata } from 'next';
import Link from 'next/link';
import { ALL_OPCOS } from '../../../data/opcos';

export const metadata: Metadata = {
  title: 'Les 11 OPCO : fiches, barèmes et dispositifs 2026',
  description:
    'Fiches détaillées des 11 opérateurs de compétences : secteurs couverts, plafonds de financement 2026, frais annexes, actions collectives et conditions de prise en charge.',
};

export default function OpcoIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="marginalia mb-3">Le répertoire · critères 2026</p>
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        Les 11 opérateurs de compétences
      </h1>
      <p className="mt-4 max-w-2xl text-ink-soft">
        Chaque entreprise relève d&apos;un seul OPCO, déterminé par sa convention collective
        (code IDCC). Chaque fiche rassemble les barèmes publiés, leur source officielle et les
        dispositifs qui ne consomment pas votre budget formation.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {ALL_OPCOS.map((o) => (
          <Link
            key={o.slug}
            href={`/opco/${o.slug}`}
            className="group flex flex-col rounded border border-rule bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-[4px_4px_0_0_var(--marker)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-bold group-hover:underline">{o.name}</h2>
              <span className="marginalia">{o.slug}</span>
            </div>
            {o.nom_complet && (
              <p className="mt-1 text-sm font-medium text-ink-soft">{o.nom_complet}</p>
            )}
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-faint">
              {o.secteurs}
            </p>
            <span className="mt-4 text-sm font-semibold text-cobalt">
              Barèmes et dispositifs →
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-12 rounded border border-rule bg-white p-6">
        <h2 className="font-display font-bold">Vous ne savez pas de quel OPCO vous relevez ?</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Le simulateur identifie votre OPCO à partir du nom ou du SIREN de votre entreprise,
          via la base officielle des conventions collectives.
        </p>
        <Link
          href="/simulateur"
          className="mt-4 inline-block rounded bg-cobalt px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy"
        >
          Identifier mon OPCO
        </Link>
      </div>
    </main>
  );
}
