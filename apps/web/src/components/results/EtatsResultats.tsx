'use client';

import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { WizardState } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Etiquette } from '@/components/ui/Etiquette';
import { SectionTitle } from '@/components/ui/SectionTitle';
import type { EtapeSite } from '@/lib/etapes';
import { typo } from '@/lib/format';
import { etiquettesDeSituation } from '@/lib/situation';
import { FiletTricolore } from './FiletTricolore';

/**
 * Titre de l'écran de résultats : il reçoit le focus quand les résultats s'affichent (WizardContainer le cherche par cet
 * identifiant, l'écran chargé à la demande le pose aussi à son montage). Ce module est dans le lot initial du simulateur :
 * il ne contient que l'en-tête de l'écran et les états d'attente et d'échec, jamais le calcul ni le catalogue d'aides.
 */
export const ID_TITRE_RESULTATS = 'titre-resultats';

/** Ce que le parcours passe à l'écran de résultats : l'état et les deux actions, aucune donnée calculée. */
export interface ProprietesEcranResultats {
  state: WizardState;
  /** Revenir à une étape du parcours (« Modifier mes informations », « Indiquer l'OPCO »…). */
  onEdit: (etape: EtapeSite) => void;
  /** Nouvelle simulation. */
  onReset: () => void;
}

/**
 * Les mêmes propriétés, pour l'attente du chargement : `next/dynamic` ne passe rien à son composant d'attente
 * (`loading`), qui les lit ici pour afficher l'en-tête réel. Le parcours fournit la valeur autour de l'écran.
 */
export const ContexteResultats = createContext<ProprietesEcranResultats | null>(null);

/** Pose le focus sur le titre des résultats (sans faire défiler : le parcours ramène déjà le haut de l'écran à la vue). */
export function focaliserTitreResultats() {
  document.getElementById(ID_TITRE_RESULTATS)?.focus({ preventScroll: true });
}

function TitreResultats({ chapeau }: { chapeau?: ReactNode }) {
  return (
    <SectionTitle
      as="h2"
      taille="sous-section"
      id={ID_TITRE_RESULTATS}
      titreFocusable
      surtitre="Résultat"
      titre="Votre plan de financement"
      chapeau={chapeau}
    />
  );
}

/**
 * En-tête de l'écran de résultats : titre (et nom de la formation), actions (Modifier, Imprimer) et étiquettes de la
 * situation (`etiquettesDeSituation`). Rien n'y dépend du catalogue d'aides ni du calcul : l'attente du chargement
 * l'affiche tel quel, et seul le bandeau de synthèse attend l'écran, sans saut de mise en page.
 */
export function EnTeteResultats({ state, onEdit }: Pick<ProprietesEcranResultats, 'state' | 'onEdit'>) {
  const situation = etiquettesDeSituation(state);
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <TitreResultats chapeau={state.formationNom ? typo(`Formation : ${state.formationNom}`) : undefined} />
        {/* Sous 640 px, libellés courts sur une ligne (le nom accessible reste complet) : le bandeau monte d'autant. */}
        <div className="-ml-1 flex flex-wrap gap-x-5 print:hidden sm:ml-0 sm:shrink-0">
          <Button variant="ghost" icone="crayon" onClick={() => onEdit('recap')}>
            Modifier<span className="max-sm:sr-only"> mes informations</span>
          </Button>
          <Button variant="ghost" icone="document" onClick={() => window.print()}>
            Imprimer<span className="max-sm:sr-only"> / PDF</span>
          </Button>
        </div>
      </div>

      {situation.length > 0 && (
        <ul aria-label="Votre situation" className="flex flex-wrap gap-2">
          {situation.map((e) => (
            <Etiquette key={e} as="li">
              {typo(e)}
            </Etiquette>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Attente du code de l'écran de résultats (chargé à la demande, préchargé dès le récapitulatif) : le même en-tête que
 * l'écran (titre focalisable, actions, étiquettes de la situation), pour que le focus posé par le parcours ne retombe pas
 * sur la page et que rien ne bouge à l'arrivée de l'écran ; seul le bandeau de synthèse est un squelette. La zone d'attente
 * occupe au moins la hauteur de l'écran (`min-h-svh`) : sur un grand écran, le pied de page sombre restait visible sous le
 * squelette puis sortait de la vue à l'arrivée de l'écran (décalage de mise en page de 0,23 à 0,30 à 1 280 × 900).
 */
export function ChargementResultats() {
  const proprietes = useContext(ContexteResultats);
  return (
    <div className="min-h-svh space-y-12 sm:space-y-14">
      <section aria-labelledby={ID_TITRE_RESULTATS} className="space-y-6">
        {proprietes ? <EnTeteResultats state={proprietes.state} onEdit={proprietes.onEdit} /> : <TitreResultats />}
        <div
          aria-busy="true"
          className="overflow-hidden rounded-panneau border border-filet bg-white shadow-douce"
        >
          <FiletTricolore />
          <div className="p-5 sm:p-8">
            <p role="status" className="flex items-center gap-2.5 text-sm font-medium text-texte-doux">
              <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-orange" />
              Calcul en cours…
            </p>
            <div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-lin-soft" />
              ))}
            </div>
            <div aria-hidden="true" className="mt-7 h-4 animate-pulse rounded-full bg-lin-soft" />
            <div aria-hidden="true" className="mt-4 h-10 w-2/3 animate-pulse rounded-xl bg-lin-soft" />
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Le code de l'écran de résultats n'a pas pu se charger (connexion coupée, version du site remplacée). Le chargeur de
 * Turbopack garde la promesse d'un lot qui a échoué : un nouvel essai sans recharger la page n'émet aucune requête. Les
 * réponses ne sont enregistrées nulle part (certaines sont sensibles : âge, handicap) : recharger les efface. L'écran le
 * dit et ne propose que « Recharger la page ».
 */
export function EchecChargementResultats() {
  useEffect(focaliserTitreResultats, []);
  return (
    <div className="space-y-6">
      <TitreResultats />
      <Callout tone="alerte" titre="L'écran de résultats n'a pas pu se charger">
        La connexion internet a peut-être été coupée. Rechargez la page une fois la connexion rétablie. Vos réponses ne
        sont pas conservées&nbsp;: il faudra les saisir de nouveau.
      </Callout>
      <div className="print:hidden">
        <Button onClick={() => window.location.reload()} pleineLargeur="mobile">
          Recharger la page
        </Button>
      </div>
    </div>
  );
}
