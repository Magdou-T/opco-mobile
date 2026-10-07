import { Icon } from './Icon';

interface SourceBadgeProps {
  url: string;
  label?: string;
}

/**
 * Lien vers la source officielle d'un montant, en pilule : orange foncé sur blanc (5,16:1), nouvel onglet annoncé aux
 * lecteurs d'écran. Transition limitée aux couleurs du fond, du bord et du texte : l'anneau de focus apparaît d'emblée.
 */
export function SourceBadge({ url, label = 'Source' }: SourceBadgeProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full border border-filet bg-white px-2 py-0.5 text-xs font-medium text-orange-deep transition-[color,background-color,border-color] hover:border-orange-deep hover:bg-orange-soft"
      title={`Voir la source officielle : ${url}`}
    >
      <Icon name="lien-externe" className="size-3" strokeWidth={2} />
      {label}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}
