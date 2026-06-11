// ============================================================
// Client SIREN — appel DIRECT de l'API recherche-entreprises
// (pas de route serveur en mobile).
//
// Reproduit EXACTEMENT la logique d'extraction IDCC de la V1 web
// (opco-funding/src/app/api/siren/route.ts) :
//   1. complements.liste_idcc (là où l'API stocke réellement l'IDCC)
//   2. fallback siege.liste_idcc puis matching_etablissements[].liste_idcc
//   3. exclusion du code "0000"
// ============================================================

import type { SirenSearchResult } from '@opco/core';

const API_BASE = 'https://recherche-entreprises.api.gouv.fr/search';

/** Erreur réseau typée : permet à l'UI de proposer le mode « je connais mon OPCO ». */
export class SirenNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SirenNetworkError';
  }
}

export async function searchCompanies(
  query: string,
  signal?: AbortSignal,
): Promise<{ results: SirenSearchResult[]; total_results: number }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { results: [], total_results: 0 };
  }

  const params = new URLSearchParams({
    q: trimmed,
    page: '1',
    per_page: '10',
    mtm_campaign: 'opco-calculator',
  });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}?${params}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new SirenNetworkError(
      'Recherche impossible : pas de connexion Internet. ' +
        'Vous pouvez sélectionner votre OPCO manuellement.',
    );
  }

  if (!response.ok) {
    throw new SirenNetworkError(
      "Erreur lors de la recherche d'entreprise. Veuillez réessayer.",
    );
  }

  const data = (await response.json()) as {
    results?: Record<string, unknown>[];
    total_results?: number;
  };

  const results: SirenSearchResult[] = (data.results || []).map(
    (r: Record<string, unknown>) => {
      const siege = r.siege as Record<string, unknown> | undefined;
      const complements = r.complements as Record<string, unknown> | undefined;

      // Extract IDCC from complements.liste_idcc (where the API actually stores it)
      const listeIdcc: string[] = [];
      const rawIdcc = complements?.liste_idcc;
      if (Array.isArray(rawIdcc)) {
        rawIdcc.forEach((idcc: string) => {
          if (idcc && idcc !== '0000') {
            listeIdcc.push(String(idcc));
          }
        });
      }

      // Fallback: also check siege.liste_idcc and matching_etablissements
      if (listeIdcc.length === 0) {
        const siegeIdcc = siege?.liste_idcc;
        if (Array.isArray(siegeIdcc)) {
          siegeIdcc.forEach((idcc: string) => {
            if (idcc && idcc !== '0000' && !listeIdcc.includes(String(idcc))) {
              listeIdcc.push(String(idcc));
            }
          });
        }

        const matching = r.matching_etablissements as
          | Array<Record<string, unknown>>
          | undefined;
        if (Array.isArray(matching)) {
          for (const etab of matching) {
            const etabIdcc = etab.liste_idcc;
            if (Array.isArray(etabIdcc)) {
              etabIdcc.forEach((idcc: string) => {
                if (idcc && idcc !== '0000' && !listeIdcc.includes(String(idcc))) {
                  listeIdcc.push(String(idcc));
                }
              });
            }
          }
        }
      }

      return {
        siren: String(r.siren || ''),
        nom_complet: String(r.nom_complet || r.nom_raison_sociale || ''),
        siege: {
          code_postal: String(siege?.code_postal || ''),
          libelle_commune: String(siege?.libelle_commune || ''),
        },
        activite_principale: String(r.activite_principale || ''),
        nombre_etablissements_ouverts: Number(r.nombre_etablissements_ouverts || 0),
        liste_idcc: listeIdcc,
        convention_collective_renseignee:
          complements?.convention_collective_renseignee === true || listeIdcc.length > 0,
      };
    },
  );

  return { results, total_results: Number(data.total_results || 0) };
}
