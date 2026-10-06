'use client';

import { useState, useCallback, useRef } from 'react';
import { SirenSearchResult } from '@/lib/types';

// API publique de l'Etat (CORS ouvert) : appelee directement depuis le
// navigateur pour rester compatible avec un hebergement 100 % statique.
const API_BASE = 'https://recherche-entreprises.api.gouv.fr/search';

interface UseSirenLookupResult {
  results: SirenSearchResult[];
  loading: boolean;
  error: string | null;
  search: (query: string) => void;
  clear: () => void;
}

/** Extrait les codes IDCC d'un resultat brut de l'API recherche-entreprises */
function extractIdcc(raw: Record<string, unknown>): string[] {
  const listeIdcc: string[] = [];
  const pushIdcc = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach((idcc) => {
        const s = String(idcc);
        if (s && s !== '0000' && !listeIdcc.includes(s)) listeIdcc.push(s);
      });
    }
  };

  const complements = raw.complements as Record<string, unknown> | undefined;
  pushIdcc(complements?.liste_idcc);

  if (listeIdcc.length === 0) {
    const siege = raw.siege as Record<string, unknown> | undefined;
    pushIdcc(siege?.liste_idcc);
    const matching = raw.matching_etablissements as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(matching)) {
      for (const etab of matching) pushIdcc(etab.liste_idcc);
    }
  }

  return listeIdcc;
}

function transformResult(raw: Record<string, unknown>): SirenSearchResult {
  const siege = raw.siege as Record<string, unknown> | undefined;
  const complements = raw.complements as Record<string, unknown> | undefined;
  const listeIdcc = extractIdcc(raw);

  return {
    siren: String(raw.siren || ''),
    nom_complet: String(raw.nom_complet || raw.nom_raison_sociale || ''),
    siege: {
      code_postal: String(siege?.code_postal || ''),
      libelle_commune: String(siege?.libelle_commune || ''),
    },
    activite_principale: String(raw.activite_principale || ''),
    nombre_etablissements_ouverts: Number(raw.nombre_etablissements_ouverts || 0),
    liste_idcc: listeIdcc,
    convention_collective_renseignee:
      complements?.convention_collective_renseignee === true || listeIdcc.length > 0,
  };
}

export function useSirenLookup(): UseSirenLookupResult {
  const [results, setResults] = useState<SirenSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback((query: string) => {
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Abort previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!query || query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          page: '1',
          per_page: '10',
        });
        const res = await fetch(`${API_BASE}?${params}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error('Erreur lors de la recherche');
        }

        const data = await res.json();
        const rawResults = Array.isArray(data.results) ? data.results : [];
        setResults(rawResults.map((r: Record<string, unknown>) => transformResult(r)));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(
          err instanceof Error
            ? err.message
            : 'Erreur lors de la recherche d\'entreprise'
        );
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  return { results, loading, error, search, clear };
}
