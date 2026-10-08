'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { parseResultatRechercheEntreprises } from '@opco/core';
import type { EntrepriseInfo } from '@opco/core';
import { requeteRecherche } from '@/lib/recherche';

// API publique de l'État (CORS ouvert) : appelée directement depuis le navigateur pour rester compatible avec un
// hébergement 100 % statique. Aucun appel à l'API de France Compétences : seul le lien vers leur outil est permis.
const API_BASE = 'https://recherche-entreprises.api.gouv.fr/search';

/** Délai d'attente après la dernière frappe avant d'interroger l'API. */
const DELAI_MS = 500;

const MESSAGE_RESEAU =
  'Recherche impossible : pas de connexion Internet. Vous pouvez saisir votre entreprise manuellement.';
const MESSAGE_HTTP = "Erreur lors de la recherche d'entreprise. Veuillez réessayer.";

interface UseSirenLookupResult {
  /** Entreprises trouvées, lues par `parseResultatRechercheEntreprises` (la seule interprétation du résultat brut). */
  results: EntrepriseInfo[];
  loading: boolean;
  error: string | null;
  /** Vrai quand la dernière recherche a échoué faute de réseau (`fetch` a levé une erreur), pas sur une réponse HTTP d'erreur. */
  isOffline: boolean;
  /** Vrai quand la recherche de la saisie en cours a abouti, même sans résultat (distingue « aucun résultat » de « pas encore cherché »). */
  hasSearched: boolean;
  search: (query: string) => void;
  clear: () => void;
}

export function useSirenLookup(): UseSirenLookupResult {
  const [results, setResults] = useState<EntrepriseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Quitter l'étape pendant une saisie : ni requête lancée après coup, ni requête en vol.
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    },
    [],
  );

  const search = useCallback((query: string) => {
    // Une nouvelle saisie annule l'attente et la requête précédentes.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setHasSearched(false);

    // Un SIREN ou un SIRET saisi avec des séparateurs (espaces, points, tirets) ou un préfixe part en chiffres collés.
    const requete = requeteRecherche(query);
    if (requete.length < 2) {
      setResults([]);
      setError(null);
      setIsOffline(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setIsOffline(false);

      try {
        const params = new URLSearchParams({
          q: requete,
          page: '1',
          per_page: '10',
        });
        let res: Response;
        try {
          res = await fetch(`${API_BASE}?${params}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          });
        } catch {
          if (controller.signal.aborted) return;
          // fetch ne rejette que sur une erreur réseau (hors ligne, DNS...) : une réponse HTTP d'erreur arrive plus bas.
          setIsOffline(true);
          setError(MESSAGE_RESEAU);
          setResults([]);
          return;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as { results?: unknown };
        if (controller.signal.aborted) return;
        const bruts = Array.isArray(data.results) ? (data.results as Record<string, unknown>[]) : [];
        setResults(bruts.map(parseResultatRechercheEntreprises));
        setHasSearched(true);
      } catch {
        if (controller.signal.aborted) return;
        setError(MESSAGE_HTTP);
        setResults([]);
      } finally {
        // Une requête annulée par une saisie plus récente ne coupe pas l'indicateur de la requête qui l'a remplacée.
        if (abortRef.current === controller) setLoading(false);
      }
    }, DELAI_MS);
  }, []);

  const clear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setResults([]);
    setError(null);
    setIsOffline(false);
    setHasSearched(false);
    setLoading(false);
  }, []);

  return { results, loading, error, isOffline, hasSearched, search, clear };
}
