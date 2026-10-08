import type { ReactNode } from 'react';
import { BandeAppel } from '@/components/site/BandeAppel';
import { Sommaire } from '@/components/site/Sommaire';
import { TitreDeSection } from '@/components/site/TitreDeSection';
import { Callout as Encadre } from '@/components/ui/Callout';
import type { CalloutTone } from '@/components/ui/Callout';
import { typo } from '@/lib/format';
import { typoDesEnfants } from '@/lib/typographie';

/* Blocs éditoriaux partagés par les guides (comprendre-les-opco, obligations, former-sans-budget). Les textes sont ceux
   des pages, vérifiés contre leurs sources (W7) : ces composants ne fixent que la mise en page. Voir DESIGN.md,
   section 16. */

export function GuideHero({ eyebrow, title, lead }: { eyebrow: string; title: ReactNode; lead: string }) {
  return (
    <header className="border-b border-filet/70">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 md:pt-14 md:pb-16">
        <p className="surtitre">{eyebrow}</p>
        <h1 className="mt-5 max-w-4xl text-affiche font-bold text-texte">{typoDesEnfants(title)}</h1>
        <p className="mt-6 max-w-2xl text-chapeau text-texte-doux">{typo(lead)}</p>
      </div>
    </header>
  );
}

/**
 * Section numérotée d'un guide : jalon turquoise au numéro #1A1A1A (5,68:1), titre `h2` focalisable (le sommaire y
 * pose le focus), texte courant mesuré (34 rem : 65 à 70 caractères par ligne pleine en Inter 16 px, mesuré dans
 * Chrome), puces turquoise. Les tableaux et les cartes gardent toute la largeur de la colonne.
 */
export function GuideSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: ReactNode;
}) {
  const idTitre = `titre-${id}`;
  return (
    <section id={id} aria-labelledby={idTitre} className="rule-double pt-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="amount mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-turquoise text-sm text-texte sm:size-11"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <TitreDeSection id={idTitre} titre={typo(title)} />
        </div>
      </div>
      <div className="mt-6 space-y-5 text-base leading-relaxed text-texte-doux marker:text-turquoise [&_strong]:font-semibold [&_strong]:text-texte [&>p]:max-w-[34rem] [&>ul]:max-w-[34rem]">
        {/* Les textes des pages gardent leurs mots ; seules leurs espaces deviennent insécables là où la typographie
            française le demande (nombre et unité, « : »). */}
        {typoDesEnfants(children)}
      </div>
    </section>
  );
}

const TONS: Record<'info' | 'warn' | 'ok', CalloutTone> = {
  info: 'info',
  warn: 'avertissement',
  ok: 'confirmation',
};

/** Encadré « À savoir » d'un guide : le `Callout` du site (information, avertissement, confirmation). */
export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'ok';
  title: string;
  children: ReactNode;
}) {
  return (
    <Encadre tone={TONS[tone]} titre={typo(title)} className="max-w-[40rem]">
      {children}
    </Encadre>
  );
}

/**
 * Lien vers une source officielle : lien orange foncé souligné, nouvel onglet annoncé aux lecteurs d'écran. `titre` :
 * l'adresse complète, en infobulle, quand le lien porte un nom (« campusAtlas sur opco-atlas.fr »).
 */
export function Source({ href, titre, children }: { href: string; titre?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="lien" title={titre}>
      {children}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}

/** Bande d'appel finale d'un guide : la même que celle de l'accueil (`BandeAppel`), sur toute la largeur. */
export function GuideCta({ title, text, href, label }: { title: string; text: string; href: string; label: string }) {
  return <BandeAppel id="titre-appel-guide" titre={title} texte={typo(text)} href={href} libelle={label} />;
}

/**
 * Corps d'un guide : sommaire (colonne collante à partir de 1 024 px, bloc replié en dessous) et colonne de lecture.
 * `min-w-0` et une grille à une colonne sous 1 024 px : un tableau large ne fait plus déborder la page. À l'impression,
 * le sommaire est masqué et la grille n'a qu'une colonne, quelle que soit la largeur de la page (A4 paysage compris).
 */
export function GuideBody({
  toc,
  etiquette = 'Sommaire du guide',
  children,
}: {
  toc: { id: string; label: string }[];
  /** Nom accessible du sommaire (la page des mentions légales n'est pas un guide). */
  etiquette?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12 lg:py-14 print:grid-cols-1">
      <Sommaire entrees={toc.map((t) => ({ id: t.id, libelle: typo(t.label) }))} etiquette={etiquette} numerote />
      <div className="min-w-0 space-y-16">{children}</div>
    </div>
  );
}
