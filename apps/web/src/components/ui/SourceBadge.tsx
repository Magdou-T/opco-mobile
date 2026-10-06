'use client';

interface SourceBadgeProps {
  url: string;
  label?: string;
}

export function SourceBadge({ url, label = 'Source' }: SourceBadgeProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded border border-rule bg-white px-2 py-0.5 text-xs font-medium text-cobalt transition-colors hover:border-cobalt hover:bg-cobalt-soft"
      title={`Voir la source officielle : ${url}`}
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {label}
    </a>
  );
}
