'use client';

import { useEffect, useRef } from 'react';
import { calculateFunding, getEmbeddedOpcoBySlug } from '@opco/core';
import { FundingBreakdown } from '@/components/results/FundingBreakdown';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useWizard } from '@/hooks/useWizard';
import { cx } from '@/lib/cx';
import { ETAPES, enumeration } from '@/lib/etapes';
import { ID_TITRE_ETAPE } from './EnTeteEtape';
import { StepFormation } from './StepFormation';
import { StepFrais } from './StepFrais';
import { StepIdentification } from './StepIdentification';
import { StepProjet } from './StepProjet';
import { StepRecap } from './StepRecap';
import { StepSituation } from './StepSituation';

/** Texte qui dit ce qui manque pour continuer ; le bouton « Suivant » s'y réfère (aria-describedby). */
const ID_AIDE_SUIVANT = 'aide-suivant';

/**
 * « Suivant » tant que l'étape est incomplète : annoncé comme indisponible (aria-disabled) mais toujours atteignable au
 * clavier, pour que le texte qui dit ce qui manque soit lu avec lui ; grisé (texte-discret sur lin, 4,57:1), sans
 * reflet ni effet de survol.
 */
const SUIVANT_INDISPONIBLE =
  'aria-disabled:cursor-not-allowed aria-disabled:bg-lin aria-disabled:text-texte-discret aria-disabled:shadow-none aria-disabled:after:hidden aria-disabled:hover:bg-lin aria-disabled:active:translate-y-0';

export function WizardContainer() {
  const {
    currentStep,
    currentStepIndex,
    state,
    showResults,
    manquants,
    updateState,
    goNext,
    goPrev,
    goToStep,
    calculate,
    reset,
    getEffectiveOpcoSlug,
    updateFormationCosts,
  } = useWizard();

  // À chaque changement d'étape : le haut du parcours revient à l'écran s'il en était sorti, et le focus passe au
  // titre de la nouvelle étape (les lecteurs d'écran l'annoncent, la tabulation repart du début de l'étape).
  const cadre = useRef<HTMLDivElement>(null);
  const etapeAffichee = useRef(currentStepIndex);
  useEffect(() => {
    if (etapeAffichee.current === currentStepIndex) return;
    etapeAffichee.current = currentStepIndex;
    const haut = cadre.current?.getBoundingClientRect().top ?? 0;
    const entete = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    if (haut < entete) {
      const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      cadre.current?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' });
    }
    document.getElementById(ID_TITRE_ETAPE)?.focus({ preventScroll: true });
  }, [currentStepIndex]);

  // Calcul du financement (dérivation pure, jamais de mise à jour de l'état pendant le rendu).
  const fundingResult = (() => {
    if (!showResults) return null;
    const slug = getEffectiveOpcoSlug();
    if (!slug) return null;
    const opco = getEmbeddedOpcoBySlug(slug);
    if (!opco) return null;

    const effectiveState =
      !state.trainingDays && state.durationHours
        ? { ...state, trainingDays: Math.ceil(state.durationHours / 7) }
        : state;

    return calculateFunding(opco, effectiveState);
  })();

  if (showResults && fundingResult) {
    return (
      <div className="space-y-6">
        <FundingBreakdown result={fundingResult} />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center print:hidden">
          <Button variant="secondary" icone="crayon" onClick={() => goToStep('recap')}>
            Modifier mes informations
          </Button>
          <Button onClick={reset}>Nouvelle simulation</Button>
          <Button variant="secondary" icone="document" onClick={() => window.print()}>
            Imprimer / PDF
          </Button>
        </div>
      </div>
    );
  }

  if (showResults) {
    // Aucun OPCO (projet « former le dirigeant ») : le calcul actuel ne porte que sur la prise en charge par un OPCO.
    return (
      <Card padding="lg" className="space-y-6">
        <Callout tone="info" titre="Aucun OPCO renseigné">
          Ce calcul estime la prise en charge par un OPCO. Si l&apos;entreprise relève d&apos;un OPCO, indiquez-le à
          l&apos;étape Entreprise.
        </Callout>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button icone="batiment" onClick={() => goToStep('identification')}>
            Indiquer l&apos;OPCO
          </Button>
          <Button variant="secondary" icone="retour" onClick={() => goToStep('recap')}>
            Revenir au récapitulatif
          </Button>
        </div>
      </Card>
    );
  }

  const premiereEtape = currentStepIndex === 0;
  const derniereEtape = currentStepIndex === ETAPES.length - 1;
  const incomplete = manquants.length > 0;

  return (
    <div
      ref={cadre}
      className="sm:rounded-panneau sm:border sm:border-filet/70 sm:bg-lin-soft sm:p-5 lg:p-7"
    >
      <ProgressBar currentStepIndex={currentStepIndex} state={state} onStepClick={goToStep} />

      <Card as="section" aria-labelledby={ID_TITRE_ETAPE} padding="none" className="mt-5 sm:mt-6">
        <div className="px-4 pt-6 pb-8 sm:px-8 sm:pt-8 lg:px-10 lg:pt-10">
          {currentStep.key === 'projet' && <StepProjet state={state} updateState={updateState} />}
          {currentStep.key === 'identification' && <StepIdentification state={state} updateState={updateState} />}
          {currentStep.key === 'situation' && <StepSituation state={state} updateState={updateState} />}
          {currentStep.key === 'formation' && (
            <StepFormation state={state} updateState={updateState} updateFormationCosts={updateFormationCosts} />
          )}
          {currentStep.key === 'frais' && <StepFrais state={state} updateState={updateState} />}
          {currentStep.key === 'recap' && <StepRecap state={state} onEdit={goToStep} />}
        </div>

        {/* Navigation : barre collée en bas de l'écran sous 1 024 px (cibles de 44 px), en pied de carte au-delà. Au
            récapitulatif, qui se lit avant de calculer, la barre reste en pied de carte et les boutons s'empilent. */}
        <div
          className={cx(
            'rounded-b-carte border-t border-filet bg-white px-4 sm:px-8 lg:px-10 lg:py-6 print:hidden',
            derniereEtape
              ? 'py-5'
              : 'sticky bottom-0 z-10 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-14px_28px_-24px_rgb(15_30_27/0.45)] lg:static lg:shadow-none',
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            {incomplete && (
              <p
                id={ID_AIDE_SUIVANT}
                className="flex items-start gap-2 text-sm leading-snug text-texte-doux sm:order-2 sm:ml-auto sm:max-w-sm sm:text-right"
              >
                <Icon name="info" className="mt-px size-4 shrink-0 text-turquoise-deep sm:hidden" />
                <span>Pour continuer, indiquez {enumeration(manquants)}.</span>
              </p>
            )}
            <div className={cx('flex gap-3 sm:contents', derniereEtape ? 'flex-col' : 'items-center')}>
              {!premiereEtape && (
                <div className="sm:order-1">
                  {derniereEtape ? (
                    <Button variant="secondary" icone="retour" onClick={goPrev} pleineLargeur="mobile">
                      Retour
                    </Button>
                  ) : (
                    // Sous 640 px, flèche seule (nom « Retour » gardé pour les lecteurs d'écran) : « Suivant » garde sa ligne.
                    <Button variant="secondary" icone="retour" onClick={goPrev} className="max-sm:min-w-11 max-sm:px-3">
                      <span className="max-sm:sr-only">Retour</span>
                    </Button>
                  )}
                </div>
              )}
              <div className={`flex-1 sm:order-3 sm:flex-none ${incomplete ? '' : 'sm:ml-auto'}`}>
                {derniereEtape ? (
                  <Button
                    size="lg"
                    fleche
                    pleineLargeur="mobile"
                    onClick={calculate}
                    className="max-sm:px-4 max-sm:text-[0.9375rem]"
                  >
                    Calculer mon financement
                  </Button>
                ) : (
                  <Button
                    fleche
                    pleineLargeur="mobile"
                    onClick={incomplete ? undefined : goNext}
                    aria-disabled={incomplete || undefined}
                    aria-describedby={incomplete ? ID_AIDE_SUIVANT : undefined}
                    className={SUIVANT_INDISPONIBLE}
                  >
                    Suivant
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
