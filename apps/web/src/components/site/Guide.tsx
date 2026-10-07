import Link from 'next/link';
import type { ReactNode } from 'react';

/* Blocs éditoriaux partagés par les pages guide */

export function GuideHero({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: string;
}) {
  return (
    <header className="border-b border-ink">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
        <p className="marginalia mb-3">{eyebrow}</p>
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">{lead}</p>
      </div>
    </header>
  );
}

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
  return (
    <section id={id} className="scroll-mt-24">
      <div className="rule-double pt-6">
        <div className="flex items-baseline gap-4">
          <span className="amount text-sm font-semibold text-cobalt">{number}</span>
          <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        </div>
      </div>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink-soft [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'ok';
  title: string;
  children: ReactNode;
}) {
  const tones = {
    info: 'border-cobalt/40 bg-cobalt-soft text-navy',
    warn: 'border-alert/40 bg-alert-soft text-alert',
    ok: 'border-valid/40 bg-valid-soft text-valid',
  };
  return (
    <div className={`rounded border p-4 ${tones[tone]}`}>
      <div className="font-display text-sm font-bold">{title}</div>
      <div className="mt-1.5 text-sm leading-relaxed opacity-90">{children}</div>
    </div>
  );
}

export function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cobalt underline decoration-cobalt/40 underline-offset-2 hover:decoration-cobalt"
    >
      {children}
    </a>
  );
}

export function GuideCta({
  title,
  text,
  href,
  label,
}: {
  title: string;
  text: string;
  href: string;
  label: string;
}) {
  return (
    <div className="mt-12 rounded border border-ink bg-navy p-6 text-paper md:p-8">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 max-w-xl text-sm text-paper/70">{text}</p>
      <Link
        href={href}
        className="mt-5 inline-block rounded bg-marker px-5 py-3 text-sm font-bold text-ink transition-transform hover:-translate-y-0.5"
      >
        {label}
      </Link>
    </div>
  );
}

/** Sommaire latéral collant */
export function GuideToc({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="Sommaire" className="hidden lg:block">
      <div className="sommaire-collant rounded border border-rule bg-white p-4">
        <div className="marginalia mb-3">Sommaire</div>
        <ol className="space-y-2 text-sm">
          {items.map((item, i) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="flex gap-2 text-ink-soft hover:text-cobalt">
                <span className="amount text-xs text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

export function GuideBody({
  toc,
  children,
}: {
  toc: { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)]">
      <GuideToc items={toc} />
      <div className="max-w-3xl space-y-12">{children}</div>
    </div>
  );
}
