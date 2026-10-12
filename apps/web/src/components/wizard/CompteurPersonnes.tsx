'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { MAX_PERSONNES } from '@opco/core';
import { CHAMP } from '@/components/ui/Champ';
import { cx } from '@/lib/cx';
import { nombreEtUnite } from '@/lib/format';
import { lireEffectif } from '@/lib/groupe';
import { INSECABLE } from '@/lib/insecable';

/** Bouton rond de 44 px (40 px au-delà de 1 024 px) ; grisé par `aria-disabled` sans quitter l'ordre du clavier. */
const BOUTON =
  'grid size-11 shrink-0 place-items-center rounded-full border-2 border-filet-fort bg-white text-texte transition-[color,background-color,border-color] hover:border-texte-doux aria-disabled:cursor-not-allowed aria-disabled:border-filet aria-disabled:text-texte-discret aria-disabled:hover:border-filet lg:size-10';

/**
 * Moins (un trait) ou plus (un trait et sa croix), dessinés en CSS : le jeu d'icônes du site n'en compte pas de plus. En
 * contraste forcé (Windows), le fond `bg-current` disparaît : chaque trait y prend la couleur système du texte.
 */
function Signe({ plus = false }: { plus?: boolean }) {
  return (
    <span aria-hidden="true" className="relative block size-3.5">
      <span className="absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 rounded-full bg-current forced-colors:bg-[CanvasText]" />
      {plus && (
        <span className="absolute top-0 left-1/2 h-full w-0.5 -translate-x-1/2 rounded-full bg-current forced-colors:bg-[CanvasText]" />
      )}
    </span>
  );
}

/**
 * Nombre de personnes d'un profil : un champ entier entouré de « Retirer une personne » et « Ajouter une personne ».
 * Une saisie qui n'est pas un entier de 1 à `max` est refusée sans bruit (`lireEffectif`) : le champ garde ce qui est tapé
 * jusqu'à ce qu'on le quitte, puis reprend la valeur retenue. Les boutons ne disparaissent pas aux bornes : ils portent
 * `aria-disabled`, pour que le focus ne se perde pas. Un message poli annonce le nombre retenu, précédé du nom du profil
 * quand il est donné (« Profil 2 : 4 personnes ») ; l'aide décrit le groupe et le champ de saisie.
 */
export function CompteurPersonnes({
  label,
  valeur,
  max = MAX_PERSONNES,
  onChange,
  aide,
  nom,
}: {
  label: ReactNode;
  valeur: number;
  max?: number;
  onChange: (nombre: number) => void;
  aide?: ReactNode;
  /** Nom du profil (« Profil 2 ») : avec plusieurs cartes, l'annonce dit de quel profil il s'agit. Absent : le nombre seul. */
  nom?: string;
}) {
  const id = useId();
  const idAide = aide ? `${id}-aide` : undefined;
  const nombre = nombreEtUnite(valeur, valeur > 1 ? 'personnes' : 'personne');
  const [texte, setTexte] = useState(String(valeur));
  const [valeurVue, setValeurVue] = useState(valeur);
  if (valeur !== valeurVue) {
    // Valeur changée hors du champ (boutons, plafond de 99 personnes) : le texte la suit.
    setValeurVue(valeur);
    setTexte(String(valeur));
  }
  const retirer = () => {
    if (valeur > 1) onChange(valeur - 1);
  };
  const ajouter = () => {
    if (valeur < max) onChange(valeur + 1);
  };
  return (
    <div role="group" aria-labelledby={`${id}-titre`} aria-describedby={idAide}>
      <p id={`${id}-titre`} className="text-sm leading-snug font-semibold text-texte">
        {label}
      </p>
      {aide && (
        <p id={idAide} className="mt-1 text-sm leading-relaxed text-texte-discret">
          {aide}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={retirer} aria-disabled={valeur <= 1 || undefined} className={BOUTON}>
          <Signe />
          <span className="sr-only">Retirer une personne</span>
        </button>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-labelledby={`${id}-titre`}
          aria-describedby={idAide}
          value={texte}
          onChange={(e) => {
            const saisie = e.target.value;
            const n = lireEffectif(saisie);
            setTexte(n == null ? saisie : String(Math.min(n, max)));
            if (n != null) onChange(Math.min(n, max));
          }}
          onBlur={() => setTexte(String(valeur))}
          className={cx(CHAMP, 'max-w-[5rem] text-center')}
        />
        <button type="button" onClick={ajouter} aria-disabled={valeur >= max || undefined} className={BOUTON}>
          <Signe plus />
          <span className="sr-only">Ajouter une personne</span>
        </button>
      </div>
      <p role="status" className="sr-only">
        {nom ? `${nom}${INSECABLE}: ${nombre}` : nombre}
      </p>
    </div>
  );
}
