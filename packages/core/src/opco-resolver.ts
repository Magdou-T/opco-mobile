import idccMap from '../data/idcc-opco-map.json';

interface IdccEntry {
  opco_slug: string;
  branche_name: string;
}

const mapping = idccMap as Record<string, IdccEntry>;

export interface ResolvedOpco {
  opcoSlug: string;
  brancheName: string;
  idcc: string;
}

/**
 * Resolve one or more IDCC codes to their OPCO.
 * Returns all unique OPCO matches.
 */
export function resolveIdccToOpco(idccCodes: string[]): ResolvedOpco[] {
  const results: ResolvedOpco[] = [];
  const seen = new Set<string>();

  for (const rawIdcc of idccCodes) {
    // Normalize: pad to 4 digits
    const idcc = rawIdcc.padStart(4, '0');
    const entry = mapping[idcc];

    if (entry && !seen.has(entry.opco_slug)) {
      seen.add(entry.opco_slug);
      results.push({
        opcoSlug: entry.opco_slug,
        brancheName: entry.branche_name,
        idcc,
      });
    }
  }

  return results;
}

/**
 * Get all IDCC entries for a given OPCO slug.
 */
export function getIdccForOpco(opcoSlug: string): { idcc: string; brancheName: string }[] {
  return Object.entries(mapping)
    .filter(([, entry]) => entry.opco_slug === opcoSlug)
    .map(([idcc, entry]) => ({ idcc, brancheName: entry.branche_name }));
}
