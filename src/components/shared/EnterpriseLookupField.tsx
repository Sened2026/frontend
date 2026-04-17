import { useRef, useEffect, useState } from 'react';
import { Search, X, Building2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useEnterpriseLookup, type UseEnterpriseLookupOptions } from '@/hooks/useEnterpriseLookup';
import { MIN_ENTERPRISE_LOOKUP_QUERY_LENGTH } from '@/lib/enterprise-lookup';
import type { SirenSearchResult } from '@/types';
import { cn } from '@/lib/utils';

interface EnterpriseLookupFieldProps {
  mode: UseEnterpriseLookupOptions['mode'];
  onSelect: (result: SirenSearchResult) => void;
  onClear: () => void;
  selectedName?: string;
  compact?: boolean;
  className?: string;
  label?: string;
  placeholder?: string;
}

export function EnterpriseLookupField({
  mode,
  onSelect,
  onClear,
  selectedName,
  compact = false,
  className,
  label = 'Rechercher une entreprise',
  placeholder = 'Nom, SIREN ou SIRET...',
}: EnterpriseLookupFieldProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    query,
    setQuery,
    results,
    total,
    hasMore,
    isLoadingMore,
    isSearching,
    rateLimitUntil,
    selectedResult,
    search,
    loadMore,
    selectResult,
    clearSelection,
    error,
  } = useEnterpriseLookup({
    mode,
    onSelect,
  });

  const hasSelection = !!selectedResult || !!selectedName;
  const [now, setNow] = useState(() => Date.now());
  const retryAfterRemaining = rateLimitUntil
    ? Math.max(0, Math.ceil((rateLimitUntil - now) / 1000))
    : 0;
  const isRateLimited = retryAfterRemaining > 0;
  const displayError = isRateLimited
    ? `Recherche temporairement indisponible, réessayez dans ${retryAfterRemaining} s.`
    : error;
  const isSearchDisabled =
    isSearching || isLoadingMore || isRateLimited || query.trim().length < MIN_ENTERPRISE_LOOKUP_QUERY_LENGTH;

  const handleClear = () => {
    clearSelection();
    onClear();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isSearchDisabled) {
        void search();
      }
    }
  };

  useEffect(() => {
    if (!rateLimitUntil || rateLimitUntil <= Date.now()) {
      setNow(Date.now());
      return;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow >= rateLimitUntil) {
        window.clearInterval(intervalId);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [rateLimitUntil]);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        // Ne pas vider les résultats si on clique en dehors, juste fermer
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (hasSelection) {
    return (
      <div className={cn('space-y-2', className)}>
        {!compact && <Label>{label}</Label>}
        <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 bg-blue-50">
          <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
              Données récupérées
            </Badge>
            <p className="text-sm font-medium text-blue-900 mt-1 truncate">
              {selectedResult?.company_name || selectedName}
            </p>
            {selectedResult?.siren && (
              <p className="text-xs text-blue-600">
                SIREN: {selectedResult.siren}
                {selectedResult.siret && ` · SIRET: ${selectedResult.siret}`}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 shrink-0"
          >
            <X className="h-4 w-4 mr-1" />
            Réinitialiser
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)} ref={dropdownRef}>
      {!compact && <Label>{label}</Label>}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="pl-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void search()}
            disabled={isSearchDisabled}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Pour de meilleurs résultats et moins de blocages, privilégiez la recherche par SIREN/SIRET.
        </p>

        {displayError && (
          <p className="text-sm text-destructive mt-1">{displayError}</p>
        )}

        {results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/30">
              {results.length} résultat{results.length > 1 ? 's' : ''} affiché{results.length > 1 ? 's' : ''}
              {total > 0 ? ` sur ${total}` : ''}
            </div>
            {results.map((result, index) => (
              <button
                key={`${result.siren}-${index}`}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
                onClick={() => selectResult(result)}
              >
                <div className="font-medium text-sm">{result.company_name}</div>
                <div className="text-xs text-muted-foreground">
                  SIREN: {result.siren}
                  {result.siret && ` · SIRET: ${result.siret}`}
                </div>
                {(result.address || result.city) && (
                  <div className="text-xs text-muted-foreground">
                    {[result.address, result.postal_code, result.city]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </button>
            ))}
            {hasMore && (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => void loadMore()}
                  disabled={isLoadingMore || isRateLimited}
                >
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Charger plus
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
