'use client';

import { useEffect, useRef } from 'react';
import { calculateFunding, getEmbeddedOpcoBySlug } from '@opco/core';
import { FundingBreakdown } from '@/components/results/FundingBreakdown';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SectionTitle } from '@/components/ui/SectionTitle';
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

/** Titre de l'écran de résultats : il reçoit le focus quand les résultats s'affichent (règle reprise par W5). */
export const ID_TITRE_RESULTATS = 'titre-resultats';

/** Air réservé en plus de la barre collante : l'anneau de focus (3 px, décalé de 2 px) d'un contrôle reste entier. */
const AIR_AU_DESSUS_DE_LA_BARRE = 8;

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
    reponsesInconnues,
    updateState,
    repondre,
    goNext,
    goPrev,
    goToStep,
    calculate,
    reset,
    getEffectiveOpcoSlug,
    updateFormationCosts,
  } = useWizard();

  const premiereEtape = currentStepIndex === 0;
  const derniereEtape = currentStepIndex === ETAPES.length - 1;

  // À chaque changement d'écran (étape, affichage des résultats, retour au récapitulatif) : le haut de l'écran revient
  // à la vue s'il en était sorti, et le focus passe à son titre, celui de l'étape ou celui des résultats (les lecteurs
  // d'écran l'annoncent, la tabulation repart du début). « Modifier mes informations » ramène à l'étape déjà affichée
  // avant le calcul : seul `showResults` change, d'où les deux dépendances.
  const cadre = useRef<HTMLDivElement>(null);
  const ecranAffiche = useRef({ etape: currentStepIndex, resultats: showResults });
  useEffect(() => {
    const avant = ecranAffiche.current;
    if (avant.etape === currentStepIndex && avant.resultats === showResults) return;
    ecranAffiche.current = { etape: currentStepIndex, resultats: showResults };
    const haut = cadre.current?.getBoundingClientRect().top ?? 0;
    const entete = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    if (haut < entete) {
      const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      cadre.current?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'start' });
    }
    document.getElementById(showResults ? ID_TITRE_RESULTATS : ID_TITRE_ETAPE)?.focus({ preventScroll: true });
  }, [currentStepIndex, showResults]);

  // Barre de navigation collée au bas de l'écran (sous 1 024 px, hors récapitulatif) : sa hauteur réelle est réservée
  // au bas de la zone de défilement (`scroll-padding-bottom` de html), pour qu'un contrôle qui reçoit le focus ne passe
  // jamais dessous (WCAG 2.2, critère 2.4.11). Mesurée à chaque changement de taille de la barre (phrase d'aide qui
  // s'allonge, zone de sécurité, texte agrandi), jamais écrite en dur ; retirée dès que la barre n'est plus collante
  // (1 024 px et plus, récapitulatif, résultats) et au démontage.
  const barre = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = barre.current;
    if (!element) return;
    const racine = document.documentElement;
    const reserver = () => {
      if (getComputedStyle(element).position === 'sticky') {
        const hauteur = Math.ceil(element.getBoundingClientRect().height) + AIR_AU_DESSUS_DE_LA_BARRE;
        racine.style.setProperty('scroll-padding-bottom', `${hauteur}px`);
      } else {
        racine.style.removeProperty('scroll-padding-bottom');
      }
    };
    reserver();
    const observateur = new ResizeObserver(reserver);
    observateur.observe(element);
    const grandEcran = window.matchMedia('(min-width: 64rem)');
    grandEcran.addEventListener('change', reserver);
    return () => {
      observateur.disconnect();
      grandEcran.removeEventListener('change', reserver);
      racine.style.removeProperty('scroll-padding-bottom');
    };
  }, [showResults, derniereEtape]);

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

  // Titre de l'écran de résultats, focalisable par programme (cible du focus à l'affichage des résultats).
  const titreResultats = (
    <SectionTitle
      as="h2"
      taille="sous-section"
      id={ID_TITRE_RESULTATS}
      titreFocusable
      surtitre="Résultat"
      titre="Votre estimation de financement"
    />
  );

  if (showResults && fundingResult) {
    return (
      <div ref={cadre} className="space-y-6">
        {titreResultats}
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
      <div ref={cadre} className="space-y-6">
        {titreResultats}
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
      </div>
    );
  }

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
          {currentStep.key === 'situation' && (
            <StepSituation
              state={state}
              updateState={updateState}
              reponsesInconnues={reponsesInconnues}
              repondre={repondre}
            />
          )}
          {currentStep.key === 'formation' && (
            <StepFormation
              state={state}
              updateState={updateState}
              updateFormationCosts={updateFormationCosts}
              reponsesInconnues={reponsesInconnues}
              repondre={repondre}
            />
          )}
          {currentStep.key === 'frais' && <StepFrais state={state} updateState={updateState} />}
          {currentStep.key === 'recap' && (
            <StepRecap state={state} onEdit={goToStep} reponsesInconnues={reponsesInconnues} />
          )}
        </div>

        {/* Navigation : barre collée en bas de l'écran sous 1 024 px (cibles de 44 px), en pied de carte au-delà ; son
            ombre vers le haut est teintée d'encre (jeton --encre, aucune couleur écrite en dur). Sa hauteur est réservée
            au défilement tant qu'elle colle (effet plus haut). Au récapitulatif, qui se lit avant de calculer, la barre
            reste en pied de carte et les boutons s'empilent. */}
        <div
          ref={barre}
          className={cx(
            'rounded-b-carte border-t border-filet bg-white px-4 sm:px-8 lg:px-10 lg:py-6 print:hidden',
            derniereEtape
              ? 'py-5'
              : 'sticky bottom-0 z-10 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-14px_28px_-24px_color-mix(in_srgb,var(--encre)_45%,transparent)] lg:static lg:shadow-none',
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
