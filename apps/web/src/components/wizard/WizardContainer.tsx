'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  ChargementResultats,
  ContexteResultats,
  EchecChargementResultats,
  ID_TITRE_RESULTATS,
} from '@/components/results/EtatsResultats';
import type { ProprietesEcranResultats } from '@/components/results/EtatsResultats';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useReserveBarreCollante } from '@/hooks/useReserveBarreCollante';
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

/** Titre de l'écran de résultats : il reçoit le focus quand les résultats s'affichent (défini avec l'écran). */
export { ID_TITRE_RESULTATS };

/**
 * Lot de l'écran de résultats : le calcul et le catalogue d'aides (environ 135 Ko gzip) ne pèsent pas sur le lot initial
 * du simulateur. Une seule fonction de chargement, appelée par `next/dynamic` au premier affichage et, plus tôt, par le
 * préchargement du récapitulatif.
 */
const chargerEcranResultats = () => import('@/components/results/EcranResultats');

/**
 * Écran de résultats chargé à la demande. Pendant le chargement, l'attente affiche déjà l'en-tête réel (titre
 * focalisable, actions, étiquettes de la situation : `ContexteResultats`) et un squelette du bandeau ; si le code ne se
 * charge pas (réseau coupé), l'écran d'échec le dit et propose de recharger la page, réponses perdues.
 */
const EcranResultats = dynamic<ProprietesEcranResultats>(
  () =>
    chargerEcranResultats()
      .then((module) => module.EcranResultats)
      .catch(() => EchecChargementResultats),
  { ssr: false, loading: () => <ChargementResultats /> },
);

/**
 * Préchargement du lot dès l'étape Récapitulatif, une seule fois par page : au clic sur « Trouver mes financements », il
 * est déjà là, même si la connexion a été coupée entre-temps. Un échec est absorbé ici : au clic, `next/dynamic` refait
 * l'appel et, s'il échoue encore, affiche l'écran d'échec.
 */
let prechargementLance = false;
function prechargerEcranResultats() {
  if (prechargementLance) return;
  prechargementLance = true;
  chargerEcranResultats().catch(() => undefined);
}

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

  // Barre de navigation collée au bas de l'écran (sous 1 024 px, hors récapitulatif) : sa hauteur est réservée au bas de
  // la zone de défilement, le focus qui y entre ne fait pas sauter la page, et un champ que la barre ou une erreur
  // viendrait masquer remonte au-dessus d'elle (useReserveBarreCollante, DESIGN.md section 14).
  const barre = useRef<HTMLDivElement>(null);
  const contenu = useRef<HTMLDivElement>(null);
  useReserveBarreCollante(barre, contenu, `${showResults}-${derniereEtape}`);

  // Récapitulatif : le lot de l'écran de résultats se charge dès maintenant (prechargerEcranResultats).
  const auRecapitulatif = currentStep.key === 'recap' && !showResults;
  useEffect(() => {
    if (auRecapitulatif) prechargerEcranResultats();
  }, [auRecapitulatif]);

  // Résultats : l'écran chargé à la demande calcule tout à partir de l'état (aucune donnée ne lui est passée) et pose le
  // focus sur son titre à son montage ; le cadre suit l'écran affiché, pour ramener son haut à la vue. Les mêmes
  // propriétés passent par `ContexteResultats` à l'attente du chargement, qui affiche l'en-tête réel.
  if (showResults) {
    const proprietes: ProprietesEcranResultats = { state, onEdit: goToStep, onReset: reset };
    return (
      <div ref={cadre}>
        <ContexteResultats value={proprietes}>
          <EcranResultats {...proprietes} />
        </ContexteResultats>
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
        <div ref={contenu} className="px-4 pt-6 pb-8 sm:px-8 sm:pt-8 lg:px-10 lg:pt-10">
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
            au défilement tant qu'elle colle (crochet plus haut) ; `barre-collante` donne à ses contrôles la marge de
            défilement négative qui annule cette réserve (globals.css). Au récapitulatif, qui se lit avant de calculer,
            la barre reste en pied de carte et les boutons s'empilent. */}
        <div
          ref={barre}
          className={cx(
            'barre-collante rounded-b-carte border-t border-filet bg-white px-4 sm:px-8 lg:px-10 lg:py-6 print:hidden',
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
                    Trouver mes financements
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
