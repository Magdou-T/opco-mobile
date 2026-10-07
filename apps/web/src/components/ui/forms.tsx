'use client';

// ============================================================
// Champs de formulaire du simulateur, dans la charte SFG (apps/web/DESIGN.md, section « Parcours du simulateur »).
// Composants contrôlés et accessibles : chaque champ a un <label> relié, chaque groupe de boutons un titre
// (role="group" + aria-labelledby), chaque bouton de choix expose son état par aria-pressed. L'aide et l'erreur se
// placent entre le libellé et le champ, reliées à lui par aria-describedby ; l'erreur apparaît dans une zone annoncée
// poliment aux lecteurs d'écran.
// ============================================================

import { useEffect, useId, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { REGIONS, REGIONS_TRIEES } from '@opco/core';
import type { CodeRegion } from '@opco/core';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { texteFr } from '@/lib/format';
import { lireNombre, saisieDuNombre } from '@/lib/saisie';

// Libellé d'un champ : composant sans état, dans son propre module (sans directive client) ; réexporté ici pour les
// importations existantes.
export { FieldLabel };

/**
 * Champ de saisie : 48 px de haut, rayon 12 px (`rounded-champ`), contour filet-fort (3,54:1 sur blanc), contour
 * orange foncé au focus (en plus de l'anneau du site), rouge quand la saisie est refusée. La couleur du texte d'exemple
 * (placeholder) vient de la règle globale du site (globals.css). Transition sans `outline-color` (DESIGN.md, section 7).
 */
const CHAMP =
  'block min-h-12 w-full rounded-champ border border-filet-fort bg-white px-4 py-2.5 text-base text-texte transition-[color,background-color,border-color] hover:border-texte-doux focus-visible:border-orange-deep aria-invalid:border-rouge';

/** Largeur d'un champ court (nombre, code postal, date) : le libellé et l'aide gardent toute la largeur. */
export type LargeurChamp = 'courte' | 'moyenne' | 'pleine';
const LARGEURS: Record<LargeurChamp, string> = {
  courte: 'max-w-[12rem]',
  moyenne: 'max-w-xs',
  pleine: '',
};

/** Identifiants reliés à un champ par aria-describedby : son aide, puis son erreur. */
function decrit(id: string, aide: boolean, erreur: boolean): string | undefined {
  const ids = [aide ? `${id}-aide` : null, erreur ? `${id}-erreur` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

/** Aide d'un champ ou d'un groupe, en texte discret (5,35:1 sur blanc). */
function Aide({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1 text-sm leading-relaxed text-texte-discret">
      {children}
    </p>
  );
}

/** Zone de l'erreur d'un champ : elle existe toujours, pour que l'erreur soit annoncée quand elle apparaît. */
function ZoneErreur({ id, erreur }: { id: string; erreur: ReactNode }) {
  return (
    <div aria-live="polite" className="[&:not(:empty)]:mt-2">
      {erreur ? (
        <p id={id} className="flex items-start gap-1.5 text-sm leading-snug font-medium text-rouge">
          <Icon name="alerte" className="mt-px size-4 shrink-0" strokeWidth={2} />
          <span>
            <span className="sr-only">Erreur : </span>
            {erreur}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Groupe de boutons de choix titré par `label` (annoncé comme un groupe par les lecteurs d'écran). */
export function ChoiceGroup({
  label,
  required,
  facultatif,
  aide,
  erreur,
  children,
  className,
}: {
  label: ReactNode;
  required?: boolean;
  facultatif?: boolean;
  aide?: ReactNode;
  erreur?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={`${id}-titre`} aria-describedby={decrit(id, !!aide, !!erreur)} className={className}>
      <FieldLabel id={`${id}-titre`} label={label} required={required} facultatif={facultatif} />
      {aide && <Aide id={`${id}-aide`}>{aide}</Aide>}
      <ZoneErreur id={`${id}-erreur`} erreur={erreur} />
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * Indicateur de sélection d'un choix : rond à contour filet-fort (3,54:1) quand il est libre, plein orange foncé avec
 * une coche blanche (5,16:1) quand il est choisi. Décoratif : l'état est porté par aria-pressed.
 */
export function IndicateurChoix({ selectionne, className }: { selectionne: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
        selectionne ? 'border-orange-deep bg-orange-deep text-white' : 'border-filet-fort bg-white group-hover:border-texte-doux',
        className,
      )}
    >
      {selectionne && <Icon name="coche" className="size-3.5" strokeWidth={3} />}
    </span>
  );
}

/**
 * Bouton de choix (bascule) en carte : `aria-pressed` annonce s'il est choisi ; la coche, le contour orange foncé et le
 * fond orange doux le montrent. `compact` pour les listes denses (régions, contrats).
 */
export function ChoiceButton({
  label,
  sublabel,
  selected,
  onClick,
  compact,
  boutonRef,
}: {
  label: ReactNode;
  sublabel?: ReactNode;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
  boutonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={boutonRef}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'group flex h-full w-full items-start gap-3 rounded-champ border text-left transition-[background-color,border-color,box-shadow] duration-150 ease-out',
        compact ? 'min-h-11 px-3.5 py-2.5' : 'min-h-14 px-4 py-3.5',
        selected
          ? 'border-orange-deep bg-orange-soft ring-1 ring-orange-deep ring-inset'
          : 'border-filet bg-white hover:border-filet-fort hover:bg-lin-soft',
      )}
    >
      <IndicateurChoix selectionne={selected} className="mt-px" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug font-semibold break-words text-texte">{label}</span>
        {sublabel && <span className="mt-1 block text-[0.8125rem] leading-snug text-texte-doux">{sublabel}</span>}
      </span>
    </button>
  );
}

/**
 * Question « Oui / Non » en groupe segmenté de pilules ; avec `avecInconnu`, un troisième choix « Je ne sais pas »
 * correspond à la valeur `null`. La valeur reste `null` pour le moteur (qui la lit comme inconnue) : c'est `inconnu`,
 * retenu par le parcours (`useWizard`, `repondre`), qui dit que l'utilisateur a choisi « Je ne sais pas ». Une question
 * sans réponse n'apparaît donc pas répondue, et une réponse « Je ne sais pas » reste choisie quand l'étape revient.
 */
export function OuiNonChoix({
  label,
  value,
  inconnu = false,
  onChange,
  avecInconnu,
  required,
  aide,
}: {
  label: ReactNode;
  value: boolean | null;
  /** L'utilisateur a répondu « Je ne sais pas » (avec `avecInconnu`). */
  inconnu?: boolean;
  onChange: (value: boolean | null) => void;
  avecInconnu?: boolean;
  required?: boolean;
  aide?: ReactNode;
}) {
  const options: { cle: string; libelle: string; valeur: boolean | null }[] = [
    { cle: 'oui', libelle: 'Oui', valeur: true },
    { cle: 'non', libelle: 'Non', valeur: false },
    ...(avecInconnu ? [{ cle: 'inconnu', libelle: 'Je ne sais pas', valeur: null }] : []),
  ];
  return (
    <ChoiceGroup label={label} required={required} aide={aide}>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-3xl border border-filet-fort bg-white p-1">
        {options.map((o) => {
          const choisi = o.valeur === null ? inconnu && value === null : value === o.valeur;
          return (
            <button
              key={o.cle}
              type="button"
              aria-pressed={choisi}
              onClick={() => onChange(o.valeur)}
              className={cx(
                'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-[color,background-color] lg:min-h-10',
                choisi ? 'bg-orange-deep text-white' : 'text-texte-doux hover:bg-lin-soft hover:text-texte',
              )}
            >
              {choisi && <Icon name="coche" className="size-4" strokeWidth={2.5} />}
              {o.libelle}
            </button>
          );
        })}
      </div>
    </ChoiceGroup>
  );
}

/**
 * Champ numérique (champ texte lu à la française par `lireNombre` : espaces de milliers, virgule ou point décimal suivi
 * de deux chiffres au plus, saisie ambiguë refusée). `euros` : montant en euros, « € » final accepté. `onChange` reçoit
 * le nombre saisi, ou null quand le champ est vide ou que la saisie est refusée ; le texte tapé reste affiché et l'erreur
 * est montrée quand l'utilisateur quitte le champ. Si la valeur change ailleurs (nouvelle entreprise), le texte la suit.
 */
export function NumberField({
  label,
  value,
  onChange,
  required,
  facultatif,
  decimal,
  euros,
  min = 0,
  max,
  placeholder,
  helper,
  largeur = 'courte',
}: {
  label: ReactNode;
  value: number | null;
  onChange: (value: number | null) => void;
  required?: boolean;
  facultatif?: boolean;
  decimal?: boolean;
  euros?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  helper?: ReactNode;
  largeur?: LargeurChamp;
}) {
  const id = useId();
  const regles = { decimal, euros, min, max };
  const [texte, setTexte] = useState(() => saisieDuNombre(value));
  const [valeurVue, setValeurVue] = useState(value);
  const [quitte, setQuitte] = useState(false);
  if (value !== valeurVue) {
    // Valeur changée hors du champ : le texte la suit, sauf s'il la représente déjà (« 1500,0 » pour 1500).
    setValeurVue(value);
    if (lireNombre(texte, regles).valeur !== value) setTexte(saisieDuNombre(value));
  }
  const erreur = quitte ? lireNombre(texte, regles).erreur : null;
  return (
    <div>
      <FieldLabel label={label} required={required} facultatif={facultatif} htmlFor={id} />
      {helper && <Aide id={`${id}-aide`}>{helper}</Aide>}
      <ZoneErreur id={`${id}-erreur`} erreur={erreur} />
      <input
        id={id}
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={texte}
        onChange={(e) => {
          const saisie = e.target.value;
          const lu = lireNombre(saisie, regles).valeur;
          setTexte(saisie);
          setValeurVue(lu);
          onChange(lu);
        }}
        onBlur={() => setQuitte(true)}
        placeholder={placeholder}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decrit(id, !!helper, !!erreur)}
        className={cx(CHAMP, 'mt-2', LARGEURS[largeur])}
      />
    </div>
  );
}

/** Champ texte, avec une icône facultative en tête (recherche). */
export function TextField({
  label,
  value,
  onChange,
  onBlur,
  required,
  facultatif,
  placeholder,
  helper,
  erreur,
  inputMode,
  maxLength,
  autoComplete,
  icone,
  largeur = 'pleine',
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  facultatif?: boolean;
  placeholder?: string;
  helper?: ReactNode;
  erreur?: ReactNode;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  autoComplete?: string;
  icone?: IconName;
  largeur?: LargeurChamp;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} required={required} facultatif={facultatif} htmlFor={id} />
      {helper && <Aide id={`${id}-aide`}>{helper}</Aide>}
      <ZoneErreur id={`${id}-erreur`} erreur={erreur} />
      <div className={cx('relative mt-2', LARGEURS[largeur])}>
        {icone && (
          <Icon name={icone} className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-texte-discret" />
        )}
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit(id, !!helper, !!erreur)}
          className={cx(CHAMP, icone && 'pl-12')}
        />
      </div>
    </div>
  );
}

/** Liste déroulante native (accessible partout), au dessin des champs, chevron à droite. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  facultatif,
  helper,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { valeur: string; libelle: string }[];
  required?: boolean;
  facultatif?: boolean;
  helper?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel label={label} required={required} facultatif={facultatif} htmlFor={id} />
      {helper && <Aide id={`${id}-aide`}>{helper}</Aide>}
      <div className="relative mt-2">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={decrit(id, !!helper, false)}
          className={cx(CHAMP, 'cursor-pointer appearance-none pr-11')}
        >
          {options.map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {o.libelle}
            </option>
          ))}
        </select>
        <Icon
          name="chevron"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 rotate-90 text-texte-doux"
        />
      </div>
    </div>
  );
}

/**
 * Case à cocher dans une carte cliquable ; `onToggle` reçoit la nouvelle valeur. La couleur de la case native
 * (accent-color) vient de la règle globale du site (globals.css).
 */
export function CheckboxRow({
  label,
  description,
  checked,
  onToggle,
  icone,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  icone?: IconName;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cx(
        'flex cursor-pointer items-start gap-3 rounded-champ border p-4 transition-colors',
        checked
          ? 'border-orange-deep bg-orange-soft ring-1 ring-orange-deep ring-inset'
          : 'border-filet bg-white hover:border-filet-fort hover:bg-lin-soft',
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer"
      />
      {icone && (
        <span
          aria-hidden="true"
          className={cx(
            'grid size-9 shrink-0 place-items-center rounded-xl',
            checked ? 'bg-white text-orange-deep' : 'bg-turquoise-soft text-turquoise-deep',
          )}
        >
          <Icon name={icone} className="size-5" />
        </span>
      )}
      <span className="min-w-0 self-center">
        <span className="block text-sm leading-snug font-semibold text-texte">{label}</span>
        {description && <span className="mt-1 block text-[0.8125rem] leading-snug text-texte-doux">{description}</span>}
      </span>
    </label>
  );
}

const OUTRE_MER = (code: CodeRegion) => code.startsWith('0');

/**
 * Choix de la région : les 18 régions, métropole puis outre-mer. Avec `focusInitial`, le bouton de la région choisie
 * (à défaut le premier) prend le focus à l'ouverture. À placer dans un `ChoiceGroup`. Une seule colonne sous 360 px :
 * à deux colonnes, « Guadeloupe » (82 px) ou « Bourgogne- » ne tenaient plus dans le bouton et se coupaient en deux.
 */
export function RegionPicker({
  selected,
  onSelect,
  focusInitial = false,
}: {
  selected: CodeRegion | null;
  onSelect: (code: CodeRegion) => void;
  focusInitial?: boolean;
}) {
  const grille = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusInitial || !grille.current) return;
    const boutons = grille.current.querySelectorAll<HTMLButtonElement>('button');
    (grille.current.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? boutons[0])?.focus();
  }, [focusInitial]);
  const groupes = [
    { titre: 'Métropole', regions: REGIONS_TRIEES.filter((r) => !OUTRE_MER(r.code)) },
    { titre: 'Outre-mer', regions: REGIONS_TRIEES.filter((r) => OUTRE_MER(r.code)) },
  ];
  return (
    <div ref={grille} className="space-y-4">
      {groupes.map((g) => (
        <div key={g.titre}>
          <p className="marginalia mb-2">{g.titre}</p>
          <div className="grid gap-2 min-[360px]:grid-cols-2 md:grid-cols-3">
            {g.regions.map(({ code, nom }) => (
              <ChoiceButton key={code} label={nom} selected={selected === code} onClick={() => onSelect(code)} compact />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Région affichée avec un bouton « Modifier », ou la liste des régions tant qu'aucune n'est connue. Le focus suit le
 * contrôle qui disparaît : « Modifier » ouvre la liste sur la région choisie ; un choix referme la liste et rend le
 * focus au nom de la région retenue.
 */
export function ChampRegion({
  label,
  required,
  aide,
  valeur,
  onChange,
}: {
  label: ReactNode;
  required?: boolean;
  aide?: ReactNode;
  valeur: CodeRegion | null;
  onChange: (code: CodeRegion) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const resume = useRef<HTMLSpanElement>(null);
  const focusSurResume = useRef(false);
  useEffect(() => {
    if (focusSurResume.current && resume.current) {
      focusSurResume.current = false;
      resume.current.focus();
    }
  });
  const choisir = (code: CodeRegion) => {
    onChange(code);
    setOuvert(false);
    focusSurResume.current = true;
  };
  return (
    <ChoiceGroup label={label} required={required} aide={aide}>
      {valeur && !ouvert ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-champ border border-filet bg-lin-soft py-2 pr-2 pl-4">
          <span ref={resume} tabIndex={-1} className="flex min-h-9 items-center gap-2.5 rounded-md font-semibold text-texte">
            <Icon name="repere" className="size-5 shrink-0 text-turquoise-deep" />
            {REGIONS[valeur]}
          </span>
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="lien inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm"
          >
            <Icon name="crayon" className="size-4" />
            Modifier<span className="sr-only"> la région</span>
          </button>
        </div>
      ) : (
        <RegionPicker selected={valeur} onSelect={choisir} focusInitial={ouvert} />
      )}
    </ChoiceGroup>
  );
}

/** Choix de l'OPCO : nom et secteurs complets de chacun (retour à la ligne, aucune coupe). À placer dans un `ChoiceGroup`. */
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
          sublabel={texteFr(o.secteurs)}
          selected={selectedSlug === o.slug}
          onClick={() => onSelect(o.slug)}
        />
      ))}
    </div>
  );
}
