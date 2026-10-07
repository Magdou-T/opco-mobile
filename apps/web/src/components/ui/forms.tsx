'use client';

// ============================================================
// Champs de formulaire du simulateur, partagés par les étapes. Composants contrôlés et accessibles : chaque champ a un
// <label> relié à lui, chaque groupe de boutons un titre (role="group" + aria-labelledby), chaque bouton de choix expose
// son état par aria-pressed.
// ============================================================

import { useId } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { REGIONS_TRIEES } from '@opco/core';
import type { CodeRegion } from '@opco/core';
import { texteFr } from '@/lib/format';

/** Classes d'un champ de saisie (celles du reste du site). */
const CHAMP =
  'w-full rounded border border-rule bg-white px-4 py-3 text-ink focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft';

/**
 * Libellé d'un champ. Avec `htmlFor` c'est un <label> relié au champ de saisie ; sans lui, c'est le titre d'un groupe de
 * boutons (il porte alors un `id` que le groupe référence, voir `ChoiceGroup`). Le champ obligatoire porte un astérisque
 * visuel et la mention « obligatoire » pour les lecteurs d'écran.
 */
export function FieldLabel({
  label,
  required,
  htmlFor,
  id,
}: {
  label: ReactNode;
  required?: boolean;
  htmlFor?: string;
  id?: string;
}) {
  const contenu = (
    <>
      {label}
      {required && (
        <>
          <span className="text-alert" aria-hidden="true">
            {' '}*
          </span>
          <span className="sr-only"> (obligatoire)</span>
        </>
      )}
    </>
  );
  const classe = 'block text-sm font-medium text-ink-soft';
  return htmlFor ? (
    <label id={id} htmlFor={htmlFor} className={classe}>
      {contenu}
    </label>
  ) : (
    <p id={id} className={classe}>
      {contenu}
    </p>
  );
}

/** Groupe de boutons de choix titré par `label` (annoncé comme un groupe par les lecteurs d'écran). */
export function ChoiceGroup({
  label,
  required,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="space-y-2">
      <FieldLabel id={id} label={label} required={required} />
      {children}
    </div>
  );
}

/** Bouton de choix (bascule) : `aria-pressed` annonce s'il est choisi, la bordure et le fond le montrent aussi. */
export function ChoiceButton({
  label,
  sublabel,
  selected,
  onClick,
  compact,
}: {
  label: ReactNode;
  sublabel?: ReactNode;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded border-2 text-left text-sm transition-all ${compact ? 'px-3 py-2' : 'p-3'} ${
        selected
          ? 'border-cobalt bg-cobalt-soft font-medium text-navy'
          : 'border-rule text-ink-soft hover:border-ink-faint'
      }`}
    >
      <span className="block">{label}</span>
      {sublabel && <span className="mt-0.5 block text-xs font-normal leading-snug text-ink-soft">{sublabel}</span>}
    </button>
  );
}

/** Question « Oui / Non » ; avec `avecInconnu`, un troisième choix « Je ne sais pas » correspond à la valeur `null`. */
export function OuiNonChoix({
  label,
  value,
  onChange,
  avecInconnu,
  required,
}: {
  label: ReactNode;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  avecInconnu?: boolean;
  required?: boolean;
}) {
  return (
    <ChoiceGroup label={label} required={required}>
      <div className={`grid gap-2 ${avecInconnu ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>
        <ChoiceButton label="Oui" selected={value === true} onClick={() => onChange(true)} compact />
        <ChoiceButton label="Non" selected={value === false} onClick={() => onChange(false)} compact />
        {avecInconnu && (
          <div className="col-span-2 sm:col-span-1">
            <ChoiceButton label="Je ne sais pas" selected={value === null} onClick={() => onChange(null)} compact />
          </div>
        )}
      </div>
    </ChoiceGroup>
  );
}

/**
 * Lecture d'une saisie numérique : vide ou illisible → null ; une valeur sous `min` est refusée (null) plutôt que
 * corrigée en silence. Entier par défaut (parseInt), décimal avec `decimal`.
 */
function lireNombre(saisie: string, decimal: boolean, min: number): number | null {
  if (saisie.trim() === '') return null;
  const n = decimal ? parseFloat(saisie) : parseInt(saisie, 10);
  return Number.isFinite(n) && n >= min ? n : null;
}

/** Champ numérique : `onChange` reçoit le nombre saisi, ou null quand le champ est vide ou invalide. */
export function NumberField({
  label,
  value,
  onChange,
  required,
  decimal,
  placeholder,
  helper,
  min = 0,
}: {
  label: ReactNode;
  value: number | null;
  onChange: (value: number | null) => void;
  required?: boolean;
  decimal?: boolean;
  placeholder?: string;
  helper?: ReactNode;
  min?: number;
}) {
  const id = useId();
  const aideId = `${id}-aide`;
  return (
    <div className="space-y-2">
      <FieldLabel label={label} required={required} htmlFor={id} />
      <input
        id={id}
        type="number"
        inputMode={decimal ? 'decimal' : 'numeric'}
        min={min}
        step={decimal ? '0.01' : '1'}
        value={value ?? ''}
        onChange={(e) => onChange(lireNombre(e.target.value, !!decimal, min))}
        placeholder={placeholder}
        aria-describedby={helper ? aideId : undefined}
        className={CHAMP}
      />
      {helper && (
        <p id={aideId} className="text-xs text-ink-soft">
          {helper}
        </p>
      )}
    </div>
  );
}

/** Champ texte. */
export function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  helper,
  inputMode,
  maxLength,
  autoComplete,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  helper?: ReactNode;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  autoComplete?: string;
}) {
  const id = useId();
  const aideId = `${id}-aide`;
  return (
    <div className="space-y-2">
      <FieldLabel label={label} required={required} htmlFor={id} />
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={helper ? aideId : undefined}
        className={CHAMP}
      />
      {helper && (
        <p id={aideId} className="text-xs text-ink-soft">
          {helper}
        </p>
      )}
    </div>
  );
}

/** Case à cocher entourée d'un cadre cliquable ; `onToggle` reçoit la nouvelle valeur. */
export function CheckboxRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded border border-rule p-3 hover:bg-paper-deep">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-rule text-cobalt"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-soft">{description}</span>}
      </span>
    </label>
  );
}

/** Choix de la région : les 18 régions, métropole puis outre-mer, sur deux colonnes. À placer dans un `ChoiceGroup`. */
export function RegionPicker({
  selected,
  onSelect,
}: {
  selected: CodeRegion | null;
  onSelect: (code: CodeRegion) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {REGIONS_TRIEES.map(({ code, nom }) => (
        <ChoiceButton key={code} label={nom} selected={selected === code} onClick={() => onSelect(code)} compact />
      ))}
    </div>
  );
}

/** Début du texte des secteurs pour les listes de choix (le texte complet peut dépasser 400 caractères). */
function secteursCourts(secteurs: string, max = 90): string {
  if (secteurs.length <= max) return secteurs;
  const coupe = secteurs.slice(0, max);
  const finMot = coupe.lastIndexOf(' ');
  return `${(finMot > 0 ? coupe.slice(0, finMot) : coupe).replace(/[\s,;:]+$/, '')}…`;
}

/** Choix de l'OPCO parmi la liste fournie (nom et début des secteurs de chacun). À placer dans un `ChoiceGroup`. */
export function OpcoPicker({
  options,
  selectedSlug,
  onSelect,
}: {
  options: { slug: string; name: string; secteurs: string }[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <ChoiceButton
          key={o.slug}
          label={o.name}
          sublabel={texteFr(secteursCourts(o.secteurs))}
          selected={selectedSlug === o.slug}
          onClick={() => onSelect(o.slug)}
        />
      ))}
    </div>
  );
}
