'use client';

import type { ReactNode } from 'react';
import type { ProfilDuGroupe } from '@opco/core';
import { Card } from '@/components/ui/Card';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { enumeration } from '@/lib/etapes';
import { STATUT_DU_PROFIL } from '@/lib/profils';
import { CompteurPersonnes } from './CompteurPersonnes';

/** Identifiant du titre d'un profil : le focus y va à l'ajout et au retrait d'un profil. */
export const idTitreProfil = (id: string) => `titre-profil-${id}`;

interface Props {
  profil: ProfilDuGroupe;
  /** Position du profil dans la liste, à partir de 1 : « Profil 2 ». */
  rang: number;
  /** Ce que le profil a déjà répondu (`pucesDuProfil`), en puces sous le titre : le statut n'y est pas, l'étiquette le dit. */
  puces: readonly string[];
  /** Ce qui manque encore à ce profil (`manquantsDuProfil`) ; dit sur la carte repliée. */
  manquants: string[];
  ouvert: boolean;
  onBasculer: () => void;
  onNombre: (nombre: number) => void;
  /** Effectif maximal de ce profil : la place que les autres profils laissent sous 99 personnes. */
  max: number;
  /** Retire le profil ; absent pour le profil principal. */
  onRetirer?: () => void;
  children: ReactNode;
}

/**
 * Carte d'un profil du groupe : titre (focalisable par programme), statut, puces de ce que le profil a répondu, compteur de
 * personnes, puis les questions du profil dans un volet qui se replie sur ces puces. Le volet reste dans la page quand il est
 * replié (`hidden`) : les champs gardent leur état. Le profil principal ne se retire pas. Sur téléphone, le compteur passe
 * sous le titre : la colonne du titre garde au moins 12 rem (`min-w-48`), car `flex-1` seul a une base de 0 et ne laisserait
 * jamais le compteur passer à la ligne (la colonne tombait à environ 70 px à 375 px).
 */
export function CarteProfil({
  profil,
  rang,
  puces,
  manquants,
  ouvert,
  onBasculer,
  onNombre,
  max,
  onRetirer,
  children,
}: Props) {
  const idCorps = `corps-profil-${profil.id}`;
  return (
    <Card as="section" aria-labelledby={idTitreProfil(profil.id)} padding="none">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-4 sm:p-5">
        <div className="min-w-48 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3
              id={idTitreProfil(profil.id)}
              tabIndex={-1}
              className="rounded-md font-display text-lg leading-snug font-bold text-texte"
            >
              Profil {rang}
            </h3>
            <Etiquette tone="turquoise">{STATUT_DU_PROFIL[profil.champs.projetType ?? 'formation_salarie']}</Etiquette>
          </div>
          {puces.length > 0 && (
            <ul role="list" className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm leading-snug text-texte-doux">
              {puces.map((puce) => (
                <li key={puce} className="flex items-start gap-1.5">
                  <span aria-hidden="true" className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-texte-doux" />
                  {puce}
                </li>
              ))}
            </ul>
          )}
          {!ouvert && manquants.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-orange-deep">
              <Icon name="info" className="mt-0.5 size-4 shrink-0" />
              <span>À compléter&nbsp;: {enumeration(manquants)}.</span>
            </p>
          )}
        </div>
        <CompteurPersonnes label="Personnes de ce profil" valeur={profil.nombre} max={max} onChange={onNombre} />
      </div>

      <div className="flex flex-wrap gap-x-5 border-t border-filet px-4 py-1 sm:px-5">
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={idCorps}
          onClick={onBasculer}
          className="lien inline-flex min-h-11 items-center gap-1.5 text-left text-sm lg:min-h-9"
        >
          <Icon
            name="chevron"
            className={cx('size-4 shrink-0 transition-transform duration-200', ouvert && 'rotate-90')}
            strokeWidth={2}
          />
          {ouvert ? 'Replier' : 'Modifier'}
          <span className="sr-only"> le profil {rang}</span>
        </button>
        {onRetirer && (
          <button
            type="button"
            onClick={onRetirer}
            className="lien inline-flex min-h-11 items-center gap-1.5 text-left text-sm lg:min-h-9"
          >
            <Icon name="fermer" className="size-4 shrink-0" strokeWidth={2} />
            Retirer ce profil
            <span className="sr-only"> {rang}</span>
          </button>
        )}
      </div>

      <div id={idCorps} hidden={!ouvert} className="border-t border-filet p-4 sm:p-5">
        {children}
      </div>
    </Card>
  );
}
