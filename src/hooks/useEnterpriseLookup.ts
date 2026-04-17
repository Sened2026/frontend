import { useState, useRef, useCallback, useEffect } from 'react';
import { MIN_ENTERPRISE_LOOKUP_QUERY_LENGTH } from '@/lib/enterprise-lookup';
import {
  readEnterpriseLookupCache,
  writeEnterpriseLookupCache,
} from '@/lib/enterprise-lookup-cache';
import { sirenService } from '@/services/api';
import type { SirenSearchResult } from '@/types';

export interface UseEnterpriseLookupOptions {
  mode: 'authenticated' | 'public';
  onSelect?: (result: SirenSearchResult) => void;
}

/** Champs qu'un résultat SIREN peut préremplir. */
const PREFILLABLE_FIELDS = [
  'company_name',
  'legal_name',
  'siren',
  'siret',
  'vat_number',
  'address',
  'postal_code',
  'city',
  'country_code',
] as const;

export type PrefillableField = (typeof PREFILLABLE_FIELDS)[number];

export interface UseEnterpriseLookupReturn {
  query: string;
  setQuery: (q: string) => void;
  results: SirenSearchResult[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  isSearching: boolean;
  isLoadingMore: boolean;
  rateLimitUntil: number | null;
  selectedResult: SirenSearchResult | null;
  prefilledFields: Set<PrefillableField>;
  search: () => Promise<void>;
  loadMore: () => Promise<void>;
  selectResult: (result: SirenSearchResult) => void;
  clearSelection: () => void;
  error: string | null;
}

export function useEnterpriseLookup(
  options: UseEnterpriseLookupOptions,
): UseEnterpriseLookupReturn {
  const { mode, onSelect } = options;

  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SirenSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [selectedResult, setSelectedResult] = useState<SirenSearchResult | null>(null);
  const [prefilledFields, setPrefilledFields] = useState<Set<PrefillableField>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const setQuery = useCallback((nextQuery: string) => {
    abortControllerRef.current?.abort();
    requestIdRef.current += 1;
    setQueryState(nextQuery);
    setResults([]);
    setTotal(0);
    setHasMore(false);
    setNextCursor(null);
    setError(null);
    setIsSearching(false);
    setIsLoadingMore(false);
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string, showErrors: boolean) => {
      const trimmed = searchQuery.trim();
      if (trimmed.length < MIN_ENTERPRISE_LOOKUP_QUERY_LENGTH) {
        abortControllerRef.current?.abort();
        setResults([]);
        setTotal(0);
        setHasMore(false);
        setNextCursor(null);
        setError(null);
        setIsSearching(false);
        setIsLoadingMore(false);
        return;
      }

      // Annuler la requête précédente
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestId = ++requestIdRef.current;

      setIsSearching(true);
      setIsLoadingMore(false);
      setError(null);

      const cachedData = readEnterpriseLookupCache(mode, trimmed);
      if (cachedData) {
        setRateLimitUntil(null);
        setResults(cachedData.items);
        setTotal(cachedData.total);
        setHasMore(cachedData.hasMore);
        setNextCursor(cachedData.nextCursor);
        setIsSearching(false);
        return;
      }

      try {
        const data = mode === 'public'
          ? await sirenService.publicLookupPaged(trimmed, undefined, null, controller.signal)
          : await sirenService.lookupPaged(trimmed, undefined, null, controller.signal);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setRateLimitUntil(null);
        setResults(data.items);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
        writeEnterpriseLookupCache(mode, trimmed, data);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return;
        }
        if (requestId !== requestIdRef.current) {
          return;
        }
        const retryAfterSeconds =
          typeof err?.retryAfterSeconds === 'number' && err.retryAfterSeconds > 0
            ? err.retryAfterSeconds
            : null;
        setRateLimitUntil(retryAfterSeconds ? Date.now() + retryAfterSeconds * 1000 : null);
        const cachedFallback = readEnterpriseLookupCache(mode, trimmed);
        if (showErrors) {
          setError(err?.message || 'Erreur lors de la recherche');
        } else {
          setError(null);
        }
        if (cachedFallback) {
          setResults(cachedFallback.items);
          setTotal(cachedFallback.total);
          setHasMore(cachedFallback.hasMore);
          setNextCursor(cachedFallback.nextCursor);
        } else {
          setResults([]);
          setTotal(0);
          setHasMore(false);
          setNextCursor(null);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    },
    [mode],
  );

  const search = useCallback(async () => {
    await performSearch(query, true);
  }, [performSearch, query]);

  const loadMore = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || !nextCursor || isLoadingMore || isSearching) {
      return;
    }

    const requestId = requestIdRef.current;
    setIsLoadingMore(true);
    setError(null);

    try {
      const data = mode === 'public'
        ? await sirenService.publicLookupPaged(trimmed, undefined, nextCursor)
        : await sirenService.lookupPaged(trimmed, undefined, nextCursor);
      if (requestId !== requestIdRef.current) {
        return;
      }

      setRateLimitUntil(null);
      setResults((previous) => [...previous, ...data.items]);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (err: any) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      const retryAfterSeconds =
        typeof err?.retryAfterSeconds === 'number' && err.retryAfterSeconds > 0
          ? err.retryAfterSeconds
          : null;
      setRateLimitUntil(retryAfterSeconds ? Date.now() + retryAfterSeconds * 1000 : null);
      setError(err?.message || 'Erreur lors de la recherche');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore, isSearching, mode, nextCursor, query]);

  const selectResult = useCallback(
    (result: SirenSearchResult) => {
      setSelectedResult(result);
      setResults([]);
      setTotal(0);
      setHasMore(false);
      setNextCursor(null);
      setQuery('');

      // Calculer les champs préremplis (ceux qui ont une valeur non vide)
      const fields = new Set<PrefillableField>();
      if (result.company_name) fields.add('company_name');
      if (result.company_name) fields.add('legal_name');
      if (result.siren) fields.add('siren');
      if (result.siret) fields.add('siret');
      if (result.vat_number) fields.add('vat_number');
      if (result.address) fields.add('address');
      if (result.postal_code) fields.add('postal_code');
      if (result.city) fields.add('city');
      if (result.country_code) fields.add('country_code');
      setPrefilledFields(fields);

      onSelect?.(result);
    },
    [onSelect],
  );

  const clearSelection = useCallback(() => {
    setSelectedResult(null);
    setPrefilledFields(new Set());
    setQuery('');
    setResults([]);
    setTotal(0);
    setHasMore(false);
    setNextCursor(null);
    setError(null);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!rateLimitUntil) {
      return;
    }

    const remainingMs = rateLimitUntil - Date.now();
    if (remainingMs <= 0) {
      setRateLimitUntil(null);
      setError((currentError) =>
        currentError?.includes('Recherche temporairement indisponible') ? null : currentError,
      );
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRateLimitUntil(null);
      setError((currentError) =>
        currentError?.includes('Recherche temporairement indisponible') ? null : currentError,
      );
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [rateLimitUntil]);

  return {
    query,
    setQuery,
    results,
    total,
    hasMore,
    nextCursor,
    isSearching,
    isLoadingMore,
    rateLimitUntil,
    selectedResult,
    prefilledFields,
    search,
    loadMore,
    selectResult,
    clearSelection,
    error,
  };
}
