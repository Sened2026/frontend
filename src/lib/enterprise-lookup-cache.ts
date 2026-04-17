import type { PaginatedSirenSearchResponse } from '@/types';

const ENTERPRISE_LOOKUP_CACHE_PREFIX = 'enterprise-lookup:v1';
const ENTERPRISE_LOOKUP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_SWEEP_KEYS = 100;

type EnterpriseLookupCacheMode = 'authenticated' | 'public';

interface EnterpriseLookupCacheEntry {
  savedAt: number;
  expiresAt: number;
  data: PaginatedSirenSearchResponse;
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildCacheKey(mode: EnterpriseLookupCacheMode, query: string): string {
  return `${ENTERPRISE_LOOKUP_CACHE_PREFIX}:${mode}:${normalizeQuery(query)}`;
}

function parseEntry(raw: string | null): EnterpriseLookupCacheEntry | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<EnterpriseLookupCacheEntry>;
    if (
      typeof parsed.savedAt !== 'number' ||
      typeof parsed.expiresAt !== 'number' ||
      !parsed.data ||
      !Array.isArray(parsed.data.items) ||
      typeof parsed.data.total !== 'number' ||
      typeof parsed.data.limit !== 'number' ||
      typeof parsed.data.hasMore !== 'boolean'
    ) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      expiresAt: parsed.expiresAt,
      data: {
        items: parsed.data.items,
        total: parsed.data.total,
        limit: parsed.data.limit,
        nextCursor: parsed.data.nextCursor ?? null,
        hasMore: parsed.data.hasMore,
      },
    };
  } catch {
    return null;
  }
}

function removeCacheKey(key: string): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function sweepExpiredEntries(): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    const now = Date.now();
    const keysToCheck: string[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(ENTERPRISE_LOOKUP_CACHE_PREFIX)) {
        continue;
      }

      keysToCheck.push(key);
      if (keysToCheck.length >= MAX_CACHE_SWEEP_KEYS) {
        break;
      }
    }

    keysToCheck.forEach((key) => {
      const entry = parseEntry(window.localStorage.getItem(key));
      if (!entry || entry.expiresAt <= now) {
        removeCacheKey(key);
      }
    });
  } catch {
    // Ignore storage sweep failures.
  }
}

export function readEnterpriseLookupCache(
  mode: EnterpriseLookupCacheMode,
  query: string,
): PaginatedSirenSearchResponse | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  const key = buildCacheKey(mode, query);

  try {
    const entry = parseEntry(window.localStorage.getItem(key));
    if (!entry) {
      removeCacheKey(key);
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      removeCacheKey(key);
      return null;
    }

    return entry.data;
  } catch {
    removeCacheKey(key);
    return null;
  }
}

export function writeEnterpriseLookupCache(
  mode: EnterpriseLookupCacheMode,
  query: string,
  data: PaginatedSirenSearchResponse,
): void {
  if (!canUseLocalStorage() || data.items.length === 0) {
    return;
  }

  const key = buildCacheKey(mode, query);
  const savedAt = Date.now();

  const entry: EnterpriseLookupCacheEntry = {
    savedAt,
    expiresAt: savedAt + ENTERPRISE_LOOKUP_CACHE_TTL_MS,
    data,
  };

  try {
    sweepExpiredEntries();
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage write failures.
  }
}
