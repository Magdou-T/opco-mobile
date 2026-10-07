'use client';

import { useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { WizardState } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { SectionTitle } from '@/components/ui/SectionTitle';
import type { EtapeSite } from '@/lib/etapes';

/**
 * Titre de l'écran de résultats : il reçoit le focus quand les résultats s'affichent (WizardContainer le cherche par cet
 * identifiant, l'écran chargé à la demande le pose aussi à son montage). Ce module est dans le lot initial du simulateur :
 * il ne contient que le titre et les états d'attente et d'échec, jamais le calcul ni le catalogue d'aides.
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

/** Pose le focus sur le titre des résultats (sans faire défiler : le parcours ramène déjà le haut de l'écran à la vue). */
export function focaliserTitreResultats() {
  document.getElementById(ID_TITRE_RESULTATS)?.focus({ preventScroll: true });
}

export function TitreResultats({ chapeau }: { chapeau?: ReactNode }) {
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
 * Attente du code de l'écran de résultats (chargé à la demande) : même titre, focalisable, pour que le focus posé par le
 * parcours ne retombe pas sur la page ; squelette de la hauteur du bandeau de synthèse, sans saut de mise en page.
 */
export function ChargementResultats() {
  return (
    <div className="space-y-6" aria-busy="true">
      <TitreResultats />
      <div className="rounded-panneau border border-filet bg-white p-5 shadow-douce sm:p-8">
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
  );
}

/**
 * Le code de l'écran de résultats n'a pas pu se charger (réseau coupé, version du site remplacée) : message d'erreur et
 * nouvel essai, sans perdre les réponses. Au succès, l'écran s'affiche à la place de ce message.
 */
export function EchecChargementResultats(props: ProprietesEcranResultats) {
  const [Ecran, setEcran] = useState<ComponentType<ProprietesEcranResultats> | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [nouvelEchec, setNouvelEchec] = useState(false);

  useEffect(focaliserTitreResultats, []);

  if (Ecran) return <Ecran {...props} />;

  const reessayer = () => {
    setEnCours(true);
    import('./EcranResultats')
      .then((module) => setEcran(() => module.EcranResultats))
      .catch(() => {
        setEnCours(false);
        setNouvelEchec(true);
      });
  };

  return (
    <div className="space-y-6">
      <TitreResultats />
      <Callout tone="alerte" titre="Le calcul n'a pas pu se charger">
        Vérifiez votre connexion internet, puis réessayez : vos réponses sont conservées.
        {nouvelEchec && ' Le nouvel essai a échoué lui aussi.'}
      </Callout>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap print:hidden">
        <Button onClick={reessayer} disabled={enCours}>
          {enCours ? 'Chargement…' : 'Réessayer'}
        </Button>
        <Button variant="secondary" icone="crayon" onClick={() => props.onEdit('recap')}>
          Revenir au récapitulatif
        </Button>
      </div>
    </div>
  );
}
