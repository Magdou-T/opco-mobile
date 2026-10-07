'use client';

import type { WizardState } from '@opco/core';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { ETAPES, etapeSautee } from '@/lib/etapes';
import type { EtapeSite } from '@/lib/etapes';

type Statut = 'faite' | 'courante' | 'a-venir' | 'sautee';

/** Ce que les lecteurs d'écran entendent après le nom de chaque étape. */
const STATUTS: Record<Statut, string> = {
  faite: 'terminée',
  courante: 'en cours',
  'a-venir': 'à venir',
  sautee: 'sans objet pour une formation à distance',
};

const LIBELLES: Record<Statut, string> = {
  faite: 'text-texte-doux group-hover:text-texte group-hover:underline',
  courante: 'font-semibold text-texte',
  'a-venir': 'text-texte-discret',
  sautee: 'text-texte-discret',
};

/**
 * Jalon d'une étape (décoratif : le nom de l'étape et son état sont dans le texte). Faite : disque turquoise de marque
 * cerclé de turquoise foncé (5,80:1 sur lin-soft ; le turquoise seul n'y fait que 2,84:1), coche encre (5,68:1). En
 * cours : disque orange foncé, numéro blanc (5,16:1), halo orangé. À venir : disque blanc au contour filet-fort
 * (3,28:1 sur lin-soft), numéro texte-discret (5,35:1). Sans objet : même dessin, contour en tirets. Le jalon est
 * entouré de la couleur du fond, qui coupe le rail (blanc sous 640 px, lin-soft au-delà).
 */
function Jalon({ statut, numero }: { statut: Statut; numero: number }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'amount grid size-7 shrink-0 place-items-center rounded-full text-xs ring-4 ring-white transition-colors duration-200 sm:size-9 sm:text-sm sm:ring-lin-soft',
        statut === 'faite' &&
          'border-2 border-turquoise-deep bg-turquoise text-texte group-hover:bg-turquoise-deep group-hover:text-white',
        statut === 'courante' && 'bg-orange-deep text-white shadow-etiquette',
        statut === 'a-venir' && 'border-2 border-filet-fort bg-white text-texte-discret',
        statut === 'sautee' && 'border-2 border-dashed border-filet-fort bg-white text-texte-discret',
      )}
    >
      {statut === 'faite' ? <Icon name="coche" className="size-3.5 sm:size-4" strokeWidth={3} /> : numero}
    </span>
  );
}

/**
 * Parcours du simulateur en 6 étapes : jalons reliés par un rail (motif « rail et jalons » de l'accueil). Liste
 * ordonnée ; l'étape en cours porte aria-current="step" ; chaque étape a un nom complet pour les lecteurs d'écran
 * (« Étape 2 sur 6 : Entreprise (en cours) »). À partir de 640 px, le libellé de chaque étape est sous son jalon ;
 * en dessous, seuls les numéros restent sur le rail et le libellé de l'étape en cours s'affiche sous le rail. Une étape
 * faite se rouvre d'un clic (cible de 44 px au moins).
 */
export function ProgressBar({
  currentStepIndex,
  state,
  onStepClick,
}: {
  currentStepIndex: number;
  state: Pick<WizardState, 'trainingMode'>;
  onStepClick?: (step: EtapeSite) => void;
}) {
  const total = ETAPES.length;
  const avancement = total > 1 ? (currentStepIndex / (total - 1)) * 100 : 0;
  return (
    <nav aria-label="Étapes du simulateur">
      <div className="relative">
        {/* Rail, du centre du premier jalon au centre du dernier ; la part parcourue en turquoise de marque. */}
        <div
          aria-hidden="true"
          className="absolute top-3 h-1 rounded-full bg-filet sm:top-4"
          style={{ left: `${50 / total}%`, right: `${50 / total}%` }}
        >
          <div
            className="h-full rounded-full bg-turquoise transition-[width] duration-500 ease-out"
            style={{ width: `${avancement}%` }}
          />
        </div>
        {/* role="list" : Safari retire la sémantique de liste d'une liste sans puces. */}
        <ol role="list" className="relative flex">
          {ETAPES.map((etape, index) => {
            const statut: Statut =
              index === currentStepIndex
                ? 'courante'
                : etapeSautee(etape.key, state)
                  ? 'sautee'
                  : index < currentStepIndex
                    ? 'faite'
                    : 'a-venir';
            const contenu = (
              <>
                <Jalon statut={statut} numero={index + 1} />
                <span
                  className={cx(
                    'sr-only text-center text-xs leading-tight sm:not-sr-only sm:mt-2 sm:block',
                    LIBELLES[statut],
                  )}
                >
                  <span className="sr-only">
                    Étape {index + 1} sur {total} :{' '}
                  </span>
                  {etape.label}
                  <span className="sr-only"> ({STATUTS[statut]})</span>
                </span>
              </>
            );
            return (
              <li
                key={etape.key}
                aria-current={statut === 'courante' ? 'step' : undefined}
                className="flex min-w-0 flex-1 justify-center"
              >
                {statut === 'faite' && onStepClick ? (
                  <button
                    type="button"
                    onClick={() => onStepClick(etape.key)}
                    className="group flex min-h-11 min-w-11 flex-col items-center rounded-xl px-1 pb-1"
                  >
                    {contenu}
                  </button>
                ) : (
                  <span className="flex min-w-11 flex-col items-center px-1 pb-1">{contenu}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <p aria-hidden="true" className="mt-2 flex items-center gap-2 text-sm sm:hidden">
        <span className="size-1.5 rounded-full bg-orange" />
        <span className="font-semibold text-texte">{ETAPES[currentStepIndex].label}</span>
      </p>
    </nav>
  );
}
