import type { Metadata } from 'next';
import { WizardContainer } from '@/components/wizard/WizardContainer';

export const metadata: Metadata = {
  title: 'Simulateur de financement OPCO',
  description:
    'Estimez en 5 étapes la prise en charge de votre formation : coûts pédagogiques, salaires, frais annexes. Basé sur les critères officiels 2026 des 11 OPCO.',
};

export default function SimulateurPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 print:hidden">
        <p className="marginalia mb-2">Simulateur · 5 étapes · ~5 minutes</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Estimez votre prise en charge
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Répondez aux questions pour obtenir une estimation détaillée, poste par poste,
          du financement de votre formation par votre OPCO. Chaque montant est accompagné
          de sa source officielle et d&apos;un tampon de fiabilité.
        </p>
      </div>
      <WizardContainer />
    </main>
  );
}
