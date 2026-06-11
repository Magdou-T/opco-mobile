// Port du hook useSirenLookup de la V1 web, branché sur le client direct
// (src/lib/siren-client.ts) au lieu d'une route serveur Next.js.

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SirenSearchResult } from '@opco/core';
import { searchCompanies, SirenNetworkError } from '@/lib/siren-client';

interface UseSirenLookupResult {
  results: SirenSearchResult[];
  loading: boolean;
  error: string | null;
  /** true si la dernière erreur est un problème réseau (→ proposer le mode manuel). */
  isOffline: boolean;
  search: (query: string) => void;
  clear: () => void;
}

export function useSirenLookup(): UseSirenLookupResult {
  const [results, setResults] = useState<SirenSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const search = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }

    if (!query || query.trim().length < 2) {
      setResults([]);
      setError(null);
      setIsOffline(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const data = await searchCompanies(query, controller.signal);
        setResults(data.results || []);
        setIsOffline(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setIsOffline(err instanceof SirenNetworkError);
        setError(
          err instanceof Error
            ? err.message
            : "Erreur lors de la recherche d'entreprise",
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
    setIsOffline(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  return { results, loading, error, isOffline, search, clear };
}
